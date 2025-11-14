-- Driver Order Offers (targeted realtime) migration
-- Date: 2025-11-14

BEGIN;

-- 1) driver_order_offers table
CREATE TABLE IF NOT EXISTS public.driver_order_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  distance_m numeric,
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | expired | declined | cancelled
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.driver_order_offers ENABLE ROW LEVEL SECURITY;

-- Uniqueness: do not spam same driver for same order
CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_order_offer ON public.driver_order_offers(order_id, driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_order_offers_driver ON public.driver_order_offers(driver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_order_offers_order ON public.driver_order_offers(order_id);

-- 2) RLS policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_order_offers' AND policyname='driver_offers_select_own'
  ) THEN
    CREATE POLICY driver_offers_select_own ON public.driver_order_offers FOR SELECT TO authenticated
      USING (driver_id = auth.uid());
  END IF;
  -- Inserts will be done by SECURITY DEFINER function; block direct inserts
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_order_offers' AND policyname='driver_offers_insert_none'
  ) THEN
    CREATE POLICY driver_offers_insert_none ON public.driver_order_offers FOR INSERT TO authenticated WITH CHECK (false);
  END IF;
END $$;

-- 3) Function to create offers for nearby online drivers
DROP FUNCTION IF EXISTS public.create_driver_offers_for_order(uuid, integer, numeric);
CREATE OR REPLACE FUNCTION public.create_driver_offers_for_order(
  p_order_id uuid,
  p_limit integer DEFAULT 20,
  p_radius_km numeric DEFAULT 7
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_order record;
  v_point geography;
  v_inserted integer := 0;
BEGIN
  SELECT o.id, o.merchant_id, o.customer_latitude, o.customer_longitude
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Build geography point (prefer customer location, else merchant location if available)
  IF v_order.customer_latitude IS NOT NULL AND v_order.customer_longitude IS NOT NULL THEN
    v_point := ST_SetSRID(ST_MakePoint(v_order.customer_longitude::double precision, v_order.customer_latitude::double precision), 4326)::geography;
  ELSE
    -- fallback to merchant coordinates if present
    v_point := NULL;
    BEGIN
      SELECT ST_SetSRID(ST_MakePoint(m.longitude::double precision, m.latitude::double precision), 4326)::geography
      INTO v_point
      FROM public.merchants m
      WHERE m.id = v_order.merchant_id AND m.latitude IS NOT NULL AND m.longitude IS NOT NULL;
    EXCEPTION WHEN others THEN
      v_point := NULL;
    END;
  END IF;

  IF v_point IS NULL THEN
    RETURN 0;
  END IF;

  WITH candidates AS (
    SELECT dp.id AS driver_id,
           ST_Distance(dp.geog, v_point) AS distance_m
    FROM public.driver_profiles dp
    WHERE dp.is_online = TRUE
      AND dp.geog IS NOT NULL
      AND ST_DWithin(dp.geog, v_point, (p_radius_km * 1000.0))
    ORDER BY ST_Distance(dp.geog, v_point) ASC
    LIMIT COALESCE(p_limit, 20)
  )
  INSERT INTO public.driver_order_offers(order_id, driver_id, distance_m, status, created_at, expires_at)
  SELECT p_order_id, c.driver_id, c.distance_m, 'pending', now(), now() + interval '3 minutes'
  FROM candidates c
  ON CONFLICT (order_id, driver_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END $$;

GRANT EXECUTE ON FUNCTION public.create_driver_offers_for_order(uuid, integer, numeric) TO authenticated;

-- 4) Trigger to create offers after order insert when status is 'pending'
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'after_order_insert_offers'
  ) THEN
    DROP TRIGGER after_order_insert_offers ON public.orders;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.trg_after_order_insert_offers();
CREATE OR REPLACE FUNCTION public.trg_after_order_insert_offers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM public.create_driver_offers_for_order(NEW.id, 30, 7);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS after_order_insert_offers ON public.orders;
CREATE TRIGGER after_order_insert_offers
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_after_order_insert_offers();

COMMIT;
