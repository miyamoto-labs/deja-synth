-- Standing Orders: persistent user rules for auto-execution on AI picks
-- Run in Supabase SQL Editor

-- Table 1: Standing order rules
CREATE TABLE IF NOT EXISTS ep_standing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,

  -- Rule criteria
  min_conviction INTEGER NOT NULL DEFAULT 80,
  max_conviction INTEGER NOT NULL DEFAULT 100,
  direction_filter TEXT DEFAULT NULL,          -- NULL=any, 'YES', 'NO'
  category_filter TEXT[] DEFAULT NULL,         -- NULL=any, or array of categories

  -- Execution parameters
  amount NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  daily_limit INTEGER NOT NULL DEFAULT 5,
  total_limit INTEGER DEFAULT NULL,            -- NULL = unlimited

  -- State
  active BOOLEAN NOT NULL DEFAULT true,
  paused_until TIMESTAMPTZ DEFAULT NULL,
  pause_reason TEXT DEFAULT NULL,

  -- Metadata
  label TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ep_standing_orders_wallet
  ON ep_standing_orders(user_wallet) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_ep_standing_orders_active
  ON ep_standing_orders(active, min_conviction) WHERE active = true;

-- Table 2: Execution log linking standing order -> pick -> trade
CREATE TABLE IF NOT EXISTS ep_standing_order_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standing_order_id UUID NOT NULL REFERENCES ep_standing_orders(id),
  pick_id UUID NOT NULL,
  user_wallet TEXT NOT NULL,

  -- Trade details
  amount NUMERIC(10,2) NOT NULL,
  price NUMERIC(10,6) NOT NULL,
  direction TEXT NOT NULL,
  token_id TEXT NOT NULL,
  order_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',     -- pending, executed, failed, skipped
  error_message TEXT DEFAULT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent double-execution of same pick by same standing order
CREATE UNIQUE INDEX IF NOT EXISTS idx_ep_soe_dedup
  ON ep_standing_order_executions(standing_order_id, pick_id);

CREATE INDEX IF NOT EXISTS idx_ep_soe_wallet_date
  ON ep_standing_order_executions(user_wallet, created_at);

CREATE INDEX IF NOT EXISTS idx_ep_soe_standing_order
  ON ep_standing_order_executions(standing_order_id, created_at);

-- Table 3: System trades (EasyPoly's own bets on high-conviction picks)
CREATE TABLE IF NOT EXISTS ep_system_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID NOT NULL,
  market_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  price NUMERIC(10,6) NOT NULL,
  shares NUMERIC(10,6) NOT NULL,
  order_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',       -- active, won, lost, closed
  pnl NUMERIC(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ep_system_trades_status
  ON ep_system_trades(status, created_at);
