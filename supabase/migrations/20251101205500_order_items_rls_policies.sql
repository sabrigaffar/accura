-- RLS policies for order_items to allow customers to manage items of their own orders
BEGIN;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Insert: allow authenticated users to insert items for their own orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_items' AND policyname='order_items_insert_own_order'
  ) THEN
    CREATE POLICY order_items_insert_own_order
      ON public.order_items
      AS PERMISSIVE
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = order_id
            AND o.customer_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Update: allow customers to update their own order items while order is pending
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_items' AND policyname='order_items_update_own_pending'
  ) THEN
    CREATE POLICY order_items_update_own_pending
      ON public.order_items
      AS PERMISSIVE
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = order_id
            AND o.customer_id = auth.uid()
            AND (o.status::text = 'pending' OR o.status IS NULL)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = order_id
            AND o.customer_id = auth.uid()
            AND (o.status::text = 'pending' OR o.status IS NULL)
        )
      );
  END IF;
END $$;

-- Delete: allow customers to remove items while order is pending
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_items' AND policyname='order_items_delete_own_pending'
  ) THEN
    CREATE POLICY order_items_delete_own_pending
      ON public.order_items
      AS PERMISSIVE
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = order_id
            AND o.customer_id = auth.uid()
            AND (o.status::text = 'pending' OR o.status IS NULL)
        )
      );
  END IF;
END $$;

COMMIT;
