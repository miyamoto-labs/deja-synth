-- USDC payment intents table
-- Tracks pending and confirmed crypto payments
CREATE TABLE IF NOT EXISTS ep_usdc_payments (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'pro',
  expected_amount TEXT NOT NULL,
  receiving_wallet TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, expired
  chain TEXT NOT NULL DEFAULT 'polygon',
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ
);

-- Index for quick lookups by wallet
CREATE INDEX IF NOT EXISTS idx_ep_usdc_payments_wallet
  ON ep_usdc_payments (wallet_address);

-- Index for pending payment polling
CREATE INDEX IF NOT EXISTS idx_ep_usdc_payments_status
  ON ep_usdc_payments (status)
  WHERE status = 'pending';
