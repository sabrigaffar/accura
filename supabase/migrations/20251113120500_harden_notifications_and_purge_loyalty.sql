-- Harden notifications insertion and purge loyalty-like messages
-- Date: 2025-11-13

BEGIN;

-- 1) Purge known loyalty messages by IDs (from user report)
DELETE FROM public.notifications
WHERE id IN (
  '1c0cfb91-803b-4aff-b2a5-93c70a2ffab2',
  '3998654c-5818-4340-b827-9c72d3c5a106',
  '2bebef9d-2b39-4373-abce-557b196390ce',
  '97002ffa-02a8-47d5-9363-b09a2ea1039e',
  '9154585e-a6fd-4c2b-a9fa-ffb7d1753fc1'
);

-- 2) Purge any residual notifications that look like loyalty marketing (defensive)
DELETE FROM public.notifications
WHERE title ILIKE '%نقاط ولاء%'
   OR (body ILIKE '%نقطة%' AND body ILIKE '%خصم%');

-- 3) Restrict INSERT to admin only (clients should not insert arbitrary notifications)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_insert_admin_or_self'
  ) THEN
    DROP POLICY notifications_insert_admin_or_self ON public.notifications;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_insert_admin_only'
  ) THEN
    CREATE POLICY notifications_insert_admin_only ON public.notifications
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin());
  END IF;
END $$;

COMMIT;
