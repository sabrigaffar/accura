-- ========================================
-- RPC: get_orders_items_summary
-- Returns up to p_limit items (product name + quantity) per order for a list of orders
-- Visible if: order.status = 'ready' OR order.driver_id = auth.uid()
-- Prices are NOT returned.
-- ========================================

CREATE OR REPLACE FUNCTION get_orders_items_summary(
  p_order_ids uuid[],
  p_limit integer DEFAULT 3
)
RETURNS TABLE(order_id uuid, product_name text, quantity integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT 
      o.id AS order_id,
      COALESCE(oi.product_name_ar, mp.name_ar, 'منتج') AS product_name,
      COALESCE(oi.quantity, 1) AS quantity,
      ROW_NUMBER() OVER (PARTITION BY o.id ORDER BY oi.created_at NULLS LAST, oi.id) AS rn
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN merchant_products mp ON mp.id = oi.product_id
    WHERE o.id = ANY(p_order_ids)
      AND (
        o.status = 'ready' OR
        o.driver_id = auth.uid()
      )
  )
  SELECT order_id, product_name, quantity
  FROM base
  WHERE rn <= GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION get_orders_items_summary(uuid[], integer) TO authenticated;
