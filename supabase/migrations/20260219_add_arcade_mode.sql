-- Arcade mode support for click-to-bet
ALTER TABLE ep_bot_sessions ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE ep_bot_sessions ADD COLUMN IF NOT EXISTS bets_remaining INTEGER DEFAULT 0;

-- Arcade trade tracking
ALTER TABLE ep_bot_trades ADD COLUMN IF NOT EXISTS resolution_price NUMERIC DEFAULT NULL;
ALTER TABLE ep_bot_trades ADD COLUMN IF NOT EXISTS token_id TEXT DEFAULT NULL;
ALTER TABLE ep_bot_trades ADD COLUMN IF NOT EXISTS condition_id TEXT DEFAULT NULL;
ALTER TABLE ep_bot_trades ADD COLUMN IF NOT EXISTS market_slug TEXT DEFAULT NULL;
ALTER TABLE ep_bot_trades ADD COLUMN IF NOT EXISTS spread_fee NUMERIC DEFAULT 0;

-- Leaderboard index
CREATE INDEX IF NOT EXISTS idx_ep_bot_sessions_leaderboard
  ON ep_bot_sessions (status, total_trades, mode)
  WHERE status IN ('stopped', 'expired') AND total_trades > 0;
