-- Fix create_chat_conversation RPC: avoid ambiguous "id" and ensure idempotency
BEGIN;

CREATE OR REPLACE FUNCTION public.create_chat_conversation(p_order_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order_driver uuid;
  v_order_customer uuid;
  v_convo_id uuid;
BEGIN
  -- Fetch order and validate
  SELECT o.driver_id, o.customer_id
  INTO v_order_driver, v_order_customer
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF v_order_driver IS NULL THEN
    RAISE EXCEPTION 'Order % not found', p_order_id USING ERRCODE = 'P0001';
  END IF;
  IF v_uid IS NULL OR v_uid <> v_order_driver THEN
    RAISE EXCEPTION 'Not allowed: caller is not the assigned driver for order %', p_order_id USING ERRCODE = 'P0001';
  END IF;

  -- Return existing conversation if present
  SELECT c.id INTO v_convo_id
  FROM public.chat_conversations c
  WHERE c.order_id = p_order_id
  LIMIT 1;

  IF v_convo_id IS NULL THEN
    INSERT INTO public.chat_conversations(order_id, customer_id, driver_id)
    VALUES (p_order_id, v_order_customer, v_order_driver)
    RETURNING public.chat_conversations.id INTO v_convo_id;
  END IF;

  id := v_convo_id;
  RETURN NEXT;
END; $$;

GRANT EXECUTE ON FUNCTION public.create_chat_conversation(uuid) TO authenticated;

COMMIT;
