-- Fix wallets and wallet_transactions RLS: restrict admin wallets visibility to admins only via is_admin()
-- Date: 2025-11-05

BEGIN;

-- Ensure is_admin() exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'is_admin'
  ) THEN
    CREATE OR REPLACE FUNCTION public.is_admin()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    AS $fn$
      SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
    $fn$;
    GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
    COMMENT ON FUNCTION public.is_admin IS 'Helper function to check if current user is admin';
  END IF;
END $$;

-- Recreate wallets_select_own policy to gate admin wallets by is_admin()
DROP POLICY IF EXISTS "wallets_select_own" ON public.wallets;
CREATE POLICY "wallets_select_own"
ON public.wallets
FOR SELECT
TO authenticated
USING (
  (owner_type = 'driver' AND owner_id = auth.uid())
  OR (owner_type = 'customer' AND owner_id = auth.uid())
  OR (owner_type = 'merchant' AND EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id = wallets.owner_id
      AND m.owner_id = auth.uid()
  ))
  OR (owner_type = 'admin' AND is_admin())
);

-- Recreate wallet_transactions_select_own policy to gate admin wallets by is_admin()
DROP POLICY IF EXISTS "wallet_transactions_select_own" ON public.wallet_transactions;
CREATE POLICY "wallet_transactions_select_own"
ON public.wallet_transactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.wallets w
    WHERE w.id = wallet_transactions.wallet_id
      AND (
        (w.owner_type = 'driver' AND w.owner_id = auth.uid())
        OR (w.owner_type = 'customer' AND w.owner_id = auth.uid())
        OR (w.owner_type = 'merchant' AND EXISTS (
          SELECT 1 FROM public.merchants m
          WHERE m.id = w.owner_id
            AND m.owner_id = auth.uid()
        ))
        OR (w.owner_type = 'admin' AND is_admin())
      )
  )
);

COMMIT;
