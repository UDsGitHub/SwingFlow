-- SwingFlow KPI report: paper (strategy) record and real (user) record since a baseline.
-- Edit the baseline timestamp once, then run in the Supabase SQL editor.
WITH params AS (
  SELECT
    (extract(epoch FROM timestamptz '2026-10-26 09:30:00-04') * 1000)::bigint AS baseline_ms,
    DATE '2026-10-26' AS baseline_date
),

setups_base AS (
  SELECT ts.* FROM trade_setups ts, params p WHERE ts.detected_at >= p.baseline_ms
),

-- Paper lifecycle: how setups resolved under the backtest's rules.
paper_funnel AS (
  SELECT
    COUNT(*)::int                                          AS setups_generated,
    COUNT(*) FILTER (WHERE status = 'ACTIVE')::int         AS waiting_for_entry,
    COUNT(*) FILTER (WHERE status = 'TRIGGERED')::int      AS paper_open,
    COUNT(*) FILTER (WHERE status = 'CLOSED')::int         AS paper_closed,
    COUNT(*) FILTER (WHERE status = 'EXPIRED')::int        AS expired_no_fill,
    COUNT(*) FILTER (WHERE status = 'SKIPPED')::int        AS skipped_gap
  FROM setups_base
),

paper_closed AS (
  SELECT strategy, paper_r, paper_exit_reason, sessions_held
  FROM setups_base
  WHERE status = 'CLOSED' AND paper_r IS NOT NULL
),

-- The live edge: compare with the backtest's out-of-sample +0.23R for Reversal.
paper_stats AS (
  SELECT
    COUNT(*)::int                                                       AS closed_trades,
    ROUND(100.0 * COUNT(*) FILTER (WHERE paper_r > 0) / NULLIF(COUNT(*), 0), 1) AS win_rate_pct,
    ROUND(AVG(paper_r)::numeric, 3)                                     AS expectancy_r,
    ROUND(AVG(sessions_held)::numeric, 1)                               AS avg_hold_sessions
  FROM paper_closed
),

paper_by_strategy AS (
  SELECT COALESCE(jsonb_object_agg(strategy, expectancy), '{}'::jsonb) AS expectancy_r_per_strategy
  FROM (SELECT strategy, ROUND(AVG(paper_r)::numeric, 3) AS expectancy FROM paper_closed GROUP BY strategy) s
),

paper_by_exit AS (
  SELECT COALESCE(jsonb_object_agg(paper_exit_reason, n), '{}'::jsonb) AS exits_by_reason
  FROM (SELECT paper_exit_reason, COUNT(*)::int AS n FROM paper_closed GROUP BY paper_exit_reason) e
),

-- Real trades the user recorded.
real_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE t.status = 'CLOSED')::int                     AS real_closed,
    COUNT(*) FILTER (WHERE t.status = 'OPEN')::int                       AS real_open,
    ROUND(100.0 * COUNT(*) FILTER (WHERE t.status = 'CLOSED' AND t.realized_pnl > 0)
          / NULLIF(COUNT(*) FILTER (WHERE t.status = 'CLOSED'), 0), 1)   AS real_win_rate_pct,
    ROUND(COALESCE(SUM(t.realized_pnl) FILTER (WHERE t.status = 'CLOSED'), 0)::numeric, 2) AS real_total_pnl
  FROM trades t, params p
  WHERE t.opened_at >= p.baseline_ms
),

scan_errors AS (
  SELECT COUNT(*)::int AS scan_error_count
  FROM scan_evaluations se, params p
  WHERE se.created_at >= p.baseline_ms AND se.result = 'ERROR'
),

scans AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'DONE')::int          AS post_close_scans_done,
    COUNT(*) FILTER (WHERE status = 'FAILED')::int        AS post_close_scans_failed
  FROM scan_runs sr, params p
  WHERE sr.session_date >= p.baseline_date
),

notif AS (
  SELECT
    COUNT(*)::int AS notification_attempts,
    ROUND(100.0 * COUNT(*) FILTER (WHERE success) / NULLIF(COUNT(*), 0), 1) AS notification_delivery_pct
  FROM notification_attempts na, params p
  WHERE na.attempted_at >= p.baseline_ms
)

SELECT
  to_timestamp(p.baseline_ms / 1000.0) AS baseline_start_utc,
  f.*, ps.*, pbs.expectancy_r_per_strategy, pbe.exits_by_reason,
  rs.*, se.scan_error_count, sc.*, n.*
FROM params p
CROSS JOIN paper_funnel f
CROSS JOIN paper_stats ps
CROSS JOIN paper_by_strategy pbs
CROSS JOIN paper_by_exit pbe
CROSS JOIN real_stats rs
CROSS JOIN scan_errors se
CROSS JOIN scans sc
CROSS JOIN notif n;
