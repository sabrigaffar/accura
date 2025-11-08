-- Integrate promotion_rules into pricing engine via calculate_order_quote_v2 and update apply_promotions_tx
BEGIN;

-- v2 pricing: combine legacy promotions with rule-based promotions
CREATE OR REPLACE FUNCTION calculate_order_quote_v2(
  p_customer_id uuid,
  p_store_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_delivery_fee numeric,
  p_tax numeric DEFAULT 0
) RETURNS TABLE(
  subtotal numeric,
  service_fee numeric,
  discount numeric,
  total numeric,
  applied_promotion uuid,
  applied_rule uuid,
  apply_on text
) AS $$
DECLARE
  v_subtotal numeric := 0;
  v_service_fee numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_now timestamptz := now();
  v_currency text;
  v_promo uuid := NULL;
  v_promo_discount numeric := 0;
  v_rule uuid := NULL;
  v_rule_apply_on text := NULL;
  v_rule_discount numeric := 0;
  v_store_category text := NULL;
  v_df numeric := COALESCE(p_delivery_fee, 0);
BEGIN
  -- compute base
  v_subtotal := COALESCE((
    SELECT COALESCE(SUM( ((elem->>'price')::numeric) * ((elem->>'quantity')::int) ), 0)
    FROM jsonb_array_elements(p_items) AS elem
  ), 0);
  SELECT currency, service_fee_flat INTO v_currency, v_service_fee FROM platform_settings WHERE id = 1;
  v_service_fee := COALESCE(v_service_fee, 0);

  -- fetch store category (text)
  SELECT category INTO v_store_category FROM merchants WHERE id = p_store_id;

  -- legacy promotions best-single
  WITH candidates AS (
    SELECT p.id, p.discount_type, p.discount_amount
    FROM promotions p
    WHERE p.is_active = true
      AND p.start_at <= v_now
      AND (p.end_at IS NULL OR v_now <= p.end_at)
      AND (
        (p.audience = 'all' AND (p.target_id IS NULL))
        OR (p.audience = 'customer' AND (p.target_id IS NULL OR p.target_id = p_customer_id))
        OR (p.audience = 'merchant' AND (p.target_id IS NULL OR p.target_id = p_store_id))
      )
  ), scored AS (
    SELECT c.id,
      CASE WHEN c.discount_type = 'percent' THEN ROUND(v_subtotal * (c.discount_amount/100.0), 2)
           WHEN c.discount_type = 'flat' THEN c.discount_amount
           ELSE 0 END AS disc
    FROM candidates c
  )
  SELECT s.id, s.disc INTO v_promo, v_promo_discount
  FROM scored s
  ORDER BY s.disc DESC NULLS LAST
  LIMIT 1;

  v_promo_discount := COALESCE(v_promo_discount, 0);
  IF v_promo_discount > v_subtotal THEN v_promo_discount := v_subtotal; END IF;

  -- rule-based promotions best-single (respect apply_on)
  WITH rule_candidates AS (
    SELECT r.id, r.discount_type, r.discount_amount, r.apply_on, r.priority, r.payment_filter, r.min_subtotal
    FROM promotion_rules r
    WHERE r.is_active = true
      AND r.start_at <= v_now
      AND (r.end_at IS NULL OR v_now <= r.end_at)
      AND (r.audience = 'all' OR r.audience = 'customer')
      AND (r.store_id IS NULL OR r.store_id = p_store_id)
      AND (r.merchant_category IS NULL OR r.merchant_category::text = COALESCE(v_store_category,'')::text)
      AND (
        r.payment_filter = 'any'
        OR (r.payment_filter = 'cash' AND lower(p_payment_method) LIKE '%cash%')
        OR (r.payment_filter = 'card' AND lower(p_payment_method) NOT LIKE '%cash%')
      )
      AND (r.min_subtotal IS NULL OR v_subtotal >= r.min_subtotal)
  ), rule_scored AS (
    SELECT rc.id, rc.apply_on, rc.priority,
      CASE
        WHEN rc.apply_on = 'subtotal' THEN (
          CASE WHEN rc.discount_type = 'percent' THEN ROUND(v_subtotal * (rc.discount_amount/100.0), 2)
               WHEN rc.discount_type = 'flat' THEN rc.discount_amount ELSE 0 END)
        WHEN rc.apply_on = 'delivery_fee' THEN (
          CASE WHEN rc.discount_type = 'percent' THEN ROUND(v_df * (rc.discount_amount/100.0), 2)
               WHEN rc.discount_type = 'flat' THEN rc.discount_amount ELSE 0 END)
        WHEN rc.apply_on = 'service_fee' THEN (
          CASE WHEN rc.discount_type = 'percent' THEN ROUND(v_service_fee * (rc.discount_amount/100.0), 2)
               WHEN rc.discount_type = 'flat' THEN rc.discount_amount ELSE 0 END)
        ELSE 0
      END AS disc
    FROM rule_candidates rc
  )
  SELECT rs.id, rs.apply_on, rs.disc
  INTO v_rule, v_rule_apply_on, v_rule_discount
  FROM rule_scored rs
  ORDER BY rs.disc DESC NULLS LAST, rs.priority ASC
  LIMIT 1;

  v_rule_discount := COALESCE(v_rule_discount, 0);
  -- clamp rule discount to its base
  IF v_rule_apply_on = 'subtotal' AND v_rule_discount > v_subtotal THEN v_rule_discount := v_subtotal; END IF;
  IF v_rule_apply_on = 'delivery_fee' AND v_rule_discount > v_df THEN v_rule_discount := v_df; END IF;
  IF v_rule_apply_on = 'service_fee' AND v_rule_discount > v_service_fee THEN v_rule_discount := v_service_fee; END IF;

  -- choose best impact
  IF v_rule_discount > v_promo_discount THEN
    v_discount := v_rule_discount;
    applied_promotion := NULL;
    applied_rule := v_rule;
    apply_on := v_rule_apply_on;
  ELSE
    v_discount := v_promo_discount;
    applied_promotion := v_promo;
    applied_rule := NULL;
    apply_on := 'subtotal'; -- legacy promotions always applied on subtotal
  END IF;

  v_total := v_subtotal + v_df + v_service_fee + COALESCE(p_tax,0) - COALESCE(v_discount,0);

  RETURN QUERY SELECT v_subtotal, v_service_fee, COALESCE(v_discount,0), v_total, applied_promotion, applied_rule, apply_on;
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION calculate_order_quote_v2(uuid, uuid, jsonb, text, numeric, numeric) TO authenticated;

-- Update apply_promotions_tx to use v2
CREATE OR REPLACE FUNCTION apply_promotions_tx(p_order_id uuid)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_items jsonb := '[]'::jsonb;
  v_quote record;
  v_subtotal numeric := 0;
  v_service_fee numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'الطلب غير موجود'::text; RETURN;
  END IF;

  -- Build items JSON from order_items (support price or unit_price)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('price', COALESCE(price, unit_price, 0), 'quantity', quantity)), '[]'::jsonb)
  INTO v_items
  FROM order_items
  WHERE order_id = p_order_id;

  SELECT * INTO v_quote
  FROM calculate_order_quote_v2(
    v_order.customer_id,
    v_order.merchant_id,
    v_items,
    v_order.payment_method,
    v_order.delivery_fee,
    COALESCE(v_order.tax, 0)
  );

  v_subtotal := COALESCE(v_quote.subtotal, 0);
  v_service_fee := COALESCE(v_quote.service_fee, COALESCE(v_order.service_fee, 0));
  v_discount := COALESCE(v_quote.discount, 0);
  v_total := COALESCE(v_quote.total, v_order.total);

  UPDATE orders
  SET subtotal = v_subtotal,
      service_fee = v_service_fee,
      discount = v_discount,
      total = v_total,
      updated_at = now()
  WHERE id = p_order_id;

  -- record applied promo/rule (idempotent by order + amount)
  IF v_discount > 0 THEN
    INSERT INTO order_discounts(order_id, promotion_id, amount, details)
    VALUES (
      p_order_id,
      v_quote.applied_promotion,
      v_discount,
      jsonb_build_object(
        'source','apply_promotions_tx_v2',
        'rule_id', v_quote.applied_rule,
        'apply_on', v_quote.apply_on
      )
    );
  END IF;

  RETURN QUERY SELECT true, 'تم تطبيق العروض على الطلب (v2)'::text; RETURN;
END $$;

GRANT EXECUTE ON FUNCTION apply_promotions_tx(uuid) TO authenticated;

COMMIT;
