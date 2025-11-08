-- Remove recursive RLS policy on profiles that caused infinite recursion via orders/merchants join
BEGIN;

-- Drop the problematic policy if it exists
DROP POLICY IF EXISTS "Merchants can view customer profiles in their orders" ON profiles;

-- Keep only safe base policies on profiles (self-access) - no-op if already exist elsewhere
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
  END IF;
END$$;

COMMIT;
