-- Allow customers to view driver profiles assigned to their orders
-- Date: 2025-11-13

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_customer_view_driver'
  ) THEN
    CREATE POLICY profiles_select_customer_view_driver ON public.profiles
      FOR SELECT TO authenticated
      USING (
        id = auth.uid() -- self
        OR EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.customer_id = auth.uid()
            AND o.driver_id = profiles.id
        )
      );
  END IF;
END $$;

COMMIT;
