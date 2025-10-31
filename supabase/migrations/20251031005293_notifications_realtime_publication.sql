-- Ensure notifications table is part of supabase_realtime publication (for postgres_changes)
DO $$
BEGIN
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
    END IF;
  EXCEPTION WHEN undefined_object THEN
    -- publication may not exist (older engine); skip silently
    NULL;
  END;
END
$$;
