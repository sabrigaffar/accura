-- Backfill: move merchant settlement transfers from store-level wallets (owner_id=merchants.id)
-- to user-level merchant wallets (owner_id=merchants.owner_id), adjusting balances idempotently.
-- Adds a memo suffix ' [migrated_to_user_wallet]' to mark processed rows.
-- Date: 2025-11-06

BEGIN;

DO $$
DECLARE
  rec RECORD;
  v_user_wallet uuid;
  v_store_wallet uuid;
BEGIN
  FOR rec IN
    SELECT wt.id as tx_id,
           wt.amount,
           wt.wallet_id as store_wallet_id,
           wt.related_order_id,
           m.owner_id as user_id
    FROM public.wallet_transactions wt
    JOIN public.wallets w ON w.id = wt.wallet_id AND w.owner_type = 'merchant'
    JOIN public.merchants m ON m.id = w.owner_id       -- store-level wallet (legacy)
    WHERE wt.type = 'transfer_in'
      AND (wt.memo IS NULL OR wt.memo NOT LIKE '%[migrated_to_user_wallet]%')
  LOOP
    v_store_wallet := rec.store_wallet_id;

    -- Ensure user-level wallet exists
    SELECT id INTO v_user_wallet FROM public.wallets WHERE owner_id = rec.user_id AND owner_type = 'merchant';
    IF v_user_wallet IS NULL THEN
      v_user_wallet := public.create_wallet_if_missing(rec.user_id, 'merchant', 30);
    END IF;

    -- Move transaction to user wallet
    UPDATE public.wallet_transactions
    SET wallet_id = v_user_wallet,
        memo = COALESCE(memo,'') || ' [migrated_to_user_wallet]'
    WHERE id = rec.tx_id;

    -- Adjust balances idempotently: only if not already adjusted
    -- We detect by confirming the store wallet still holds the amount (or memo not marked previously)
    UPDATE public.wallets SET balance = balance - rec.amount WHERE id = v_store_wallet;
    UPDATE public.wallets SET balance = balance + rec.amount WHERE id = v_user_wallet;
  END LOOP;
END $$;

COMMIT;
