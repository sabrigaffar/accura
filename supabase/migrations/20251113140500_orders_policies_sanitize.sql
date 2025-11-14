-- Sanitize orders RLS policies to avoid recursion and standardize access
-- Date: 2025-11-13

BEGIN;

-- Ensure RLS enabled
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='orders' AND c.relrowsecurity
  ) THEN
    ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop any policies on orders that reference profiles/reviews (potential recursion sources)
DO $$ DECLARE r record; BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='public' AND tablename='orders'
      AND (
        COALESCE(qual,'') ILIKE '%profiles%'
        OR COALESCE(qual,'') ILIKE '%reviews%'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON public.orders', r.policyname);
  END LOOP;
END $$;

-- Ensure minimal safe policies exist
DO $$ BEGIN
  -- customer can read own orders
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='orders_select_customer'
  ) THEN
    CREATE POLICY orders_select_customer ON public.orders
      FOR SELECT TO authenticated
      USING (customer_id = auth.uid());
  END IF;

  -- driver can read orders assigned to them
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='orders_select_driver'
  ) THEN
    CREATE POLICY orders_select_driver ON public.orders
      FOR SELECT TO authenticated
      USING (driver_id = auth.uid());
  END IF;

  -- merchant owner can read orders of their stores
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='orders_select_merchant_owner'
  ) THEN
    CREATE POLICY orders_select_merchant_owner ON public.orders
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.merchants m
          WHERE m.id = orders.merchant_id AND m.owner_id = auth.uid()
        )
      );
  END IF;

  -- admin full read
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='orders_select_admin'
  ) THEN
    CREATE POLICY orders_select_admin ON public.orders
      FOR SELECT TO authenticated
      USING (public.is_admin());
  END IF;
END $$;

COMMIT;
