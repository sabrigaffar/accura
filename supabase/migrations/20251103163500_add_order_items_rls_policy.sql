-- Add RLS policy for order_items to allow drivers to view items for orders they can see
-- Date: 2025-11-03

BEGIN;

-- Drop existing policies if any
DROP POLICY IF EXISTS "order_items_select_policy" ON public.order_items;

-- Allow authenticated users to view order_items for orders they have access to
CREATE POLICY "order_items_select_policy"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
    AND (
      -- Customer can see their own orders
      o.customer_id = auth.uid()
      -- Merchant can see orders for their stores
      OR EXISTS (
        SELECT 1 FROM public.merchants m
        WHERE m.id = o.merchant_id
        AND m.owner_id = auth.uid()
      )
      -- Driver can see orders assigned to them OR ready orders (not yet assigned)
      OR o.driver_id = auth.uid()
      OR (o.status = 'ready' AND o.driver_id IS NULL)
    )
  )
);

COMMIT;
