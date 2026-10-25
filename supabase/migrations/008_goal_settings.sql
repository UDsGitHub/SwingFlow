-- ============================================================
-- SwingFlow — Goal period + risk ceiling
-- ============================================================
-- The goal is now an amount per period (day, week or month) judged against the measured edge,
-- and risk per trade is bounded by a ceiling the user sets.

-- ── 1. Fill gaps so the new constraints hold ──────────────────
UPDATE settings SET account_size = 5000 WHERE account_size IS NULL OR account_size <= 0;
UPDATE settings SET daily_goal   = 100  WHERE daily_goal   IS NULL OR daily_goal   <= 0;
UPDATE settings SET risk_percent = 1.5  WHERE risk_percent IS NULL OR risk_percent <= 0;

-- ── 2. Goal amount per period ─────────────────────────────────
ALTER TABLE settings RENAME COLUMN daily_goal TO goal_amount;
ALTER TABLE settings ADD COLUMN goal_period TEXT NOT NULL DEFAULT 'WEEKLY';
-- The system takes ~0.6 trades a week, so a daily goal is almost never met on a given day.
-- Existing goals keep their amount and are judged per week.
ALTER TABLE settings
  ADD CONSTRAINT settings_goal_period_check CHECK (goal_period IN ('DAILY', 'WEEKLY', 'MONTHLY'));

-- ── 3. Risk ceiling ───────────────────────────────────────────
ALTER TABLE settings ADD COLUMN max_risk_percent NUMERIC NOT NULL DEFAULT 2;
-- Anyone already above the default ceiling is clamped to it, never the ceiling raised for them.
UPDATE settings SET risk_percent = 2 WHERE risk_percent > 2;

ALTER TABLE settings
  ALTER COLUMN account_size SET NOT NULL,
  ALTER COLUMN goal_amount  SET NOT NULL,
  ALTER COLUMN risk_percent SET NOT NULL,
  ADD CONSTRAINT settings_account_size_check     CHECK (account_size > 0),
  ADD CONSTRAINT settings_goal_amount_check      CHECK (goal_amount > 0),
  ADD CONSTRAINT settings_max_risk_percent_check CHECK (max_risk_percent > 0 AND max_risk_percent <= 10),
  ADD CONSTRAINT settings_risk_percent_check     CHECK (risk_percent > 0 AND risk_percent <= max_risk_percent);
