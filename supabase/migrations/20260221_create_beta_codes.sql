-- Beta access codes table (single-use per code)
CREATE TABLE IF NOT EXISTS ep_beta_codes (
  code TEXT PRIMARY KEY,
  claimed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the 10 beta codes
INSERT INTO ep_beta_codes (code) VALUES
  ('EP7KX3NR'),
  ('EP9WM4FT'),
  ('EPH2VD6B'),
  ('EPJQ8YS5'),
  ('EP3RN7CW'),
  ('EPFX4K9G'),
  ('EP6BT2HP'),
  ('EPWN5J8D'),
  ('EP8CM3VR'),
  ('EPKY6F4T')
ON CONFLICT (code) DO NOTHING;
