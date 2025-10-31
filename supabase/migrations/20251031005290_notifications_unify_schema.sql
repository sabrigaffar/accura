-- Unify notifications schema to match app expectations and backfill
-- Adds title, body, data, type, read_at; backfills from *_ar/*_en and notification_type

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'title'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN title text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'body'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN body text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'data'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN data jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'type'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN type text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN read_at timestamptz;
  END IF;
END $$;

-- Backfill new columns from old multilingual columns when available
UPDATE public.notifications n
SET 
  title = COALESCE(n.title, n.title_ar, n.title_en),
  body  = COALESCE(n.body,  n.body_ar,  n.body_en),
  type  = COALESCE(n.type,  n.notification_type)
WHERE (n.title IS NULL OR n.body IS NULL OR n.type IS NULL);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

COMMENT ON TABLE public.notifications IS 'Unified notifications log used by all roles (driver/merchant/customer).';
