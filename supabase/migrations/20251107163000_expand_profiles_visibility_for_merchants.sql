-- Migration: Expand merchant visibility to driver profiles via RLS
-- Reason: Merchant order cards need to show assigned driver's name/phone.
-- Approach: Update merchant_can_view_profile() to allow seeing both customers and drivers
-- of the merchant's orders, and re-create the consolidated SELECT policy.

BEGIN;

CREATE OR REPLACE FUNCTION public.merchant_can_view_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.merchants m ON m.id = o.merchant_id
    WHERE m.owner_id = auth.uid()
      AND (o.customer_id = p_profile_id OR o.driver_id = p_profile_id)
  ) INTO v_ok;
  RETURN COALESCE(v_ok, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.merchant_can_view_profile(uuid) TO authenticated;

-- Re-create the consolidated policy to ensure it's in sync
DROP POLICY IF EXISTS profiles_select_extended ON public.profiles;
CREATE POLICY profiles_select_extended ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()                   -- self
    OR public.merchant_can_view_profile(id)  -- merchants: customers OR drivers of their orders
    OR public.is_admin()              -- admins
  );

COMMIT;
