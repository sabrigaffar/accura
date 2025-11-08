-- Enforce that an ad cannot be active unless it is approved
-- Date: 2025-11-05

BEGIN;

ALTER TABLE public.sponsored_ads
  DROP CONSTRAINT IF EXISTS sponsored_ads_active_requires_approved,
  ADD CONSTRAINT sponsored_ads_active_requires_approved
    CHECK (NOT is_active OR approval_status = 'approved');

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_is_active ON public.sponsored_ads(is_active);

COMMIT;
