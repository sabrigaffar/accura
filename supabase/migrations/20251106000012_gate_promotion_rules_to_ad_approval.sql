-- Gate promotion_rules created from sponsored ads by the ad's approval state
-- Also ensure create/approve/reject functions keep rule activation in sync
-- And ensure pricing engine ignores rules tied to unapproved ads
-- Date: 2025-11-06

BEGIN;

-- 1) Replace create_ad_with_payment to create promotion_rule as inactive until approval
DROP FUNCTION IF EXISTS create_ad_with_payment(uuid, text, text, text, text, integer, timestamptz, timestamptz, numeric, text, numeric, text, uuid);
CREATE OR REPLACE FUNCTION create_ad_with_payment(
  p_merchant_id uuid,
  p_ad_type text,
  p_title text,
  p_description text,
  p_image_url text,
  p_priority integer,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_budget_amount numeric,
  p_discount_type text DEFAULT NULL,
  p_discount_amount numeric DEFAULT NULL,
  p_apply_on text DEFAULT 'subtotal',
  p_target_product_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ad_id uuid;
  v_wallet_id uuid;
  v_current_balance numeric;
  v_transaction_id uuid;
  v_cost_per_click numeric;
  v_cost_per_impression numeric;
  v_admin_wallet uuid;
  v_rule_id uuid;
BEGIN
  SELECT cost_per_click, cost_per_impression 
  INTO v_cost_per_click, v_cost_per_impression
  FROM platform_ad_settings
  WHERE id = '00000000-0000-0000-0000-000000000001';
  
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE owner_id = p_merchant_id AND owner_type = 'merchant';
  
  IF v_wallet_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'المحفظة غير موجودة');
  END IF;
  IF v_current_balance < p_budget_amount THEN
    RETURN json_build_object('success', false, 'error', 'رصيد المحفظة غير كافٍ');
  END IF;

  INSERT INTO sponsored_ads (
    merchant_id, ad_type, title, description, image_url, priority,
    start_date, end_date, is_active, budget_amount, cost_per_click, cost_per_impression,
    approval_status, payment_status, amount_paid,
    discount_type, discount_amount, apply_on, target_product_id, offer_label
  ) VALUES (
    p_merchant_id, p_ad_type, p_title, p_description, p_image_url, p_priority,
    p_start_date, p_end_date, false, p_budget_amount, v_cost_per_click, v_cost_per_impression,
    'pending', 'paid', p_budget_amount,
    p_discount_type, p_discount_amount, COALESCE(p_apply_on, 'subtotal'), p_target_product_id,
    CASE 
      WHEN p_discount_type = 'percent' THEN CONCAT('خصم ', COALESCE(p_discount_amount,0),'%')
      WHEN p_discount_type = 'flat' THEN CONCAT('خصم ', COALESCE(p_discount_amount,0),' ج')
      ELSE NULL END
  ) RETURNING id INTO v_ad_id;

  UPDATE wallets SET balance = balance - p_budget_amount WHERE id = v_wallet_id;
  INSERT INTO wallet_transactions (wallet_id, amount, type, memo)
  VALUES (v_wallet_id, -p_budget_amount, 'ad_payment', 'دفع ميزانية إعلان: ' || p_title)
  RETURNING id INTO v_transaction_id;
  
  SELECT id INTO v_admin_wallet FROM wallets WHERE owner_type = 'admin' LIMIT 1;
  IF v_admin_wallet IS NULL THEN
    INSERT INTO wallets(owner_id, owner_type, balance) VALUES (gen_random_uuid(), 'admin', 0)
    RETURNING id INTO v_admin_wallet;
  END IF;
  UPDATE wallets SET balance = balance + p_budget_amount WHERE id = v_admin_wallet;
  INSERT INTO wallet_transactions (wallet_id, amount, type, memo)
  VALUES (v_admin_wallet, p_budget_amount, 'ad_payment', 'استلام ميزانية إعلان: ' || p_title);

  IF p_discount_type IS NOT NULL AND p_discount_amount IS NOT NULL THEN
    INSERT INTO promotion_rules(
      is_active, start_at, end_at, audience, store_id, discount_type, discount_amount, apply_on, priority, target_product_id
    ) VALUES (
      false, p_start_date, p_end_date, 'all', p_merchant_id, p_discount_type, p_discount_amount, COALESCE(p_apply_on,'subtotal'), 100, p_target_product_id
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

-- 2) Update approve_ad to activate linked rule
DROP FUNCTION IF EXISTS approve_ad(uuid, uuid);
CREATE OR REPLACE FUNCTION approve_ad(
  p_ad_id uuid,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE sponsored_ads
  SET 
    approval_status = 'approved',
    approved_by = p_admin_id,
    approved_at = now(),
    is_active = true
  WHERE id = p_ad_id
    AND approval_status = 'pending';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الإعلان غير موجود أو تمت الموافقة عليه مسبقاً';
  END IF;

  UPDATE promotion_rules r
  SET is_active = true
  WHERE r.id = (SELECT promotion_rule_id FROM sponsored_ads WHERE id = p_ad_id);
END;
$$;

-- 3) Update reject_ad to keep linked rule inactive
DROP FUNCTION IF EXISTS reject_ad(uuid, uuid, text);
CREATE OR REPLACE FUNCTION reject_ad(
  p_ad_id uuid,
  p_admin_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_merchant_id uuid;
  v_budget_amount numeric;
  v_wallet_id uuid;
  v_transaction_id uuid;
BEGIN
  UPDATE sponsored_ads
  SET 
    approval_status = 'rejected',
    approved_by = p_admin_id,
    approved_at = now(),
    rejection_reason = p_reason,
    is_active = false
  WHERE id = p_ad_id AND approval_status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الإعلان غير موجود أو تمت مراجعته مسبقاً';
  END IF;

  UPDATE promotion_rules r
  SET is_active = false
  WHERE r.id = (SELECT promotion_rule_id FROM sponsored_ads WHERE id = p_ad_id);

  SELECT merchant_id, budget_amount INTO v_merchant_id, v_budget_amount
  FROM sponsored_ads WHERE id = p_ad_id;

  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE owner_id = v_merchant_id AND owner_type = 'merchant';
  
  UPDATE wallets
  SET balance = balance + v_budget_amount
  WHERE id = v_wallet_id;
  
  INSERT INTO wallet_transactions (wallet_id, amount, type, memo)
  VALUES (v_wallet_id, v_budget_amount, 'ad_refund', 'استرجاع ميزانية إعلان مرفوض: ' || p_reason)
  RETURNING id INTO v_transaction_id;
END;
$$;

-- 4) Update recreate_promotion_rule_for_ad to set rule active only if ad approved
DROP FUNCTION IF EXISTS recreate_promotion_rule_for_ad(uuid);
CREATE OR REPLACE FUNCTION recreate_promotion_rule_for_ad(p_ad_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule_id uuid;
  v_ad RECORD;
  v_is_active boolean := false;
BEGIN
  SELECT id, merchant_id, title, start_date, end_date,
         discount_type, discount_amount, apply_on, target_product_id, approval_status
  INTO v_ad
  FROM sponsored_ads
  WHERE id = p_ad_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'الإعلان غير موجود');
  END IF;

  IF v_ad.discount_type IS NULL OR v_ad.discount_amount IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'الإعلان لا يحتوي بيانات عرض');
  END IF;

  v_is_active := (v_ad.approval_status = 'approved');

  INSERT INTO promotion_rules(
    name, is_active, start_at, end_at, audience, store_id, discount_type, discount_amount, apply_on, priority, target_product_id
  ) VALUES (
    CONCAT('عرض إعلان: ', COALESCE(v_ad.title, 'إعلان')),
    v_is_active,
    v_ad.start_date,
    v_ad.end_date,
    'all',
    v_ad.merchant_id,
    (v_ad.discount_type::text)::discount_type_enum,
    v_ad.discount_amount,
    COALESCE((v_ad.apply_on::text), 'subtotal')::promo_apply_on_enum,
    100,
    v_ad.target_product_id
  ) RETURNING id INTO v_rule_id;

  UPDATE sponsored_ads SET promotion_rule_id = v_rule_id WHERE id = p_ad_id;

  RETURN json_build_object('success', true, 'promotion_rule_id', v_rule_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 5) Gate rule_candidates inside calculate_order_quote_v2 against unapproved ad-linked rules
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

-- 6) Tighten RLS on promotion_rules for public selection
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='promotion_rules' AND policyname='promotion_rules_select_all'
  ) THEN
    DROP POLICY promotion_rules_select_all ON public.promotion_rules;
  END IF;
END $$;

DROP POLICY IF EXISTS promotion_rules_public_select ON public.promotion_rules;
CREATE POLICY promotion_rules_public_select
ON public.promotion_rules
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND start_at <= now()
  AND (end_at IS NULL OR now() <= end_at)
  AND (
    NOT EXISTS (SELECT 1 FROM public.sponsored_ads sa WHERE sa.promotion_rule_id = promotion_rules.id)
    OR EXISTS (
      SELECT 1 FROM public.sponsored_ads sa
      WHERE sa.promotion_rule_id = promotion_rules.id
        AND sa.approval_status = 'approved'
        AND sa.is_active = true
        AND sa.start_date <= now()
        AND (sa.end_date IS NULL OR now() <= sa.end_date)
        AND sa.total_spent < sa.budget_amount
    )
  )
);

DROP POLICY IF EXISTS promotion_rules_admin_all ON public.promotion_rules;
CREATE POLICY promotion_rules_admin_all
ON public.promotion_rules
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

DROP POLICY IF EXISTS promotion_rules_merchant_select ON public.promotion_rules;
CREATE POLICY promotion_rules_merchant_select
ON public.promotion_rules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id = promotion_rules.store_id
      AND m.owner_id = auth.uid()
  )
);

COMMIT;
