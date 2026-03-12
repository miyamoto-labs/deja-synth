-- Add copytrade wallet support to ep_users
-- copytrade_wallet: links auth user to their generated copytrade wallet address
-- parent_wallet: on copytrade wallet rows, links back to the auth wallet

ALTER TABLE ep_users ADD COLUMN IF NOT EXISTS copytrade_wallet TEXT;
ALTER TABLE ep_users ADD COLUMN IF NOT EXISTS parent_wallet TEXT;

-- Index for looking up copytrade wallets by parent
CREATE INDEX IF NOT EXISTS idx_ep_users_parent_wallet ON ep_users(parent_wallet) WHERE parent_wallet IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ep_users_copytrade_wallet ON ep_users(copytrade_wallet) WHERE copytrade_wallet IS NOT NULL;
