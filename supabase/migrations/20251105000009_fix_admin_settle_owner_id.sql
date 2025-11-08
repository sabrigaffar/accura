BEGIN;

-- Fix admin_settle_ad_spend to properly SELECT owner_id into a separate variable
CREATE OR REPLACE FUNCTION public.admin_settle_ad_spend(
  p_ad_id uuid,
  p_admin_id uuid DEFAULT NULL
) RETURNS TABLE (ok boolean, settled numeric, remaining numeric, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ad public.sponsored_ads%ROWTYPE;
  v_owner uuid;
  v_owner_wallet uuid;
  v_admin_wallet uuid;
  v_currency text := 'EGP';
  v_to_bill numeric(10,2);
  v_balance numeric(10,2);
  v_settle numeric(10,2);
BEGIN
  -- Load the ad row first
  SELECT * INTO v_ad
  FROM public.sponsored_ads
  WHERE id = p_ad_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric, 'ad not found';
    RETURN;
  END IF;

  -- Load the owner id from merchants using the ad.merchant_id
  SELECT owner_id INTO v_owner
  FROM public.merchants
  WHERE id = v_ad.merchant_id
  LIMIT 1;

  v_to_bill := GREATEST(COALESCE(v_ad.total_spent,0) - COALESCE(v_ad.billed_spent,0), 0);

  IF v_to_bill <= 0 THEN
    RETURN QUERY SELECT true, 0::numeric, 0::numeric, 'لا يوجد مستحقات';
    RETURN;
  END IF;

  -- Ensure wallets exist
  SELECT id INTO v_admin_wallet FROM public.wallets WHERE owner_type='admin' LIMIT 1;
  IF v_admin_wallet IS NULL THEN
    INSERT INTO public.wallets(owner_id, owner_type, balance, currency)
    VALUES (gen_random_uuid(), 'admin', 0, v_currency) RETURNING id INTO v_admin_wallet;
  END IF;

  SELECT id INTO v_owner_wallet FROM public.wallets WHERE owner_id = v_owner AND owner_type='merchant' LIMIT 1;
  IF v_owner_wallet IS NULL THEN
    INSERT INTO public.wallets(owner_id, owner_type, balance, currency)
    VALUES (v_owner, 'merchant', 0, v_currency) RETURNING id INTO v_owner_wallet;
  END IF;

  SELECT balance INTO v_balance FROM public.wallets WHERE id = v_owner_wallet;
  v_settle := LEAST(v_to_bill, COALESCE(v_balance,0));

  IF v_settle > 0 THEN
    -- Debit owner wallet and log
    UPDATE public.wallets SET balance = balance - v_settle WHERE id = v_owner_wallet;
    INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo)
    VALUES (v_owner_wallet, 'ad_spend', v_settle, 'تحصيل إنفاق إعلان');

    -- Credit admin wallet and log
    UPDATE public.wallets SET balance = balance + v_settle WHERE id = v_admin_wallet;
    INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo)
    VALUES (v_admin_wallet, 'ad_spend', v_settle, 'إيراد إعلان');

    -- Ledger & mark billed
    INSERT INTO public.ad_billing_ledger(ad_id, merchant_id, owner_id, amount, note)
    VALUES (v_ad.id, v_ad.merchant_id, v_owner, v_settle, 'Ad spend settlement');

    UPDATE public.sponsored_ads
    SET billed_spent = billed_spent + v_settle, updated_at = now()
    WHERE id = v_ad.id;
  END IF;

  RETURN QUERY
    SELECT (v_settle = v_to_bill) as ok,
           v_settle as settled,
           (v_to_bill - v_settle) as remaining,
           CASE 
             WHEN v_settle = 0 THEN 'رصيد غير كافٍ لتسوية إنفاق الإعلان'
             WHEN v_settle < v_to_bill THEN 'تمت تسوية جزء من إنفاق الإعلان وباقي يتطلب شحن المحفظة'
             ELSE 'تمت تسوية إنفاق الإعلان بالكامل'
           END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_settle_ad_spend(uuid, uuid) TO authenticated;

COMMIT;
