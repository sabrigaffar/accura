-- RPC to return admin wallet and transactions; creates wallet if missing
BEGIN;

-- Ensure pgcrypto available for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION get_admin_wallet_overview(p_limit int DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w RECORD;
  tx jsonb := '[]'::jsonb;
BEGIN
  -- Find existing admin wallet
  SELECT * INTO w FROM wallets WHERE owner_type = 'admin' LIMIT 1;

  -- Create if missing
  IF w IS NULL THEN
    INSERT INTO wallets (id, owner_id, owner_type, balance, currency)
    VALUES (gen_random_uuid(), gen_random_uuid()::text, 'admin', 0, 'EGP')
    RETURNING * INTO w;
  END IF;

  -- Collect transactions of interest
  SELECT COALESCE(jsonb_agg(to_jsonb(t) - 'wallet_id'), '[]'::jsonb)
    INTO tx
  FROM (
    SELECT id, type, amount, memo, related_order_id, created_at
    FROM wallet_transactions
    WHERE wallet_id = w.id
      AND type IN ('deposit','withdraw','hold','release','capture','transfer_in','transfer_out','adjust','ad_payment','ad_refund')
    ORDER BY created_at DESC
    LIMIT p_limit
  ) t;

  RETURN jsonb_build_object(
    'wallet', to_jsonb(w),
    'transactions', tx
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_wallet_overview(int) TO authenticated;

COMMIT;
