-- Agent Trading System Tables
-- Week 1 Implementation

-- Users table (if not exists from other auth system)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Wallets table (MoonPay wallets for agents)
CREATE TABLE IF NOT EXISTS agent_wallets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT UNIQUE NOT NULL,
  address_solana TEXT NOT NULL,
  address_ethereum TEXT NOT NULL,
  address_bitcoin TEXT NOT NULL,
  address_tron TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL, -- AES-256-GCM encrypted with user-specific key
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agents table (autonomous trading agents)
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED', -- CREATED, RUNNING, PAUSED, STOPPED, ERROR
  strategy_type TEXT NOT NULL, -- TOP_SIGNALS, COPY_TRADER, CUSTOM
  strategy_config JSONB NOT NULL DEFAULT '{}',
  risk_config JSONB NOT NULL DEFAULT '{}',
  wallet_id TEXT UNIQUE NOT NULL REFERENCES agent_wallets(id),
  session_id TEXT, -- OpenClaw subagent session ID
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  
  CONSTRAINT valid_status CHECK (status IN ('CREATED', 'RUNNING', 'PAUSED', 'STOPPED', 'ERROR')),
  CONSTRAINT valid_strategy CHECK (strategy_type IN ('TOP_SIGNALS', 'COPY_TRADER', 'CUSTOM'))
);

-- Trades table (agent trade history)
CREATE TABLE IF NOT EXISTS agent_trades (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  market_id TEXT NOT NULL,
  market_title TEXT NOT NULL,
  outcome TEXT NOT NULL, -- YES, NO
  order_type TEXT NOT NULL, -- MARKET, LIMIT
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, OPEN, CLOSED, FAILED, CANCELLED
  
  -- Entry
  entry_amount NUMERIC(10,4) NOT NULL, -- USDC
  entry_price NUMERIC(10,4) NOT NULL, -- Price per share
  entry_shares NUMERIC(10,4) NOT NULL, -- Shares purchased
  entry_timestamp TIMESTAMPTZ DEFAULT now(),
  
  -- Exit
  exit_amount NUMERIC(10,4), -- USDC received
  exit_price NUMERIC(10,4), -- Price per share
  exit_shares NUMERIC(10,4), -- Shares sold
  exit_timestamp TIMESTAMPTZ,
  
  -- P&L
  pnl NUMERIC(10,4), -- USD profit/loss
  pnl_percent NUMERIC(10,4), -- % return
  
  -- Metadata
  signal_source TEXT, -- 'easypoly' | 'trader:{id}' | 'custom'
  signal_confidence NUMERIC(10,4), -- 0-100
  reason TEXT, -- Trade rationale
  error TEXT, -- Error message if failed
  
  CONSTRAINT valid_outcome CHECK (outcome IN ('YES', 'NO')),
  CONSTRAINT valid_order_type CHECK (order_type IN ('MARKET', 'LIMIT')),
  CONSTRAINT valid_trade_status CHECK (status IN ('PENDING', 'OPEN', 'CLOSED', 'FAILED', 'CANCELLED'))
);

-- Performance table (agent performance snapshots)
CREATE TABLE IF NOT EXISTS agent_performance (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT now(),
  
  -- Balance
  balance NUMERIC(10,4) NOT NULL, -- Current USDC balance
  
  -- P&L
  total_pnl NUMERIC(10,4) NOT NULL, -- All-time P&L
  total_pnl_percent NUMERIC(10,4) NOT NULL, -- % return on initial capital
  daily_pnl NUMERIC(10,4) NOT NULL, -- Last 24h P&L
  weekly_pnl NUMERIC(10,4) NOT NULL, -- Last 7d P&L
  monthly_pnl NUMERIC(10,4) NOT NULL, -- Last 30d P&L
  
  -- Trade stats
  total_trades INTEGER NOT NULL DEFAULT 0,
  open_positions INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  win_rate NUMERIC(10,4) NOT NULL DEFAULT 0, -- %
  avg_win_size NUMERIC(10,4) NOT NULL DEFAULT 0, -- Avg profit per win
  avg_loss_size NUMERIC(10,4) NOT NULL DEFAULT 0, -- Avg loss per loss
  
  -- Risk metrics
  sharpe_ratio NUMERIC(10,4), -- (avgReturn - riskFreeRate) / stdDev
  max_drawdown NUMERIC(10,4), -- Max % decline from peak
  
  -- Rankings
  rank INTEGER -- Position in leaderboard
);

-- Leaderboard table (agent rankings)
CREATE TABLE IF NOT EXISTS agent_leaderboard (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type TEXT NOT NULL, -- HUMAN, AGENT
  rank INTEGER NOT NULL,
  entity_id TEXT NOT NULL, -- agentId or userId
  entity_name TEXT NOT NULL,
  total_pnl NUMERIC(10,4) NOT NULL,
  total_pnl_percent NUMERIC(10,4) NOT NULL,
  win_rate NUMERIC(10,4) NOT NULL,
  total_trades INTEGER NOT NULL,
  
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_leaderboard_type CHECK (type IN ('HUMAN', 'AGENT')),
  UNIQUE(type, rank)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_wallets_user_id ON agent_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status) WHERE status IN ('RUNNING', 'PAUSED');
CREATE INDEX IF NOT EXISTS idx_agent_trades_agent_id ON agent_trades(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_trades_status ON agent_trades(status) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_agent_trades_entry_timestamp ON agent_trades(entry_timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_performance_agent_id ON agent_performance(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_timestamp ON agent_performance(timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_performance_rank ON agent_performance(rank);
CREATE INDEX IF NOT EXISTS idx_agent_leaderboard_type ON agent_leaderboard(type);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_wallets_updated_at BEFORE UPDATE ON agent_wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
