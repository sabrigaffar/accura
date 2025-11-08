-- Harden approval update policies and allow notifications insert by admin or self
-- Date: 2025-11-08

BEGIN;

-- Ensure notifications RLS allows admin/self insert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_insert_admin_or_self'
  ) THEN
    CREATE POLICY notifications_insert_admin_or_self ON public.notifications
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin() OR user_id = auth.uid());
  END IF;
END $$;

-- Restrict non-admin updates so owners cannot change approval fields on driver_profiles
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_profiles' AND policyname='driver_profiles_update_self_basic'
  ) THEN
    DROP POLICY driver_profiles_update_self_basic ON public.driver_profiles;
  END IF;
  CREATE POLICY driver_profiles_update_self_basic ON public.driver_profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
      id = auth.uid()
      AND approval_status IS NOT DISTINCT FROM (SELECT dp2.approval_status FROM public.driver_profiles dp2 WHERE dp2.id = driver_profiles.id)
      AND approved_by IS NOT DISTINCT FROM (SELECT dp2.approved_by FROM public.driver_profiles dp2 WHERE dp2.id = driver_profiles.id)
      AND approved_at IS NOT DISTINCT FROM (SELECT dp2.approved_at FROM public.driver_profiles dp2 WHERE dp2.id = driver_profiles.id)
      AND rejected_at IS NOT DISTINCT FROM (SELECT dp2.rejected_at FROM public.driver_profiles dp2 WHERE dp2.id = driver_profiles.id)
    );
END $$;

-- Restrict non-admin updates so owners cannot change approval fields on merchants
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='merchants' AND policyname='merchants_update_owner_basic'
  ) THEN
    DROP POLICY merchants_update_owner_basic ON public.merchants;
  END IF;
  CREATE POLICY merchants_update_owner_basic ON public.merchants
    FOR UPDATE TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (
      owner_id = auth.uid()
      AND approval_status IS NOT DISTINCT FROM (SELECT m2.approval_status FROM public.merchants m2 WHERE m2.id = merchants.id)
      AND approved_by IS NOT DISTINCT FROM (SELECT m2.approved_by FROM public.merchants m2 WHERE m2.id = merchants.id)
      AND approved_at IS NOT DISTINCT FROM (SELECT m2.approved_at FROM public.merchants m2 WHERE m2.id = merchants.id)
      AND rejected_at IS NOT DISTINCT FROM (SELECT m2.rejected_at FROM public.merchants m2 WHERE m2.id = merchants.id)
      AND is_active IS NOT DISTINCT FROM (SELECT m2.is_active FROM public.merchants m2 WHERE m2.id = merchants.id)
    );
END $$;

COMMIT;
