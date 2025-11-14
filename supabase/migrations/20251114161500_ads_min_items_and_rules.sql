-- Add min_items support for sponsored ads and promotion rules, and update pricing functions
-- Date: 2025-11-14

BEGIN;

-- 1) Add min_items columns
ALTER TABLE IF EXISTS public.sponsored_ads
  ADD COLUMN IF NOT EXISTS min_items integer;

ALTER TABLE IF EXISTS public.promotion_rules
  ADD COLUMN IF NOT EXISTS min_items integer;

-- 2) Update create_ad_with_payment to accept p_min_items and persist it
DROP FUNCTION IF EXISTS public.create_ad_with_payment(
  uuid, text, text, text, text, integer, timestamptz, timestamptz, numeric,
  public.discount_type_enum, numeric, public.promo_apply_on_enum, uuid
);

CREATE OR REPLACE FUNCTION public.create_ad_with_payment(
  p_merchant_id uuid,
  p_ad_type text,
  p_title text,
  p_description text,
  p_image_url text,
  p_priority integer,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_budget_amount numeric,
  -- offer params
  p_discount_type public.discount_type_enum DEFAULT NULL,
  p_discount_amount numeric DEFAULT NULL,
  p_apply_on public.promo_apply_on_enum DEFAULT 'subtotal',
  p_target_product_id uuid DEFAULT NULL,
  p_min_items integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ad_id uuid;
  v_user_id uuid;
  v_wallet_id uuid;
  v_current_balance numeric;
  v_transaction_id uuid;
  v_cost_per_click numeric;
  v_cost_per_impression numeric;
  v_admin_wallet uuid;
  v_rule_id uuid;
BEGIN
  -- Resolve user (owner) from merchant
  SELECT owner_id INTO v_user_id
  FROM merchants
  WHERE id = p_merchant_id;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'المتجر غير موجود');
  END IF;

  -- Pricing settings
  SELECT cost_per_click, cost_per_impression 
  INTO v_cost_per_click, v_cost_per_impression
  FROM platform_ad_settings
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- Get merchant owner's wallet
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE owner_id = v_user_id AND owner_type = 'merchant';

  IF v_wallet_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'المحفظة غير موجودة');
  END IF;
  IF v_current_balance < p_budget_amount THEN
    RETURN json_build_object('success', false, 'error', 'رصيد المحفظة غير كافٍ');
  END IF;

  -- Create ad (pending approval, not active yet)
  INSERT INTO sponsored_ads (
    merchant_id, ad_type, title, description, image_url, priority,
    start_date, end_date, is_active, budget_amount, cost_per_click, cost_per_impression,
    approval_status, payment_status, amount_paid,
    discount_type, discount_amount, apply_on, target_product_id, min_items, offer_label
  ) VALUES (
    p_merchant_id, p_ad_type, p_title, p_description, p_image_url, p_priority,
    p_start_date, p_end_date, false, p_budget_amount, v_cost_per_click, v_cost_per_impression,
    'pending', 'paid', p_budget_amount,
    p_discount_type,
    p_discount_amount,
    COALESCE(p_apply_on, 'subtotal'::public.promo_apply_on_enum),
    p_target_product_id,
    p_min_items,
    CASE 
      WHEN p_discount_type = 'percent'::public.discount_type_enum THEN CONCAT('خصم ', COALESCE(p_discount_amount,0),'%')
      WHEN p_discount_type = 'flat'::public.discount_type_enum THEN CONCAT('خصم ', COALESCE(p_discount_amount,0),' ج')
      ELSE NULL END
  ) RETURNING id INTO v_ad_id;

  -- Debit owner's wallet
  UPDATE wallets SET balance = balance - p_budget_amount WHERE id = v_wallet_id;
  INSERT INTO wallet_transactions (wallet_id, amount, type, memo)
  VALUES (v_wallet_id, -p_budget_amount, 'ad_payment', 'دفع ميزانية إعلان: ' || p_title)
  RETURNING id INTO v_transaction_id;

  -- Credit platform (admin) wallet
  SELECT id INTO v_admin_wallet FROM wallets WHERE owner_type = 'admin' LIMIT 1;
  IF v_admin_wallet IS NULL THEN
    INSERT INTO wallets(owner_id, owner_type, balance) VALUES (gen_random_uuid(), 'admin', 0)
    RETURNING id INTO v_admin_wallet;
  END IF;
  UPDATE wallets SET balance = balance + p_budget_amount WHERE id = v_admin_wallet;
  INSERT INTO wallet_transactions (wallet_id, amount, type, memo)
  VALUES (v_admin_wallet, p_budget_amount, 'ad_payment', 'استلام ميزانية إعلان: ' || p_title);

  -- Auto-create promotion rule (INACTIVE until admin approval)
  IF p_discount_type IS NOT NULL AND p_discount_amount IS NOT NULL THEN
    INSERT INTO promotion_rules(
      name, is_active, start_at, end_at, audience, store_id, discount_type, discount_amount, apply_on, priority, target_product_id, min_items
    ) VALUES (
      CONCAT('عرض إعلان: ', COALESCE(p_title, 'إعلان')),
      false, p_start_date, p_end_date, 'all', p_merchant_id,
      p_discount_type,
      p_discount_amount,
      COALESCE(p_apply_on,'subtotal'::public.promo_apply_on_enum),
      100,
      p_target_product_id,
      p_min_items
    ) RETURNING id INTO v_rule_id;

    UPDATE sponsored_ads SET promotion_rule_id = v_rule_id WHERE id = v_ad_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'ad_id', v_ad_id,
    'transaction_id', v_transaction_id,
    'message', 'تم إنشاء الإعلان بنجاح وسيتم مراجعته من قبل الإدارة'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_ad_with_payment(
  uuid, text, text, text, text, integer, timestamptz, timestamptz, numeric,
  public.discount_type_enum, numeric, public.promo_apply_on_enum, uuid, integer
) TO authenticated;

-- 3) Update calculate_order_quote_v2 to check min_items on rules
CREATE OR REPLACE FUNCTION public.calculate_order_quote_v2(
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
  v_items_count int := 0;
BEGIN
  -- compute base subtotal from all items
  v_subtotal := COALESCE((
    SELECT COALESCE(SUM( ((elem->>'price')::numeric) * ((elem->>'quantity')::int) ), 0)
    FROM jsonb_array_elements(p_items) AS elem
  ), 0);

  -- compute total quantity across all items
  SELECT COALESCE(SUM((elem->>'quantity')::int), 0) INTO v_items_count
  FROM jsonb_array_elements(p_items) AS elem;

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

  -- rule-based promotions best-single (respect apply_on and product target and min_items)
  WITH rule_candidates AS (
    SELECT r.id, r.discount_type, r.discount_amount, r.apply_on, r.priority, r.payment_filter, r.min_subtotal, r.target_product_id, r.min_items
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
      AND (r.min_items IS NULL OR v_items_count >= r.min_items)
  ), rule_scored AS (
    SELECT rc.id, rc.apply_on, rc.priority, rc.target_product_id,
      CASE
        WHEN rc.apply_on = 'product' AND rc.target_product_id IS NOT NULL THEN (
          -- sum only targeted product lines
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

-- 4) Update quote_order_v3 to enforce ad.min_items if provided
CREATE OR REPLACE FUNCTION public.quote_order_v3(
  p_customer_id uuid,
  p_store_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_delivery_fee numeric,
  p_tax numeric DEFAULT 0,
  p_ad_id uuid DEFAULT NULL
)
RETURNS TABLE(
  subtotal numeric,
  delivery_fee numeric,
  service_fee numeric,
  tax numeric,
  discount numeric,
  total numeric,
  applied_promotion uuid,
  applied_rule uuid,
  apply_on text,
  applied_ad uuid,
  ad_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q RECORD;
  v_now timestamptz := now();
  v_ad RECORD;
  v_ad_discount numeric := 0;
  v_apply_on text := NULL;
  v_subtotal numeric := 0;
  v_df numeric := COALESCE(p_delivery_fee, 0);
  v_service_fee numeric := 0;
  v_best_discount numeric := 0;
  v_best_apply_on text := NULL;
  v_applied_ad uuid := NULL;
  v_product_base numeric := 0;
  v_items_count int := 0;
BEGIN
  -- compute items count once
  SELECT COALESCE(SUM((elem->>'quantity')::int), 0) INTO v_items_count
  FROM jsonb_array_elements(p_items) AS elem;

  SELECT * INTO v_q FROM public.calculate_order_quote_v2(p_customer_id, p_store_id, p_items, p_payment_method, p_delivery_fee, p_tax);
  v_subtotal := COALESCE(v_q.subtotal, 0);
  v_service_fee := COALESCE(v_q.service_fee, 0);
  v_best_discount := COALESCE(v_q.discount, 0);
  v_best_apply_on := v_q.apply_on;

  IF p_ad_id IS NOT NULL THEN
    SELECT * INTO v_ad FROM public.sponsored_ads WHERE id = p_ad_id;
    IF FOUND THEN
      IF v_ad.deleted_at IS NULL
         AND v_ad.merchant_id = p_store_id
         AND v_ad.approval_status = 'approved'
         AND v_ad.is_active = true
         AND v_ad.start_date <= v_now
         AND (v_ad.end_date IS NULL OR v_now <= v_ad.end_date)
         AND v_ad.total_spent < v_ad.budget_amount
         AND v_ad.discount_type IS NOT NULL
         AND v_ad.discount_amount IS NOT NULL
         AND (v_ad.min_items IS NULL OR v_items_count >= v_ad.min_items)
      THEN
        v_apply_on := COALESCE(v_ad.apply_on, 'subtotal');
        IF v_apply_on = 'product' AND v_ad.target_product_id IS NOT NULL THEN
          SELECT COALESCE(SUM(((elem->>'price')::numeric) * ((elem->>'quantity')::int)), 0)
          INTO v_product_base
          FROM jsonb_array_elements(p_items) AS elem
          WHERE elem->>'product_id' = v_ad.target_product_id::text;

          IF v_ad.discount_type = 'percent' THEN
            v_ad_discount := ROUND(v_product_base * (v_ad.discount_amount/100.0), 2);
          ELSE
            v_ad_discount := v_ad.discount_amount;
          END IF;
          IF v_ad_discount > v_product_base THEN v_ad_discount := v_product_base; END IF;
        ELSIF v_apply_on = 'delivery_fee' THEN
          v_ad_discount := CASE WHEN v_ad.discount_type = 'percent' THEN ROUND(v_df * (v_ad.discount_amount/100.0), 2) ELSE v_ad.discount_amount END;
          IF v_ad_discount > v_df THEN v_ad_discount := v_df; END IF;
        ELSIF v_apply_on = 'service_fee' THEN
          v_ad_discount := CASE WHEN v_ad.discount_type = 'percent' THEN ROUND(v_service_fee * (v_ad.discount_amount/100.0), 2) ELSE v_ad.discount_amount END;
          IF v_ad_discount > v_service_fee THEN v_ad_discount := v_service_fee; END IF;
        ELSE
          v_ad_discount := CASE WHEN v_ad.discount_type = 'percent' THEN ROUND(v_subtotal * (v_ad.discount_amount/100.0), 2) ELSE v_ad.discount_amount END;
          IF v_ad_discount > v_subtotal THEN v_ad_discount := v_subtotal; END IF;
        END IF;

        IF v_ad_discount > v_best_discount THEN
          v_best_discount := v_ad_discount;
          v_best_apply_on := v_apply_on;
          v_applied_ad := p_ad_id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    v_subtotal,
    v_df,
    v_service_fee,
    COALESCE(p_tax,0),
    COALESCE(v_best_discount,0),
    v_subtotal + v_df + v_service_fee + COALESCE(p_tax,0) - COALESCE(v_best_discount,0),
    v_q.applied_promotion,
    v_q.applied_rule,
    v_best_apply_on,
    v_applied_ad,
    CASE WHEN v_applied_ad IS NOT NULL THEN 'ad_applied' ELSE 'no_ad' END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.quote_order_v3(uuid, uuid, jsonb, text, numeric, numeric, uuid) TO authenticated, anon;

COMMIT;
