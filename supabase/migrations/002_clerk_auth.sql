-- ============================================================
-- SwingFlow — Migration 002: Switch from Supabase Auth to Clerk
-- Run this in Supabase SQL editor AFTER 001_initial_schema.sql
-- ============================================================

-- Step 1: Drop RLS policies FIRST (they reference column types — must go before ALTER COLUMN)
DROP POLICY IF EXISTS "own_profiles"       ON profiles;
DROP POLICY IF EXISTS "own_settings"       ON settings;
DROP POLICY IF EXISTS "own_watchlist"      ON watchlist;
DROP POLICY IF EXISTS "own_setups"         ON trade_setups;
DROP POLICY IF EXISTS "own_notifications"  ON notifications;
DROP POLICY IF EXISTS "own_push_subs"      ON push_subscriptions;

-- Step 2: Remove the Supabase Auth trigger (Clerk handles user creation now)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Step 3: Drop foreign key constraints that reference auth.users
-- (Clerk user IDs are strings like "user_2abc123", not UUIDs)
ALTER TABLE profiles           DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE settings           DROP CONSTRAINT IF EXISTS settings_user_id_fkey;
ALTER TABLE watchlist          DROP CONSTRAINT IF EXISTS watchlist_user_id_fkey;
ALTER TABLE trade_setups       DROP CONSTRAINT IF EXISTS trade_setups_user_id_fkey;
ALTER TABLE notifications      DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey;

-- Also drop the notifications → trade_setups FK before we alter types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_setup_id_fkey;

-- Step 4: Change all user_id / id columns from UUID to TEXT
ALTER TABLE profiles           ALTER COLUMN id       TYPE TEXT USING id::TEXT;
ALTER TABLE settings           ALTER COLUMN user_id  TYPE TEXT USING user_id::TEXT;
ALTER TABLE watchlist          ALTER COLUMN user_id  TYPE TEXT USING user_id::TEXT;
ALTER TABLE trade_setups       ALTER COLUMN user_id  TYPE TEXT USING user_id::TEXT;
ALTER TABLE notifications      ALTER COLUMN user_id  TYPE TEXT USING user_id::TEXT;
ALTER TABLE push_subscriptions ALTER COLUMN user_id  TYPE TEXT USING user_id::TEXT;

-- Step 5: Re-add the notifications → trade_setups FK (setup IDs are still UUIDs)
ALTER TABLE notifications
  ADD CONSTRAINT notifications_setup_id_fkey
  FOREIGN KEY (setup_id) REFERENCES trade_setups(id) ON DELETE SET NULL;

-- All access now goes through our Express backend using the service_role key.
-- The service_role key bypasses RLS, and our backend always filters by user_id.
-- RLS remains ENABLED on all tables — direct anon key access is denied by default.
