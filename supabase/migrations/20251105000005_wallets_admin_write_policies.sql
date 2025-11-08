BEGIN;

-- Ensure RLS is enabled (should already be from previous migrations)
ALTER TABLE IF EXISTS public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Allow admins (is_admin()) to INSERT wallets (e.g., auto-create admin wallet)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallets' AND policyname='admin_insert_wallets'
  ) THEN
    CREATE POLICY admin_insert_wallets ON public.wallets
      FOR INSERT TO authenticated
      WITH CHECK (is_admin());
  END IF;
END $$;

-- Allow admins to UPDATE wallets (debit/credit during subscription charge)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallets' AND policyname='admin_update_wallets'
  ) THEN
    CREATE POLICY admin_update_wallets ON public.wallets
      FOR UPDATE TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END $$;

-- Allow admins to INSERT wallet_transactions rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallet_transactions' AND policyname='admin_insert_wallet_transactions'
  ) THEN
    CREATE POLICY admin_insert_wallet_transactions ON public.wallet_transactions
      FOR INSERT TO authenticated
      WITH CHECK (is_admin());
  END IF;
END $$;

COMMIT;
