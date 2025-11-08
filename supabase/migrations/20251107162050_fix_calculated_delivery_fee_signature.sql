-- Migration: Resolve ambiguity for calculate_delivery_fee() by keeping a single-arg version only
-- Reason: update_order_delivery_info() calls calculate_delivery_fee(distance) and multiple candidates existed.

BEGIN;

-- Drop ONLY the 3-arg version to remove ambiguity when calling with a single argument
DROP FUNCTION IF EXISTS public.calculate_delivery_fee(numeric, numeric, numeric);

COMMIT;
