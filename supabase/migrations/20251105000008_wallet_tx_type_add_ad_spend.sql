BEGIN;

-- Ensure wallet_transactions type allows 'ad_spend'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='wallet_transactions'
  ) THEN
    -- Drop and recreate type check on 'type' column
    EXECUTE 'ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check';
    EXECUTE 'ALTER TABLE public.wallet_transactions 
      ADD CONSTRAINT wallet_transactions_type_check 
      CHECK (type IN (
        ''deposit'',
        ''withdraw'',
        ''hold'',
        ''release'',
        ''capture'',
        ''transfer_in'',
        ''transfer_out'',
        ''adjust'',
        ''ad_payment'',
        ''ad_refund'',
        ''subscription'',
        ''commission'',
        ''ad_spend''
      ))';

    -- If a separate transaction_type column exists, align it too
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='wallet_transactions' AND column_name='transaction_type'
    ) THEN
      EXECUTE 'ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_transaction_type_check';
      EXECUTE 'ALTER TABLE public.wallet_transactions 
        ADD CONSTRAINT wallet_transactions_transaction_type_check 
        CHECK (transaction_type IN (
          ''deposit'',
          ''withdraw'',
          ''hold'',
          ''release'',
          ''capture'',
          ''transfer_in'',
          ''transfer_out'',
          ''adjust'',
          ''ad_payment'',
          ''ad_refund'',
          ''subscription'',
          ''commission'',
          ''order_payment'',
          ''order_refund'',
          ''settlement'',
          ''ad_spend''
        ))';
    END IF;
  END IF;
END$$;

COMMIT;
