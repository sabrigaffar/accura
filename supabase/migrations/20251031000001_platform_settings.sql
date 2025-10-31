-- Platform settings table to control commission behavior

CREATE TABLE IF NOT EXISTS platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  driver_commission_per_km NUMERIC NOT NULL DEFAULT 1,
  driver_commission_free_until TIMESTAMPTZ NULL
);

-- Ensure single row exists
INSERT INTO platform_settings(id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
