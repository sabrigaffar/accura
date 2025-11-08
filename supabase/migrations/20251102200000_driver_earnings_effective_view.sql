-- View to expose driver earnings with an effective amount computed with fallbacks
-- and simple fields for the mobile app to consume without joins on the client.
BEGIN;

-- Ensure RLS policy on orders so drivers can read their own orders (required for the view)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'drivers can read their orders'
  ) THEN
    EXECUTE 'CREATE POLICY "drivers can read their orders" ON public.orders FOR SELECT TO authenticated USING (driver_id = auth.uid())';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.driver_earnings_effective AS
SELECT
  de.id,
  de.driver_id,
  de.order_id,
  -- Prefer net_amount if positive, then amount if positive, otherwise compute from order
  COALESCE(
    NULLIF(de.net_amount, 0),
    NULLIF(de.amount, 0),
    GREATEST(
      COALESCE(o.delivery_fee, 0),
      COALESCE(o.calculated_delivery_fee, 0),
      COALESCE(public.calculate_delivery_fee(o.delivery_distance_km), 0)
    )
  ) AS effective_amount,
  de.net_amount,
  de.commission_amount,
  COALESCE(de.earned_at, de.created_at) AS earned_at,
  o.order_number,
  p.full_name AS customer_name
FROM public.driver_earnings de
JOIN public.orders o ON o.id = de.order_id
LEFT JOIN public.profiles p ON p.id = o.customer_id
WHERE de.driver_id = auth.uid();

-- Grant select on the view
GRANT SELECT ON public.driver_earnings_effective TO authenticated;

COMMIT;
