-- Migration: Optimize merchants_nearby_haversine with bounding box, LIMIT, and indexes
-- Date: 2025-11-12

BEGIN;

-- Helpful indexes for filtering
CREATE INDEX IF NOT EXISTS merchants_is_active_idx ON public.merchants (is_active);
CREATE INDEX IF NOT EXISTS merchants_lat_idx ON public.merchants (latitude);
CREATE INDEX IF NOT EXISTS merchants_lng_idx ON public.merchants (longitude);
CREATE INDEX IF NOT EXISTS merchants_active_lat_lng_idx ON public.merchants (is_active, latitude, longitude);

-- Replace function using Haversine formula with a bounding box pre-filter and LIMIT
CREATE OR REPLACE FUNCTION public.merchants_nearby_haversine(
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
STABLE
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
    (
      6371 * 2 * ASIN(
        SQRT(
          POWER(SIN(RADIANS(COALESCE(m.latitude::double precision, 0) - p_lat) / 2), 2) +
          COS(RADIANS(p_lat)) * COS(RADIANS(COALESCE(m.latitude::double precision, 0))) *
          POWER(SIN(RADIANS(COALESCE(m.longitude::double precision, 0) - p_lng) / 2), 2)
        )
      )
    ) AS distance_km
  FROM public.merchants m
  WHERE m.is_active = TRUE
    AND m.latitude IS NOT NULL
    AND m.longitude IS NOT NULL
    -- Bounding box pre-filter to reduce candidate set
    AND m.latitude BETWEEN (p_lat - (p_radius_km / 110.574)) AND (p_lat + (p_radius_km / 110.574))
    AND m.longitude BETWEEN (
      p_lng - (p_radius_km / (111.320 * COS(RADIANS(p_lat))))
    ) AND (
      p_lng + (p_radius_km / (111.320 * COS(RADIANS(p_lat))))
    )
    -- Precise Haversine distance filter
    AND (
      6371 * 2 * ASIN(
        SQRT(
          POWER(SIN(RADIANS(COALESCE(m.latitude::double precision, 0) - p_lat) / 2), 2) +
          COS(RADIANS(p_lat)) * COS(RADIANS(COALESCE(m.latitude::double precision, 0))) *
          POWER(SIN(RADIANS(COALESCE(m.longitude::double precision, 0) - p_lng) / 2), 2)
        )
      )
    ) <= p_radius_km
  ORDER BY distance_km ASC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.merchants_nearby_haversine(double precision, double precision, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchants_nearby_haversine(double precision, double precision, numeric) TO anon, authenticated;

COMMIT;
