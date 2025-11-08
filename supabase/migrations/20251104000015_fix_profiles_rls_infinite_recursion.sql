-- Fix infinite recursion in profiles RLS by using a SECURITY DEFINER helper
BEGIN;

-- Helper: SECURITY DEFINER function that checks if current user is admin, bypassing RLS
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
BEGIN
  -- This query executes with function owner privileges (bypasses RLS if owned by table owner)
  SELECT user_type INTO v_type FROM profiles WHERE id = auth.uid();
  RETURN v_type = 'admin';
END;
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Recreate admin policy on profiles to avoid recursive self-reference
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='admin_select_profiles'
  ) THEN
    DROP POLICY admin_select_profiles ON profiles;
  END IF;
END $$;

-- Allow: the user can select his own row OR any row if admin
CREATE POLICY admin_select_profiles ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin());

COMMIT;
