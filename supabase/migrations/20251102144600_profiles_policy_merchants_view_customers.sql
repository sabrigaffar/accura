-- Allow merchants to view customer profiles involved in their own orders
-- This fixes cases where merchant order card cannot see customer's phone number due to RLS

BEGIN;

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;

-- Policy: merchants can SELECT customer rows that have at least one order
-- whose merchant_id belongs to a store they own
DROP POLICY IF EXISTS "Merchants can view customer profiles in their orders" ON profiles;
CREATE POLICY "Merchants can view customer profiles in their orders"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM orders o
    JOIN merchants m ON m.id = o.merchant_id
    WHERE o.customer_id = profiles.id
      AND m.owner_id = auth.uid()
  )
);

COMMIT;
