-- Add copy trading config columns to ep_user_follows
-- These enable full copy-trade configuration: direction filters, sizing modes,
-- risk limits, and slippage tolerances.

-- Copy direction toggles
ALTER TABLE ep_user_follows
  ADD COLUMN IF NOT EXISTS copy_buy BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS copy_sell BOOLEAN NOT NULL DEFAULT false;

-- Trade sizing mode: 'fixed' = flat dollar amount, 'percentage' = % of trader's position
ALTER TABLE ep_user_follows
  ADD COLUMN IF NOT EXISTS sizing_mode TEXT NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS sizing_value NUMERIC(10,2) NOT NULL DEFAULT 10.00;

-- Risk limit columns (nullable = no limit)
ALTER TABLE ep_user_follows
  ADD COLUMN IF NOT EXISTS total_spend_limit NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_spent NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS max_per_trade NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS min_trade_size NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_per_market NUMERIC(10,2) DEFAULT NULL;

-- Slippage (price tolerance %)
ALTER TABLE ep_user_follows
  ADD COLUMN IF NOT EXISTS slippage_buy_pct NUMERIC(5,2) NOT NULL DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS slippage_sell_pct NUMERIC(5,2) NOT NULL DEFAULT 2.00;

-- Add constraint for sizing_mode
ALTER TABLE ep_user_follows
  ADD CONSTRAINT chk_sizing_mode CHECK (sizing_mode IN ('fixed', 'percentage'));
