-- Add RLS policy to allow merchants to view their own wallets
-- This fixes the issue where merchant wallet screen shows 0 balance
-- Date: 2025-11-03

BEGIN;

-- Drop existing policies if any
DROP POLICY IF EXISTS "wallets_select_own" ON public.wallets;
DROP POLICY IF EXISTS "wallet_transactions_select_own" ON public.wallet_transactions;

-- Allow users to view their own wallets (driver, merchant, customer)
CREATE POLICY "wallets_select_own"
ON public.wallets
FOR SELECT
TO authenticated
USING (
  -- User can see their own driver wallet
  (owner_type = 'driver' AND owner_id = auth.uid())
  OR
  -- User can see their own customer wallet
  (owner_type = 'customer' AND owner_id = auth.uid())
  OR
  -- Merchant can see wallets for stores they own
  (owner_type = 'merchant' AND EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id = wallets.owner_id
    AND m.owner_id = auth.uid()
  ))
  OR
  -- Admin can see admin wallets (for internal use)
  (owner_type = 'admin')
);

-- Allow users to view transactions for wallets they can access
CREATE POLICY "wallet_transactions_select_own"
ON public.wallet_transactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.wallets w
    WHERE w.id = wallet_transactions.wallet_id
    AND (
      -- Same conditions as wallets policy
      (w.owner_type = 'driver' AND w.owner_id = auth.uid())
      OR
      (w.owner_type = 'customer' AND w.owner_id = auth.uid())
      OR
      (w.owner_type = 'merchant' AND EXISTS (
        SELECT 1 FROM public.merchants m
        WHERE m.id = w.owner_id
        AND m.owner_id = auth.uid()
      ))
      OR
      (w.owner_type = 'admin')
    )
  )
);

COMMIT;
