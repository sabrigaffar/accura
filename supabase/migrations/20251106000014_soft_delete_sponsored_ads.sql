-- Soft delete for sponsored_ads and tighten gating in functions and policies
-- Date: 2025-11-06

BEGIN;

-- 1) Add soft delete column
ALTER TABLE public.sponsored_ads
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2) Update public view policy to exclude deleted
DROP POLICY IF EXISTS sponsored_ads_public_view ON public.sponsored_ads;
CREATE POLICY sponsored_ads_public_view
ON public.sponsored_ads
FOR SELECT
TO anon, authenticated
USING (
  deleted_at IS NULL
  AND is_active = true
  AND approval_status = 'approved'
  AND start_date <= now()
  AND (end_date IS NULL OR now() <= end_date)
  AND total_spent < budget_amount
);

-- 3) Update get_active_sponsored_ads to exclude deleted
DROP FUNCTION IF EXISTS get_active_sponsored_ads(text, integer);
CREATE OR REPLACE FUNCTION get_active_sponsored_ads(
  p_ad_type text DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  merchant_id uuid,
  merchant_name text,
  ad_type text,
  title text,
  description text,
  image_url text,
  priority integer,
  impression_count integer,
  click_count integer,
  ctr numeric
) 
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.id,
    sa.merchant_id,
    m.name_ar as merchant_name,
    sa.ad_type,
    sa.title,
    sa.description,
    sa.image_url,
    sa.priority,
    sa.impression_count,
    sa.click_count,
    CASE 
      WHEN sa.impression_count > 0 
      THEN ROUND((sa.click_count::numeric / sa.impression_count::numeric) * 100, 2)
      ELSE 0
    END as ctr
  FROM sponsored_ads sa
  JOIN merchants m ON m.id = sa.merchant_id
  WHERE 
    sa.deleted_at IS NULL
    AND sa.is_active = true
    AND sa.approval_status = 'approved'
    AND sa.start_date <= now()
    AND (sa.end_date IS NULL OR now() <= sa.end_date)
    AND sa.total_spent < sa.budget_amount
    AND (p_ad_type IS NULL OR sa.ad_type = p_ad_type)
  ORDER BY sa.priority DESC, sa.created_at DESC
  LIMIT p_limit;
END;
$$;

-- 4) Update calculate_order_quote_v2 gating to exclude deleted ads via rule linkage
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
  v_subtotal := COALESCE((
    SELECT COALESCE(SUM( ((elem->>'price')::numeric) * ((elem->>'quantity')::int) ), 0)
    FROM jsonb_array_elements(p_items) AS elem
  ), 0);
  SELECT currency, service_fee_flat INTO v_currency, v_service_fee FROM platform_settings WHERE id = 1;
  v_service_fee := COALESCE(v_service_fee, 0);

  SELECT category INTO v_store_category FROM merchants WHERE id = p_store_id;

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

  WITH rule_candidates AS (
    SELECT r.id, r.discount_type, r.discount_amount, r.apply_on, r.priority, r.payment_filter, r.min_subtotal, r.target_product_id
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
      AND (
        NOT EXISTS (SELECT 1 FROM sponsored_ads sa WHERE sa.promotion_rule_id = r.id)
        OR EXISTS (
          SELECT 1 FROM sponsored_ads sa
          WHERE sa.promotion_rule_id = r.id
            AND sa.deleted_at IS NULL
            AND sa.approval_status = 'approved'
            AND sa.is_active = true
            AND sa.start_date <= v_now
            AND (sa.end_date IS NULL OR v_now <= sa.end_date)
            AND sa.total_spent < sa.budget_amount
        )
      )
  ), rule_scored AS (
    SELECT rc.id, rc.apply_on, rc.priority, rc.target_product_id,
      CASE
        WHEN rc.apply_on = 'product' AND rc.target_product_id IS NOT NULL THEN (
          (
            SELECT COALESCE(SUM( ((elem->>'price')::numeric) * ((elem->>'quantity')::int) ), 0)
            FROM jsonb_array_elements(p_items) AS elem
            WHERE elem->>'product_id' = rc.target_product_id::text
          ) * CASE WHEN rc.discount_type = 'percent' THEN (rc.discount_amount/100.0) ELSE 0 END
        ) + CASE WHEN rc.apply_on = 'product' AND rc.discount_type = 'flat' THEN rc.discount_amount ELSE 0 END
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
  IF v_rule_apply_on = 'subtotal' AND v_rule_discount > v_subtotal THEN v_rule_discount := v_subtotal; END IF;
  IF v_rule_apply_on = 'delivery_fee' AND v_rule_discount > v_df THEN v_rule_discount := v_df; END IF;
  IF v_rule_apply_on = 'service_fee' AND v_rule_discount > v_service_fee THEN v_rule_discount := v_service_fee; END IF;

  IF v_rule_discount > v_promo_discount THEN
    v_discount := v_rule_discount;
    applied_promotion := NULL;
    applied_rule := v_rule;
    apply_on := v_rule_apply_on;
  ELSE
    v_discount := v_promo_discount;
    applied_promotion := v_promo;
    applied_rule := NULL;
    apply_on := 'subtotal';
  END IF;

  v_total := v_subtotal + v_df + v_service_fee + COALESCE(p_tax,0) - COALESCE(v_discount,0);

  RETURN QUERY SELECT v_subtotal, v_service_fee, COALESCE(v_discount,0), v_total, applied_promotion, applied_rule, apply_on;
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5) Update apply_ad_discount_if_eligible to exclude deleted ads
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

  IF v_ad.deleted_at IS NOT NULL THEN
    RETURN QUERY SELECT false, 'الإعلان محذوف'::text; RETURN;
  END IF;

  IF v_ad.approval_status <> 'approved' OR v_ad.is_active = false OR v_ad.start_date > now() OR (v_ad.end_date IS NOT NULL AND v_ad.end_date < now()) OR v_ad.total_spent >= v_ad.budget_amount THEN
    RETURN QUERY SELECT false, 'الإعلان غير نشط حالياً'::text; RETURN;
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'الطلب غير موجود'::text; RETURN; END IF;

  IF v_order.merchant_id <> v_ad.merchant_id THEN
    RETURN QUERY SELECT false, 'المتجر لا يطابق الإعلان'::text; RETURN;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', product_id, 'price', COALESCE(price, unit_price, 0), 'quantity', quantity)), '[]'::jsonb)
  INTO v_items
  FROM order_items WHERE order_id = p_order_id;

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

  UPDATE orders
  SET discount = COALESCE(discount,0) + v_discount,
      total = GREATEST(0, COALESCE(total,0) - v_discount),
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO order_discounts(order_id, promotion_id, amount, details)
  VALUES (
    p_order_id,
    NULL,
    v_discount,
    jsonb_build_object('source','apply_ad_discount_if_eligible','ad_id', p_ad_id, 'apply_on', v_apply_on)
  );

  PERFORM record_ad_conversion(p_ad_id, p_order_id);

  RETURN QUERY SELECT true, 'تم تطبيق خصم الإعلان وتسجيل التحويل'::text; RETURN;
END;
$$;

-- 6) Merchant delete RPC: soft delete ad and disable linked rule
CREATE OR REPLACE FUNCTION merchant_delete_sponsored_ad(p_ad_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ad RECORD;
BEGIN
  SELECT sa.* INTO v_ad
  FROM sponsored_ads sa
  JOIN merchants m ON m.id = sa.merchant_id
  WHERE sa.id = p_ad_id AND m.owner_id = auth.uid();

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح بحذف هذا الإعلان أو غير موجود');
  END IF;

  -- Soft delete: mark deleted and inactive
  UPDATE sponsored_ads
  SET deleted_at = now(), is_active = false
  WHERE id = p_ad_id;

  -- Disable linked rule (if any)
  UPDATE promotion_rules r
  SET is_active = false
  WHERE r.id = (SELECT promotion_rule_id FROM sponsored_ads WHERE id = p_ad_id);

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION merchant_delete_sponsored_ad(uuid) TO authenticated;

COMMIT;
