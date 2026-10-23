-- SwingFlow baseline KPI report (fallback: no was_timely / ambiguous_candle_flag required)
-- Edit baseline timestamp once, then run.
WITH params AS (
  SELECT (extract(epoch FROM timestamptz '2026-04-27 09:30:00-04') * 1000)::bigint AS baseline_ms
),

setups_base AS (
  SELECT ts.*
  FROM trade_setups ts, params p
  WHERE ts.detected_at >= p.baseline_ms
),

generated AS (
  SELECT COUNT(*)::int AS setups_generated
  FROM setups_base
),

triggered AS (
  SELECT COUNT(*)::int AS setups_triggered
  FROM setups_base
  WHERE status IN ('TRIGGERED', 'TARGET_HIT', 'STOPPED', 'COMPLETED')
),

outcomes AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'TARGET_HIT')::int AS target_hit_count,
    COUNT(*) FILTER (WHERE status = 'STOPPED')::int AS stopped_count
  FROM setups_base
),

resolved AS (
  SELECT realized_pnl, strategy
  FROM setups_base
  WHERE status IN ('TARGET_HIT', 'STOPPED')
    AND realized_pnl IS NOT NULL
),

expectancy_global AS (
  SELECT
    COUNT(*)::int AS resolved_trades,
    COUNT(*) FILTER (WHERE realized_pnl > 0)::int AS wins,
    COUNT(*) FILTER (WHERE realized_pnl < 0)::int AS losses,
    AVG(realized_pnl) FILTER (WHERE realized_pnl > 0) AS avg_win,
    AVG(ABS(realized_pnl)) FILTER (WHERE realized_pnl < 0) AS avg_loss
  FROM resolved
),

winrate AS (
  SELECT
    ROUND(
      100.0 * (eg.wins::numeric / NULLIF(eg.resolved_trades, 0)),
      2
    ) AS win_rate_pct
  FROM expectancy_global eg
),

expectancy_calc AS (
  SELECT
    ROUND(
      (
        (COALESCE(eg.wins::numeric / NULLIF(eg.resolved_trades,0), 0) * COALESCE(eg.avg_win,0))
        -
        (COALESCE(eg.losses::numeric / NULLIF(eg.resolved_trades,0), 0) * COALESCE(eg.avg_loss,0))
      )::numeric,
      2
    ) AS expectancy_global
  FROM expectancy_global eg
),

scan_errors AS (
  SELECT COUNT(*)::int AS scan_error_count
  FROM scan_evaluations se, params p
  WHERE se.created_at >= p.baseline_ms
    AND se.result = 'ERROR'
),

-- Delivery success proxy using existing notification_attempts.success
notif AS (
  SELECT
    COUNT(*)::int AS notification_attempts_count,
    COUNT(*) FILTER (WHERE success = true)::int AS delivered_attempt_count,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE success = true)::numeric / NULLIF(COUNT(*), 0),
      2
    ) AS notification_delivery_pct
  FROM notification_attempts na, params p
  WHERE na.attempted_at >= p.baseline_ms
),

expectancy_by_strategy AS (
  SELECT
    strategy,
    ROUND(
      (
        (COALESCE((COUNT(*) FILTER (WHERE realized_pnl > 0))::numeric / NULLIF(COUNT(*),0),0) * COALESCE(AVG(realized_pnl) FILTER (WHERE realized_pnl > 0),0))
        -
        (COALESCE((COUNT(*) FILTER (WHERE realized_pnl < 0))::numeric / NULLIF(COUNT(*),0),0) * COALESCE(AVG(ABS(realized_pnl)) FILTER (WHERE realized_pnl < 0),0))
      )::numeric,
      2
    ) AS expectancy
  FROM resolved
  GROUP BY strategy
),

expectancy_strategy_json AS (
  SELECT COALESCE(
    jsonb_object_agg(strategy, expectancy),
    '{}'::jsonb
  ) AS expectancy_per_strategy
  FROM expectancy_by_strategy
)

SELECT
  to_timestamp(p.baseline_ms / 1000.0) AS baseline_start_utc,
  g.setups_generated,
  t.setups_triggered,
  o.target_hit_count,
  o.stopped_count,
  wr.win_rate_pct,
  ec.expectancy_global,
  n.notification_attempts_count,
  n.delivered_attempt_count,
  n.notification_delivery_pct,
  se.scan_error_count,
  esj.expectancy_per_strategy
FROM params p
CROSS JOIN generated g
CROSS JOIN triggered t
CROSS JOIN outcomes o
CROSS JOIN winrate wr
CROSS JOIN expectancy_calc ec
CROSS JOIN notif n
CROSS JOIN scan_errors se
CROSS JOIN expectancy_strategy_json esj;