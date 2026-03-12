-- ================================================================
-- Add scanner-generated pick columns to ep_curated_picks
-- These columns support the new market_scanner.py → Supabase pipeline.
-- Existing columns (market_id, direction, conviction_score, entry_price,
-- target_price, stop_loss, risk_reward, edge_explanation, time_horizon,
-- status, condition_id) are preserved as-is.
-- ================================================================

-- Scanner metadata columns
ALTER TABLE ep_curated_picks ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE ep_curated_picks ADD COLUMN IF NOT EXISTS side TEXT;           -- YES/NO (alias for direction)
ALTER TABLE ep_curated_picks ADD COLUMN IF NOT EXISTS price NUMERIC(10,4); -- current entry price
ALTER TABLE ep_curated_picks ADD COLUMN IF NOT EXISTS confidence TEXT;     -- HIGH/MEDIUM/LOW
ALTER TABLE ep_curated_picks ADD COLUMN IF NOT EXISTS composite_score NUMERIC(6,2);
ALTER TABLE ep_curated_picks ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE ep_curated_picks ADD COLUMN IF NOT EXISTS tier TEXT;           -- S/A/B/C/D
ALTER TABLE ep_curated_picks ADD COLUMN IF NOT EXISTS token_id TEXT;       -- CLOB token ID for the chosen side
ALTER TABLE ep_curated_picks ADD COLUMN IF NOT EXISTS question TEXT;       -- denormalized for quick access
ALTER TABLE ep_curated_picks ADD COLUMN IF NOT EXISTS reasoning TEXT;      -- scoring reasoning summary
ALTER TABLE ep_curated_picks ADD COLUMN IF NOT EXISTS event_slug TEXT;     -- for deduplication
ALTER TABLE ep_curated_picks ADD COLUMN IF NOT EXISTS scan_mode TEXT DEFAULT 'free'; -- free/enhanced
ALTER TABLE ep_curated_picks ADD COLUMN IF NOT EXISTS scores JSONB;       -- full score breakdown

-- Indexes for Polytinder queries
CREATE INDEX IF NOT EXISTS idx_ep_curated_picks_status_score
  ON ep_curated_picks (status, composite_score DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ep_curated_picks_category
  ON ep_curated_picks (category)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ep_curated_picks_tier
  ON ep_curated_picks (tier)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ep_curated_picks_event_slug
  ON ep_curated_picks (event_slug);

-- Deduplicate: only one active pick per condition_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_ep_curated_picks_active_condition
  ON ep_curated_picks (condition_id)
  WHERE status = 'active';
