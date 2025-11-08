-- Enable RLS on sponsored_ads and enforce that only approved + active ads are visible to public
-- Date: 2025-11-05

BEGIN;

-- Ensure RLS is enabled
ALTER TABLE public.sponsored_ads ENABLE ROW LEVEL SECURITY;

-- Public view: only approved & active & within schedule & budget
DROP POLICY IF EXISTS sponsored_ads_public_view ON public.sponsored_ads;
CREATE POLICY sponsored_ads_public_view
ON public.sponsored_ads
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND approval_status = 'approved'
  AND start_date <= now()
  AND end_date >= now()
  AND total_spent < budget_amount
);

-- Merchant owners can see their own ads (any status)
DROP POLICY IF EXISTS sponsored_ads_merchant_select ON public.sponsored_ads;
CREATE POLICY sponsored_ads_merchant_select
ON public.sponsored_ads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id = sponsored_ads.merchant_id
      AND m.owner_id = auth.uid()
  )
);

-- Admins can fully manage
DROP POLICY IF EXISTS sponsored_ads_admin_all ON public.sponsored_ads;
CREATE POLICY sponsored_ads_admin_all
ON public.sponsored_ads
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

COMMIT;
