-- LP Market Scores: cache table for scored reward markets
-- Used by the Earn tab to rank LP opportunities by MM Score

CREATE TABLE IF NOT EXISTS lp_market_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  condition_id TEXT NOT NULL UNIQUE,
  question TEXT,
  slug TEXT,
  end_date TIMESTAMPTZ,
  yes_token TEXT,
  no_token TEXT,
  daily_reward NUMERIC NOT NULL DEFAULT 0,
  max_spread NUMERIC NOT NULL DEFAULT 0,
  min_size NUMERIC NOT NULL DEFAULT 0,
  midpoint NUMERIC,
  spread NUMERIC DEFAULT 0,
  price_std_dev NUMERIC DEFAULT 0,
  mm_score NUMERIC NOT NULL DEFAULT 0,
  risk_tier TEXT DEFAULT 'high',
  est_apy NUMERIC DEFAULT 0,
  fill_risk NUMERIC DEFAULT 0,
  reward_per_1k NUMERIC DEFAULT 0,
  side_required TEXT DEFAULT 'both',
  days_remaining INTEGER DEFAULT 0,
  competing_liquidity NUMERIC DEFAULT 0,
  scored_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lp_scores_mm_score ON lp_market_scores (mm_score DESC);
CREATE INDEX IF NOT EXISTS idx_lp_scores_risk_tier ON lp_market_scores (risk_tier);
CREATE INDEX IF NOT EXISTS idx_lp_scores_scored_at ON lp_market_scores (scored_at);
