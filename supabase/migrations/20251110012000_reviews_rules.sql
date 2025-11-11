-- Reviews rules: enforce customer-only after delivery, prevent duplicates, and maintain aggregates
-- Date: 2025-11-10

BEGIN;

-- 1) Add aggregate columns for drivers and merchants (profiles owners)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='driver_profiles' AND column_name='average_rating'
  ) THEN
    ALTER TABLE public.driver_profiles ADD COLUMN average_rating numeric(3,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='driver_profiles' AND column_name='reviews_count'
  ) THEN
    ALTER TABLE public.driver_profiles ADD COLUMN reviews_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='merchant_average_rating'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN merchant_average_rating numeric(3,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='merchant_reviews_count'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN merchant_reviews_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews(reviewee_id, reviewee_type, created_at DESC);

-- 3) Prevent duplicate reviews for same order/reviewer/type
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='reviews' AND indexname='uq_reviews_order_reviewer_type'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT uq_reviews_order_reviewer_type UNIQUE (order_id, reviewer_id, reviewee_type);
  END IF;
END $$;

-- 4) Create secure RPC to create a review (customer -> driver/merchant) only after delivery
DROP FUNCTION IF EXISTS public.create_review(uuid, text, integer, text);
CREATE OR REPLACE FUNCTION public.create_review(
  p_order_id uuid,
  p_reviewee_type text,
  p_rating integer,
  p_comment text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_reviewee uuid;
  v_type text := lower(p_reviewee_type);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'invalid rating' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = '22023';
  END IF;
  IF v_order.customer_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'not your order' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(v_order.status::text, '') <> 'delivered' THEN
    RAISE EXCEPTION 'order not delivered' USING ERRCODE = '22023';
  END IF;

  IF v_type = 'driver' THEN
    IF v_order.driver_id IS NULL THEN
      RAISE EXCEPTION 'no driver assigned' USING ERRCODE = '22023';
    END IF;
    v_reviewee := v_order.driver_id;
  ELSIF v_type = 'merchant' THEN
    SELECT owner_id INTO v_reviewee FROM public.merchants WHERE id = v_order.merchant_id;
    IF v_reviewee IS NULL THEN
      RAISE EXCEPTION 'merchant/owner not found' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid reviewee_type' USING ERRCODE = '22023';
  END IF;

  -- Prevent duplicates explicitly
  IF EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.order_id = p_order_id AND r.reviewer_id = v_uid AND r.reviewee_type = v_type
  ) THEN
    RAISE EXCEPTION 'duplicate review' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.reviews(order_id, reviewer_id, reviewee_id, reviewee_type, rating, comment)
  VALUES (p_order_id, v_uid, v_reviewee, v_type, p_rating, NULLIF(p_comment, ''));

  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION public.create_review(uuid, text, integer, text) TO authenticated;

-- 5) Tighten INSERT policy: only allow rows that match constraints (customer & delivered & correct reviewee & no duplicate)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reviews' AND policyname='Customers can create reviews'
  ) THEN
    DROP POLICY "Customers can create reviews" ON public.reviews;
  END IF;
END $$;

DROP POLICY IF EXISTS insert_customer_delivered_reviews ON public.reviews;
CREATE POLICY insert_customer_delivered_reviews ON public.reviews
FOR INSERT TO authenticated
WITH CHECK (
  -- Reviewer is current user
  reviewer_id = auth.uid()
  AND rating BETWEEN 1 AND 5
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = reviews.order_id
      AND o.customer_id = auth.uid()
      AND o.status::text = 'delivered'
      AND (
        (reviews.reviewee_type = 'driver'   AND reviews.reviewee_id = o.driver_id)
        OR
        (reviews.reviewee_type = 'merchant' AND reviews.reviewee_id = (SELECT owner_id FROM public.merchants WHERE id = o.merchant_id))
      )
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.order_id = reviews.order_id AND r.reviewer_id = auth.uid() AND r.reviewee_type = reviews.reviewee_type
  )
);

-- 6) Aggregates maintenance trigger
-- Drop trigger first to avoid dependency error on dropping function
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
  v_type text;
  v_avg numeric(10,6);
  v_cnt int;
BEGIN
  v_id := COALESCE(NEW.reviewee_id, OLD.reviewee_id);
  v_type := COALESCE(NEW.reviewee_type, OLD.reviewee_type);

  SELECT COALESCE(AVG(rating)::numeric, 0), COALESCE(COUNT(*), 0)
  INTO v_avg, v_cnt
  FROM public.reviews
  WHERE reviewee_id = v_id AND reviewee_type = v_type;

  IF v_type = 'driver' THEN
    UPDATE public.driver_profiles
    SET average_rating = ROUND(v_avg::numeric, 2),
        reviews_count = v_cnt
    WHERE id = v_id;
  ELSIF v_type = 'merchant' THEN
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
