-- Fix create_ad_with_payment to use USER-level wallet (owner_id = merchants.owner_id)
-- and fix refund_unused_ad_budget to credit/debit the USER wallet as well.

BEGIN;

-- Drop text-based CHECK constraints that block enum conversion (safe if absent)
ALTER TABLE sponsored_ads DROP CONSTRAINT IF EXISTS sponsored_ads_discount_type_check;
ALTER TABLE sponsored_ads DROP CONSTRAINT IF EXISTS sponsored_ads_apply_on_check;

-- Drop any lingering CHECK constraints that reference these columns (name may vary)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE contype='c' AND conrelid='public.sponsored_ads'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%discount_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.sponsored_ads DROP CONSTRAINT %I', r.conname);
  END LOOP;

  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE contype='c' AND conrelid='public.sponsored_ads'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%apply_on%'
  LOOP
    EXECUTE format('ALTER TABLE public.sponsored_ads DROP CONSTRAINT %I', r.conname);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping enum conversion for sponsored_ads due to: %', SQLERRM;
END $$;

-- Drop defaults to avoid implicit casts during type change
ALTER TABLE sponsored_ads ALTER COLUMN discount_type DROP DEFAULT;
ALTER TABLE sponsored_ads ALTER COLUMN apply_on DROP DEFAULT;

-- Ensure sponsored_ads columns use enum types if currently text
DO $$
BEGIN
  -- discount_type -> discount_type_enum
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sponsored_ads' AND column_name = 'discount_type'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'sponsored_ads' AND column_name = 'discount_type' AND udt_name <> 'discount_type_enum'
    ) THEN
      ALTER TABLE sponsored_ads 
      ALTER COLUMN discount_type TYPE discount_type_enum 
      USING (CASE WHEN discount_type IS NULL THEN NULL ELSE discount_type::discount_type_enum END);
    END IF;
  END IF;

  -- apply_on -> promo_apply_on_enum
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sponsored_ads' AND column_name = 'apply_on'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'sponsored_ads' AND column_name = 'apply_on' AND udt_name <> 'promo_apply_on_enum'
    ) THEN
      ALTER TABLE sponsored_ads 
      ALTER COLUMN apply_on TYPE promo_apply_on_enum 
      USING (CASE WHEN apply_on IS NULL THEN 'subtotal'::promo_apply_on_enum ELSE apply_on::promo_apply_on_enum END);
    END IF;
  END IF;
END $$;

-- Replace create_ad_with_payment to resolve 'المحفظة غير موجودة' when using user wallets
DROP FUNCTION IF EXISTS create_ad_with_payment(uuid, text, text, text, text, integer, timestamptz, timestamptz, numeric, text, numeric, text, uuid);
DROP FUNCTION IF EXISTS create_ad_with_payment(uuid, text, text, text, text, integer, timestamptz, timestamptz, numeric, discount_type_enum, numeric, promo_apply_on_enum, uuid);
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
  p_discount_type discount_type_enum DEFAULT NULL,
  p_discount_amount numeric DEFAULT NULL,
  p_apply_on promo_apply_on_enum DEFAULT 'subtotal',
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
  -- Resolve user_id from merchant
  SELECT owner_id INTO v_user_id
  FROM merchants
  WHERE id = p_merchant_id;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'المتجر غير موجود');
  END IF;

  -- Pricing
  SELECT cost_per_click, cost_per_impression 
  INTO v_cost_per_click, v_cost_per_impression
  FROM platform_ad_settings
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- Get USER wallet (owner_type kept as 'merchant' for merchants)
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE owner_id = v_user_id AND owner_type = 'merchant';

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
    p_discount_type,
    p_discount_amount,
    COALESCE(p_apply_on, 'subtotal'::promo_apply_on_enum),
    p_target_product_id,
    CASE 
      WHEN p_discount_type = 'percent'::discount_type_enum THEN CONCAT('خصم ', COALESCE(p_discount_amount,0),'%')
      WHEN p_discount_type = 'flat'::discount_type_enum THEN CONCAT('خصم ', COALESCE(p_discount_amount,0),' ج')
      ELSE NULL END
  ) RETURNING id INTO v_ad_id;

  -- Deduct from USER wallet
  UPDATE wallets SET balance = balance - p_budget_amount WHERE id = v_wallet_id;
  INSERT INTO wallet_transactions (wallet_id, amount, type, memo)
  VALUES (v_wallet_id, -p_budget_amount, 'ad_payment', 'دفع ميزانية إعلان: ' || p_title)
  RETURNING id INTO v_transaction_id;

  -- Credit platform (admin) wallet with budget
  SELECT id INTO v_admin_wallet FROM wallets WHERE owner_type = 'admin' LIMIT 1;
  IF v_admin_wallet IS NULL THEN
    INSERT INTO wallets(owner_id, owner_type, balance) VALUES (gen_random_uuid(), 'admin', 0)
    RETURNING id INTO v_admin_wallet;
  END IF;
  UPDATE wallets SET balance = balance + p_budget_amount WHERE id = v_admin_wallet;
  INSERT INTO wallet_transactions (wallet_id, amount, type, memo)
  VALUES (v_admin_wallet, p_budget_amount, 'ad_payment', 'استلام ميزانية إعلان: ' || p_title);

  -- Auto-create promotion rule if offer provided
  IF p_discount_type IS NOT NULL AND p_discount_amount IS NOT NULL THEN
    INSERT INTO promotion_rules(
      name, is_active, start_at, end_at, audience, store_id, discount_type, discount_amount, apply_on, priority, target_product_id
    ) VALUES (
      CONCAT('عرض إعلان: ', COALESCE(p_title, 'إعلان')),
      true, p_start_date, p_end_date, 'all', p_merchant_id,
      p_discount_type,
      p_discount_amount,
      COALESCE(p_apply_on,'subtotal'::promo_apply_on_enum),
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

-- Update refund_unused_ad_budget to use USER wallet
CREATE OR REPLACE FUNCTION refund_unused_ad_budget(
  p_ad_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant_id uuid;
  v_user_id uuid;
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

  -- Resolve user_id
  SELECT owner_id INTO v_user_id
  FROM merchants
  WHERE id = v_merchant_id;

  v_unused_amount := v_budget_amount - v_total_spent;
  IF v_unused_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'لا يوجد مبلغ متبقٍ للاسترجاع');
  END IF;

  -- USER wallet
  SELECT id INTO v_wallet_id FROM wallets WHERE owner_id = v_user_id AND owner_type = 'merchant';
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

-- Permissions
GRANT EXECUTE ON FUNCTION create_ad_with_payment(
  uuid, text, text, text, text, integer, timestamptz, timestamptz, numeric, discount_type_enum, numeric, promo_apply_on_enum, uuid
) TO authenticated;

COMMIT;
