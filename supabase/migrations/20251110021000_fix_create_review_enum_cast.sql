-- Fix enum/text comparison in create_review by casting text to reviewee_type_enum
-- Date: 2025-11-10

BEGIN;

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

  -- Prevent duplicates explicitly (cast text to enum for comparison)
  IF EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.order_id = p_order_id AND r.reviewer_id = v_uid AND r.reviewee_type = (v_type::reviewee_type_enum)
  ) THEN
    RAISE EXCEPTION 'duplicate review' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.reviews(order_id, reviewer_id, reviewee_id, reviewee_type, rating, comment)
  VALUES (p_order_id, v_uid, v_reviewee, (v_type::reviewee_type_enum), p_rating, NULLIF(p_comment, ''));

  RETURN TRUE;
END $$;

COMMIT;
