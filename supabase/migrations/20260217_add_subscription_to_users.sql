-- Add subscription tracking columns to ep_users
ALTER TABLE ep_users
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Index for Stripe webhook lookups
CREATE INDEX IF NOT EXISTS idx_ep_users_stripe_customer
  ON ep_users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
