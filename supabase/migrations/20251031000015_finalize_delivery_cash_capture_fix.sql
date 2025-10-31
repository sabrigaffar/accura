-- Fix cash branch in finalize_delivery_tx to only capture service_fee
-- Commissions (driver per-km and merchant) are handled via separate transfer entries

CREATE OR REPLACE FUNCTION finalize_delivery_tx(p_order_id uuid)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order record;
  v_driver_wallet uuid;
  v_merchant_wallet uuid;
  v_platform_wallet uuid;
  v_driver_tx_exists boolean;
  v_merchant_tx_exists boolean;
  v_platform_capture_exists boolean;
  v_platform_mc_exists boolean; -- merchant commission in exists
  v_platform_dc_exists boolean; -- driver commission in exists
  v_commission_out_exists boolean; -- driver commission out from driver wallet
  v_earning_exists boolean;

  v_driver_amount numeric;
  v_platform_fee numeric;
  v_product_component numeric;
  v_tax_component numeric;
  v_merchant_gross numeric;
  v_merchant_commission_rate numeric := 0;
  v_merchant_commission_flat numeric := 0;
  v_merchant_commission numeric := 0;
  v_merchant_net numeric := 0;

  v_customer_total numeric;
  v_capture_amount numeric;
  v_payment_method text;

  v_commission_per_km numeric := 1; -- EGP per km
  v_commission_free_until timestamptz; -- if NULL => commission applies immediately
  v_commission_km integer := 0;
  v_driver_commission numeric := 0;

  v_settings record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'يجب تسجيل الدخول'::text; RETURN;
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'الطلب غير موجود'::text; RETURN; END IF;
  IF v_order.driver_id IS DISTINCT FROM v_uid THEN
    RETURN QUERY SELECT false, 'لا تملك صلاحية إنهاء هذا الطلب'::text; RETURN;
  END IF;

  -- load settings (singleton)
  SELECT 
    driver_commission_per_km,
    driver_commission_free_until,
    service_fee_flat,
    merchant_commission_rate,
    merchant_commission_flat
  INTO v_settings
  FROM platform_settings WHERE id = 1;

  v_commission_per_km := COALESCE(v_settings.driver_commission_per_km, 1);
  v_commission_free_until := v_settings.driver_commission_free_until; -- if NULL => charge applies
  v_merchant_commission_rate := COALESCE(v_settings.merchant_commission_rate, 0);
  v_merchant_commission_flat := COALESCE(v_settings.merchant_commission_flat, 0);

  -- components
  v_driver_amount := COALESCE(v_order.delivery_fee, 0);
  v_platform_fee  := COALESCE(v_order.service_fee, v_settings.service_fee_flat, 0);
  v_product_component := COALESCE(v_order.product_total, v_order.subtotal, 0);
  v_tax_component := COALESCE(v_order.tax_amount, v_order.tax, 0);
  v_merchant_gross := v_product_component + v_tax_component;

  v_customer_total := COALESCE(v_order.customer_total, v_order.total, NULL);
  IF (v_merchant_gross IS NULL OR v_merchant_gross = 0) AND v_customer_total IS NOT NULL THEN
    v_merchant_gross := GREATEST(v_customer_total - v_driver_amount - v_platform_fee, 0);
  END IF;

  -- merchant commission
  v_merchant_commission := GREATEST(ROUND(v_merchant_gross * (COALESCE(v_merchant_commission_rate,0)/100), 2) + COALESCE(v_merchant_commission_flat,0), 0);
  IF v_merchant_commission > v_merchant_gross THEN
    v_merchant_commission := v_merchant_gross;
  END IF;
  v_merchant_net := GREATEST(v_merchant_gross - v_merchant_commission, 0);

  -- derive per-km driver commission
  IF v_commission_free_until IS NULL OR now() > v_commission_free_until THEN
    v_commission_km := COALESCE(CEIL(v_order.delivery_distance_km), CEIL(COALESCE(v_order.calculated_delivery_fee, v_order.delivery_fee, 0) / 10), 0);
    IF v_commission_km < 0 THEN v_commission_km := 0; END IF;
    v_driver_commission := GREATEST(v_commission_km * v_commission_per_km, 0);
    IF v_driver_commission > v_driver_amount THEN
      v_driver_commission := v_driver_amount; -- cap
    END IF;
  ELSE
    v_driver_commission := 0;
  END IF;

  v_payment_method := COALESCE(v_order.payment_method, '');
  v_capture_amount := COALESCE(v_customer_total, v_driver_amount + v_merchant_gross + v_platform_fee);

  -- ensure wallets
  SELECT id INTO v_driver_wallet FROM wallets WHERE owner_type='driver' AND owner_id=v_uid LIMIT 1;
  IF v_driver_wallet IS NULL THEN
    INSERT INTO wallets(owner_id, owner_type, balance, currency) VALUES (v_uid, 'driver', 0, 'EGP') RETURNING id INTO v_driver_wallet;
  END IF;
  SELECT id INTO v_merchant_wallet FROM wallets WHERE owner_type='merchant' AND owner_id=v_order.merchant_id LIMIT 1;
  IF v_merchant_wallet IS NULL THEN
    INSERT INTO wallets(owner_id, owner_type, balance, currency) VALUES (v_order.merchant_id, 'merchant', 0, 'EGP') RETURNING id INTO v_merchant_wallet;
  END IF;
  SELECT id INTO v_platform_wallet FROM wallets WHERE owner_type='admin' LIMIT 1;
  IF v_platform_wallet IS NULL THEN
    INSERT INTO wallets(owner_type, balance, currency) VALUES ('admin', 0, 'EGP') RETURNING id INTO v_platform_wallet;
  END IF;

  -- already delivered? upsert earnings and commissions then exit
  IF v_order.status = 'delivered' THEN
    INSERT INTO driver_earnings(driver_id, order_id, amount, net_amount, commission_amount, earned_at)
    VALUES (v_uid, p_order_id, v_driver_amount, v_driver_amount - v_driver_commission, v_driver_commission, COALESCE(v_order.delivered_at, now()))
    ON CONFLICT (order_id) DO UPDATE SET
      amount = EXCLUDED.amount,
      net_amount = EXCLUDED.net_amount,
      commission_amount = EXCLUDED.commission_amount;

    IF v_driver_commission > 0 THEN
      SELECT EXISTS(SELECT 1 FROM wallet_transactions WHERE wallet_id=v_driver_wallet AND related_order_id=p_order_id AND type='transfer_out' AND memo='Driver per-km commission') INTO v_commission_out_exists;
      IF NOT v_commission_out_exists THEN
        INSERT INTO wallet_transactions(wallet_id, type, amount, memo, related_order_id, created_at)
        VALUES (v_driver_wallet, 'transfer_out', v_driver_commission, 'Driver per-km commission', p_order_id, now());
        UPDATE wallets SET balance = balance - v_driver_commission WHERE id = v_driver_wallet;
      END IF;
      SELECT EXISTS(SELECT 1 FROM wallet_transactions WHERE wallet_id=v_platform_wallet AND related_order_id=p_order_id AND type='transfer_in' AND memo='Driver per-km commission') INTO v_platform_dc_exists;
      IF NOT v_platform_dc_exists THEN
        INSERT INTO wallet_transactions(wallet_id, type, amount, memo, related_order_id, created_at)
        VALUES (v_platform_wallet, 'transfer_in', v_driver_commission, 'Driver per-km commission', p_order_id, now());
        UPDATE wallets SET balance = balance + v_driver_commission WHERE id = v_platform_wallet;
      END IF;
    END IF;

    IF v_merchant_commission > 0 THEN
      SELECT EXISTS(SELECT 1 FROM wallet_transactions WHERE wallet_id=v_platform_wallet AND related_order_id=p_order_id AND type='transfer_in' AND memo='Merchant commission') INTO v_platform_mc_exists;
      IF NOT v_platform_mc_exists THEN
        INSERT INTO wallet_transactions(wallet_id, type, amount, memo, related_order_id, created_at)
        VALUES (v_platform_wallet, 'transfer_in', v_merchant_commission, 'Merchant commission', p_order_id, now());
        UPDATE wallets SET balance = balance + v_merchant_commission WHERE id = v_platform_wallet;
      END IF;
    END IF;

    RETURN QUERY SELECT true, 'الطلب مسجَّل كمسلَّم سابقاً'::text; RETURN;
  END IF;

  -- driver credit (idempotent)
  SELECT EXISTS(SELECT 1 FROM wallet_transactions WHERE wallet_id=v_driver_wallet AND related_order_id=p_order_id AND type='transfer_in') INTO v_driver_tx_exists;
  IF NOT v_driver_tx_exists THEN
    INSERT INTO wallet_transactions(wallet_id, type, amount, memo, related_order_id, created_at)
    VALUES (v_driver_wallet, 'transfer_in', v_driver_amount, 'Driver delivery earning', p_order_id, now());
    UPDATE wallets SET balance = balance + v_driver_amount WHERE id = v_driver_wallet;
  END IF;

  -- merchant credit (net)
  SELECT EXISTS(SELECT 1 FROM wallet_transactions WHERE wallet_id=v_merchant_wallet AND related_order_id=p_order_id AND type='transfer_in') INTO v_merchant_tx_exists;
  IF NOT v_merchant_tx_exists THEN
    INSERT INTO wallet_transactions(wallet_id, type, amount, memo, related_order_id, created_at)
    VALUES (v_merchant_wallet, 'transfer_in', v_merchant_net, 'Merchant settlement (net after commission)', p_order_id, now());
    UPDATE wallets SET balance = balance + v_merchant_net WHERE id = v_merchant_wallet;
  END IF;

  -- platform capture and fees
  IF v_payment_method IN ('card','visa','online') THEN
    SELECT EXISTS(SELECT 1 FROM wallet_transactions WHERE wallet_id=v_platform_wallet AND related_order_id=p_order_id AND type='capture') INTO v_platform_capture_exists;
    IF NOT v_platform_capture_exists THEN
      INSERT INTO wallet_transactions(wallet_id, type, amount, memo, related_order_id, created_at)
      VALUES (v_platform_wallet, 'capture', v_capture_amount, 'Card capture', p_order_id, now());
      UPDATE wallets SET balance = balance + v_platform_fee WHERE id = v_platform_wallet;
    END IF;
  ELSE
    -- CASH: capture only service fee as separate accounting entry
    SELECT EXISTS(SELECT 1 FROM wallet_transactions WHERE wallet_id=v_platform_wallet AND related_order_id=p_order_id AND type='capture') INTO v_platform_capture_exists;
    IF NOT v_platform_capture_exists AND v_platform_fee > 0 THEN
      INSERT INTO wallet_transactions(wallet_id, type, amount, memo, related_order_id, created_at)
      VALUES (v_platform_wallet, 'capture', v_platform_fee, 'Cash platform fee', p_order_id, now());
      UPDATE wallets SET balance = balance + v_platform_fee WHERE id = v_platform_wallet;
    END IF;
  END IF;

  -- commissions intake (separate)
  IF v_driver_commission > 0 THEN
    SELECT EXISTS(SELECT 1 FROM wallet_transactions WHERE wallet_id=v_platform_wallet AND related_order_id=p_order_id AND type='transfer_in' AND memo='Driver per-km commission') INTO v_platform_dc_exists;
    IF NOT v_platform_dc_exists THEN
      INSERT INTO wallet_transactions(wallet_id, type, amount, memo, related_order_id, created_at)
      VALUES (v_platform_wallet, 'transfer_in', v_driver_commission, 'Driver per-km commission', p_order_id, now());
      UPDATE wallets SET balance = balance + v_driver_commission WHERE id = v_platform_wallet;
    END IF;

    SELECT EXISTS(SELECT 1 FROM wallet_transactions WHERE wallet_id=v_driver_wallet AND related_order_id=p_order_id AND type='transfer_out' AND memo='Driver per-km commission') INTO v_commission_out_exists;
    IF NOT v_commission_out_exists THEN
      INSERT INTO wallet_transactions(wallet_id, type, amount, memo, related_order_id, created_at)
      VALUES (v_driver_wallet, 'transfer_out', v_driver_commission, 'Driver per-km commission', p_order_id, now());
      UPDATE wallets SET balance = balance - v_driver_commission WHERE id = v_driver_wallet;
    END IF;
  END IF;

  IF v_merchant_commission > 0 THEN
    SELECT EXISTS(SELECT 1 FROM wallet_transactions WHERE wallet_id=v_platform_wallet AND related_order_id=p_order_id AND type='transfer_in' AND memo='Merchant commission') INTO v_platform_mc_exists;
    IF NOT v_platform_mc_exists THEN
      INSERT INTO wallet_transactions(wallet_id, type, amount, memo, related_order_id, created_at)
      VALUES (v_platform_wallet, 'transfer_in', v_merchant_commission, 'Merchant commission', p_order_id, now());
      UPDATE wallets SET balance = balance + v_merchant_commission WHERE id = v_platform_wallet;
    END IF;
  END IF;

  -- upsert driver earnings
  INSERT INTO driver_earnings(driver_id, order_id, amount, net_amount, commission_amount, earned_at)
  VALUES (v_uid, p_order_id, v_driver_amount, v_driver_amount - v_driver_commission, v_driver_commission, now())
  ON CONFLICT (order_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    net_amount = EXCLUDED.net_amount,
    commission_amount = EXCLUDED.commission_amount;

  UPDATE orders SET status='delivered', updated_at=now(), delivered_at=COALESCE(delivered_at, now()) WHERE id=p_order_id;

  RETURN QUERY SELECT true, 'تم إنهاء التسليم وتسوية المستحقات والعمولات (كاش/فيزا)'::text; RETURN;
END $$;

GRANT EXECUTE ON FUNCTION finalize_delivery_tx(uuid) TO authenticated;
