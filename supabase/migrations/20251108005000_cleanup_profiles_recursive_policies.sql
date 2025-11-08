-- Remove legacy recursive profiles policies that reference orders directly
-- to avoid stack-depth recursion. A consolidated, safe policy exists: profiles_select_extended
-- Date: 2025-11-08

BEGIN;

-- Drop by exact legacy names if present
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles'
      AND policyname='Merchants can view customer profiles in their orders'
  ) THEN
    DROP POLICY "Merchants can view customer profiles in their orders" ON public.profiles;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles'
      AND policyname='Merchants can view customers of their orders'
  ) THEN
    DROP POLICY "Merchants can view customers of their orders" ON public.profiles;
  END IF;
END $$;

-- Ensure the consolidated policy exists (re-create idempotently)
DROP POLICY IF EXISTS profiles_select_extended ON public.profiles;
CREATE POLICY profiles_select_extended ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.merchant_can_view_profile(id)
    OR public.is_admin()
  );

COMMIT;
