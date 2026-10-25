-- ============================================================
-- SwingFlow — Paper trade tracking + real trades
-- ============================================================
-- Setups (trade_setups) now carry an automatic *paper* track that follows the same rules as
-- the backtest. Trades the user actually takes live in the new `trades` table.

-- ── 1. Remove legacy rows ─────────────────────────────────────
-- Rows created before the post-close scan (no signal_date) were scored by the old tracker,
-- which ignored gaps and only checked closes. They are not comparable and are removed.
DELETE FROM trade_setups WHERE signal_date IS NULL;

-- Any remaining row still carrying an old-tracker status cannot be mapped safely: stop here
-- so it can be reviewed instead of silently guessing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM trade_setups WHERE status NOT IN ('ACTIVE', 'TRIGGERED', 'EXPIRED')) THEN
    RAISE EXCEPTION 'trade_setups has rows with legacy statuses (TARGET_HIT/STOPPED/COMPLETED); review before migrating';
  END IF;
END $$;

-- The old ACTIVE-only uniqueness index is replaced below; drop it first so the reset cannot collide.
DROP INDEX IF EXISTS uq_trade_setups_one_active;

-- Rows the old tracker marked TRIGGERED restart as ACTIVE: the new tracker replays them from
-- their signal date (managed_through is NULL) and reaches the correct state.
UPDATE trade_setups SET status = 'ACTIVE', entry_hit_at = NULL WHERE status = 'TRIGGERED';

-- ── 2. Paper tracking state on setups ─────────────────────────
ALTER TABLE trade_setups
  ADD COLUMN IF NOT EXISTS exit_plan          JSONB,     -- exit rules snapshot at creation
  ADD COLUMN IF NOT EXISTS atr_at_signal      NUMERIC,   -- ATR14 of the signal window (trail distance)
  ADD COLUMN IF NOT EXISTS current_stop       NUMERIC,   -- rises with trail / break-even
  ADD COLUMN IF NOT EXISTS highest_high       NUMERIC,
  ADD COLUMN IF NOT EXISTS sessions_waited    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sessions_held      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paper_fill_price   NUMERIC,
  ADD COLUMN IF NOT EXISTS paper_fill_date    DATE,
  ADD COLUMN IF NOT EXISTS paper_exit_price   NUMERIC,
  ADD COLUMN IF NOT EXISTS paper_exit_date    DATE,
  ADD COLUMN IF NOT EXISTS paper_exit_reason  TEXT,
  ADD COLUMN IF NOT EXISTS paper_r            NUMERIC,
  ADD COLUMN IF NOT EXISTS managed_through    DATE,      -- last completed session applied
  ADD COLUMN IF NOT EXISTS fill_notified_at   BIGINT,    -- fill push sent (avoids repeating it in the digest)
  ADD COLUMN IF NOT EXISTS dismissed_at       BIGINT,    -- hidden by the user; paper tracking continues
  ADD COLUMN IF NOT EXISTS tracking_version   INTEGER NOT NULL DEFAULT 0;  -- compare-and-set guard

UPDATE trade_setups SET current_stop = stop WHERE current_stop IS NULL;

ALTER TABLE trade_setups DROP CONSTRAINT IF EXISTS trade_setups_status_chk;
ALTER TABLE trade_setups ADD CONSTRAINT trade_setups_status_chk
  CHECK (status IN ('ACTIVE', 'TRIGGERED', 'CLOSED', 'EXPIRED', 'SKIPPED'));

ALTER TABLE trade_setups DROP CONSTRAINT IF EXISTS trade_setups_paper_exit_reason_chk;
ALTER TABLE trade_setups ADD CONSTRAINT trade_setups_paper_exit_reason_chk
  CHECK (paper_exit_reason IS NULL OR paper_exit_reason IN ('TARGET', 'STOP', 'TRAIL_STOP', 'TIME', 'SMA', 'GAP_SKIP', 'NO_FILL'));

-- One open setup per user + symbol + strategy while it waits for entry OR its paper trade is
-- open — the backtest blocks new signals until the previous trade ends.
CREATE UNIQUE INDEX IF NOT EXISTS uq_trade_setups_one_open
  ON trade_setups (user_id, symbol, strategy)
  WHERE status IN ('ACTIVE', 'TRIGGERED');

CREATE INDEX IF NOT EXISTS idx_trade_setups_tracking ON trade_setups (status) WHERE status IN ('ACTIVE', 'TRIGGERED');

-- ── 3. Real trades ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trades (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  setup_id      UUID REFERENCES trade_setups(id) ON DELETE SET NULL,
  symbol        TEXT NOT NULL,
  direction     TEXT NOT NULL DEFAULT 'LONG',
  entry_price   NUMERIC NOT NULL CHECK (entry_price > 0),
  shares        INTEGER NOT NULL CHECK (shares > 0),
  stop_price    NUMERIC,                    -- the stop the user has at their broker
  status        TEXT NOT NULL DEFAULT 'OPEN',
  opened_at     BIGINT NOT NULL,
  exit_price    NUMERIC CHECK (exit_price IS NULL OR exit_price > 0),
  closed_at     BIGINT,
  realized_pnl  NUMERIC,
  notes         TEXT,
  CONSTRAINT trades_status_chk CHECK (status IN ('OPEN', 'CLOSED')),
  CONSTRAINT trades_closed_fields_chk CHECK (
    (status = 'OPEN' AND exit_price IS NULL AND closed_at IS NULL)
    OR (status = 'CLOSED' AND exit_price IS NOT NULL AND closed_at IS NOT NULL AND realized_pnl IS NOT NULL)
  )
);

-- One open real trade per setup.
CREATE UNIQUE INDEX IF NOT EXISTS uq_trades_one_open_per_setup ON trades (setup_id) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_trades_user_status ON trades (user_id, status);
CREATE INDEX IF NOT EXISTS idx_trades_user_closed ON trades (user_id, closed_at DESC);

-- Server-only table: no policies, so only the service role can read or write it.
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
