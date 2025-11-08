-- Ensure ad metrics recording functions can update sponsored_ads counters despite RLS
BEGIN;

-- Run these as SECURITY DEFINER so they execute with the function owner (table owner), bypassing merchant-only RLS for counter updates.
ALTER FUNCTION public.record_ad_impression(uuid, uuid, text, text, numeric, numeric)
  SECURITY DEFINER;
ALTER FUNCTION public.record_ad_impression(uuid, uuid, text, text, numeric, numeric)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.record_ad_click(uuid, uuid, text)
  SECURITY DEFINER;
ALTER FUNCTION public.record_ad_click(uuid, uuid, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.record_ad_conversion(uuid, uuid)
  SECURITY DEFINER;
ALTER FUNCTION public.record_ad_conversion(uuid, uuid)
  SET search_path = public, pg_temp;

-- Optionally, ensure ownership by the schema owner (adjust if your owner is different)
DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.record_ad_impression(uuid, uuid, text, text, numeric, numeric) OWNER TO postgres;
  EXCEPTION WHEN insufficient_privilege THEN
    -- ignore if we don't have permission in local dev
    NULL;
  END;
  BEGIN
    ALTER FUNCTION public.record_ad_click(uuid, uuid, text) OWNER TO postgres;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.record_ad_conversion(uuid, uuid) OWNER TO postgres;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;

COMMIT;
