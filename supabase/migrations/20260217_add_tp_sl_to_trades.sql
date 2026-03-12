-- Add take-profit and stop-loss columns to ep_user_trades
ALTER TABLE ep_user_trades
  ADD COLUMN IF NOT EXISTS take_profit NUMERIC,
  ADD COLUMN IF NOT EXISTS stop_loss NUMERIC;

COMMENT ON COLUMN ep_user_trades.take_profit IS 'User-set take-profit price (0-1 scale, e.g. 0.65 = 65c)';
COMMENT ON COLUMN ep_user_trades.stop_loss IS 'User-set stop-loss price (0-1 scale, e.g. 0.30 = 30c)';
