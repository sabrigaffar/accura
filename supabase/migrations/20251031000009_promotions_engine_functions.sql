-- Promotions engine: order_discounts table, calculate_order_quote_json, apply_promotions_tx

-- 1) order_discounts table
CREATE TABLE IF NOT EXISTS order_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  promotion_id uuid NULL REFERENCES promotions(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  details jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_discounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_discounts' AND policyname='order_discounts_select_own'
  ) THEN
    CREATE POLICY order_discounts_select_own ON order_discounts FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_discounts.order_id
          AND (o.customer_id = auth.uid() OR o.merchant_id = auth.uid() OR o.driver_id = auth.uid())
      )
    );
  END IF;
END $$;

-- 2) Helper: compute subtotal from JSON items [{ price, quantity }]
CREATE OR REPLACE FUNCTION _compute_subtotal_from_items(p_items jsonb)
RETURNS numeric
LANGUAGE sql
AS $$
  SELECT COALESCE(SUM( ( (elem->>'price')::numeric ) * ( (elem->>'quantity')::int ) ), 0)
  FROM jsonb_array_elements(p_items) AS elem;
$$;

-- 3) calculate_order_quote_json
CREATE OR REPLACE FUNCTION calculate_order_quote_json(
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
  applied_promotion uuid
) AS $$
DECLARE
  v_subtotal numeric := 0;
  v_service_fee numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_applied uuid := NULL;
  v_now timestamptz := now();
  v_currency text;
BEGIN
  v_subtotal := _compute_subtotal_from_items(p_items);
  SELECT currency, service_fee_flat INTO v_currency, v_service_fee FROM platform_settings WHERE id = 1;
  v_service_fee := COALESCE(v_service_fee, 0);

  -- Choose best applicable promotion (simple best-single rule)
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
  SELECT s.id, s.disc
  INTO v_applied, v_discount
  FROM scored s
  ORDER BY s.disc DESC NULLS LAST
  LIMIT 1;

  v_discount := COALESCE(v_discount, 0);
  IF v_discount > v_subtotal THEN v_discount := v_subtotal; END IF;

  v_total := v_subtotal + COALESCE(p_delivery_fee,0) + v_service_fee + COALESCE(p_tax,0) - v_discount;

  RETURN QUERY SELECT v_subtotal, v_service_fee, v_discount, v_total, v_applied;
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION calculate_order_quote_json(uuid, uuid, jsonb, text, numeric, numeric) TO authenticated;

-- 4) apply_promotions_tx: recompute on server after items inserted
CREATE OR REPLACE FUNCTION apply_promotions_tx(p_order_id uuid)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_items jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_service_fee numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_promo uuid := NULL;
  v_quote record;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'الطلب غير موجود'::text; RETURN;
  END IF;

  -- Build items JSON from order_items
  SELECT COALESCE(jsonb_agg(jsonb_build_object('price', price, 'quantity', quantity)), '[]'::jsonb)
  INTO v_items
  FROM order_items
  WHERE order_id = p_order_id;

  SELECT * INTO v_quote
  FROM calculate_order_quote_json(
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
  v_promo := v_quote.applied_promotion;

  UPDATE orders
  SET subtotal = v_subtotal,
      service_fee = v_service_fee,
      discount = v_discount,
      total = v_total,
      updated_at = now()
  WHERE id = p_order_id;

  -- record applied promo (idempotent per order/promo)
  IF v_promo IS NOT NULL AND v_discount > 0 THEN
    INSERT INTO order_discounts(order_id, promotion_id, amount, details)
    VALUES (p_order_id, v_promo, v_discount, jsonb_build_object('source','apply_promotions_tx'))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN QUERY SELECT true, 'تم تطبيق العروض على الطلب'::text; RETURN;
END $$;

GRANT EXECUTE ON FUNCTION apply_promotions_tx(uuid) TO authenticated;
