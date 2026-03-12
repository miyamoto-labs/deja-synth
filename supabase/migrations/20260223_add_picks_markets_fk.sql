-- Add foreign key relationship between ep_curated_picks and ep_markets_raw
-- This enables PostgREST to join the tables in the Polytinder feed API

-- First, ensure market_id column exists and is the right type
-- (it should already exist, but this is idempotent)
ALTER TABLE ep_curated_picks ALTER COLUMN market_id TYPE TEXT;

-- Add the foreign key constraint
-- Note: This will fail if there are any picks referencing non-existent markets
-- We use ON DELETE CASCADE so picks are auto-deleted if markets are removed
ALTER TABLE ep_curated_picks
  ADD CONSTRAINT fk_ep_curated_picks_market
  FOREIGN KEY (market_id) 
  REFERENCES ep_markets_raw(market_id)
  ON DELETE CASCADE;

-- Create index on the FK column for faster joins
CREATE INDEX IF NOT EXISTS idx_ep_curated_picks_market_id
  ON ep_curated_picks(market_id);
