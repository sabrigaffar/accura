-- Backfill merchant settlements for delivered ONLINE orders that missed credit
-- Idempotent: skips orders that already have a merchant transfer_in transaction
-- Date: 2025-11-02

DO $$
DECLARE
  r record;
  m_wallet uuid;
  amt numeric;
BEGIN
  FOR r IN 
    SELECT o.id AS order_id,
           o.merchant_id,
           COALESCE(o.product_total,0) AS product_total,
           COALESCE(o.tax_amount,0) AS tax_amount
    FROM public.orders o
    WHERE o.status = 'delivered'
      AND o.merchant_id IS NOT NULL
      AND COALESCE(o.payment_method, 'cash') IN ('card','wallet')
  LOOP
    amt := GREATEST(r.product_total + r.tax_amount, 0);
    IF amt > 0 THEN
      m_wallet := public.create_wallet_if_missing(r.merchant_id, 'merchant', 30);
      IF NOT EXISTS (
        SELECT 1 FROM public.wallet_transactions wt
        WHERE wt.wallet_id = m_wallet AND wt.related_order_id = r.order_id AND wt.type = 'transfer_in'
      ) THEN
        UPDATE public.wallets SET balance = balance + amt WHERE id = m_wallet;
        INSERT INTO public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
        VALUES (m_wallet, 'transfer_in', amt, 'Merchant settlement (product+tax) [backfill]', r.order_id);
      END IF;
    END IF;
  END LOOP;
END $$;
