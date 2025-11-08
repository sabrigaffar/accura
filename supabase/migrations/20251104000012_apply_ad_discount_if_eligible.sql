-- Apply ad discount only if order comes from that ad and record conversion
BEGIN;

CREATE OR REPLACE FUNCTION apply_ad_discount_if_eligible(
  p_order_id uuid,
  p_ad_id uuid
)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ad record;
  v_order record;
  v_items jsonb := '[]'::jsonb;
  v_discount numeric := 0;
  v_apply_on text := 'subtotal';
  v_product_base numeric := 0;
BEGIN
  SELECT * INTO v_ad FROM sponsored_ads WHERE id = p_ad_id;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'الإعلان غير موجود'::text; RETURN; END IF;

  -- must be approved and within window and have budget left
  IF v_ad.approval_status <> 'approved' OR v_ad.is_active = false OR v_ad.start_date > now() OR v_ad.end_date < now() OR v_ad.total_spent >= v_ad.budget_amount THEN
    RETURN QUERY SELECT false, 'الإعلان غير نشط حالياً'::text; RETURN;
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'الطلب غير موجود'::text; RETURN; END IF;

  -- must be same merchant
  IF v_order.merchant_id <> v_ad.merchant_id THEN
    RETURN QUERY SELECT false, 'المتجر لا يطابق الإعلان'::text; RETURN;
  END IF;

  -- build items list with product_id, price, quantity
  SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', product_id, 'price', COALESCE(price, unit_price, 0), 'quantity', quantity)), '[]'::jsonb)
  INTO v_items
  FROM order_items WHERE order_id = p_order_id;

  -- compute discount based on ad's offer
  v_apply_on := COALESCE(v_ad.apply_on, 'subtotal');

  IF v_ad.discount_type IS NULL OR v_ad.discount_amount IS NULL THEN
    RETURN QUERY SELECT false, 'لا يوجد عرض مرتبط بالإعلان'::text; RETURN;
  END IF;

  IF v_apply_on = 'product' AND v_ad.target_product_id IS NOT NULL THEN
    SELECT COALESCE(SUM( ((elem->>'price')::numeric) * ((elem->>'quantity')::int) ), 0)
    INTO v_product_base
    FROM jsonb_array_elements(v_items) AS elem
    WHERE elem->>'product_id' = v_ad.target_product_id::text;

    IF v_ad.discount_type = 'percent' THEN
      v_discount := ROUND(v_product_base * (v_ad.discount_amount/100.0), 2);
    ELSE
      v_discount := v_ad.discount_amount;
    END IF;
    IF v_discount > v_product_base THEN v_discount := v_product_base; END IF;
  ELSIF v_apply_on = 'delivery_fee' THEN
    IF v_ad.discount_type = 'percent' THEN
      v_discount := ROUND(COALESCE(v_order.delivery_fee,0) * (v_ad.discount_amount/100.0), 2);
    ELSE
      v_discount := v_ad.discount_amount;
    END IF;
    IF v_discount > COALESCE(v_order.delivery_fee,0) THEN v_discount := COALESCE(v_order.delivery_fee,0); END IF;
  ELSIF v_apply_on = 'service_fee' THEN
    IF v_ad.discount_type = 'percent' THEN
      v_discount := ROUND(COALESCE(v_order.service_fee,0) * (v_ad.discount_amount/100.0), 2);
    ELSE
      v_discount := v_ad.discount_amount;
    END IF;
    IF v_discount > COALESCE(v_order.service_fee,0) THEN v_discount := COALESCE(v_order.service_fee,0); END IF;
  ELSE
    -- subtotal
    SELECT COALESCE(SUM( ((elem->>'price')::numeric) * ((elem->>'quantity')::int) ), 0)
    INTO v_product_base
    FROM jsonb_array_elements(v_items) AS elem;

    IF v_ad.discount_type = 'percent' THEN
      v_discount := ROUND(v_product_base * (v_ad.discount_amount/100.0), 2);
    ELSE
      v_discount := v_ad.discount_amount;
    END IF;
    IF v_discount > v_product_base THEN v_discount := v_product_base; END IF;
  END IF;

  IF v_discount <= 0 THEN
    RETURN QUERY SELECT false, 'لا يوجد خصم قابل للتطبيق'::text; RETURN;
  END IF;

  -- apply to order totals
  UPDATE orders
  SET discount = COALESCE(discount,0) + v_discount,
      total = GREATEST(0, COALESCE(total,0) - v_discount),
      updated_at = now()
  WHERE id = p_order_id;

  -- record discount row
  INSERT INTO order_discounts(order_id, promotion_id, amount, details)
  VALUES (
    p_order_id,
    NULL,
    v_discount,
    jsonb_build_object('source','apply_ad_discount_if_eligible','ad_id', p_ad_id, 'apply_on', v_apply_on)
  );

  -- mark conversion
  PERFORM record_ad_conversion(p_ad_id, p_order_id);

  RETURN QUERY SELECT true, 'تم تطبيق خصم الإعلان وتسجيل التحويل'::text; RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_ad_discount_if_eligible(uuid, uuid) TO authenticated;

COMMIT;
