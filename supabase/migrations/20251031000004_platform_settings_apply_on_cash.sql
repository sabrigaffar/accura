-- Add setting to control whether merchant commission applies on cash orders
ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS merchant_commission_apply_on_cash BOOLEAN NOT NULL DEFAULT false;

-- Ensure row exists
INSERT INTO platform_settings(id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
