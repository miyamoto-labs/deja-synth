-- Referral system + Points / Leaderboard for EasyPoly
-- Run this in Supabase SQL Editor

-- ── 1. Referral columns on existing ep_users table ──────────
ALTER TABLE ep_users
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by TEXT;

CREATE INDEX IF NOT EXISTS idx_ep_users_referral_code
  ON ep_users(referral_code) WHERE referral_code IS NOT NULL;

-- ── 2. Referral tracking table ──────────────────────────────
CREATE TABLE IF NOT EXISTS ep_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_wallet TEXT NOT NULL,
  referred_wallet TEXT NOT NULL,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected',  -- 'connected' | 'active'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ep_referrals_referred
  ON ep_referrals(referred_wallet);

CREATE INDEX IF NOT EXISTS idx_ep_referrals_referrer
  ON ep_referrals(referrer_wallet, created_at DESC);

-- ── 3. Points ledger (immutable event log) ──────────────────
CREATE TABLE IF NOT EXISTS ep_points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,       -- 'signup' | 'referral' | 'trade' | 'pick_followed' | 'daily_login'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ep_points_ledger_wallet
  ON ep_points_ledger(user_wallet, created_at DESC);

-- ── 4. Points summary (denormalized for fast leaderboard) ───
CREATE TABLE IF NOT EXISTS ep_user_points (
  user_wallet TEXT PRIMARY KEY,
  total_points INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze',  -- 'bronze' | 'silver' | 'gold' | 'diamond'
  referral_count INTEGER NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ep_user_points_leaderboard
  ON ep_user_points(total_points DESC);
