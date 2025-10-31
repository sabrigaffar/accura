-- ========================================
-- Make finalize_delivery_tx idempotent and ensure earnings recorded
-- ========================================

-- Unique guard to prevent duplicate earnings per order
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_driver_earnings_order'
  ) THEN
    CREATE UNIQUE INDEX uq_driver_earnings_order ON driver_earnings (order_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION finalize_delivery_tx(p_order_id uuid)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order record;
  v_driver_wallet_id uuid;
  v_exists_tx boolean;
  v_exists_earn boolean;
  v_amount numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'يجب تسجيل الدخول'::text; RETURN;
  END IF;

  -- lock order row
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'الطلب غير موجود'::text; RETURN; END IF;

  -- only assigned driver can finalize
  IF v_order.driver_id IS DISTINCT FROM v_uid THEN
    RETURN QUERY SELECT false, 'لا تملك صلاحية إنهاء هذا الطلب'::text; RETURN;
  END IF;

  -- idempotency: if already delivered, just ensure earnings exist and return
  IF v_order.status = 'delivered' THEN
    -- ensure earning exists
    SELECT EXISTS(SELECT 1 FROM driver_earnings WHERE order_id = p_order_id) INTO v_exists_earn;
    IF NOT v_exists_earn THEN
      INSERT INTO driver_earnings (driver_id, order_id, amount, earned_at)
      VALUES (v_uid, p_order_id, COALESCE(v_order.delivery_fee, 0), now())
      ON CONFLICT (order_id) DO NOTHING;
    END IF;
    RETURN QUERY SELECT true, 'الطلب مسجّل مسلَّم من قبل'::text; RETURN;
  END IF;

  -- compute amount (delivery_fee)
  v_amount := COALESCE(v_order.delivery_fee, 0);

  -- credit driver wallet only once per order
  SELECT id INTO v_driver_wallet_id FROM wallets WHERE owner_type = 'driver' AND owner_id = v_uid LIMIT 1;
  IF v_driver_wallet_id IS NULL THEN
    INSERT INTO wallets(owner_id, owner_type, balance, currency)
    VALUES (v_uid, 'driver', 0, 'EGP') RETURNING id INTO v_driver_wallet_id;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM wallet_transactions 
    WHERE wallet_id = v_driver_wallet_id AND related_order_id = p_order_id AND type = 'transfer_in'
  ) INTO v_exists_tx;

  IF NOT v_exists_tx THEN
    INSERT INTO wallet_transactions(wallet_id, type, amount, memo, related_order_id, created_at)
    VALUES (v_driver_wallet_id, 'transfer_in', v_amount, 'Driver delivery earning', p_order_id, now());
    -- update wallet balance
    UPDATE wallets SET balance = balance + v_amount, updated_at = now() WHERE id = v_driver_wallet_id;
  END IF;

  -- ensure earnings row exists (idempotent)
  INSERT INTO driver_earnings(driver_id, order_id, amount, earned_at)
  VALUES (v_uid, p_order_id, v_amount, now())
  ON CONFLICT (order_id) DO NOTHING;

  -- set order delivered
  UPDATE orders SET status = 'delivered', updated_at = now(), delivered_at = COALESCE(delivered_at, now())
  WHERE id = p_order_id;

  RETURN QUERY SELECT true, 'تم إنهاء التسليم وتسوية الأرباح'::text; RETURN;
END $$;

GRANT EXECUTE ON FUNCTION finalize_delivery_tx(uuid) TO authenticated;
