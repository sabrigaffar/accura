-- Backfill chat_participants for existing conversations
-- Date: 2025-11-14

BEGIN;

-- Ensure rows exist for customer/driver/merchant participants for all conversations
INSERT INTO public.chat_participants (conversation_id, user_id, role, unread_count, joined_at)
SELECT c.id, c.customer_id, 'customer', 0, now()
FROM public.chat_conversations c
WHERE c.customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.chat_participants p
    WHERE p.conversation_id = c.id AND p.user_id = c.customer_id
  );

INSERT INTO public.chat_participants (conversation_id, user_id, role, unread_count, joined_at)
SELECT c.id, c.driver_id, 'driver', 0, now()
FROM public.chat_conversations c
WHERE c.driver_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.chat_participants p
    WHERE p.conversation_id = c.id AND p.user_id = c.driver_id
  );

-- Backfill for merchant if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='chat_conversations' AND column_name='merchant_id'
  ) THEN
    INSERT INTO public.chat_participants (conversation_id, user_id, role, unread_count, joined_at)
    SELECT c.id, c.merchant_id, 'merchant', 0, now()
    FROM public.chat_conversations c
    WHERE c.merchant_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.chat_participants p
        WHERE p.conversation_id = c.id AND p.user_id = c.merchant_id
      );
  END IF;
END$$;

COMMIT;
