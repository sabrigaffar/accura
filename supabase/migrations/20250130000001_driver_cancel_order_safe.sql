-- ========================================
-- RPC: driver_cancel_order_safe
-- Allows the assigned driver to cancel an active order safely, logs the reason,
-- and returns the order back to the available pool (status = 'ready').
-- ========================================

CREATE OR REPLACE FUNCTION driver_cancel_order_safe(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
  v_order record;
BEGIN
  -- Ensure auth
  v_driver_id := auth.uid();
  IF v_driver_id IS NULL THEN
    RETURN QUERY SELECT false, 'يجب تسجيل الدخول'::text; RETURN; END IF;

  -- Fetch order
  SELECT id, status, driver_id INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'الطلب غير موجود'::text; RETURN; END IF;

  -- Must be the assigned driver
  IF v_order.driver_id IS DISTINCT FROM v_driver_id THEN
    RETURN QUERY SELECT false, 'لا تملك صلاحية إلغاء هذا الطلب'::text; RETURN; END IF;

  -- Only cancel if in active driver states
  IF v_order.status NOT IN ('accepted','picked_up','on_the_way','heading_to_customer','heading_to_merchant') THEN
    RETURN QUERY SELECT false, 'لا يمكن إلغاء الطلب في حالته الحالية'::text; RETURN; END IF;

  -- Log cancellation (ignore errors if table missing)
  BEGIN
    INSERT INTO driver_cancellations(driver_id, order_id, reason)
    VALUES (v_driver_id, p_order_id, COALESCE(NULLIF(p_reason, ''), 'بدون سبب'));
  EXCEPTION WHEN OTHERS THEN
    -- ignore logging errors
    NULL;
  END;

  -- Return order to available pool
  UPDATE orders
  SET driver_id = NULL,
      status = 'ready',
      updated_at = now()
  WHERE id = p_order_id;

  RETURN QUERY SELECT true, 'تم إلغاء الطلب وإعادته للطلبات المتاحة'::text; RETURN;
END; $$;

GRANT EXECUTE ON FUNCTION driver_cancel_order_safe(uuid, text) TO authenticated;
