-- Bot rental sessions
-- Tracks users who rent the EasyP trading bot
CREATE TABLE IF NOT EXISTS ep_bot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, paused, stopped, expired
  plan TEXT NOT NULL,                     -- quick_shot, day_pass, marathon
  credits_usdc NUMERIC(10,2) NOT NULL,   -- amount paid for bot time
  bankroll_usdc NUMERIC(10,2) NOT NULL,  -- trading bankroll deposited
  market TEXT NOT NULL DEFAULT 'BTC-5m', -- BTC-5m, BTC-15m, ETH-15m
  settings JSONB DEFAULT '{}',           -- slider values, or empty = defaults

  -- Trading wallet (generated for this session)
  bot_wallet_address TEXT,
  bot_private_key_encrypted TEXT,        -- AES-256-GCM encrypted

  -- Time tracking
  total_seconds INTEGER NOT NULL,        -- purchased time in seconds
  used_seconds INTEGER DEFAULT 0,

  -- Performance
  starting_balance NUMERIC(10,2),
  current_balance NUMERIC(10,2),
  total_trades INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  total_pnl NUMERIC(10,4) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ
);

-- Individual bot trades
CREATE TABLE IF NOT EXISTS ep_bot_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES ep_bot_sessions(id),
  market TEXT NOT NULL,           -- BTC-5m, BTC-15m, ETH-15m
  side TEXT NOT NULL,             -- UP, DOWN
  amount NUMERIC(10,4),
  entry_price NUMERIC(10,4),
  shares NUMERIC(10,4),
  outcome TEXT DEFAULT 'pending', -- won, lost, pending
  pnl NUMERIC(10,4),
  order_id TEXT,

  -- Signal data (for transparency)
  momentum NUMERIC(10,6),
  edge NUMERIC(10,4),
  synthdata_prob NUMERIC(10,4),

  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_ep_bot_sessions_wallet
  ON ep_bot_sessions (wallet_address);

CREATE INDEX IF NOT EXISTS idx_ep_bot_sessions_status
  ON ep_bot_sessions (status)
  WHERE status IN ('pending', 'active', 'paused');

CREATE INDEX IF NOT EXISTS idx_ep_bot_trades_session
  ON ep_bot_trades (session_id);

CREATE INDEX IF NOT EXISTS idx_ep_bot_trades_outcome
  ON ep_bot_trades (outcome)
  WHERE outcome = 'pending';
