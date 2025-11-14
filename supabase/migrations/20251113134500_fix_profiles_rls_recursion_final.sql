-- Fix RLS infinite recursion by eliminating policies that self-reference "profiles"
-- and standardizing admin SELECT policies to use public.is_admin() (which reads admin_users).
-- Date: 2025-11-13

BEGIN;

-- 1) Ensure is_admin() uses admin_users (idempotent)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()
  );
$fn$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2) Standardize admin SELECT policies to use is_admin()
-- Profiles: drop and recreate admin_select_profiles safely
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='admin_select_profiles') THEN
    DROP POLICY admin_select_profiles ON public.profiles;
  END IF;
  CREATE POLICY admin_select_profiles ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
END $$;

-- Sponsored Ads
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sponsored_ads' AND policyname='admin_select_sponsored_ads') THEN
    DROP POLICY admin_select_sponsored_ads ON public.sponsored_ads;
  END IF;
  CREATE POLICY admin_select_sponsored_ads ON public.sponsored_ads FOR SELECT TO authenticated USING (public.is_admin());
END $$;

-- Merchants
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='merchants' AND policyname='admin_select_merchants') THEN
    DROP POLICY admin_select_merchants ON public.merchants;
  END IF;
  CREATE POLICY admin_select_merchants ON public.merchants FOR SELECT TO authenticated USING (public.is_admin());
END $$;

-- Orders
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='admin_select_orders') THEN
    DROP POLICY admin_select_orders ON public.orders;
  END IF;
  CREATE POLICY admin_select_orders ON public.orders FOR SELECT TO authenticated USING (public.is_admin());
END $$;

-- Driver Profiles
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_profiles' AND policyname='admin_select_driver_profiles') THEN
    DROP POLICY admin_select_driver_profiles ON public.driver_profiles;
  END IF;
  CREATE POLICY admin_select_driver_profiles ON public.driver_profiles FOR SELECT TO authenticated USING (public.is_admin());
END $$;

-- Wallets
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallets' AND policyname='admin_select_wallets') THEN
    DROP POLICY admin_select_wallets ON public.wallets;
  END IF;
  CREATE POLICY admin_select_wallets ON public.wallets FOR SELECT TO authenticated USING (public.is_admin());
END $$;

-- Wallet Transactions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallet_transactions' AND policyname='admin_select_wallet_transactions') THEN
    DROP POLICY admin_select_wallet_transactions ON public.wallet_transactions;
  END IF;
  CREATE POLICY admin_select_wallet_transactions ON public.wallet_transactions FOR SELECT TO authenticated USING (public.is_admin());
END $$;

-- Platform Settings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_settings' AND policyname='admin_select_platform_settings') THEN
    DROP POLICY admin_select_platform_settings ON public.platform_settings;
  END IF;
  CREATE POLICY admin_select_platform_settings ON public.platform_settings FOR SELECT TO authenticated USING (public.is_admin());
END $$;

-- App Settings (guard: if table exists)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='app_settings'
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' AND policyname='admin_select_app_settings') THEN
      DROP POLICY admin_select_app_settings ON public.app_settings;
    END IF;
    CREATE POLICY admin_select_app_settings ON public.app_settings FOR SELECT TO authenticated USING (public.is_admin());
  END IF;
END $$;

COMMIT;
