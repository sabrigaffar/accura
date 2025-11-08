-- Add SECURITY DEFINER helper to allow drivers to read customer profiles for their assigned orders
-- and a RLS policy to enable that. Avoids recursion by not joining from profiles; uses orders.
-- Date: 2025-11-07

BEGIN;

-- Helper: can the current driver view this profile (as a customer)?
CREATE OR REPLACE FUNCTION public.driver_can_view_profile(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver uuid := auth.uid();
  v_ok boolean;
BEGIN
  IF v_driver IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;
  -- Driver may view a customer's profile only if they are assigned to at least one order of that customer
  SELECT exists(
    SELECT 1 FROM public.orders o
    WHERE o.customer_id = p_user_id AND o.driver_id = v_driver
  ) INTO v_ok;
  RETURN coalesce(v_ok, false);
END;$$;

-- RLS policy: allow drivers to select profiles they are allowed to view
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_for_driver'
  ) THEN
    CREATE POLICY profiles_select_for_driver ON public.profiles
      FOR SELECT
      USING (
        -- allow reading self OR when driver_can_view_profile says so
        id = auth.uid() OR public.driver_can_view_profile(id)
      );
  ELSE
    DROP POLICY profiles_select_for_driver ON public.profiles;
    CREATE POLICY profiles_select_for_driver ON public.profiles
      FOR SELECT
      USING (id = auth.uid() OR public.driver_can_view_profile(id));
  END IF;
END $$;

COMMIT;
