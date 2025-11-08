-- Allow merchants to view customer profiles connected to their own orders
-- Fixes merchant order card showing default name/phone due to RLS blocking profiles join
-- Date: 2025-11-06

BEGIN;

-- Be idempotent across environments
DROP POLICY IF EXISTS "Merchants can view customers of their orders" ON public.profiles;

CREATE POLICY "Merchants can view customers of their orders"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.merchants m ON m.id = o.merchant_id
      WHERE o.customer_id = profiles.id
        AND m.owner_id = auth.uid()
    )
  );

COMMIT;
