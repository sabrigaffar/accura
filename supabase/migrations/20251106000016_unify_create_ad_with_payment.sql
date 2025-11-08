-- Unify create_ad_with_payment signature to avoid PostgREST overloading ambiguity
-- Keep enum-typed parameters and gating logic (promotion_rule inactive until admin approval)
-- Date: 2025-11-06

BEGIN;

-- Drop any existing overloaded signatures to remove ambiguity
DROP FUNCTION IF EXISTS public.create_ad_with_payment(
  uuid, text, text, text, text, integer, timestamptz, timestamptz, numeric, text, numeric, text, uuid
);
DROP FUNCTION IF EXISTS public.create_ad_with_payment(
  uuid, text, text, text, text, integer, timestamptz, timestamptz, numeric, public.discount_type_enum, numeric, public.promo_apply_on_enum, uuid
);

-- Recreate a single authoritative version using enums + proper wallet + inactive rule
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
  p_target_product_id uuid DEFAULT NULL
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
    discount_type, discount_amount, apply_on, target_product_id, offer_label
  ) VALUES (
    p_merchant_id, p_ad_type, p_title, p_description, p_image_url, p_priority,
    p_start_date, p_end_date, false, p_budget_amount, v_cost_per_click, v_cost_per_impression,
    'pending', 'paid', p_budget_amount,
    p_discount_type,
    p_discount_amount,
    COALESCE(p_apply_on, 'subtotal'::public.promo_apply_on_enum),
    p_target_product_id,
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
      name, is_active, start_at, end_at, audience, store_id, discount_type, discount_amount, apply_on, priority, target_product_id
    ) VALUES (
      CONCAT('عرض إعلان: ', COALESCE(p_title, 'إعلان')),
      false, p_start_date, p_end_date, 'all', p_merchant_id,
      p_discount_type,
      p_discount_amount,
      COALESCE(p_apply_on,'subtotal'::public.promo_apply_on_enum),
      100,
      p_target_product_id
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
  public.discount_type_enum, numeric, public.promo_apply_on_enum, uuid
) TO authenticated;

COMMIT;
