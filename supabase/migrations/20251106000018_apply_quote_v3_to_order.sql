-- Apply the same best-of (promotions/rules vs ad) logic used by quote_order_v3 to a persisted order
-- Date: 2025-11-06

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_quote_v3_to_order(
  p_order_id uuid,
  p_ad_id uuid DEFAULT NULL
)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_items jsonb := '[]'::jsonb;
  v_q RECORD;
  v_customer_id uuid;
  v_store_id uuid;
  v_payment_method text;
  v_delivery_fee numeric;
  v_tax numeric;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'الطلب غير موجود'::text; RETURN;
  END IF;

  -- Build items JSON
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'product_id', product_id,
            'price', COALESCE(price, unit_price, 0),
            'quantity', quantity
          )), '[]'::jsonb)
  INTO v_items
  FROM public.order_items
  WHERE order_id = p_order_id;

  v_customer_id := v_order.customer_id;
  v_store_id := v_order.merchant_id; -- store_id mirrors merchant_id
  v_payment_method := COALESCE(v_order.payment_method::text, 'cash');
  v_delivery_fee := COALESCE(v_order.delivery_fee, 0);
  v_tax := COALESCE(v_order.tax, 0);

  SELECT * INTO v_q
  FROM public.quote_order_v3(
    v_customer_id,
    v_store_id,
    v_items,
    v_payment_method,
    v_delivery_fee,
    v_tax,
    p_ad_id
  );

  -- Update order to match quote breakdown
  UPDATE public.orders
  SET subtotal = COALESCE(v_q.subtotal, subtotal),
      service_fee = COALESCE(v_q.service_fee, service_fee),
      discount = COALESCE(v_q.discount, 0),
      total = COALESCE(v_q.total, total),
      updated_at = now()
  WHERE id = p_order_id;

  -- Remove prior auto-calculated discount rows from our previous engines to avoid duplication
  DELETE FROM public.order_discounts
  WHERE order_id = p_order_id
    AND (details->>'source') IN (
      'apply_promotions_tx_v2',
      'apply_ad_discount_if_eligible',
      'apply_quote_v3_to_order'
    );

  -- Record the applied discount if any
  IF COALESCE(v_q.discount, 0) > 0 THEN
    INSERT INTO public.order_discounts(order_id, promotion_id, amount, details)
    VALUES (
      p_order_id,
      v_q.applied_promotion,
      v_q.discount,
      jsonb_build_object(
        'source','apply_quote_v3_to_order',
        'rule_id', v_q.applied_rule,
        'apply_on', v_q.apply_on,
        'ad_id', v_q.applied_ad
      )
    );
  END IF;

  RETURN QUERY SELECT true, 'تم تطبيق تسعير الكوت بشكل نهائي على الطلب'::text; RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_quote_v3_to_order(uuid, uuid) TO authenticated;

COMMIT;
