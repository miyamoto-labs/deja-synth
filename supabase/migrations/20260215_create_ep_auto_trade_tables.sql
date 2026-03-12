-- Auto-trade queue tracking tables
-- Run this in Supabase SQL Editor

-- Track which signals the user has already dismissed
CREATE TABLE IF NOT EXISTS ep_auto_trade_dismissed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  signal_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_wallet, signal_id)
);

-- Track auto-trade executions for daily limit enforcement
CREATE TABLE IF NOT EXISTS ep_auto_trade_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  signal_id UUID NOT NULL,
  trader_id UUID NOT NULL,
  order_id TEXT,
  amount NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for counting daily trades per user
CREATE INDEX IF NOT EXISTS idx_ep_auto_trade_log_daily
  ON ep_auto_trade_log(user_wallet, created_at);

-- Index for dismissed signal lookups
CREATE INDEX IF NOT EXISTS idx_ep_auto_trade_dismissed_wallet
  ON ep_auto_trade_dismissed(user_wallet, signal_id);
