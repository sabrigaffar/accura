BEGIN;

-- Ledger table for subscription charges (owner-level)
CREATE TABLE IF NOT EXISTS public.merchant_billing_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EGP',
  charged_at timestamptz NOT NULL DEFAULT now(),
  note text
);

COMMENT ON TABLE public.merchant_billing_ledger IS 'Owner-level ledger for merchant subscription charges (for accounting integration with wallets later).';

-- Charge subscription: owner-level debit intent + platform credit intent
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

  -- Find admin wallet (create if missing)
  SELECT id INTO v_admin_wallet FROM public.wallets WHERE owner_type='admin' LIMIT 1;
  IF v_admin_wallet IS NULL THEN
    INSERT INTO public.wallets(owner_id, owner_type, balance, currency)
    VALUES (gen_random_uuid(), 'admin', 0, v_currency) RETURNING id INTO v_admin_wallet;
  END IF;

  -- Find owner (merchant-user) wallet (create if missing)
  SELECT id INTO v_owner_wallet FROM public.wallets WHERE owner_id = v_owner AND owner_type='merchant' LIMIT 1;
  IF v_owner_wallet IS NULL THEN
    -- create with 0 initial balance
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

  -- Record owner-level ledger (accounting)
  INSERT INTO public.merchant_billing_ledger(merchant_id, owner_id, amount, note)
  VALUES (p_merchant_id, v_owner, v_fee, 'Monthly subscription charge');

  -- Update subscription dates
  UPDATE merchant_subscriptions
  SET last_paid_at = now(), next_due_at = now() + interval '30 days', status = 'active'
  WHERE id = v_sub_id;

  -- Activity log (best-effort)
  BEGIN
    INSERT INTO admin_activity_log(admin_id, action, resource_type, resource_id, details, timestamp)
    VALUES (p_admin_id, 'system', 'merchant_subscription', v_sub_id, jsonb_build_object('merchant_id', p_merchant_id, 'amount', v_fee), now());
  EXCEPTION WHEN OTHERS THEN
    -- ignore
  END;

  RETURN QUERY SELECT true, 'تم التحصيل';
END;
$$;

GRANT EXECUTE ON FUNCTION public.charge_merchant_subscription(uuid, uuid) TO authenticated;

-- Toggle merchant visibility (is_active) with SECURITY DEFINER for admins
CREATE OR REPLACE FUNCTION public.admin_toggle_merchant_visibility(
  p_merchant_id uuid,
  p_is_active boolean,
  p_admin_id uuid DEFAULT NULL
) RETURNS TABLE (ok boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE merchants SET is_active = p_is_active WHERE id = p_merchant_id;

  BEGIN
    INSERT INTO admin_activity_log(admin_id, action, resource_type, resource_id, details, timestamp)
    VALUES (p_admin_id, CASE WHEN p_is_active THEN 'update' ELSE 'update' END, 'merchant_visibility', p_merchant_id, jsonb_build_object('is_active', p_is_active), now());
  EXCEPTION WHEN OTHERS THEN
  END;

  RETURN QUERY SELECT true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_toggle_merchant_visibility(uuid, boolean, uuid) TO authenticated;

COMMIT;
