BEGIN;

-- Unify all admin wallets into a single canonical wallet
-- Idempotent: safe to rerun; moves tx/holds to canonical and zeroes others' balances
DO $$
DECLARE
  v_canon uuid;
  v_sum numeric(12,2) := 0;
BEGIN
  -- Ensure we have a canonical admin wallet
  v_canon := public.get_or_create_admin_wallet();

  -- Move all wallet_transactions that point to non-canonical admin wallets
  UPDATE public.wallet_transactions wt
  SET wallet_id = v_canon
  WHERE wallet_id IN (
    SELECT id FROM public.wallets WHERE owner_type = 'admin' AND id <> v_canon
  );

  -- Move any wallet_holds (unlikely for admin, but safe)
  UPDATE public.wallet_holds wh
  SET wallet_id = v_canon
  WHERE wallet_id IN (
    SELECT id FROM public.wallets WHERE owner_type = 'admin' AND id <> v_canon
  );

  -- Fold balances: add all other admin wallet balances into canonical, then zero them
  SELECT COALESCE(SUM(balance), 0) INTO v_sum
  FROM public.wallets
  WHERE owner_type = 'admin' AND id <> v_canon;

  IF COALESCE(v_sum,0) <> 0 THEN
    UPDATE public.wallets SET balance = balance + v_sum WHERE id = v_canon;
    UPDATE public.wallets SET balance = 0 WHERE owner_type = 'admin' AND id <> v_canon;
  END IF;
END $$;

COMMIT;
