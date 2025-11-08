-- Add stock checking and reservation functions
-- Prevents customers from ordering more than available quantity
-- Prevents merchants from accepting more orders than stock allows
-- Date: 2025-11-03

BEGIN;

-- Function to check if product has enough stock for requested quantity
CREATE OR REPLACE FUNCTION public.check_product_stock(
  p_product_id uuid,
  p_requested_quantity integer
)
RETURNS TABLE(available boolean, current_stock integer, message text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quantity integer;
BEGIN
  -- Get current product quantity
  SELECT COALESCE(quantity, 0) INTO v_quantity
  FROM public.products
  WHERE id = p_product_id;

  -- If product not found
  IF v_quantity IS NULL THEN
    RETURN QUERY SELECT false, 0, 'المنتج غير موجود'::text;
    RETURN;
  END IF;

  -- Check if enough stock
  IF v_quantity >= p_requested_quantity THEN
    RETURN QUERY SELECT true, v_quantity, 'متوفر'::text;
  ELSE
    RETURN QUERY SELECT false, v_quantity, format('الكمية المتاحة فقط %s', v_quantity)::text;
  END IF;
END;
$$;

-- Function to reserve stock when merchant accepts order (deduct from quantity)
CREATE OR REPLACE FUNCTION public.reserve_order_stock(p_order_id uuid)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item record;
  v_product_quantity integer;
  v_insufficient_products text := '';
BEGIN
  -- Loop through all items in the order
  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    -- Get current product quantity
    SELECT COALESCE(quantity, 0) INTO v_product_quantity
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE; -- Lock row for update

    -- Check if enough stock
    IF v_product_quantity < v_item.quantity THEN
      v_insufficient_products := v_insufficient_products || format('منتج %s (متوفر: %s، مطلوب: %s)، ', 
        v_item.product_id, v_product_quantity, v_item.quantity);
    ELSE
      -- Deduct quantity
      UPDATE public.products
      SET quantity = quantity - v_item.quantity,
          updated_at = now()
      WHERE id = v_item.product_id;
    END IF;
  END LOOP;

  -- If any products had insufficient stock
  IF v_insufficient_products <> '' THEN
    ok := false;
    message := 'مخزون غير كافٍ: ' || v_insufficient_products;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Success
  ok := true;
  message := 'تم حجز المخزون بنجاح';
  RETURN NEXT;
  RETURN;
END;
$$;

-- Function to release stock when order is cancelled/rejected (add back to quantity)
CREATE OR REPLACE FUNCTION public.release_order_stock(p_order_id uuid)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item record;
BEGIN
  -- Loop through all items in the order and add back quantity
  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    UPDATE public.products
    SET quantity = quantity + v_item.quantity,
        updated_at = now()
    WHERE id = v_item.product_id;
  END LOOP;

  ok := true;
  message := 'تم إرجاع المخزون بنجاح';
  RETURN NEXT;
  RETURN;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_product_stock(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_order_stock(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_order_stock(uuid) TO authenticated;

COMMIT;
