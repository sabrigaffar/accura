-- Ensure app_settings and platform_settings exist with sensible defaults
BEGIN;

-- app_settings
CREATE TABLE IF NOT EXISTS app_settings (
  id text PRIMARY KEY,
  site_name text DEFAULT 'Accura',
  email_notifications boolean DEFAULT false,
  push_notifications boolean DEFAULT false,
  two_factor_auth boolean DEFAULT false,
  language text DEFAULT 'ar',
  theme text DEFAULT 'light',
  maintenance_mode boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- seed global row if missing
INSERT INTO app_settings(id)
SELECT 'global'
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE id='global');

-- platform_settings
CREATE TABLE IF NOT EXISTS platform_settings (
  id int PRIMARY KEY,
  service_fee_flat numeric DEFAULT 2.5,
  driver_commission_per_km numeric DEFAULT 1.0,
  driver_commission_free_until timestamptz NULL,
  merchant_commission_rate numeric DEFAULT 0,
  merchant_commission_flat numeric DEFAULT 0,
  merchant_commission_apply_on_cash boolean DEFAULT false,
  currency text DEFAULT 'EGP',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- seed row id=1 if missing
INSERT INTO platform_settings(id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM platform_settings WHERE id=1);

-- RLS enable and admin SELECT policy only if not enabled
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' AND policyname='admin_select_app_settings'
  ) THEN
    CREATE POLICY admin_select_app_settings ON app_settings FOR SELECT TO authenticated
      USING (EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type='admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_settings' AND policyname='admin_select_platform_settings'
  ) THEN
    CREATE POLICY admin_select_platform_settings ON platform_settings FOR SELECT TO authenticated
      USING (EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type='admin'));
  END IF;
END $$;

COMMIT;
