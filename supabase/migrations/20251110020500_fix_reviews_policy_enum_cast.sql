-- Fix enum/text comparison in reviews RLS policy by casting enum to text
-- Date: 2025-11-10

BEGIN;

-- Recreate INSERT policy with proper casts to avoid operator does not exist: reviewee_type_enum = text
DROP POLICY IF EXISTS insert_customer_delivered_reviews ON public.reviews;
CREATE POLICY insert_customer_delivered_reviews ON public.reviews
FOR INSERT TO authenticated
WITH CHECK (
  reviewer_id = auth.uid()
  AND rating BETWEEN 1 AND 5
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = reviews.order_id
      AND o.customer_id = auth.uid()
      AND o.status::text = 'delivered'
      AND (
        (reviews.reviewee_type::text = 'driver'   AND reviews.reviewee_id = o.driver_id)
        OR
        (reviews.reviewee_type::text = 'merchant' AND reviews.reviewee_id = (SELECT owner_id FROM public.merchants WHERE id = o.merchant_id))
      )
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.order_id = reviews.order_id AND r.reviewer_id = auth.uid() AND r.reviewee_type = reviews.reviewee_type
  )
);

COMMIT;
