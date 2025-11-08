-- Backfill: debit driver wallets for historical capture transactions that didn't reduce balance
-- This will add an 'adjust' transaction per driver wallet and reduce wallet balance accordingly.
-- Idempotent: skips wallets already fully backfilled (checks prior adjusts with the same memo)
-- Date: 2025-11-02

BEGIN;

WITH captures AS (
  SELECT w.id AS wallet_id, COALESCE(SUM(t.amount),0) AS total_capture
  FROM public.wallets w
  JOIN public.wallet_transactions t ON t.wallet_id = w.id
  WHERE w.owner_type = 'driver'
    AND t.type = 'capture'
    AND (t.memo ILIKE 'تحصيل رسوم المنصة%' OR t.memo ILIKE 'Driver per-km commission%' OR t.memo ILIKE 'Platform%per-km%')
  GROUP BY w.id
),
prev_adjust AS (
  SELECT t.wallet_id, COALESCE(SUM(ABS(t.amount)),0) AS total_adjust
  FROM public.wallet_transactions t
  WHERE t.type = 'adjust'
    AND t.memo = 'Backfill: driver capture debit'
  GROUP BY t.wallet_id
),
needs AS (
  SELECT c.wallet_id, GREATEST(c.total_capture - COALESCE(a.total_adjust,0), 0) AS delta
  FROM captures c
  LEFT JOIN prev_adjust a ON a.wallet_id = c.wallet_id
  WHERE (c.total_capture - COALESCE(a.total_adjust,0)) > 0
)
UPDATE public.wallets w
SET balance = balance - n.delta
FROM needs n
WHERE w.id = n.wallet_id;

-- Create adjust transactions per wallet
WITH captures AS (
  SELECT w.id AS wallet_id, COALESCE(SUM(t.amount),0) AS total_capture
  FROM public.wallets w
  JOIN public.wallet_transactions t ON t.wallet_id = w.id
  WHERE w.owner_type = 'driver'
    AND t.type = 'capture'
    AND (t.memo ILIKE 'تحصيل رسوم المنصة%' OR t.memo ILIKE 'Driver per-km commission%' OR t.memo ILIKE 'Platform%per-km%')
  GROUP BY w.id
),
prev_adjust AS (
  SELECT t.wallet_id, COALESCE(SUM(ABS(t.amount)),0) AS total_adjust
  FROM public.wallet_transactions t
  WHERE t.type = 'adjust'
    AND t.memo = 'Backfill: driver capture debit'
  GROUP BY t.wallet_id
),
needs AS (
  SELECT c.wallet_id, GREATEST(c.total_capture - COALESCE(a.total_adjust,0), 0) AS delta
  FROM captures c
  LEFT JOIN prev_adjust a ON a.wallet_id = c.wallet_id
  WHERE (c.total_capture - COALESCE(a.total_adjust,0)) > 0
)
INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo)
SELECT n.wallet_id, 'adjust', (0 - n.delta), 'Backfill: driver capture debit'
FROM needs n;

COMMIT;
