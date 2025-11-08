-- Migration: Allow merchants to read driver_profiles (for assigned drivers)
-- So the merchant UI can show driver's avatar (photo_url) and other public info

BEGIN;

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;

-- Safe drop/create of the consolidated SELECT policy
DROP POLICY IF EXISTS driver_profiles_select_extended ON public.driver_profiles;
CREATE POLICY driver_profiles_select_extended ON public.driver_profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()                       -- self (driver sees their own profile)
    OR public.merchant_can_view_profile(id)  -- merchants: drivers (or customers) of their orders
    OR public.is_admin()                  -- admins
  );

COMMIT;
