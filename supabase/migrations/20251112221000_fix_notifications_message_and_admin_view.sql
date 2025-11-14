-- Fix notifications schema compatibility and admin visibility
-- Date: 2025-11-12

BEGIN;

-- 1) Add compatibility column `message` (alias of body) if some code still uses it
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS message text;

-- Keep body/message in sync on INSERT/UPDATE
DROP FUNCTION IF EXISTS public.tg_notifications_sync_message_body() CASCADE;
CREATE OR REPLACE FUNCTION public.tg_notifications_sync_message_body()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.body IS NULL AND NEW.message IS NOT NULL THEN
    NEW.body := NEW.message;
  END IF;
  IF NEW.message IS NULL AND NEW.body IS NOT NULL THEN
    NEW.message := NEW.body;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_sync_message_body ON public.notifications;
CREATE TRIGGER notifications_sync_message_body
BEFORE INSERT OR UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.tg_notifications_sync_message_body();

-- 2) Allow admins to view all notifications (RLS policy)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='notifications' AND policyname='admin_select_all_notifications'
  ) THEN
    CREATE POLICY admin_select_all_notifications ON public.notifications
      FOR SELECT TO authenticated
      USING (is_admin());
  END IF;
END $$;

-- 3) Admin helper RPC to list notifications with profile name, with optional filter
DROP FUNCTION IF EXISTS public.admin_list_notifications(integer, integer, uuid);
CREATE OR REPLACE FUNCTION public.admin_list_notifications(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_user uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_name text,
  title text,
  body text,
  type text,
  data jsonb,
  is_read boolean,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    n.id,
    n.user_id,
    p.full_name AS user_name,
    COALESCE(n.title, n.title_ar, n.title_en) AS title,
    COALESCE(n.body,  n.body_ar,  n.body_en)  AS body,
    COALESCE(n.type,  n.notification_type, 'system') AS type,
    n.data,
    n.is_read,
    n.created_at
  FROM public.notifications n
  LEFT JOIN public.profiles p ON p.id = n.user_id
  WHERE (p_user IS NULL OR n.user_id = p_user)
  ORDER BY n.created_at DESC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_notifications(integer, integer, uuid) TO authenticated;

COMMIT;
