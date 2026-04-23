-- ============================================================
-- SwingFlow — Trade Outcomes
-- Adds realized P&L tracking to trade_setups
-- ============================================================

ALTER TABLE trade_setups
  ADD COLUMN IF NOT EXISTS exit_price   NUMERIC,
  ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC,
  ADD COLUMN IF NOT EXISTS closed_at    BIGINT;
