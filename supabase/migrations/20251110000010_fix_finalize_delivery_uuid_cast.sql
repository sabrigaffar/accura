-- Fix finalize_delivery_tx: do SELECT * INTO v_hold (composite) instead of selecting a subset of columns
-- This fixes 22P02 invalid UUID cast when amount (numeric) was being coerced into a uuid field
-- Keeps: dynamic base_fee_per_km, per-km commission, free-until, no-hold fallbacks, cash capture expected only
-- Date: 2025-11-10

BEGIN;

CREATE OR REPLACE FUNCTION public.finalize_delivery_tx(p_order_id uuid)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_driver uuid := auth.uid();
  v_order public.orders;
  v_driver_wallet uuid;
  v_merchant_wallet uuid;
  v_admin_wallet uuid;
  v_hold public.wallet_holds;
  v_platform_service_fee numeric;
  v_driver_delivery_fee numeric;
  v_payment_method text;
  v_now timestamptz := now();
  v_km_fee numeric := 0;
  v_expected_hold numeric := 0;
  v_exists boolean := false;
  v_driver_deposit_exists boolean := false;
  v_merchant_tx_exists boolean := false;
  v_platform_capture_exists boolean := false;
  v_product_amount numeric := 0;
  v_tax_amount numeric := 0;
  v_merchant_amount numeric := 0;
  v_customer_total numeric := 0;
  v_capture_amount numeric := 0;
  v_commission_total numeric := 0;
  v_merchant_user uuid := null;  -- owner_id of the merchant (user level)
  v_per_km_driver numeric := 1;  -- platform_settings.driver_commission_per_km
  v_base_fee_per_km numeric := 10; -- dynamic base used by calculate_delivery_fee
  v_free_until timestamptz := NULL; -- platform_settings.driver_commission_free_until
  v_distance_km numeric := null;
  v_kilometers integer := 0;
  v_cash_capture_amt numeric := 0;
BEGIN
  -- Load order (and basic sanity)
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND driver_id = v_driver;
  IF NOT FOUND THEN ok := false; message := 'الطلب غير موجود أو غير متعلق بك'; RETURN NEXT; RETURN; END IF;

  v_platform_service_fee := COALESCE(v_order.service_fee, 2.5);
  v_driver_delivery_fee := COALESCE(v_order.delivery_fee, 0);
  IF COALESCE(v_driver_delivery_fee, 0) <= 0 THEN
    v_driver_delivery_fee := COALESCE(v_order.calculated_delivery_fee, 0);
  END IF;
  IF COALESCE(v_driver_delivery_fee, 0) <= 0 THEN
    v_driver_delivery_fee := COALESCE(public.calculate_delivery_fee(v_order.delivery_distance_km), 0);
  END IF;
  IF v_driver_delivery_fee < 0 THEN v_driver_delivery_fee := 0; END IF;

  v_payment_method := COALESCE((v_order.payment_method)::text, 'cash');

  -- Resolve platform per-km rate, base per-km fee, and free period
  SELECT COALESCE(driver_commission_per_km, 1), COALESCE(base_fee_per_km, 10), driver_commission_free_until
    INTO v_per_km_driver, v_base_fee_per_km, v_free_until
  FROM public.platform_settings WHERE id = 1;

  -- Determine kilometers for km_fee (treat <=0 as missing)
  v_distance_km := v_order.delivery_distance_km;
  IF v_distance_km IS NOT NULL AND v_distance_km > 0 THEN
    v_kilometers := CEIL(v_distance_km);
  ELSE
    -- Derive from delivery fee and dynamic base per-km used in calculate_delivery_fee
    v_kilometers := GREATEST(CEIL(COALESCE(v_driver_delivery_fee, 0) / v_base_fee_per_km), 0);
  END IF;

  -- Compute per-km fee, honor free-until, and cap to driver fee
  IF v_free_until IS NOT NULL AND v_now <= v_free_until THEN
    v_km_fee := 0;
  ELSE
    v_km_fee := GREATEST(v_kilometers, 0) * v_per_km_driver;
  END IF;
  IF v_km_fee > v_driver_delivery_fee THEN
    v_km_fee := v_driver_delivery_fee;
  END IF;

  v_expected_hold := v_km_fee + CASE WHEN v_payment_method = 'cash' THEN v_platform_service_fee ELSE 0 END;

  v_product_amount := COALESCE(v_order.product_total, v_order.subtotal, 0);
  v_tax_amount := COALESCE(v_order.tax_amount, v_order.tax, 0);
  v_merchant_amount := GREATEST(v_product_amount + v_tax_amount, 0);
  v_customer_total := COALESCE(v_order.customer_total, v_order.total, 0);
  v_capture_amount := COALESCE(v_customer_total, v_driver_delivery_fee + v_merchant_amount + v_platform_service_fee);

  -- Resolve merchant user id (owner of the store)
  SELECT owner_id INTO v_merchant_user FROM public.merchants WHERE id = v_order.merchant_id;

  -- Wallet ids
  SELECT id INTO v_driver_wallet FROM public.wallets WHERE owner_id = v_driver AND owner_type = 'driver';
  IF v_driver_wallet IS NULL THEN v_driver_wallet := public.create_wallet_if_missing(v_driver, 'driver', 30); END IF;

  IF v_merchant_user IS NOT NULL THEN
    SELECT id INTO v_merchant_wallet FROM public.wallets WHERE owner_id = v_merchant_user AND owner_type = 'merchant';
    IF v_merchant_wallet IS NULL THEN v_merchant_wallet := public.create_wallet_if_missing(v_merchant_user, 'merchant', 30); END IF;
  END IF;

  SELECT id INTO v_admin_wallet FROM public.wallets WHERE owner_type = 'admin' LIMIT 1;
  IF v_admin_wallet IS NULL THEN
    INSERT INTO public.wallets(owner_id, owner_type, balance) VALUES (gen_random_uuid(), 'admin', 0) RETURNING id INTO v_admin_wallet;
  END IF;

  -- IMPORTANT: fetch entire composite row for v_hold
  SELECT * INTO v_hold
  FROM public.wallet_holds
  WHERE related_order_id = p_order_id AND status = 'active'
  LIMIT 1;

  -- Calculate commission upfront
  IF v_payment_method = 'cash' THEN
    v_commission_total := v_km_fee + v_platform_service_fee; -- cash: driver pays km + service
  ELSE
    v_commission_total := v_km_fee; -- online: driver pays km only
  END IF;

  -- 1) Driver earnings record (logical earning for reporting)
  SELECT EXISTS(
    SELECT 1 FROM public.driver_earnings de WHERE de.driver_id = v_driver AND de.order_id = p_order_id
  ) INTO v_exists;
  IF NOT v_exists THEN
    INSERT INTO public.driver_earnings(driver_id, order_id, amount, commission_amount, net_amount, earned_at)
    VALUES (v_driver, p_order_id, v_driver_delivery_fee, v_commission_total, GREATEST(v_driver_delivery_fee - v_commission_total, 0), v_now)
    ON CONFLICT (driver_id, order_id) DO NOTHING;
  END IF;

  -- 1.b) Credit driver wallet only for ONLINE (card/wallet)
  IF v_payment_method IN ('card','wallet','online','visa') THEN
    SELECT EXISTS(
      SELECT 1 FROM public.wallet_transactions wt 
      WHERE wt.wallet_id = v_driver_wallet AND wt.related_order_id = p_order_id AND wt.type = 'deposit'
    ) INTO v_driver_deposit_exists;
    IF NOT v_driver_deposit_exists THEN
      UPDATE public.wallets SET balance = balance + v_driver_delivery_fee WHERE id = v_driver_wallet;
      INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      VALUES (v_driver_wallet, 'deposit', v_driver_delivery_fee, 'أرباح التوصيل (أونلاين)', p_order_id);
    END IF;
  END IF;

  -- 1.c) Credit merchant settlement (product + tax) for ONLINE ONLY to USER wallet
  IF v_payment_method IN ('card','wallet','online','visa') THEN
    IF v_merchant_wallet IS NOT NULL AND v_merchant_amount > 0 THEN
      SELECT EXISTS(
        SELECT 1 FROM public.wallet_transactions wt
        WHERE wt.wallet_id = v_merchant_wallet AND wt.related_order_id = p_order_id AND wt.type = 'transfer_in'
      ) INTO v_merchant_tx_exists;
      IF NOT v_merchant_tx_exists THEN
        UPDATE public.wallets SET balance = balance + v_merchant_amount WHERE id = v_merchant_wallet;
        INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
        VALUES (v_merchant_wallet, 'transfer_in', v_merchant_amount, 'Merchant settlement (product+tax)', p_order_id);
      END IF;
    END IF;
  END IF;

  -- 2) Platform fees settlement and captures
  IF v_payment_method = 'cash' THEN
    IF v_hold.id IS NOT NULL THEN
      -- capture only expected (km + service), release any extra hold back to driver
      v_cash_capture_amt := LEAST(v_hold.amount, v_expected_hold);
      UPDATE public.wallet_holds SET status = 'captured', captured_at = v_now WHERE id = v_hold.id;

      -- capture expected portion
      INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      VALUES (v_driver_wallet, 'capture', v_cash_capture_amt, 'تحصيل رسوم المنصة (CASH)', p_order_id);
      UPDATE public.wallets SET balance = balance - v_cash_capture_amt WHERE id = v_driver_wallet;
      UPDATE public.wallets SET balance = balance + v_cash_capture_amt WHERE id = v_admin_wallet;
      INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      VALUES (v_admin_wallet, 'transfer_in', v_cash_capture_amt, 'رسوم المنصة من السائق (CASH)', p_order_id);

      -- release any excess hold back to driver
      IF v_hold.amount > v_cash_capture_amt THEN
        INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
        VALUES (v_driver_wallet, 'release', (v_hold.amount - v_cash_capture_amt), 'إرجاع الفارق من الحجز', p_order_id);
      END IF;
    ELSE
      -- No hold: perform direct debit from driver to platform for cash commissions
      IF v_commission_total > 0 THEN
        INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
        VALUES (v_driver_wallet, 'transfer_out', v_commission_total, 'تحصيل رسوم المنصة (CASH) بدون حجز', p_order_id);
        UPDATE public.wallets SET balance = balance - v_commission_total WHERE id = v_driver_wallet;
        INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
        VALUES (v_admin_wallet, 'transfer_in', v_commission_total, 'رسوم المنصة من السائق (CASH) بدون حجز', p_order_id);
        UPDATE public.wallets SET balance = balance + v_commission_total WHERE id = v_admin_wallet;
      END IF;
    END IF;
  ELSE
    IF v_hold.id IS NOT NULL THEN
      UPDATE public.wallet_holds SET status = 'captured', captured_at = v_now WHERE id = v_hold.id;
      -- ONLINE: capture per-km from driver hold and release the rest
      INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      VALUES (v_driver_wallet, 'capture', v_km_fee, 'تحصيل رسوم المنصة لكل كم (أونلاين)', p_order_id);
      UPDATE public.wallets SET balance = balance - v_km_fee WHERE id = v_driver_wallet;
      UPDATE public.wallets SET balance = balance + v_km_fee WHERE id = v_admin_wallet;
      INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      VALUES (v_admin_wallet, 'transfer_in', v_km_fee, 'رسوم المنصة لكل كم (أونلاين)', p_order_id);
      IF v_hold.amount > v_km_fee THEN
        INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
        VALUES (v_driver_wallet, 'release', (v_hold.amount - v_km_fee), 'إرجاع الفارق من الحجز', p_order_id);
      END IF;
    ELSE
      -- No hold: direct debit per-km from driver
      IF v_km_fee > 0 THEN
        INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
        VALUES (v_driver_wallet, 'transfer_out', v_km_fee, 'رسوم المنصة لكل كم (أونلاين) بدون حجز', p_order_id);
        UPDATE public.wallets SET balance = balance - v_km_fee WHERE id = v_driver_wallet;
        INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
        VALUES (v_admin_wallet, 'transfer_in', v_km_fee, 'رسوم المنصة لكل كم (أونلاين) بدون حجز', p_order_id);
        UPDATE public.wallets SET balance = balance + v_km_fee WHERE id = v_admin_wallet;
      END IF;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.wallet_transactions wt
      WHERE wt.wallet_id = v_admin_wallet AND wt.related_order_id = p_order_id AND wt.type = 'capture'
    ) INTO v_platform_capture_exists;
    IF NOT v_platform_capture_exists THEN
      INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      VALUES (v_admin_wallet, 'capture', v_capture_amount, 'Card capture', p_order_id);
      UPDATE public.wallets SET balance = balance + v_platform_service_fee WHERE id = v_admin_wallet;
    END IF;
  END IF;

  UPDATE public.orders SET status = 'delivered', updated_at = v_now WHERE id = p_order_id AND status IN ('on_the_way','picked_up','heading_to_customer');

  ok := true; message := 'تم إنهاء التسليم وتسوية الرسوم'; RETURN NEXT; RETURN;
END; $$;

GRANT EXECUTE ON FUNCTION public.finalize_delivery_tx(uuid) TO authenticated;

COMMIT;
