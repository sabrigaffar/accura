-- Migration: Fix semantics of calculated_delivery_fee to be fee in EGP (ceil(distance_km) * base_rate)
-- Non-destructive, uses CREATE OR REPLACE and guarded backfill.

BEGIN;

-- 2) Backfill suspicious rows where calculated_delivery_fee looks like a distance (e.g., < 5 EGP)
-- Prefer using delivery_distance_km if present; fallback to rounding delivery_fee/base_rate
UPDATE public.orders o
SET calculated_delivery_fee = public.calculate_delivery_fee(o.delivery_distance_km)
WHERE (o.calculated_delivery_fee IS NULL OR o.calculated_delivery_fee < 5)
  AND o.delivery_distance_km IS NOT NULL;

-- Fallback: where distance is missing, derive from existing explicit delivery_fee
UPDATE public.orders o
SET calculated_delivery_fee = GREATEST(CEIL(COALESCE(o.delivery_fee, 10) / 10) * 10, 10)
WHERE (o.calculated_delivery_fee IS NULL OR o.calculated_delivery_fee < 5)
  AND o.delivery_distance_km IS NULL;

-- 3) Optional alignment: if explicit delivery_fee is NULL, fill from calculated value
UPDATE public.orders o
SET delivery_fee = COALESCE(o.delivery_fee, o.calculated_delivery_fee)
WHERE o.delivery_fee IS NULL AND o.calculated_delivery_fee IS NOT NULL;

COMMIT;
