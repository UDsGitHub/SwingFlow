-- ============================================================
-- SwingFlow — Trust upgrade schema
-- ============================================================

ALTER TABLE trade_setups
  ADD COLUMN IF NOT EXISTS entry_hit_at BIGINT,
  ADD COLUMN IF NOT EXISTS stop_hit_at BIGINT,
  ADD COLUMN IF NOT EXISTS target_hit_at BIGINT,
  ADD COLUMN IF NOT EXISTS pnl_estimate NUMERIC,
  ADD COLUMN IF NOT EXISTS score NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS scan_evaluations (
  id BIGSERIAL PRIMARY KEY,
  scan_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  strategy TEXT NOT NULL,
  checks JSONB NOT NULL DEFAULT '{}'::jsonb,
  result TEXT NOT NULL,
  explanation TEXT NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  regime TEXT NOT NULL,
  regime_confidence NUMERIC NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scan_eval_user_created
  ON scan_evaluations(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_attempts (
  id BIGSERIAL PRIMARY KEY,
  notification_id BIGINT REFERENCES notifications(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  setup_id UUID REFERENCES trade_setups(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  error_message TEXT,
  attempted_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_attempts_user_time
  ON notification_attempts(user_id, attempted_at DESC);
