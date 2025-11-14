-- Replace profiles_select_customer_view_driver policy with a helper function to avoid recursive policy evaluation
-- Date: 2025-11-13

BEGIN;

-- Helper: can current customer view the given driver profile?
CREATE OR REPLACE FUNCTION public.customer_can_view_driver_profile(p_driver_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ok boolean;
BEGIN
  IF auth.uid() IS NULL OR p_driver_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.customer_id = auth.uid()
      AND o.driver_id = p_driver_id
  ) INTO v_ok;
  RETURN COALESCE(v_ok, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.customer_can_view_driver_profile(uuid) TO authenticated;

-- Recreate the policy to use the helper function (idempotent drop+create)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_customer_view_driver'
  ) THEN
    DROP POLICY profiles_select_customer_view_driver ON public.profiles;
  END IF;
END $$;

CREATE POLICY profiles_select_customer_view_driver ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.customer_can_view_driver_profile(id)
    OR public.is_admin()
  );

COMMIT;
