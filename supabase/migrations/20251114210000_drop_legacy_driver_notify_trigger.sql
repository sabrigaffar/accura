-- Drop legacy driver notify trigger/function to avoid duplicate logic
-- Date: 2025-11-14

BEGIN;

-- Drop trigger created in 20251031005271_add_push_notifications.sql if exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'new_order_notification_trigger' AND n.nspname='public' AND c.relname='orders'
  ) THEN
    DROP TRIGGER new_order_notification_trigger ON public.orders;
  END IF;
END $$;

-- Drop helper trigger function if exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname='trigger_new_order_notifications'
  ) THEN
    DROP FUNCTION public.trigger_new_order_notifications();
  END IF;
END $$;

-- Drop notify_available_drivers if not used anymore
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname='notify_available_drivers'
  ) THEN
    DROP FUNCTION public.notify_available_drivers(uuid);
  END IF;
END $$;

COMMIT;
