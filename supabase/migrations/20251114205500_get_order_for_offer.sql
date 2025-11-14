-- RPC to fetch order details for drivers with an offer
-- Date: 2025-11-14

BEGIN;

DROP FUNCTION IF EXISTS public.get_order_for_offer(uuid);
CREATE OR REPLACE FUNCTION public.get_order_for_offer(p_order_id uuid)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT o.*
  FROM public.orders o
  WHERE o.id = p_order_id
    AND EXISTS (
      SELECT 1 FROM public.driver_order_offers dof
      WHERE dof.order_id = o.id AND dof.driver_id = auth.uid()
    );
END $$;

REVOKE ALL ON FUNCTION public.get_order_for_offer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_for_offer(uuid) TO authenticated;

COMMIT;
