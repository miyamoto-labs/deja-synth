-- Add subscription expiration tracking to ep_users
-- USDC payments expire after 30 days; Stripe expiry tracks current_period_end
-- Run this in Supabase SQL Editor

ALTER TABLE ep_users
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ep_users_subscription_expires
  ON ep_users (subscription_expires_at)
  WHERE subscription_expires_at IS NOT NULL;
