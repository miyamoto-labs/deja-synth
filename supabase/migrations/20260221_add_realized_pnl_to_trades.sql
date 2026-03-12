-- Add realized P&L tracking columns to ep_user_trades
ALTER TABLE ep_user_trades
  ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS market_slug TEXT DEFAULT NULL;

COMMENT ON COLUMN ep_user_trades.realized_pnl IS 'Realized P&L in USD after market resolution or position close. NULL = not yet resolved.';
COMMENT ON COLUMN ep_user_trades.resolved_at IS 'Timestamp when trade was resolved/closed';
COMMENT ON COLUMN ep_user_trades.market_slug IS 'Polymarket market slug for Gamma API lookups';

-- Index for efficient resolution queries (find unresolved BUY trades)
CREATE INDEX IF NOT EXISTS idx_ep_user_trades_unresolved
  ON ep_user_trades (user_wallet, side, resolved_at)
  WHERE side = 'BUY' AND resolved_at IS NULL;
