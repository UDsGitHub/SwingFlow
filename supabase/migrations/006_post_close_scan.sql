-- ============================================================
-- SwingFlow — Post-close scan: setup signal dates + duplicate guard
-- ============================================================

-- ET trading date of the completed daily bar that produced the setup.
-- Setups expire a fixed number of trading days after this date if never filled.
ALTER TABLE trade_setups
  ADD COLUMN IF NOT EXISTS signal_date DATE;

-- At most one ACTIVE setup per user + symbol + strategy, even when scans overlap.
CREATE UNIQUE INDEX IF NOT EXISTS uq_trade_setups_one_active
  ON trade_setups (user_id, symbol, strategy)
  WHERE status = 'ACTIVE';

-- One row per scheduled scan per trading session. The unique key doubles as a lock so
-- overlapping instances (cron, startup catch-up, old + new container during a deploy)
-- cannot run the same post-close scan twice.
CREATE TABLE IF NOT EXISTS scan_runs (
  id            BIGSERIAL PRIMARY KEY,
  kind          TEXT NOT NULL,                    -- 'POST_CLOSE'
  session_date  DATE NOT NULL,                    -- ET trading date the scan judges
  status        TEXT NOT NULL DEFAULT 'RUNNING',  -- RUNNING | DONE | MARKET_CLOSED | FAILED
  started_at    BIGINT NOT NULL,
  finished_at   BIGINT,
  users         INTEGER,
  setups        INTEGER,
  expired       INTEGER,
  error         TEXT,
  UNIQUE (kind, session_date),
  CONSTRAINT scan_runs_status_chk CHECK (status IN ('RUNNING', 'DONE', 'MARKET_CLOSED', 'FAILED'))
);

-- Server-only table: no policies, so only the service role can read or write it.
ALTER TABLE scan_runs ENABLE ROW LEVEL SECURITY;
