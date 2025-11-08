-- Migrate wallets from per-store to per-user model
-- This simplifies wallet management for merchants with multiple stores

-- Step 1: Create temporary table to store merged wallets
CREATE TEMP TABLE temp_user_wallets AS
SELECT 
  m.owner_id as user_id,
  SUM(w.balance) as total_balance,
  w.currency
FROM wallets w
JOIN merchants m ON m.id = w.owner_id
WHERE w.owner_type = 'merchant'
GROUP BY m.owner_id, w.currency;

-- Step 2: Create user wallets if they don't exist, or merge into existing ones
-- This handles the case where a user wallet might already exist
DO $$
DECLARE
  merchant_wallet RECORD;
  user_wallet_id uuid;
  user_wallet_exists boolean;
BEGIN
  -- For each merchant wallet
  FOR merchant_wallet IN 
    SELECT w.id as wallet_id, w.owner_id as merchant_id, w.balance, w.currency, m.owner_id as user_id
    FROM wallets w
    JOIN merchants m ON m.id = w.owner_id
    WHERE w.owner_type = 'merchant'
  LOOP
    -- Check if user wallet already exists
    SELECT EXISTS(
      SELECT 1 FROM wallets 
      WHERE owner_id = merchant_wallet.user_id 
        AND owner_type = 'merchant'
        AND id != merchant_wallet.wallet_id
    ) INTO user_wallet_exists;
    
    IF user_wallet_exists THEN
      -- User wallet exists, merge this merchant wallet into it
      SELECT id INTO user_wallet_id
      FROM wallets
      WHERE owner_id = merchant_wallet.user_id 
        AND owner_type = 'merchant'
        AND id != merchant_wallet.wallet_id;
      
      -- Add balance to existing user wallet
      UPDATE wallets
      SET balance = balance + merchant_wallet.balance
      WHERE id = user_wallet_id;
      
      -- Update transactions to point to user wallet
      UPDATE wallet_transactions
      SET wallet_id = user_wallet_id
      WHERE wallet_id = merchant_wallet.wallet_id;
      
      -- Delete old merchant wallet
      DELETE FROM wallets WHERE id = merchant_wallet.wallet_id;
      
      RAISE NOTICE 'Merged merchant wallet % (balance: %) into user wallet %', 
        merchant_wallet.wallet_id, merchant_wallet.balance, user_wallet_id;
    ELSE
      -- No user wallet exists, just update owner_id
      UPDATE wallets
      SET owner_id = merchant_wallet.user_id
      WHERE id = merchant_wallet.wallet_id;
      
      RAISE NOTICE 'Updated wallet % to use user_id %', 
        merchant_wallet.wallet_id, merchant_wallet.user_id;
    END IF;
  END LOOP;
END $$;

-- Step 3: Update wallet_transactions type enum to include new ad-related types
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_type_check 
CHECK (type IN (
  'deposit',
  'withdraw',
  'hold',
  'release',
  'capture',
  'transfer_in',
  'transfer_out',
  'adjust',
  'ad_payment',      -- New: Payment for sponsored ad
  'ad_refund',       -- New: Refund from cancelled/unused ad budget
  'subscription',    -- For merchant subscriptions
  'commission'       -- Platform commission
));

-- Step 4: Update transaction_type enum in wallet_transactions if it exists as separate column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallet_transactions' 
    AND column_name = 'transaction_type'
  ) THEN
    ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_transaction_type_check;
    ALTER TABLE wallet_transactions 
    ADD CONSTRAINT wallet_transactions_transaction_type_check 
    CHECK (transaction_type IN (
      'deposit',
      'withdraw',
      'hold',
      'release',
      'capture',
      'transfer_in',
      'transfer_out',
      'adjust',
      'ad_payment',
      'ad_refund',
      'subscription',
      'commission',
      'order_payment',
      'order_refund',
      'settlement'
    ));
  END IF;
END $$;

-- Step 5: Update create_ad_with_payment function to use user wallet
CREATE OR REPLACE FUNCTION create_ad_with_payment(
  p_merchant_id uuid,
  p_ad_type text,
  p_title text,
  p_description text,
  p_image_url text,
  p_priority integer,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_budget_amount numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ad_id uuid;
  v_wallet_id uuid;
  v_current_balance numeric;
  v_transaction_id uuid;
  v_cost_per_click numeric;
  v_cost_per_impression numeric;
  v_user_id uuid;
BEGIN
  -- Get user_id from merchant
  SELECT owner_id INTO v_user_id
  FROM merchants
  WHERE id = p_merchant_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'المتجر غير موجود';
  END IF;
  
  -- Get pricing settings
  SELECT cost_per_click, cost_per_impression 
  INTO v_cost_per_click, v_cost_per_impression
  FROM platform_ad_settings
  WHERE id = '00000000-0000-0000-0000-000000000001';
  
  -- Get USER wallet (not merchant wallet)
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE owner_id = v_user_id AND owner_type = 'merchant';
  
  -- Check if wallet exists and has sufficient balance
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'المحفظة غير موجودة';
  END IF;
  
  IF v_current_balance < p_budget_amount THEN
    RAISE EXCEPTION 'رصيد المحفظة غير كافٍ. الرصيد الحالي: % ج، المطلوب: % ج', v_current_balance, p_budget_amount;
  END IF;
  
  -- Create ad (pending approval)
  INSERT INTO sponsored_ads (
    merchant_id,
    ad_type,
    title,
    description,
    image_url,
    priority,
    start_date,
    end_date,
    is_active,
    budget_amount,
    cost_per_click,
    cost_per_impression,
    approval_status,
    payment_status,
    amount_paid
  ) VALUES (
    p_merchant_id,
    p_ad_type,
    p_title,
    p_description,
    p_image_url,
    p_priority,
    p_start_date,
    p_end_date,
    false,
    p_budget_amount,
    v_cost_per_click,
    v_cost_per_impression,
    'pending',
    'paid',
    p_budget_amount
  )
  RETURNING id INTO v_ad_id;
  
  -- Deduct from USER wallet
  UPDATE wallets
  SET balance = balance - p_budget_amount
  WHERE id = v_wallet_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id,
    amount,
    type,
    memo
  ) VALUES (
    v_wallet_id,
    -p_budget_amount,
    'ad_payment',
    'دفع ميزانية إعلان: ' || p_title
  )
  RETURNING id INTO v_transaction_id;
  
  -- Link transaction to ad
  UPDATE sponsored_ads
  SET wallet_transaction_id = v_transaction_id
  WHERE id = v_ad_id;
  
  RETURN json_build_object(
    'success', true,
    'ad_id', v_ad_id,
    'transaction_id', v_transaction_id,
    'message', 'تم إنشاء الإعلان بنجاح وسيتم مراجعته من قبل الإدارة'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Update approve_ad to work regardless of is_active status
CREATE OR REPLACE FUNCTION approve_ad(
  p_ad_id uuid,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Approve ad and set it active
  UPDATE sponsored_ads
  SET 
    approval_status = 'approved',
    approved_by = p_admin_id,
    approved_at = now(),
    is_active = true  -- Always set to true on approval
  WHERE id = p_ad_id
    AND approval_status = 'pending';  -- Only check pending status
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الإعلان غير موجود أو تمت الموافقة عليه مسبقاً';
  END IF;
END;
$$;

-- Step 6: Update reject_ad function to refund to user wallet
CREATE OR REPLACE FUNCTION reject_ad(
  p_ad_id uuid,
  p_admin_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_merchant_id uuid;
  v_user_id uuid;
  v_budget_amount numeric;
  v_wallet_id uuid;
  v_transaction_id uuid;
BEGIN
  -- Get ad details
  SELECT merchant_id, budget_amount
  INTO v_merchant_id, v_budget_amount
  FROM sponsored_ads
  WHERE id = p_ad_id AND approval_status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الإعلان غير موجود أو تمت مراجعته مسبقاً';
  END IF;
  
  -- Get user_id from merchant
  SELECT owner_id INTO v_user_id
  FROM merchants
  WHERE id = v_merchant_id;
  
  -- Update ad status
  UPDATE sponsored_ads
  SET 
    approval_status = 'rejected',
    approved_by = p_admin_id,
    approved_at = now(),
    rejection_reason = p_reason,
    is_active = false
  WHERE id = p_ad_id;
  
  -- Refund to USER wallet
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE owner_id = v_user_id AND owner_type = 'merchant';
  
  UPDATE wallets
  SET balance = balance + v_budget_amount
  WHERE id = v_wallet_id;
  
  -- Create refund transaction
  INSERT INTO wallet_transactions (
    wallet_id,
    amount,
    type,
    memo
  ) VALUES (
    v_wallet_id,
    v_budget_amount,
    'ad_refund',
    'استرجاع ميزانية إعلان مرفوض: ' || p_reason
  )
  RETURNING id INTO v_transaction_id;
  
  -- Update ad with refund info
  UPDATE sponsored_ads
  SET 
    refund_transaction_id = v_transaction_id,
    amount_refunded = v_budget_amount,
    payment_status = 'refunded'
  WHERE id = p_ad_id;
END;
$$;

-- Step 7: Update refund_unused_ad_budget function
CREATE OR REPLACE FUNCTION refund_unused_ad_budget(
  p_ad_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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
BEGIN
  -- Get ad details
  SELECT merchant_id, budget_amount, total_spent, title
  INTO v_merchant_id, v_budget_amount, v_total_spent, v_ad_title
  FROM sponsored_ads
  WHERE id = p_ad_id
    AND approval_status = 'approved'
    AND payment_status = 'paid';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'الإعلان غير موجود أو تم استرجاع أمواله مسبقاً');
  END IF;
  
  -- Get user_id
  SELECT owner_id INTO v_user_id
  FROM merchants
  WHERE id = v_merchant_id;
  
  -- Calculate unused amount
  v_unused_amount := v_budget_amount - v_total_spent;
  
  IF v_unused_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'لا يوجد مبلغ متبقٍ للاسترجاع');
  END IF;
  
  -- Get USER wallet
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE owner_id = v_user_id AND owner_type = 'merchant';
  
  -- Refund to wallet
  UPDATE wallets
  SET balance = balance + v_unused_amount
  WHERE id = v_wallet_id;
  
  -- Create refund transaction
  INSERT INTO wallet_transactions (
    wallet_id,
    amount,
    type,
    memo
  ) VALUES (
    v_wallet_id,
    v_unused_amount,
    'ad_refund',
    'استرجاع المبلغ المتبقي من إعلان: ' || v_ad_title
  )
  RETURNING id INTO v_transaction_id;
  
  -- Update ad
  UPDATE sponsored_ads
  SET 
    refund_transaction_id = v_transaction_id,
    amount_refunded = v_unused_amount,
    payment_status = 'refunded'
  WHERE id = p_ad_id;
  
  RETURN json_build_object(
    'success', true,
    'refunded_amount', v_unused_amount,
    'message', 'تم استرجاع المبلغ المتبقي بنجاح'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Step 8: Create function to get user wallet (for all stores)
CREATE OR REPLACE FUNCTION get_user_wallet_balance(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT balance INTO v_balance
  FROM wallets
  WHERE owner_id = p_user_id AND owner_type = 'merchant';
  
  RETURN COALESCE(v_balance, 0);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_wallet_balance(uuid) TO authenticated;

-- Comments
COMMENT ON FUNCTION get_user_wallet_balance IS 'Returns wallet balance for a user (shared across all their stores)';

-- Final summary
DO $$
DECLARE
  total_users int;
  total_wallets int;
BEGIN
  SELECT COUNT(DISTINCT owner_id) INTO total_users
  FROM wallets WHERE owner_type = 'merchant';
  
  SELECT COUNT(*) INTO total_wallets
  FROM wallets WHERE owner_type = 'merchant';
  
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '📊 Total users with merchant wallets: %', total_users;
  RAISE NOTICE '💰 Total merchant wallets after merge: %', total_wallets;
  RAISE NOTICE '🎯 Each user now has one wallet shared across all their stores';
END $$;
