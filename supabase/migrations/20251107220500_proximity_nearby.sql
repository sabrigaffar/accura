-- Migration: Proximity queries (merchants/drivers nearby within radius)
-- - Enable PostGIS
-- - Add geog columns and triggers for merchants and driver_profiles
-- - Create GiST indexes
-- - Create RPCs: merchants_nearby, drivers_nearby

BEGIN;

-- 0) Enable PostGIS (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1) Merchants: geography column + trigger to keep in sync
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS geog geography(Point,4326);

-- Backfill existing rows
UPDATE public.merchants m
SET geog = CASE
  WHEN m.latitude IS NOT NULL AND m.longitude IS NOT NULL THEN
    ST_SetSRID(ST_MakePoint(m.longitude::double precision, m.latitude::double precision), 4326)::geography
  ELSE NULL
END
WHERE geog IS NULL;

-- Trigger function
CREATE OR REPLACE FUNCTION public.merchants_update_geog_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geog := ST_SetSRID(ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision), 4326)::geography;
  ELSE
    NEW.geog := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_merchants_update_geog'
  ) THEN
    CREATE TRIGGER trg_merchants_update_geog
    BEFORE INSERT OR UPDATE OF latitude, longitude ON public.merchants
    FOR EACH ROW EXECUTE FUNCTION public.merchants_update_geog_trigger();
  END IF;
END $$;

-- Index
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_merchants_geog'
  ) THEN
    CREATE INDEX idx_merchants_geog ON public.merchants USING GIST (geog);
  END IF;
END $$;

-- 2) Driver profiles: add lat/lng and geography column + trigger
ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,8),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(11,8),
  ADD COLUMN IF NOT EXISTS geog geography(Point,4326);

-- Backfill existing rows (if any lat/lng exists)
UPDATE public.driver_profiles d
SET geog = CASE
  WHEN d.latitude IS NOT NULL AND d.longitude IS NOT NULL THEN
    ST_SetSRID(ST_MakePoint(d.longitude::double precision, d.latitude::double precision), 4326)::geography
  ELSE NULL
END
WHERE geog IS NULL;

-- Trigger function
CREATE OR REPLACE FUNCTION public.driver_profiles_update_geog_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geog := ST_SetSRID(ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision), 4326)::geography;
  ELSE
    NEW.geog := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_driver_profiles_update_geog'
  ) THEN
    CREATE TRIGGER trg_driver_profiles_update_geog
    BEFORE INSERT OR UPDATE OF latitude, longitude ON public.driver_profiles
    FOR EACH ROW EXECUTE FUNCTION public.driver_profiles_update_geog_trigger();
  END IF;
END $$;

-- Index
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_driver_profiles_geog'
  ) THEN
    CREATE INDEX idx_driver_profiles_geog ON public.driver_profiles USING GIST (geog);
  END IF;
END $$;

-- 3) RPC: merchants_nearby
CREATE OR REPLACE FUNCTION public.merchants_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_km numeric DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name_ar text,
  name_en text,
  banner_url text,
  description_ar text,
  logo_url text,
  category text,
  is_open boolean,
  delivery_fee numeric,
  rating numeric,
  min_order_amount numeric,
  working_hours jsonb,
  avg_delivery_time integer,
  distance_km numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
  m.id,
  m.name_ar,
  m.name_en,
  m.banner_url,
  m.description_ar,
  m.logo_url,
  m.category,
  m.is_open,
  m.delivery_fee,
  m.rating,
  m.min_order_amount,
  m.working_hours,
  m.avg_delivery_time,
  (ST_Distance(m.geog, ST_MakePoint(p_lng, p_lat)::geography) / 1000.0) AS distance_km
FROM public.merchants m
WHERE m.geog IS NOT NULL
  AND m.is_active = TRUE
  AND ST_DWithin(m.geog, ST_MakePoint(p_lng, p_lat)::geography, (p_radius_km * 1000.0))
ORDER BY distance_km ASC
$$;

REVOKE ALL ON FUNCTION public.merchants_nearby(double precision, double precision, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchants_nearby(double precision, double precision, numeric) TO anon, authenticated;

-- 4) RPC: drivers_nearby
CREATE OR REPLACE FUNCTION public.drivers_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_km numeric DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  avatar_url text,
  distance_km numeric,
  is_online boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
  dp.id,
  COALESCE(p.full_name, '') AS name,
  p.avatar_url,
  (ST_Distance(dp.geog, ST_MakePoint(p_lng, p_lat)::geography) / 1000.0) AS distance_km,
  dp.is_online
FROM public.driver_profiles dp
LEFT JOIN public.profiles p ON p.id = dp.id
WHERE dp.geog IS NOT NULL
  AND dp.is_online = TRUE
  AND ST_DWithin(dp.geog, ST_MakePoint(p_lng, p_lat)::geography, (p_radius_km * 1000.0))
ORDER BY distance_km ASC
$$;

REVOKE ALL ON FUNCTION public.drivers_nearby(double precision, double precision, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.drivers_nearby(double precision, double precision, numeric) TO anon, authenticated;

COMMIT;
