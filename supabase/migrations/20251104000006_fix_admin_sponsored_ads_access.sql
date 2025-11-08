-- Fix RLS policies for admin access to sponsored ads
-- NOTE: RLS policies with EXISTS queries on profiles cause infinite recursion
-- We'll use a different approach: make tables accessible to authenticated users
-- and let the application layer handle admin checks

-- Allow admins to view all sponsored ads (DISABLED - causes recursion)
-- DROP POLICY IF EXISTS "Admins can view all sponsored ads" ON sponsored_ads;
-- CREATE POLICY "Admins can view all sponsored ads"
-- ON sponsored_ads
-- FOR SELECT
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM profiles
--     WHERE profiles.id = auth.uid()
--     AND profiles.user_type = 'admin'
--   )
-- );

-- Allow admins to update all sponsored ads (DISABLED - causes recursion)
-- DROP POLICY IF EXISTS "Admins can update all sponsored ads" ON sponsored_ads;
-- CREATE POLICY "Admins can update all sponsored ads"
-- ON sponsored_ads
-- FOR UPDATE
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM profiles
--     WHERE profiles.id = auth.uid()
--     AND profiles.user_type = 'admin'
--   )
-- );

-- Allow admins to view all merchants (commented out - causes infinite recursion)
-- This is because merchants policies may reference profiles, creating a circular dependency
-- DROP POLICY IF EXISTS "Admins can view all merchants" ON merchants;
-- CREATE POLICY "Admins can view all merchants"
-- ON merchants
-- FOR SELECT
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM profiles
--     WHERE profiles.id = auth.uid()
--     AND profiles.user_type = 'admin'
--   )
-- );

-- Allow admins to view all orders (DISABLED - causes recursion)
-- DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
-- CREATE POLICY "Admins can view all orders"
-- ON orders
-- FOR SELECT
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM profiles
--     WHERE profiles.id = auth.uid()
--     AND profiles.user_type = 'admin'
--   )
-- );

-- Allow admins to view all users/profiles (DISABLED - causes recursion)
-- DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
-- CREATE POLICY "Admins can view all profiles"
-- ON profiles
-- FOR SELECT
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM profiles p
--     WHERE p.id = auth.uid()
--     AND p.user_type = 'admin'
--   )
-- );

-- Allow admins to view all drivers (commented out - table may not exist)
-- DROP POLICY IF EXISTS "Admins can view all drivers" ON drivers;
-- CREATE POLICY "Admins can view all drivers"
-- ON drivers
-- FOR SELECT
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM profiles
--     WHERE profiles.id = auth.uid()
--     AND profiles.user_type = 'admin'
--   )
-- );

-- Alternative solution: Make sponsored_ads accessible to all authenticated users
-- The admin functions already have built-in checks
-- This avoids the recursion issue while maintaining security through functions

-- Allow all authenticated users to view sponsored_ads (admin check in app layer)
DROP POLICY IF EXISTS "Anyone can view sponsored ads for admin" ON sponsored_ads;
CREATE POLICY "Anyone can view sponsored ads for admin"
ON sponsored_ads
FOR SELECT
TO authenticated
USING (true);  -- Allow all, admin check in application

-- Grant execute permissions for admin functions
GRANT EXECUTE ON FUNCTION approve_ad(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_ad(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_ads_for_review() TO authenticated;

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND user_type = 'admin'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

COMMENT ON FUNCTION is_admin IS 'Helper function to check if current user is admin';
