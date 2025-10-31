-- Fix RPC: create_chat_conversation to avoid ambiguous "id" and be idempotent
-- Creates a chat conversation for an order if it doesn't already exist

CREATE OR REPLACE FUNCTION create_chat_conversation(p_order_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order record;
  v_existing uuid;
  v_new uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'must be authenticated';
  END IF;

  -- Fetch needed fields with explicit aliases to avoid ambiguity
  SELECT o.id AS order_id,
         o.customer_id AS customer_id,
         o.driver_id AS driver_id
  INTO v_order
  FROM orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  -- If conversation already exists, return it
  SELECT c.id INTO v_existing
  FROM chat_conversations c
  WHERE c.order_id = v_order.order_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_existing; RETURN;
  END IF;

  -- Create new conversation
  INSERT INTO chat_conversations(order_id, customer_id, driver_id, created_at)
  VALUES (v_order.order_id, v_order.customer_id, v_order.driver_id, now())
  RETURNING chat_conversations.id INTO v_new;

  RETURN QUERY SELECT v_new;
END $$;

GRANT EXECUTE ON FUNCTION create_chat_conversation(uuid) TO authenticated;
