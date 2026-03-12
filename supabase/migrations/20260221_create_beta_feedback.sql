-- Beta feedback table
CREATE TABLE IF NOT EXISTS ep_beta_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT,
  page TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
