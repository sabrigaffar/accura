-- RLS policies to enforce approval workflow and admin-only approval fields
-- Date: 2025-11-08

BEGIN;

-- Helpers
CREATE OR REPLACE FUNCTION public.driver_is_approved(p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.driver_profiles dp
    WHERE dp.id = p_uid AND dp.approval_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.merchant_owner_has_approved(p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.owner_id = p_uid AND m.approval_status = 'approved'
  );
$$;

-- Enable RLS if not enabled
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='driver_profiles' AND c.relrowsecurity
  ) THEN
    ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='merchants' AND c.relrowsecurity
  ) THEN
    ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- driver_profiles policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_profiles' AND policyname='driver_profiles_select_self_or_admin'
  ) THEN
    CREATE POLICY driver_profiles_select_self_or_admin ON public.driver_profiles
      FOR SELECT TO authenticated
      USING (id = auth.uid() OR public.is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_profiles' AND policyname='driver_profiles_insert_self'
  ) THEN
    CREATE POLICY driver_profiles_insert_self ON public.driver_profiles
      FOR INSERT TO authenticated
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- Allow driver to update own basic fields but NOT approval fields
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_profiles' AND policyname='driver_profiles_update_self_basic'
  ) THEN
    CREATE POLICY driver_profiles_update_self_basic ON public.driver_profiles
      FOR UPDATE TO authenticated
      USING (id = auth.uid())
      WITH CHECK (
        id = auth.uid()
        AND approval_status IS NOT DISTINCT FROM approval_status -- no change constraint here; enforced via column privileges below
      );
  END IF;
END $$;

-- Admin can update approval fields
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_profiles' AND policyname='driver_profiles_update_admin'
  ) THEN
    CREATE POLICY driver_profiles_update_admin ON public.driver_profiles
      FOR UPDATE TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- merchants policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='merchants' AND policyname='merchants_select_owner_or_admin'
  ) THEN
    CREATE POLICY merchants_select_owner_or_admin ON public.merchants
      FOR SELECT TO authenticated
      USING (owner_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='merchants' AND policyname='merchants_insert_owner'
  ) THEN
    CREATE POLICY merchants_insert_owner ON public.merchants
      FOR INSERT TO authenticated
      WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

-- Owner can update basic fields but NOT approval fields
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='merchants' AND policyname='merchants_update_owner_basic'
  ) THEN
    CREATE POLICY merchants_update_owner_basic ON public.merchants
      FOR UPDATE TO authenticated
      USING (owner_id = auth.uid())
      WITH CHECK (
        owner_id = auth.uid()
        AND approval_status IS NOT DISTINCT FROM approval_status
      );
  END IF;
END $$;

-- Admin can update approval fields
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='merchants' AND policyname='merchants_update_admin'
  ) THEN
    CREATE POLICY merchants_update_admin ON public.merchants
      FOR UPDATE TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

COMMIT;
