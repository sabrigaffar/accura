-- Update admin RLS policies to use is_admin() helper; add update/insert on settings tables
BEGIN;

-- Helper: enable RLS if table exists
DO $$ BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles';
  IF FOUND THEN
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- For each table, drop old admin_select_* if exists and recreate using is_admin()
DO $$ BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='merchants';
  IF FOUND THEN
    ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='merchants' AND policyname='admin_select_merchants') THEN
      DROP POLICY admin_select_merchants ON merchants;
    END IF;
    CREATE POLICY admin_select_merchants ON merchants FOR SELECT TO authenticated USING (is_admin());
  END IF;
END $$;

DO $$ BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='driver_profiles';
  IF FOUND THEN
    ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_profiles' AND policyname='admin_select_driver_profiles') THEN
      DROP POLICY admin_select_driver_profiles ON driver_profiles;
    END IF;
    CREATE POLICY admin_select_driver_profiles ON driver_profiles FOR SELECT TO authenticated USING (is_admin());
  END IF;
END $$;

DO $$ BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='orders';
  IF FOUND THEN
    ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='admin_select_orders') THEN
      DROP POLICY admin_select_orders ON orders;
    END IF;
    CREATE POLICY admin_select_orders ON orders FOR SELECT TO authenticated USING (is_admin());
  END IF;
END $$;

DO $$ BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sponsored_ads';
  IF FOUND THEN
    ALTER TABLE sponsored_ads ENABLE ROW LEVEL SECURITY;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sponsored_ads' AND policyname='admin_select_sponsored_ads') THEN
      DROP POLICY admin_select_sponsored_ads ON sponsored_ads;
    END IF;
    CREATE POLICY admin_select_sponsored_ads ON sponsored_ads FOR SELECT TO authenticated USING (is_admin());
  END IF;
END $$;

DO $$ BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='wallets';
  IF FOUND THEN
    ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallets' AND policyname='admin_select_wallets') THEN
      DROP POLICY admin_select_wallets ON wallets;
    END IF;
    CREATE POLICY admin_select_wallets ON wallets FOR SELECT TO authenticated USING (is_admin());
  END IF;
END $$;

DO $$ BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='wallet_transactions';
  IF FOUND THEN
    ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallet_transactions' AND policyname='admin_select_wallet_transactions') THEN
      DROP POLICY admin_select_wallet_transactions ON wallet_transactions;
    END IF;
    CREATE POLICY admin_select_wallet_transactions ON wallet_transactions FOR SELECT TO authenticated USING (is_admin());
  END IF;
END $$;

-- Settings tables: app_settings and platform_settings
DO $$ BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='app_settings';
  IF FOUND THEN
    ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' AND policyname='admin_select_app_settings') THEN
      DROP POLICY admin_select_app_settings ON app_settings;
    END IF;
    CREATE POLICY admin_select_app_settings ON app_settings FOR SELECT TO authenticated USING (is_admin());
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' AND policyname='admin_update_app_settings') THEN
      CREATE POLICY admin_update_app_settings ON app_settings FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' AND policyname='admin_insert_app_settings') THEN
      CREATE POLICY admin_insert_app_settings ON app_settings FOR INSERT TO authenticated WITH CHECK (is_admin());
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='platform_settings';
  IF FOUND THEN
    ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_settings' AND policyname='admin_select_platform_settings') THEN
      DROP POLICY admin_select_platform_settings ON platform_settings;
    END IF;
    CREATE POLICY admin_select_platform_settings ON platform_settings FOR SELECT TO authenticated USING (is_admin());
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_settings' AND policyname='admin_update_platform_settings') THEN
      CREATE POLICY admin_update_platform_settings ON platform_settings FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_settings' AND policyname='admin_insert_platform_settings') THEN
      CREATE POLICY admin_insert_platform_settings ON platform_settings FOR INSERT TO authenticated WITH CHECK (is_admin());
    END IF;
  END IF;
END $$;

COMMIT;
