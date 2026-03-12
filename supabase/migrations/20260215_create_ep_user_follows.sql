-- Auto-Follow Traders table
-- Tracks which traders a user follows and their auto-trade settings.

CREATE TABLE IF NOT EXISTS ep_user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  trader_id UUID NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  auto_trade BOOLEAN NOT NULL DEFAULT false,
  amount_per_trade NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  max_daily_trades INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_wallet, trader_id)
);

-- Fast lookup for a user's active follows
CREATE INDEX IF NOT EXISTS idx_ep_user_follows_wallet
  ON ep_user_follows(user_wallet) WHERE active = true;

-- Find all users with auto-trade enabled (for future signal processing)
CREATE INDEX IF NOT EXISTS idx_ep_user_follows_auto
  ON ep_user_follows(auto_trade) WHERE active = true AND auto_trade = true;
