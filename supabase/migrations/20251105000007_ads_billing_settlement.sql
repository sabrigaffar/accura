BEGIN;

-- 1) Add billed_spent to sponsored_ads to track settled spend
ALTER TABLE public.sponsored_ads
  ADD COLUMN IF NOT EXISTS billed_spent numeric(10,2) DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'billed_spent_nonneg' 
      AND conrelid = 'public.sponsored_ads'::regclass
  ) THEN
    ALTER TABLE public.sponsored_ads
      ADD CONSTRAINT billed_spent_nonneg CHECK (billed_spent >= 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'billed_spent_le_total' 
      AND conrelid = 'public.sponsored_ads'::regclass
  ) THEN
    ALTER TABLE public.sponsored_ads
      ADD CONSTRAINT billed_spent_le_total CHECK (billed_spent <= total_spent);
  END IF;
END$$;

-- 2) Ledger for ad settlements
CREATE TABLE IF NOT EXISTS public.ad_billing_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.sponsored_ads(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'EGP',
  settled_at timestamptz NOT NULL DEFAULT now(),
  note text
);

COMMENT ON TABLE public.ad_billing_ledger IS 'Ledger of ad spend settlements billed from merchant owner wallet to platform wallet.';

ALTER TABLE public.ad_billing_ledger ENABLE ROW LEVEL SECURITY;
-- Admin-only access
DROP POLICY IF EXISTS admin_full_access_ad_billing ON public.ad_billing_ledger;
CREATE POLICY admin_full_access_ad_billing ON public.ad_billing_ledger
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- 3) Settle a single ad's outstanding spend (partial settlement allowed up to wallet balance)
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
  SELECT sa.*, m.owner_id INTO v_ad
  FROM public.sponsored_ads sa
  JOIN public.merchants m ON m.id = sa.merchant_id
  WHERE sa.id = p_ad_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric, 'ad not found';
    RETURN;
  END IF;

  v_owner := v_ad.owner_id;
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
    -- Debit owner wallet
    UPDATE public.wallets SET balance = balance - v_settle WHERE id = v_owner_wallet;
    INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo)
    VALUES (v_owner_wallet, 'ad_spend', v_settle, 'تحصيل إنفاق إعلان');

    -- Credit admin wallet
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

-- 4) Bulk settle for owner (used on wallet top-up)
CREATE OR REPLACE FUNCTION public.try_settle_owner_due_ads(
  p_owner_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT sa.id
    FROM public.sponsored_ads sa
    JOIN public.merchants m ON m.id = sa.merchant_id
    WHERE m.owner_id = p_owner_id
      AND (COALESCE(sa.total_spent,0) - COALESCE(sa.billed_spent,0)) > 0
  LOOP
    PERFORM public.admin_settle_ad_spend(r.id, NULL);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_settle_owner_due_ads(uuid) TO authenticated;

-- 5) Trigger: on wallet credit, try settle ad dues for owner
CREATE OR REPLACE FUNCTION public.trg_wallet_credit_settle_ads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_owner uuid; v_owner_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT owner_id, owner_type INTO v_owner, v_owner_type FROM public.wallets WHERE id = NEW.wallet_id;
    IF v_owner_type = 'merchant' AND NEW.type IN ('deposit','transfer_in','refund') THEN
      PERFORM public.try_settle_owner_due_ads(v_owner);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallet_credit_settle_ads ON public.wallet_transactions;
CREATE TRIGGER wallet_credit_settle_ads
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_wallet_credit_settle_ads();

-- 6) Triggers on sponsored_ads to settle on stop/delete
CREATE OR REPLACE FUNCTION public.sponsored_ads_before_update_settle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_active = false AND OLD.is_active = true THEN
    PERFORM public.admin_settle_ad_spend(OLD.id, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sponsored_ads_bu_settle ON public.sponsored_ads;
CREATE TRIGGER sponsored_ads_bu_settle
BEFORE UPDATE ON public.sponsored_ads
FOR EACH ROW EXECUTE FUNCTION public.sponsored_ads_before_update_settle();

CREATE OR REPLACE FUNCTION public.sponsored_ads_before_delete_settle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_remaining numeric(10,2);
BEGIN
  PERFORM public.admin_settle_ad_spend(OLD.id, NULL);
  SELECT (COALESCE(total_spent,0) - COALESCE(billed_spent,0))
  INTO v_remaining
  FROM public.sponsored_ads
  WHERE id = OLD.id;

  IF COALESCE(v_remaining,0) > 0 THEN
    RAISE EXCEPTION 'لا يمكن حذف الإعلان لوجود مستحقات غير مسددة. الرجاء شحن المحفظة أولاً.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sponsored_ads_bd_settle ON public.sponsored_ads;
CREATE TRIGGER sponsored_ads_bd_settle
BEFORE DELETE ON public.sponsored_ads
FOR EACH ROW EXECUTE FUNCTION public.sponsored_ads_before_delete_settle();

COMMIT;
