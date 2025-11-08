-- Automatically settle and refund on merchant-initiated delete, then soft-delete the ad
-- Date: 2025-11-06

BEGIN;

CREATE OR REPLACE FUNCTION merchant_delete_sponsored_ad(p_ad_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ad public.sponsored_ads%ROWTYPE;
  v_owner uuid;
  v_owner_wallet uuid;
  v_admin_wallet uuid;
  v_unused numeric(10,2) := 0;
  v_ok boolean;
  v_settled numeric(10,2);
  v_remaining numeric(10,2);
  v_msg text;
BEGIN
  -- Verify ownership
  SELECT sa.* INTO v_ad
  FROM public.sponsored_ads sa
  JOIN public.merchants m ON m.id = sa.merchant_id
  WHERE sa.id = p_ad_id AND m.owner_id = auth.uid();

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح بحذف هذا الإعلان أو غير موجود');
  END IF;

  -- Owner id (merchant owner)
  SELECT owner_id INTO v_owner FROM public.merchants WHERE id = v_ad.merchant_id;

  -- Prepaid model: amount_paid > 0 means budget already moved to admin wallet
  IF COALESCE(v_ad.amount_paid,0) > 0 THEN
    v_admin_wallet := public.get_or_create_admin_wallet();
    SELECT id INTO v_owner_wallet FROM public.wallets WHERE owner_id = v_owner AND owner_type='merchant' LIMIT 1;
    IF v_owner_wallet IS NULL THEN
      INSERT INTO public.wallets(owner_id, owner_type, balance, currency)
      VALUES (v_owner, 'merchant', 0, 'EGP') RETURNING id INTO v_owner_wallet;
    END IF;

    -- Mark billed_spent up to total_spent
    UPDATE public.sponsored_ads
    SET billed_spent = GREATEST(COALESCE(billed_spent,0), COALESCE(total_spent,0))
    WHERE id = v_ad.id;

    -- Refund unused budget back to merchant wallet
    v_unused := GREATEST(COALESCE(v_ad.amount_paid,0) - COALESCE(v_ad.total_spent,0), 0);
    IF v_unused > 0 THEN
      UPDATE public.wallets SET balance = balance - v_unused WHERE id = v_admin_wallet;
      INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo)
      VALUES (v_admin_wallet, 'ad_refund', -v_unused, 'استرجاع المتبقي لإعلان محذوف');

      UPDATE public.wallets SET balance = balance + v_unused WHERE id = v_owner_wallet;
      INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo)
      VALUES (v_owner_wallet, 'ad_refund', v_unused, 'استرجاع المتبقي لإعلان محذوف');

      UPDATE public.sponsored_ads
      SET amount_refunded = COALESCE(amount_refunded,0) + v_unused,
          payment_status = CASE WHEN COALESCE(amount_refunded,0) + v_unused >= COALESCE(amount_paid,0) THEN 'refunded' ELSE payment_status END
      WHERE id = v_ad.id;
    END IF;
  ELSE
    -- Postpay model: collect dues now; if remaining > 0, abort deletion
    SELECT ok, settled, remaining, message
      INTO v_ok, v_settled, v_remaining, v_msg
    FROM public.admin_settle_ad_spend(v_ad.id, NULL);

    IF NOT v_ok OR v_remaining > 0 THEN
      RETURN json_build_object(
        'success', false,
        'error', COALESCE(v_msg, 'رصيد غير كافٍ لتسوية إنفاق الإعلان')
      );
    END IF;
  END IF;

  -- Soft delete and deactivate
  UPDATE public.sponsored_ads
  SET deleted_at = now(), is_active = false
  WHERE id = v_ad.id;

  -- Disable linked rule
  UPDATE public.promotion_rules r
  SET is_active = false
  WHERE r.id = (SELECT promotion_rule_id FROM public.sponsored_ads WHERE id = v_ad.id);

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION merchant_delete_sponsored_ad(uuid) TO authenticated;

COMMIT;
