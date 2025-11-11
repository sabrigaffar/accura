-- Fix refresh_reviewee_aggregates to avoid enum=text comparisons by using enum-typed variable
-- Date: 2025-11-10

BEGIN;

-- Drop trigger first to avoid dependency issues, then recreate function with proper enum typing
DROP TRIGGER IF EXISTS on_reviews_change_refresh ON public.reviews;
DROP FUNCTION IF EXISTS public.refresh_reviewee_aggregates();

CREATE OR REPLACE FUNCTION public.refresh_reviewee_aggregates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_type reviewee_type_enum; -- use enum type, not text
  v_avg numeric(10,6);
  v_cnt int;
BEGIN
  v_id := COALESCE(NEW.reviewee_id, OLD.reviewee_id);
  v_type := COALESCE(NEW.reviewee_type, OLD.reviewee_type); -- both are enum

  SELECT COALESCE(AVG(rating)::numeric, 0), COALESCE(COUNT(*), 0)
  INTO v_avg, v_cnt
  FROM public.reviews
  WHERE reviewee_id = v_id AND reviewee_type = v_type; -- enum = enum

  IF v_type = 'driver'::reviewee_type_enum THEN
    UPDATE public.driver_profiles
    SET average_rating = ROUND(v_avg::numeric, 2),
        reviews_count = v_cnt
    WHERE id = v_id;
  ELSIF v_type = 'merchant'::reviewee_type_enum THEN
    UPDATE public.profiles
    SET merchant_average_rating = ROUND(v_avg::numeric, 2),
        merchant_reviews_count = v_cnt
    WHERE id = v_id;
  END IF;

  RETURN NULL;
END $$;

CREATE TRIGGER on_reviews_change_refresh
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.refresh_reviewee_aggregates();

COMMIT;
