-- Add Stop Loss / Take Profit columns to ep_user_follows
-- NULL = disabled (user has not set SL/TP for this follow)

ALTER TABLE ep_user_follows
  ADD COLUMN IF NOT EXISTS stop_loss_pct NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS take_profit_pct NUMERIC DEFAULT NULL;

COMMENT ON COLUMN ep_user_follows.stop_loss_pct IS 'Auto-sell if position P&L drops below -X% from entry. NULL = disabled.';
COMMENT ON COLUMN ep_user_follows.take_profit_pct IS 'Auto-sell if position P&L rises above +X% from entry. NULL = disabled.';
