-- Add bet_amount column to ep_bot_sessions for variable bet sizing
ALTER TABLE ep_bot_sessions ADD COLUMN IF NOT EXISTS bet_amount NUMERIC(10,2) DEFAULT NULL;

-- Comment: When NULL, defaults to $1 for backward compatibility
COMMENT ON COLUMN ep_bot_sessions.bet_amount IS 'Per-bet amount in USD. NULL defaults to $1 for legacy sessions.';
