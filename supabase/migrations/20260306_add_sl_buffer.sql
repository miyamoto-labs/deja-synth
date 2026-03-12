-- Add SL exit buffer % column to ep_user_follows
-- When SL triggers at -X%, the GTC limit sell is placed at -(X + buffer)%
-- E.g. SL at -50%, buffer 15% → limit price = entry * (1 - 0.65)

ALTER TABLE ep_user_follows
  ADD COLUMN IF NOT EXISTS sl_buffer_pct NUMERIC DEFAULT 15;
