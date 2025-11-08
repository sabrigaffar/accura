-- Cleanup potentially recursive/self-referential RLS policies on profiles
BEGIN;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname <> 'admin_select_profiles'
      AND (
        COALESCE(qual::text,'') ILIKE '%profiles%'
        OR COALESCE(with_check::text,'') ILIKE '%profiles%'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON profiles', r.policyname);
  END LOOP;
END $$;

COMMIT;
