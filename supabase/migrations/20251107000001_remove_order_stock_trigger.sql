-- Remove legacy stock update trigger and function to avoid double-deduction
-- We now rely on explicit RPCs: reserve_order_stock / release_order_stock
-- Date: 2025-11-07

BEGIN;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_order_accepted ON public.orders;

-- Drop function if exists
DROP FUNCTION IF EXISTS public.update_product_quantities();

COMMIT;
