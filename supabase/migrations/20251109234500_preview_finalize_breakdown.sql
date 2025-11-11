-- Debug helper: preview_finalize_breakdown shows how finalize_delivery_tx would compute amounts
-- Date: 2025-11-09

BEGIN;

CREATE OR REPLACE FUNCTION public.preview_finalize_breakdown(p_order_id uuid)
RETURNS TABLE(
  order_id uuid,
  payment_method text,
  delivery_distance_km numeric,
  driver_delivery_fee numeric,
  calculated_delivery_fee numeric,
  per_km_rate numeric,
  base_fee_per_km numeric,
  kilometers integer,
  km_fee numeric,
  service_fee numeric,
  expected_cash_capture numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_order public.orders;
  v_payment_method text;
  v_driver_delivery_fee numeric;
  v_distance_km numeric;
  v_per_km_driver numeric := 1;
  v_base_fee_per_km numeric := 10;
  v_kilometers integer := 0;
  v_km_fee numeric := 0;
  v_service_fee numeric := 0;
  v_free_until timestamptz := NULL;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT p_order_id, NULL::text, NULL::numeric, NULL::numeric, NULL::numeric,
                         NULL::numeric, NULL::numeric, NULL::integer, NULL::numeric, NULL::numeric, NULL::numeric; RETURN;
  END IF;

  v_payment_method := COALESCE((v_order.payment_method)::text, 'cash');
  v_service_fee := COALESCE(v_order.service_fee, 2.5);
  v_driver_delivery_fee := COALESCE(v_order.delivery_fee, COALESCE(v_order.calculated_delivery_fee, 0));
  IF COALESCE(v_driver_delivery_fee, 0) <= 0 THEN
    v_driver_delivery_fee := COALESCE(public.calculate_delivery_fee(v_order.delivery_distance_km), 0);
  END IF;

  SELECT COALESCE(driver_commission_per_km, 1), COALESCE(base_fee_per_km, 10), driver_commission_free_until
    INTO v_per_km_driver, v_base_fee_per_km, v_free_until
  FROM public.platform_settings WHERE id = 1;

  v_distance_km := v_order.delivery_distance_km;
  IF v_distance_km IS NOT NULL AND v_distance_km > 0 THEN
    v_kilometers := CEIL(v_distance_km);
  ELSE
    v_kilometers := GREATEST(CEIL(COALESCE(v_driver_delivery_fee, 0) / v_base_fee_per_km), 0);
  END IF;

  IF v_free_until IS NOT NULL AND now() <= v_free_until THEN
    v_km_fee := 0;
  ELSE
    v_km_fee := GREATEST(v_kilometers, 0) * v_per_km_driver;
  END IF;

  RETURN QUERY SELECT v_order.id,
                      v_payment_method,
                      v_distance_km,
                      v_driver_delivery_fee,
                      v_order.calculated_delivery_fee,
                      v_per_km_driver,
                      v_base_fee_per_km,
                      v_kilometers,
                      v_km_fee,
                      v_service_fee,
                      (v_km_fee + CASE WHEN v_payment_method = 'cash' THEN v_service_fee ELSE 0 END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_finalize_breakdown(uuid) TO authenticated, anon;

COMMIT;
