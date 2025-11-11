-- Cleanup legacy rating triggers/functions that conflict with new aggregate system
-- Reason: prevent ambiguous column reference errors and double updates
-- Date: 2025-11-10

BEGIN;

-- Drop old triggers on reviews (legacy rating system)
DROP TRIGGER IF EXISTS trigger_update_driver_rating ON public.reviews;
DROP TRIGGER IF EXISTS trigger_update_merchant_rating ON public.reviews;

-- Drop old functions used by those triggers
DROP FUNCTION IF EXISTS public.update_driver_average_rating();
DROP FUNCTION IF EXISTS public.update_merchant_average_rating();

COMMIT;
