-- Fix stock reservation functions to use merchant_products.stock instead of public.products.quantity
-- Also make reservation atomic by validating first, then deducting
-- Date: 2025-11-06

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
  v_stock integer;
BEGIN
  -- Get current product stock
  SELECT stock INTO v_stock
  FROM public.merchant_products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'المنتج غير موجود'::text; RETURN;
  END IF;

  v_stock := COALESCE(v_stock, 0);

  IF v_stock >= p_requested_quantity THEN
    RETURN QUERY SELECT true, v_stock, 'متوفر'::text;
  ELSE
    RETURN QUERY SELECT false, v_stock, format('الكمية المتاحة فقط %s', v_stock)::text;
  END IF;
END;
$$;

-- Function to reserve stock when merchant accepts order (deduct from stock)
CREATE OR REPLACE FUNCTION public.reserve_order_stock(p_order_id uuid)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item record;
  v_stock integer;
  v_insufficient_products text := '';
BEGIN
  -- First pass: validate and lock product rows
  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    SELECT stock INTO v_stock
    FROM public.merchant_products
    WHERE id = v_item.product_id
    FOR UPDATE; -- lock row

    IF NOT FOUND THEN
      v_insufficient_products := v_insufficient_products || format('منتج %s غير موجود، ', v_item.product_id);
    ELSIF COALESCE(v_stock, 0) < v_item.quantity THEN
      v_insufficient_products := v_insufficient_products || format('منتج %s (متوفر: %s، مطلوب: %s)، ', v_item.product_id, COALESCE(v_stock, 0), v_item.quantity);
    END IF;
  END LOOP;

  -- If any products had insufficient stock, do not update anything
  IF v_insufficient_products <> '' THEN
    ok := false;
    message := 'مخزون غير كافٍ: ' || v_insufficient_products;
    RETURN NEXT; RETURN;
  END IF;

  -- Second pass: deduct quantities
  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    UPDATE public.merchant_products
    SET stock = stock - v_item.quantity,
        updated_at = now()
    WHERE id = v_item.product_id;
  END LOOP;

  ok := true;
  message := 'تم حجز المخزون بنجاح';
  RETURN NEXT; RETURN;
END;
$$;

-- Function to release stock when order is cancelled/rejected (add back to stock)
CREATE OR REPLACE FUNCTION public.release_order_stock(p_order_id uuid)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item record;
BEGIN
  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    UPDATE public.merchant_products
    SET stock = stock + v_item.quantity,
        updated_at = now()
    WHERE id = v_item.product_id;
  END LOOP;

  ok := true;
  message := 'تم إرجاع المخزون بنجاح';
  RETURN NEXT; RETURN;
END;
$$;

-- Ensure execute permissions
GRANT EXECUTE ON FUNCTION public.check_product_stock(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_order_stock(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_order_stock(uuid) TO authenticated;

COMMIT;
