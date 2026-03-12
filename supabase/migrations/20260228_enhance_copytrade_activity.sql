-- Enhance ep_auto_trade_log to track ALL copytrade attempts (not just successes)
-- This powers the Copy Trade Activity feed on the portfolio page

ALTER TABLE ep_auto_trade_log
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'executed',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS market_slug TEXT,
  ADD COLUMN IF NOT EXISTS market_question TEXT,
  ADD COLUMN IF NOT EXISTS side TEXT,
  ADD COLUMN IF NOT EXISTS direction TEXT,
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS trader_alias TEXT;

-- Index for fetching activity by user (portfolio page)
CREATE INDEX IF NOT EXISTS idx_ep_auto_trade_log_user_status
  ON ep_auto_trade_log(user_wallet, status, created_at DESC);

COMMENT ON COLUMN ep_auto_trade_log.status IS 'executed | failed | skipped';
COMMENT ON COLUMN ep_auto_trade_log.error_message IS 'Reason for failure or skip';
