-- Prevent duplicate copytrade executions from concurrent processor calls.
-- Only one "executed" or "pending" row per (signal_id, user_wallet) is allowed.
-- This acts as a database-level lock to prevent the race condition where
-- two processors both pass the JIT dedup check before either writes a log entry.

-- First, clean up any existing duplicates (keep the earliest)
DELETE FROM ep_auto_trade_log a
  USING ep_auto_trade_log b
  WHERE a.signal_id = b.signal_id
    AND a.user_wallet = b.user_wallet
    AND a.status = b.status
    AND a.status IN ('executed', 'pending')
    AND a.created_at > b.created_at;

-- Add unique partial index: only one executed/pending row per signal+user
CREATE UNIQUE INDEX IF NOT EXISTS idx_ep_auto_trade_log_dedup
  ON ep_auto_trade_log(signal_id, user_wallet)
  WHERE status IN ('executed', 'pending');
