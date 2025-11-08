-- Migration: Update merchants_nearby return type (add extra columns)
-- Fixes error 42P13 by dropping and recreating the function with new OUT columns

BEGIN;

-- Drop old signature to allow new OUT columns
DROP FUNCTION IF EXISTS public.merchants_nearby(double precision, double precision, numeric);

-- Recreate with updated return columns (distance in km, and more merchant fields)
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

COMMIT;
