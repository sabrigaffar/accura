-- Extend sponsored_ads with offer fields and link to promotion_rules
BEGIN;

-- 1) Columns for offer definition and linkage
ALTER TABLE sponsored_ads
  ADD COLUMN IF NOT EXISTS discount_type text CHECK (discount_type IN ('percent','flat')),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS apply_on text DEFAULT 'subtotal' CHECK (apply_on IN ('subtotal','delivery_fee','service_fee','product')),
  ADD COLUMN IF NOT EXISTS target_product_id uuid,
  ADD COLUMN IF NOT EXISTS offer_label text,
  ADD COLUMN IF NOT EXISTS promotion_rule_id uuid REFERENCES promotion_rules(id);

-- 2) Replace create_ad_with_payment to accept offer params and credit admin wallet
DROP FUNCTION IF EXISTS create_ad_with_payment(uuid, text, text, text, text, integer, timestamptz, timestamptz, numeric);
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
  -- offer params
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
  -- Get pricing settings
  SELECT cost_per_click, cost_per_impression 
  INTO v_cost_per_click, v_cost_per_impression
  FROM platform_ad_settings
  WHERE id = '00000000-0000-0000-0000-000000000001';
  
  -- Get merchant wallet
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE owner_id = p_merchant_id AND owner_type = 'merchant';
  
  IF v_wallet_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'المحفظة غير موجودة');
  END IF;
  IF v_current_balance < p_budget_amount THEN
    RETURN json_build_object('success', false, 'error', 'رصيد المحفظة غير كافٍ');
  END IF;

  -- Create ad (pending approval)
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

  -- Deduct from merchant wallet
  UPDATE wallets SET balance = balance - p_budget_amount WHERE id = v_wallet_id;
  INSERT INTO wallet_transactions (wallet_id, amount, type, memo)
  VALUES (v_wallet_id, -p_budget_amount, 'ad_payment', 'دفع ميزانية إعلان: ' || p_title)
  RETURNING id INTO v_transaction_id;
  
  -- Credit platform (admin) wallet immediately with budget
  SELECT id INTO v_admin_wallet FROM wallets WHERE owner_type = 'admin' LIMIT 1;
  IF v_admin_wallet IS NULL THEN
    INSERT INTO wallets(owner_id, owner_type, balance) VALUES (gen_random_uuid(), 'admin', 0)
    RETURNING id INTO v_admin_wallet;
  END IF;
  UPDATE wallets SET balance = balance + p_budget_amount WHERE id = v_admin_wallet;
  INSERT INTO wallet_transactions (wallet_id, amount, type, memo)
  VALUES (v_admin_wallet, p_budget_amount, 'ad_payment', 'استلام ميزانية إعلان: ' || p_title);

  -- If offer provided, auto-create promotion rule and link it
  IF p_discount_type IS NOT NULL AND p_discount_amount IS NOT NULL THEN
    INSERT INTO promotion_rules(
      is_active, start_at, end_at, audience, store_id, discount_type, discount_amount, apply_on, priority, target_product_id
    ) VALUES (
      true, p_start_date, p_end_date, 'all', p_merchant_id, p_discount_type, p_discount_amount, COALESCE(p_apply_on,'subtotal'), 100, p_target_product_id
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

-- 3) Adjust refund to also debit admin wallet when returning unused budget
CREATE OR REPLACE FUNCTION refund_unused_ad_budget(
  p_ad_id uuid
)
RETURNS json
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_merchant_id uuid;
  v_budget_amount numeric;
  v_total_spent numeric;
  v_unused_amount numeric;
  v_wallet_id uuid;
  v_transaction_id uuid;
  v_ad_title text;
  v_admin_wallet uuid;
BEGIN
  SELECT merchant_id, budget_amount, total_spent, title
  INTO v_merchant_id, v_budget_amount, v_total_spent, v_ad_title
  FROM sponsored_ads
  WHERE id = p_ad_id AND approval_status = 'approved' AND payment_status = 'paid';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'الإعلان غير موجود أو تم استرجاع أمواله مسبقاً');
  END IF;

  v_unused_amount := v_budget_amount - v_total_spent;
  IF v_unused_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'لا يوجد مبلغ متبقٍ للاسترجاع');
  END IF;

  SELECT id INTO v_wallet_id FROM wallets WHERE owner_id = v_merchant_id AND owner_type = 'merchant';
  UPDATE wallets SET balance = balance + v_unused_amount WHERE id = v_wallet_id;
  INSERT INTO wallet_transactions (wallet_id, amount, type, memo)
  VALUES (v_wallet_id, v_unused_amount, 'ad_refund', 'استرجاع المتبقي من إعلان: ' || v_ad_title)
  RETURNING id INTO v_transaction_id;

  -- Debit admin wallet accordingly
  SELECT id INTO v_admin_wallet FROM wallets WHERE owner_type = 'admin' LIMIT 1;
  IF v_admin_wallet IS NULL THEN
    INSERT INTO wallets(owner_id, owner_type, balance) VALUES (gen_random_uuid(), 'admin', 0)
    RETURNING id INTO v_admin_wallet;
  END IF;
  UPDATE wallets SET balance = balance - v_unused_amount WHERE id = v_admin_wallet;
  INSERT INTO wallet_transactions (wallet_id, amount, type, memo)
  VALUES (v_admin_wallet, -v_unused_amount, 'ad_refund', 'إرجاع المتبقي لإعلان: ' || v_ad_title);

  UPDATE sponsored_ads
  SET refund_transaction_id = v_transaction_id,
      amount_refunded = v_unused_amount,
      payment_status = 'refunded'
  WHERE id = p_ad_id;

  RETURN json_build_object('success', true, 'refunded_amount', v_unused_amount);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMIT;

-- Permissions
GRANT EXECUTE ON FUNCTION create_ad_with_payment(
  uuid, text, text, text, text, integer, timestamptz, timestamptz, numeric, text, numeric, text, uuid
) TO authenticated;
