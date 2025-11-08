-- Ensure all merchants have wallets created
-- Fix issue where wallet_transactions exist but wallets don't
-- Date: 2025-11-03

BEGIN;

-- Create wallets for all merchants that don't have one
INSERT INTO public.wallets (owner_id, owner_type, balance, currency)
SELECT 
  m.id,
  'merchant'::text,
  0,
  'EGP'
FROM public.merchants m
WHERE NOT EXISTS (
  SELECT 1 FROM public.wallets w 
  WHERE w.owner_id = m.id AND w.owner_type = 'merchant'
)
ON CONFLICT DO NOTHING;

-- Now update wallet balances based on existing transactions
-- This fixes wallets that had transactions but no initial balance update
UPDATE public.wallets w
SET balance = COALESCE((
  SELECT SUM(
    CASE 
      WHEN wt.type IN ('deposit', 'transfer_in') THEN wt.amount
      WHEN wt.type IN ('withdraw', 'transfer_out', 'capture') THEN -wt.amount
      ELSE 0
    END
  )
  FROM public.wallet_transactions wt
  WHERE wt.wallet_id = w.id
), 0)
WHERE w.owner_type = 'merchant'
  AND w.balance = 0
  AND EXISTS (
    SELECT 1 FROM public.wallet_transactions wt 
    WHERE wt.wallet_id = w.id
  );

COMMIT;
