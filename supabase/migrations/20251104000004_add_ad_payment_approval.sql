-- Add payment and approval system to sponsored ads

-- Add new columns to sponsored_ads
ALTER TABLE sponsored_ads
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'paid' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_refunded numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS wallet_transaction_id uuid REFERENCES wallet_transactions(id),
ADD COLUMN IF NOT EXISTS refund_transaction_id uuid REFERENCES wallet_transactions(id);

-- Create index for approval status
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_approval_status ON sponsored_ads(approval_status);
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_payment_status ON sponsored_ads(payment_status);

-- Update get_active_sponsored_ads to only show approved ads
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
    sa.is_active = true
    AND sa.approval_status = 'approved'  -- Only approved ads
    AND sa.start_date <= now()
    AND sa.end_date >= now()
    AND sa.total_spent < sa.budget_amount
    AND (p_ad_type IS NULL OR sa.ad_type = p_ad_type)
  ORDER BY sa.priority DESC, sa.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to create ad with wallet payment
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
    false,  -- Not active until approved
    p_budget_amount,
    v_cost_per_click,
    v_cost_per_impression,
    'pending',
    'paid',
    p_budget_amount
  )
  RETURNING id INTO v_ad_id;
  
  -- Deduct from merchant wallet
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

-- Function for admin to approve ad
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
END;
$$;

-- Function for admin to reject ad
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
  -- Get ad details
  SELECT merchant_id, budget_amount
  INTO v_merchant_id, v_budget_amount
  FROM sponsored_ads
  WHERE id = p_ad_id AND approval_status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الإعلان غير موجود أو تمت مراجعته مسبقاً';
  END IF;
  
  -- Update ad status
  UPDATE sponsored_ads
  SET 
    approval_status = 'rejected',
    approved_by = p_admin_id,
    approved_at = now(),
    rejection_reason = p_reason,
    is_active = false
  WHERE id = p_ad_id;
  
  -- Refund to merchant wallet
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE owner_id = v_merchant_id AND owner_type = 'merchant';
  
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

-- Function to refund unused budget when ad ends or is cancelled
CREATE OR REPLACE FUNCTION refund_unused_ad_budget(
  p_ad_id uuid
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_merchant_id uuid;
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
  
  -- Calculate unused amount
  v_unused_amount := v_budget_amount - v_total_spent;
  
  IF v_unused_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'لا يوجد مبلغ متبقٍ للاسترجاع');
  END IF;
  
  -- Get merchant wallet
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE owner_id = v_merchant_id AND owner_type = 'merchant';
  
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

-- Function to get pending ads for admin review
CREATE OR REPLACE FUNCTION get_pending_ads_for_review()
RETURNS TABLE (
  id uuid,
  merchant_id uuid,
  merchant_name text,
  ad_type text,
  title text,
  description text,
  image_url text,
  budget_amount numeric,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz
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
    sa.budget_amount,
    sa.start_date,
    sa.end_date,
    sa.created_at
  FROM sponsored_ads sa
  JOIN merchants m ON m.id = sa.merchant_id
  WHERE sa.approval_status = 'pending'
  ORDER BY sa.created_at DESC;
END;
$$;

-- RLS Policies updates
DROP POLICY IF EXISTS merchants_manage_own_ads ON sponsored_ads;
DROP POLICY IF EXISTS merchants_insert_own_ads ON sponsored_ads;
DROP POLICY IF EXISTS merchants_update_own_ads ON sponsored_ads;
DROP POLICY IF EXISTS admin_manage_all_ads ON sponsored_ads;

-- Merchants can view their own ads
CREATE POLICY merchants_manage_own_ads ON sponsored_ads
  FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_id = auth.uid()
    )
  );

-- Merchants can insert their own ads
CREATE POLICY merchants_insert_own_ads ON sponsored_ads
  FOR INSERT
  WITH CHECK (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_id = auth.uid()
    )
  );

-- Merchants can update their own ads (only specific fields)
CREATE POLICY merchants_update_own_ads ON sponsored_ads
  FOR UPDATE
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_id = auth.uid()
    )
  );

-- Admin can view and manage all ads
CREATE POLICY admin_manage_all_ads ON sponsored_ads
  FOR ALL
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_ad_with_payment(uuid, text, text, text, text, integer, timestamptz, timestamptz, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_ad(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_ad(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION refund_unused_ad_budget(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_ads_for_review() TO authenticated;

-- Comments
COMMENT ON FUNCTION create_ad_with_payment IS 'Creates ad and deducts budget from merchant wallet upfront';
COMMENT ON FUNCTION approve_ad IS 'Admin approves pending ad and activates it';
COMMENT ON FUNCTION reject_ad IS 'Admin rejects ad and refunds merchant';
COMMENT ON FUNCTION refund_unused_ad_budget IS 'Refunds unused budget back to merchant wallet when ad ends';
COMMENT ON FUNCTION get_pending_ads_for_review IS 'Returns all pending ads waiting for admin approval';
