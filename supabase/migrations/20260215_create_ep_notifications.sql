-- Notification system for EasyPoly
-- Stores persistent notifications for in-app bell + feed

CREATE TABLE IF NOT EXISTS ep_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT,              -- NULL = broadcast (visible to all users)
  type TEXT NOT NULL,            -- 'pick' | 'signal' | 'trade' | 'system'
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB DEFAULT '{}',  -- pick_id, trader_id, market_question, conviction, etc.
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup: user's notifications ordered by recency, filtered by read status
CREATE INDEX idx_ep_notifications_user
  ON ep_notifications(user_wallet, read, created_at DESC);

-- Fast lookup: broadcast notifications (user_wallet IS NULL)
CREATE INDEX idx_ep_notifications_broadcast
  ON ep_notifications(created_at DESC) WHERE user_wallet IS NULL;
