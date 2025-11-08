BEGIN;

CREATE OR REPLACE FUNCTION public.charge_merchant_subscription(
  p_merchant_id uuid,
  p_admin_id uuid DEFAULT NULL
) RETURNS TABLE (ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner uuid;
  v_fee numeric;
  v_sub_id uuid;
  v_owner_wallet uuid;
  v_admin_wallet uuid;
  v_currency text := 'EGP';
  v_trial_end timestamptz;
  v_next_due timestamptz;
BEGIN
  SELECT m.owner_id, s.id, COALESCE(s.monthly_fee, 100), s.trial_end_at, s.next_due_at
  INTO v_owner, v_sub_id, v_fee, v_trial_end, v_next_due
  FROM merchants m
  LEFT JOIN merchant_subscriptions s ON s.merchant_id = m.id
  WHERE m.id = p_merchant_id
  LIMIT 1;

  IF v_owner IS NULL THEN
    RETURN QUERY SELECT false, 'merchant not found';
    RETURN;
  END IF;

  IF v_sub_id IS NULL THEN
    RETURN QUERY SELECT false, 'no subscription found for merchant';
    RETURN;
  END IF;

  -- Prevent early charge: still in trial OR not yet due
  IF v_trial_end IS NOT NULL AND v_trial_end > now() THEN
    RETURN QUERY SELECT false, 'الاشتراك في فترة التجربة؛ غير مستحق الآن';
    RETURN;
  END IF;
  IF v_next_due IS NULL OR v_next_due > now() THEN
    RETURN QUERY SELECT false, 'الاشتراك غير مستحق الآن';
    RETURN;
  END IF;

  -- Canonical admin wallet
  v_admin_wallet := public.get_or_create_admin_wallet();

  -- Owner wallet
  SELECT id INTO v_owner_wallet FROM public.wallets WHERE owner_id = v_owner AND owner_type='merchant' LIMIT 1;
  IF v_owner_wallet IS NULL THEN
    INSERT INTO public.wallets(owner_id, owner_type, balance, currency)
    VALUES (v_owner, 'merchant', 0, v_currency) RETURNING id INTO v_owner_wallet;
  END IF;

  -- Ensure sufficient balance
  IF (SELECT balance FROM public.wallets WHERE id = v_owner_wallet) < v_fee THEN
    RETURN QUERY SELECT false, 'رصيد محفظة التاجر غير كافٍ';
    RETURN;
  END IF;

  -- Debit owner wallet and log
  UPDATE public.wallets SET balance = balance - v_fee WHERE id = v_owner_wallet;
  INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo)
  VALUES (v_owner_wallet, 'subscription', v_fee, 'سداد اشتراك شهري');

  -- Credit admin wallet and log
  UPDATE public.wallets SET balance = balance + v_fee WHERE id = v_admin_wallet;
  INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo)
  VALUES (v_admin_wallet, 'subscription', v_fee, 'اشتراك تاجر');

  -- Update subscription dates
  UPDATE merchant_subscriptions
  SET last_paid_at = now(), next_due_at = now() + interval '30 days', status = 'active'
  WHERE id = v_sub_id;

  -- Activity log (best-effort)
  BEGIN
    INSERT INTO admin_activity_log(admin_id, action, resource_type, resource_id, details, timestamp)
    VALUES (p_admin_id, 'system', 'merchant_subscription', v_sub_id, jsonb_build_object('merchant_id', p_merchant_id, 'amount', v_fee), now());
  EXCEPTION WHEN OTHERS THEN
  END;

  RETURN QUERY SELECT true, 'تم التحصيل';
END;
$$;

GRANT EXECUTE ON FUNCTION public.charge_merchant_subscription(uuid, uuid) TO authenticated;

COMMIT;
