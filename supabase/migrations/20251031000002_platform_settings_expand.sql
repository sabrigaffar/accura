-- Expand platform_settings to include service and merchant fees

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS service_fee_flat NUMERIC NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS merchant_commission_rate NUMERIC NOT NULL DEFAULT 0, -- percent e.g. 5 = 5%
  ADD COLUMN IF NOT EXISTS merchant_commission_flat NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EGP';

-- Ensure singleton row exists
INSERT INTO platform_settings(id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
