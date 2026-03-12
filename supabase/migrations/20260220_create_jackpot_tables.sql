-- ============================================================
-- Jackpot Pool — single-row global accumulator
-- ============================================================
CREATE TABLE IF NOT EXISTS ep_jackpot_pool (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_amount NUMERIC(12,4) NOT NULL DEFAULT 0,
  total_collected NUMERIC(12,4) NOT NULL DEFAULT 0,
  total_awarded NUMERIC(12,4) NOT NULL DEFAULT 0,
  total_contributions INTEGER NOT NULL DEFAULT 0,
  last_contribution_at TIMESTAMPTZ,
  last_awarded_at TIMESTAMPTZ,
  week_start TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed the single row
INSERT INTO ep_jackpot_pool (id, current_amount, week_start)
VALUES (1, 0, date_trunc('week', now()))
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Jackpot Winners — history of all awards
-- ============================================================
CREATE TABLE IF NOT EXISTS ep_jackpot_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES ep_bot_sessions(id),
  wallet_address TEXT NOT NULL,
  amount NUMERIC(12,4) NOT NULL,
  session_roi NUMERIC(10,4),
  session_trades INTEGER,
  week_start TIMESTAMPTZ NOT NULL,
  week_end TIMESTAMPTZ NOT NULL,
  awarded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ep_jackpot_winners_awarded
  ON ep_jackpot_winners (awarded_at DESC);

-- ============================================================
-- Per-session jackpot contribution tracking
-- ============================================================
ALTER TABLE ep_bot_sessions
  ADD COLUMN IF NOT EXISTS jackpot_contributed NUMERIC(10,4) DEFAULT 0;

-- ============================================================
-- Atomic increment function (prevents race conditions)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_jackpot_pool(contribution NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE ep_jackpot_pool
  SET current_amount = current_amount + contribution,
      total_collected = total_collected + contribution,
      total_contributions = total_contributions + 1,
      last_contribution_at = now(),
      updated_at = now()
  WHERE id = 1;
END;
$$ LANGUAGE plpgsql;
