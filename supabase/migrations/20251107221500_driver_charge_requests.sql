-- Migration: Driver charge requests (Phase 2 skeleton)
-- - Table driver_charge_requests
-- - RLS minimal
-- - RPCs: request_driver_charge, respond_driver_charge (no wallet effects yet)

BEGIN;

CREATE TABLE IF NOT EXISTS public.driver_charge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  merchant_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  rejected_at timestamptz
);

ALTER TABLE public.driver_charge_requests ENABLE ROW LEVEL SECURITY;

-- Only owners (merchant_user_id or driver_id) can select their own rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_charge_requests' AND policyname='driver_charge_requests_select_owners'
  ) THEN
    CREATE POLICY driver_charge_requests_select_owners ON public.driver_charge_requests
      FOR SELECT
      TO authenticated
      USING (auth.uid() = merchant_user_id OR auth.uid() = driver_id);
  END IF;
END $$;

-- Block direct INSERT/UPDATE/DELETE; force using RPCs (policies deny by default)
-- (No insert/update policies created intentionally)

-- Helper: Ensure caller is the merchant owner of the order's merchant
CREATE OR REPLACE FUNCTION public._is_order_merchant_owner(p_order_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.merchants m ON m.id = o.merchant_id
    WHERE o.id = p_order_id AND m.owner_id = p_user_id
  );
$$;

-- RPC: request_driver_charge (merchant -> create pending request)
CREATE OR REPLACE FUNCTION public.request_driver_charge(
  p_order_id uuid,
  p_amount numeric,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver uuid;
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  -- Ensure caller is merchant owner for this order
  IF NOT public._is_order_merchant_owner(p_order_id, v_uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Require order to have a driver assigned (optional business rule)
  SELECT o.driver_id INTO v_driver FROM public.orders o WHERE o.id = p_order_id;
  IF v_driver IS NULL THEN
    RAISE EXCEPTION 'order has no driver assigned';
  END IF;

  INSERT INTO public.driver_charge_requests (order_id, merchant_user_id, driver_id, amount, reason, status)
  VALUES (p_order_id, v_uid, v_driver, p_amount, p_reason, 'pending')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_driver_charge(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_driver_charge(uuid, numeric, text) TO authenticated;

-- RPC: respond_driver_charge (driver -> approve/reject)
CREATE OR REPLACE FUNCTION public.respond_driver_charge(
  p_request_id uuid,
  p_decision text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_driver uuid;
  v_now timestamptz := now();
  v_new_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  SELECT driver_id INTO v_driver FROM public.driver_charge_requests WHERE id = p_request_id;
  IF v_driver IS NULL OR v_driver <> v_uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_new_status := p_decision;

  UPDATE public.driver_charge_requests
  SET status = v_new_status,
      approved_at = CASE WHEN v_new_status = 'approved' THEN v_now ELSE approved_at END,
      rejected_at = CASE WHEN v_new_status = 'rejected' THEN v_now ELSE rejected_at END
  WHERE id = p_request_id AND status = 'pending';

  RETURN v_new_status;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_driver_charge(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_driver_charge(uuid, text) TO authenticated;

COMMIT;
