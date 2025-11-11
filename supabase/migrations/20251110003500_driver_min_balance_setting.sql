-- Add dynamic min balance setting and wire driver_can_accept/accept_order_safe to it
-- Date: 2025-11-10

BEGIN;

-- 1) Add platform setting
ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS driver_min_balance_to_accept numeric NOT NULL DEFAULT 50;

COMMENT ON COLUMN public.platform_settings.driver_min_balance_to_accept IS 'الحد الأدنى لرصيد السائق لقبول الطلب بالجنيه المصري - Minimum driver wallet balance to accept orders (EGP)';

-- 2) Update driver_can_accept to use platform setting by default (if p_min is NULL)
DROP FUNCTION IF EXISTS public.driver_can_accept(numeric);
CREATE OR REPLACE FUNCTION public.driver_can_accept(p_min numeric DEFAULT NULL)
RETURNS TABLE(allowed boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_wallet_id uuid;
  v_balance numeric := 0;
  v_active_holds numeric := 0;
  v_available numeric := 0;
  v_cfg_min numeric := NULL;
  v_min numeric := NULL;
BEGIN
  IF v_uid IS NULL THEN
    allowed := false; message := 'يجب تسجيل الدخول'; RETURN NEXT; RETURN;
  END IF;

  SELECT driver_min_balance_to_accept INTO v_cfg_min FROM public.platform_settings WHERE id = 1;
  v_min := COALESCE(p_min, v_cfg_min, 50);

  -- ensure wallet
  SELECT id, balance INTO v_wallet_id, v_balance
  FROM public.wallets
  WHERE owner_id = v_uid AND owner_type = 'driver'
  LIMIT 1;
  IF v_wallet_id IS NULL THEN
    v_wallet_id := public.create_wallet_if_missing(v_uid, 'driver', 30);
    SELECT balance INTO v_balance FROM public.wallets WHERE id = v_wallet_id;
  END IF;

  -- compute available = balance - active holds
  SELECT COALESCE(SUM(amount), 0)
  INTO v_active_holds
  FROM public.wallet_holds
  WHERE wallet_id = v_wallet_id AND status = 'active';

  v_available := COALESCE(v_balance, 0) - COALESCE(v_active_holds, 0);

  IF v_available < v_min THEN
    allowed := false;
    message := format('رصيد محفظتك المتاح %.2f أقل من الحد الأدنى %.2f. لا يمكنك قبول الطلب.', v_available, v_min);
    RETURN NEXT; RETURN;
  END IF;

  allowed := true; message := 'يمكنك قبول الطلب'; RETURN NEXT; RETURN;
END; $$;

GRANT EXECUTE ON FUNCTION public.driver_can_accept(numeric) TO authenticated;

-- 3) Update accept_order_safe to consult platform dynamic min
CREATE OR REPLACE FUNCTION public.accept_order_safe(p_order_id uuid)
RETURNS TABLE (accepted boolean, message text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active_count int;
  v_driver uuid := auth.uid();
  v_wallet_id uuid;
  v_can boolean; 
  v_msg text;
  v_hold_amount numeric := 0;
  v_order public.orders;
  v_km_fee numeric := 0;
  v_service numeric := 0;
  v_payment_method text;
  v_per_km_driver numeric := 1;
  v_base_fee_per_km numeric := 10;
  v_distance_km numeric;
  v_kilometers integer := 0;
  v_min numeric := NULL;
BEGIN
  -- Read dynamic min and gate by driver_can_accept
  SELECT driver_min_balance_to_accept INTO v_min FROM public.platform_settings WHERE id = 1;
  SELECT d.allowed, d.message INTO v_can, v_msg FROM public.driver_can_accept(v_min) AS d;
  IF NOT v_can THEN
    accepted := false; message := v_msg; RETURN NEXT; RETURN;
  END IF;

  -- Prevent multiple active orders
  SELECT COUNT(*) INTO v_active_count
  FROM public.orders
  WHERE driver_id = v_driver
    AND status IN ('heading_to_merchant','picked_up','heading_to_customer','on_the_way');
  IF v_active_count > 0 THEN
    accepted := false; message := 'لديك طلب نشط بالفعل. لا يمكنك قبول طلب آخر الآن.'; RETURN NEXT; RETURN;
  END IF;

  -- Assign order atomically
  UPDATE public.orders
  SET driver_id = v_driver,
      status = 'heading_to_merchant',
      updated_at = now()
  WHERE id = p_order_id
    AND (driver_id IS NULL OR driver_id = v_driver)
    AND status IN ('ready','out_for_delivery','accepted')
  RETURNING * INTO v_order;

  IF NOT FOUND THEN
    accepted := false; message := 'تعذر قبول الطلب. ربما تم قبوله من شخص آخر.'; RETURN NEXT; RETURN;
  END IF;

  -- Ensure driver wallet
  SELECT public.create_wallet_if_missing(v_driver, 'driver', 30) INTO v_wallet_id;

  -- Load platform settings for dynamic per-km
  SELECT COALESCE(driver_commission_per_km, 1), COALESCE(base_fee_per_km, 10)
    INTO v_per_km_driver, v_base_fee_per_km
  FROM public.platform_settings WHERE id = 1;

  -- Determine kilometers for hold (prefer distance; else derive from delivery/calculated fee with dynamic base)
  v_distance_km := v_order.delivery_distance_km;
  IF v_distance_km IS NOT NULL AND v_distance_km > 0 THEN
    v_kilometers := CEIL(v_distance_km);
  ELSE
    v_kilometers := GREATEST(CEIL(COALESCE(v_order.delivery_fee, v_order.calculated_delivery_fee, 0) / v_base_fee_per_km), 0);
  END IF;

  -- per-km fee to hold uses driver_commission_per_km
  v_km_fee := GREATEST(v_kilometers, 0) * v_per_km_driver;

  -- service fee if CASH
  v_payment_method := COALESCE((v_order.payment_method)::text, 'cash');
  v_service := CASE WHEN v_payment_method = 'cash' THEN COALESCE(v_order.service_fee, 2.5) ELSE 0 END;

  v_hold_amount := GREATEST(v_km_fee + v_service, 0);

  -- Place hold on driver wallet (captured/released at delivery time)
  IF v_hold_amount > 0 THEN
    INSERT INTO public.wallet_holds(wallet_id, amount, related_order_id)
    VALUES (v_wallet_id, v_hold_amount, p_order_id);
    INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
    VALUES (v_wallet_id, 'hold', v_hold_amount, 'حجز رسوم المنصة المتوقعة (لكل كم + الخدمة إن كانت CASH)', p_order_id);
  END IF;

  accepted := true; message := 'تم قبول الطلب بنجاح'; RETURN NEXT; RETURN;
END; $$;

GRANT EXECUTE ON FUNCTION public.accept_order_safe(uuid) TO authenticated;

COMMIT;
