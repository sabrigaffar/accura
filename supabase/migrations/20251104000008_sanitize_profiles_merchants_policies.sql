-- Sanitize RLS policies on profiles and merchants to fix infinite recursion
BEGIN;

-- 1) Drop any non-base policies on profiles
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname NOT IN (
        'Users can view own profile',
        'Users can view their own profile',
        'Users can update their own profile',
        'Users can insert their own profile'
      )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END$$;

-- Recreate safe base policies if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
  END IF;
END$$;

-- 2) Drop admin/view-all style policies on merchants that may depend on profiles
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='public' AND tablename='merchants'
      AND policyname NOT IN (
        'Anyone can view active merchants',
        'Merchants can manage their own stores'
      )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.merchants', r.policyname);
  END LOOP;
END$$;

-- Ensure safe merchants policies exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='merchants' AND policyname='Anyone can view active merchants'
  ) THEN
    CREATE POLICY "Anyone can view active merchants" ON public.merchants FOR SELECT USING (is_active = true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='merchants' AND policyname='Merchants can manage their own stores'
  ) THEN
    CREATE POLICY "Merchants can manage their own stores" ON public.merchants FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
  END IF;
END$$;

COMMIT;
