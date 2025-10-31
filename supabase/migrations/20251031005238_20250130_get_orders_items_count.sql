-- ========================================
-- RPC: get_orders_items_count
-- Returns items_count for a list of orders the caller is allowed to see.
-- - Before acceptance: allows READY orders for any caller (count only, no details)
-- - After acceptance: allows orders assigned to the current driver
-- ========================================

CREATE OR REPLACE FUNCTION get_orders_items_count(
  p_order_ids uuid[]
)
RETURNS TABLE(order_id uuid, items_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id AS order_id,
         COALESCE(COUNT(oi.*), 0)::int AS items_count
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  WHERE o.id = ANY(p_order_ids)
    AND (
      o.status = 'ready' OR
      o.driver_id = auth.uid()
    )
  GROUP BY o.id
$$;

GRANT EXECUTE ON FUNCTION get_orders_items_count(uuid[]) TO authenticated;
