-- Adjust finalize_delivery_tx to compute merchant amount robustly
-- merchant_amount := COALESCE(product_total, subtotal) + COALESCE(tax_amount, tax)
-- fallback: if still zero, use customer_total/total - delivery_fee - service_fee

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
  v_earning_exists boolean;
  v_driver_amount numeric;
  v_platform_fee numeric;
  v_merchant_amount numeric;
  v_product_component numeric;
  v_tax_component numeric;
  v_customer_total numeric;
  v_capture_amount numeric;
  v_payment_method text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'يجب تسجيل الدخول'::text; RETURN;
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'الطلب غير موجود'::text; RETURN; END IF;
  IF v_order.driver_id IS DISTINCT FROM v_uid THEN
    RETURN QUERY SELECT false, 'لا تملك صلاحية إنهاء هذا الطلب'::text; RETURN;
  END IF;

  v_driver_amount := COALESCE(v_order.delivery_fee, 0);
  v_platform_fee  := COALESCE(v_order.service_fee, 0);
  v_product_component := COALESCE(v_order.product_total, v_order.subtotal, 0);
  v_tax_component := COALESCE(v_order.tax_amount, v_order.tax, 0);
  v_merchant_amount := v_product_component + v_tax_component;

  v_customer_total := COALESCE(v_order.customer_total, v_order.total, NULL);
  IF (v_merchant_amount IS NULL OR v_merchant_amount = 0) AND v_customer_total IS NOT NULL THEN
    v_merchant_amount := GREATEST(v_customer_total - v_driver_amount - v_platform_fee, 0);
  END IF;

  v_payment_method := COALESCE(v_order.payment_method, '');
  v_capture_amount := COALESCE(v_customer_total, v_driver_amount + v_merchant_amount + v_platform_fee);

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

  -- already delivered? ensure earning row and exit
  IF v_order.status = 'delivered' THEN
    SELECT EXISTS(SELECT 1 FROM driver_earnings WHERE order_id = p_order_id) INTO v_earning_exists;
    IF NOT v_earning_exists THEN
      INSERT INTO driver_earnings(driver_id, order_id, amount, earned_at)
      VALUES (v_uid, p_order_id, v_driver_amount, now())
      ON CONFLICT (order_id) DO NOTHING;
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

  -- merchant credit (idempotent)
  SELECT EXISTS(SELECT 1 FROM wallet_transactions WHERE wallet_id=v_merchant_wallet AND related_order_id=p_order_id AND type='transfer_in') INTO v_merchant_tx_exists;
  IF NOT v_merchant_tx_exists THEN
    INSERT INTO wallet_transactions(wallet_id, type, amount, memo, related_order_id, created_at)
    VALUES (v_merchant_wallet, 'transfer_in', v_merchant_amount, 'Merchant settlement', p_order_id, now());
    UPDATE wallets SET balance = balance + v_merchant_amount WHERE id = v_merchant_wallet;
  END IF;

  -- platform capture (idempotent)
  IF v_payment_method IN ('card','visa','online') THEN
    SELECT EXISTS(SELECT 1 FROM wallet_transactions WHERE wallet_id=v_platform_wallet AND related_order_id=p_order_id AND type='capture') INTO v_platform_capture_exists;
    IF NOT v_platform_capture_exists THEN
      INSERT INTO wallet_transactions(wallet_id, type, amount, memo, related_order_id, created_at)
      VALUES (v_platform_wallet, 'capture', v_capture_amount, 'Card capture', p_order_id, now());
      UPDATE wallets SET balance = balance + v_platform_fee WHERE id = v_platform_wallet;
    END IF;
  ELSE
    SELECT EXISTS(SELECT 1 FROM wallet_transactions WHERE wallet_id=v_platform_wallet AND related_order_id=p_order_id AND type='capture') INTO v_platform_capture_exists;
    IF NOT v_platform_capture_exists AND v_platform_fee > 0 THEN
      INSERT INTO wallet_transactions(wallet_id, type, amount, memo, related_order_id, created_at)
      VALUES (v_platform_wallet, 'capture', v_platform_fee, 'Cash order platform fee', p_order_id, now());
      UPDATE wallets SET balance = balance + v_platform_fee WHERE id = v_platform_wallet;
    END IF;
  END IF;

  -- ensure driver earnings row
  INSERT INTO driver_earnings(driver_id, order_id, amount, earned_at)
  VALUES (v_uid, p_order_id, v_driver_amount, now())
  ON CONFLICT (order_id) DO NOTHING;

  -- mark delivered
  UPDATE orders SET status='delivered', updated_at=now(), delivered_at=COALESCE(delivered_at, now()) WHERE id=p_order_id;

  RETURN QUERY SELECT true, 'تم إنهاء التسليم وتسوية المستحقات'::text; RETURN;
END $$;

GRANT EXECUTE ON FUNCTION finalize_delivery_tx(uuid) TO authenticated;
