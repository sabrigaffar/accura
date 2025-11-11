-- Fix 22023: unrecognized format() type specifier due to usage of %.2f in format()
-- Replace with to_char(...) concatenation in driver_can_accept
-- Date: 2025-11-10

BEGIN;

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
    message := 'رصيد محفظتك المتاح ' || to_char(v_available, 'FM999999990.00') ||
               ' أقل من الحد الأدنى ' || to_char(v_min, 'FM999999990.00') ||
               '. لا يمكنك قبول الطلب.';
    RETURN NEXT; RETURN;
  END IF;

  allowed := true; message := 'يمكنك قبول الطلب'; RETURN NEXT; RETURN;
END; $$;

GRANT EXECUTE ON FUNCTION public.driver_can_accept(numeric) TO authenticated;

COMMIT;
