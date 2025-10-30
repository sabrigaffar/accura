-- Ensure single admin wallet and enforce uniqueness

-- 1) Merge duplicate admin wallets (if any) into the oldest one, preserving data
DO $$
DECLARE
  v_keep uuid;
  v_rec record;
BEGIN
  -- Choose the oldest admin wallet to keep
  SELECT id INTO v_keep
  FROM public.wallets
  WHERE owner_type = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_keep IS NOT NULL THEN
    FOR v_rec IN
      SELECT id
      FROM public.wallets
      WHERE owner_type = 'admin' AND id <> v_keep
    LOOP
      -- Reassign transactions and holds to the kept wallet
      UPDATE public.wallet_transactions SET wallet_id = v_keep WHERE wallet_id = v_rec.id;
      UPDATE public.wallet_holds SET wallet_id = v_keep WHERE wallet_id = v_rec.id;

      -- Add balances together then remove the duplicate wallet
      UPDATE public.wallets w
      SET balance = w.balance + COALESCE((SELECT balance FROM public.wallets WHERE id = v_rec.id), 0)
      WHERE w.id = v_keep;

      DELETE FROM public.wallets WHERE id = v_rec.id;
    END LOOP;
  END IF;
END$$;

-- 2) Enforce a single admin wallet via partial unique index
-- This ensures at most one row where owner_type='admin'
CREATE UNIQUE INDEX IF NOT EXISTS ux_wallets_one_admin
ON public.wallets(owner_type)
WHERE owner_type = 'admin';
