-- Admin dashboard views, overview RPC, and admin SELECT policies
BEGIN;

-- A) Views for charts
CREATE OR REPLACE VIEW v_orders_monthly AS
SELECT date_trunc('month', created_at) AS month,
       COUNT(*) AS orders,
       COALESCE(SUM(total),0) AS revenue
FROM orders
GROUP BY 1
ORDER BY 1;

CREATE OR REPLACE VIEW v_users_monthly AS
SELECT date_trunc('month', created_at) AS month,
       COUNT(*) FILTER (WHERE user_type='customer') AS customers,
       COUNT(*) FILTER (WHERE user_type='merchant') AS merchants,
       COUNT(*) FILTER (WHERE user_type='driver')   AS drivers,
       COUNT(*) FILTER (WHERE user_type='admin')    AS admins
FROM profiles
GROUP BY 1
ORDER BY 1;

CREATE OR REPLACE VIEW v_user_types_distribution AS
SELECT user_type, COUNT(*) AS count
FROM profiles
GROUP BY user_type;

CREATE OR REPLACE VIEW v_merchants_categories AS
SELECT category, COUNT(*) AS count
FROM merchants
GROUP BY category;

-- B) RPC: get_admin_overview
CREATE OR REPLACE FUNCTION get_admin_overview()
RETURNS TABLE (
  total_users int,
  total_orders int,
  total_merchants int,
  total_drivers int,
  total_revenue numeric,
  total_sponsored_ads int,
  pending_orders int,
  pending_ads int
) AS $$
BEGIN
  SELECT COUNT(*) INTO total_users FROM profiles;
  SELECT COUNT(*) INTO total_orders FROM orders;
  SELECT COUNT(*) INTO total_merchants FROM merchants;
  SELECT COUNT(*) INTO total_drivers FROM driver_profiles;
  SELECT COALESCE(SUM(total),0) INTO total_revenue FROM orders;
  SELECT COUNT(*) INTO total_sponsored_ads FROM sponsored_ads;
  SELECT COUNT(*) INTO pending_orders FROM orders WHERE status='pending';
  SELECT COUNT(*) INTO pending_ads FROM sponsored_ads WHERE approval_status='pending';
  RETURN QUERY SELECT total_users, total_orders, total_merchants, total_drivers, total_revenue, total_sponsored_ads, pending_orders, pending_ads;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public;
GRANT EXECUTE ON FUNCTION get_admin_overview() TO authenticated;

-- C) Admin RLS SELECT policies (idempotent guards)
-- Helper: create admin SELECT policy if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='admin_select_profiles'
  ) THEN
    CREATE POLICY admin_select_profiles ON profiles FOR SELECT TO authenticated
      USING (EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type='admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='merchants' AND policyname='admin_select_merchants'
  ) THEN
    CREATE POLICY admin_select_merchants ON merchants FOR SELECT TO authenticated
      USING (EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type='admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_profiles' AND policyname='admin_select_driver_profiles'
  ) THEN
    CREATE POLICY admin_select_driver_profiles ON driver_profiles FOR SELECT TO authenticated
      USING (EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type='admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='admin_select_orders'
  ) THEN
    CREATE POLICY admin_select_orders ON orders FOR SELECT TO authenticated
      USING (EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type='admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sponsored_ads' AND policyname='admin_select_sponsored_ads'
  ) THEN
    CREATE POLICY admin_select_sponsored_ads ON sponsored_ads FOR SELECT TO authenticated
      USING (EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type='admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallets' AND policyname='admin_select_wallets'
  ) THEN
    CREATE POLICY admin_select_wallets ON wallets FOR SELECT TO authenticated
      USING (EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type='admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallet_transactions' AND policyname='admin_select_wallet_transactions'
  ) THEN
    CREATE POLICY admin_select_wallet_transactions ON wallet_transactions FOR SELECT TO authenticated
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

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_ad_settings' AND policyname='admin_select_platform_ad_settings'
  ) THEN
    CREATE POLICY admin_select_platform_ad_settings ON platform_ad_settings FOR SELECT TO authenticated
      USING (EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type='admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' AND policyname='admin_select_app_settings'
    ) THEN
      CREATE POLICY admin_select_app_settings ON app_settings FOR SELECT TO authenticated
        USING (EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type='admin'));
    END IF;
  END IF;
END $$;

COMMIT;
