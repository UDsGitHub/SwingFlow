-- ============================================================
-- SwingFlow — Initial Schema
-- Run this once in your Supabase SQL editor
-- ============================================================

-- ── Profiles (extends auth.users, one row per user) ─────────
CREATE TABLE IF NOT EXISTS profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan              TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'starter' | 'pro'
  stripe_customer_id TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Per-user settings ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_size  NUMERIC DEFAULT 5000,
  daily_goal    NUMERIC DEFAULT 100,
  risk_percent  NUMERIC DEFAULT 1.5,
  data_provider TEXT    DEFAULT 'mock'
);

-- ── Watchlist ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist (
  id        SERIAL PRIMARY KEY,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol    TEXT NOT NULL,
  added_at  BIGINT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, symbol)
);

-- ── Trade setups ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_setups (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol             TEXT NOT NULL,
  strategy           TEXT NOT NULL,   -- 'TREND_PULLBACK' | 'BREAKOUT' | 'REVERSAL'
  direction          TEXT NOT NULL,   -- 'LONG' | 'SHORT'
  entry              NUMERIC NOT NULL,
  stop               NUMERIC NOT NULL,
  target             NUMERIC NOT NULL,
  confidence         NUMERIC NOT NULL,
  risk_reward        NUMERIC NOT NULL,
  detected_at        BIGINT NOT NULL,
  status             TEXT DEFAULT 'ACTIVE',  -- 'ACTIVE' | 'TRIGGERED' | 'COMPLETED' | 'EXPIRED'
  notes              TEXT,
  stock_suggestion   JSONB,
  options_suggestion JSONB
);

CREATE INDEX IF NOT EXISTS idx_setups_user_status ON trade_setups(user_id, status);

-- ── Notification log ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id        SERIAL PRIMARY KEY,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setup_id  UUID REFERENCES trade_setups(id) ON DELETE SET NULL,
  type      TEXT NOT NULL,
  message   TEXT NOT NULL,
  sent_at   BIGINT NOT NULL,
  delivered BOOLEAN DEFAULT FALSE
);

-- ── Push subscriptions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         SERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  auth       TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE(user_id, endpoint)
);

-- ============================================================
-- Row Level Security — users can only touch their own rows
-- ============================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_setups      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profiles"      ON profiles          FOR ALL USING (auth.uid() = id);
CREATE POLICY "own_settings"      ON settings          FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_watchlist"     ON watchlist         FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_setups"        ON trade_setups      FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_notifications" ON notifications     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_push_subs"     ON push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Trigger: bootstrap a new user's data on sign-up
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Profile
  INSERT INTO profiles (id) VALUES (NEW.id);

  -- Default settings
  INSERT INTO settings (user_id) VALUES (NEW.id);

  -- Default watchlist
  INSERT INTO watchlist (user_id, symbol, added_at, is_active)
  VALUES
    (NEW.id, 'AAPL', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, TRUE),
    (NEW.id, 'NVDA', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, TRUE),
    (NEW.id, 'TSLA', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, TRUE),
    (NEW.id, 'MSFT', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, TRUE),
    (NEW.id, 'AMD',  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, TRUE),
    (NEW.id, 'META', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, TRUE),
    (NEW.id, 'AMZN', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, TRUE),
    (NEW.id, 'SPY',  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, TRUE),
    (NEW.id, 'QQQ',  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, TRUE);

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users (Supabase's own table)
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
