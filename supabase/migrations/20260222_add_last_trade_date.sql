-- Add last_trade_date to track when each trader last made a trade
-- Used to filter out inactive traders from Daily Top 5 recommendations
ALTER TABLE ep_tracked_traders ADD COLUMN IF NOT EXISTS last_trade_date timestamptz;
