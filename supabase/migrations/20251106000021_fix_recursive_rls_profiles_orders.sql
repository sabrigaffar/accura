-- Fix infinite recursion in RLS policies between profiles <-> orders by
-- replacing subquery-based policy with a SECURITY DEFINER helper function.
-- Date: 2025-11-06

BEGIN;

-- 1) Helper function: can current user (merchant owner) view the given profile (customer)?
CREATE OR REPLACE FUNCTION public.merchant_can_view_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow if current user owns a merchant that has an order by this profile as customer
  RETURN EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.merchants m ON m.id = o.merchant_id
    WHERE o.customer_id = p_profile_id
      AND m.owner_id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merchant_can_view_profile(uuid) TO authenticated;

-- 2) Replace the recursive policy with a function-based one
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles'
      AND policyname='Merchants can view customers of their orders'
  ) THEN
    DROP POLICY "Merchants can view customers of their orders" ON public.profiles;
  END IF;
END $$;

-- Consolidate into a single safe SELECT policy that covers: self, merchant visibility, and admins
DROP POLICY IF EXISTS profiles_select_extended ON public.profiles;
CREATE POLICY profiles_select_extended ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()               -- self
    OR public.merchant_can_view_profile(id)  -- merchants: customers of their orders
    OR public.is_admin()          -- admins
  );

COMMIT;
