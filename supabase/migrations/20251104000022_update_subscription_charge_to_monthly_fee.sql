-- Update subscription charge RPC to use monthly_fee and record 'subscription' transaction types
BEGIN;

CREATE OR REPLACE FUNCTION public.charge_merchant_subscription(p_merchant_id uuid)
RETURNS TABLE (ok boolean, message text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_wallet uuid;
  v_merchant_wallet uuid;
  v_sub public.merchant_subscriptions%rowtype;
  v_amount numeric := 100; -- default fallback
  v_now timestamptz := now();
  v_is_admin boolean := public.is_admin();
BEGIN
  IF NOT v_is_admin THEN
    ok := false; message := 'غير مصرح'; RETURN NEXT; RETURN; 
  END IF;

  -- find wallets
  SELECT id INTO v_admin_wallet FROM public.wallets WHERE owner_type='admin' LIMIT 1;
  IF v_admin_wallet IS NULL THEN
    INSERT INTO public.wallets(owner_id, owner_type, balance)
    VALUES (gen_random_uuid(), 'admin', 0) RETURNING id INTO v_admin_wallet;
  END IF;
  SELECT id FROM public.wallets WHERE owner_id = p_merchant_id AND owner_type='merchant' INTO v_merchant_wallet;
  IF v_merchant_wallet IS NULL THEN
    v_merchant_wallet := public.create_wallet_if_missing(p_merchant_id, 'merchant', 30);
  END IF;

  -- load subscription row
  SELECT * INTO v_sub FROM public.merchant_subscriptions WHERE merchant_id = p_merchant_id;
  IF NOT FOUND THEN
    ok := false; message := 'لا يوجد اشتراك للتاجر'; RETURN NEXT; RETURN; 
  END IF;

  v_amount := COALESCE(v_sub.monthly_fee, 100);

  -- check merchant balance
  IF (SELECT balance FROM public.wallets WHERE id = v_merchant_wallet) < v_amount THEN
    ok := false; message := 'رصيد التاجر غير كاف'; RETURN NEXT; RETURN; 
  END IF;

  -- transfer from merchant to admin (record as 'subscription')
  UPDATE public.wallets SET balance = balance - v_amount WHERE id = v_merchant_wallet;
  INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo)
  VALUES (v_merchant_wallet, 'subscription', v_amount, 'سداد اشتراك شهري');

  UPDATE public.wallets SET balance = balance + v_amount WHERE id = v_admin_wallet;
  INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo)
  VALUES (v_admin_wallet, 'subscription', v_amount, 'اشتراك تاجر');

  -- update subscription dates
  UPDATE public.merchant_subscriptions
  SET last_paid_at = v_now, next_due_at = v_now + interval '30 days', status = 'active'
  WHERE merchant_id = p_merchant_id;

  ok := true; message := 'تم التحصيل وتحديث الاشتراك'; RETURN NEXT; RETURN;
END; $$;

GRANT EXECUTE ON FUNCTION public.charge_merchant_subscription(uuid) TO authenticated;

COMMIT;
