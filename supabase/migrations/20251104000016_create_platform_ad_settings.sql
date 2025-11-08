-- Create platform_ad_settings table and policies
BEGIN;

CREATE TABLE IF NOT EXISTS platform_ad_settings (
  id uuid PRIMARY KEY,
  cost_per_click numeric NOT NULL DEFAULT 0.5,
  cost_per_impression numeric NOT NULL DEFAULT 0.01,
  min_budget int NOT NULL DEFAULT 100,
  max_budget int NOT NULL DEFAULT 10000,
  min_duration_days int NOT NULL DEFAULT 7,
  max_duration_days int NOT NULL DEFAULT 90,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default row if missing (well-known UUID)
INSERT INTO platform_ad_settings(id)
SELECT '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM platform_ad_settings WHERE id = '00000000-0000-0000-0000-000000000001'
);

ALTER TABLE platform_ad_settings ENABLE ROW LEVEL SECURITY;

-- Admin read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_ad_settings' AND policyname='admin_select_platform_ad_settings'
  ) THEN
    CREATE POLICY admin_select_platform_ad_settings ON platform_ad_settings FOR SELECT TO authenticated
      USING (is_admin());
  END IF;
END $$;

-- Admin update/insert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_ad_settings' AND policyname='admin_update_platform_ad_settings'
  ) THEN
    CREATE POLICY admin_update_platform_ad_settings ON platform_ad_settings FOR UPDATE TO authenticated
      USING (is_admin()) WITH CHECK (is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_ad_settings' AND policyname='admin_insert_platform_ad_settings'
  ) THEN
    CREATE POLICY admin_insert_platform_ad_settings ON platform_ad_settings FOR INSERT TO authenticated
      WITH CHECK (is_admin());
  END IF;
END $$;

COMMIT;
