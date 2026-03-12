-- Add on-chain signal tracking columns to ep_trader_trades
-- Enables dedup by tx_hash + log_index for webhook-sourced signals

ALTER TABLE ep_trader_trades
  ADD COLUMN IF NOT EXISTS tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS log_index INTEGER,
  ADD COLUMN IF NOT EXISTS block_number BIGINT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'onchain_monitor';

-- Dedup: same on-chain event can't create duplicate signals
CREATE UNIQUE INDEX IF NOT EXISTS idx_ep_trader_trades_tx_dedup
  ON ep_trader_trades(tx_hash, log_index)
  WHERE tx_hash IS NOT NULL;

-- Fast token ID lookups for resolving CTF events to markets
CREATE INDEX IF NOT EXISTS idx_ep_markets_raw_yes_token
  ON ep_markets_raw(yes_token) WHERE yes_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ep_markets_raw_no_token
  ON ep_markets_raw(no_token) WHERE no_token IS NOT NULL;
