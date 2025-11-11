-- Add menu_url field to merchants and create public storage bucket for menus
BEGIN;

ALTER TABLE IF EXISTS public.merchants
  ADD COLUMN IF NOT EXISTS menu_url text;

-- Create a public storage bucket for merchant menus (images or PDFs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('merchant-menus', 'merchant-menus', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read for merchant menus'
  ) THEN
    CREATE POLICY "Public read for merchant menus"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'merchant-menus');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated upload merchant menus'
  ) THEN
    CREATE POLICY "Authenticated upload merchant menus"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'merchant-menus');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated update merchant menus'
  ) THEN
    CREATE POLICY "Authenticated update merchant menus"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'merchant-menus');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated delete merchant menus'
  ) THEN
    CREATE POLICY "Authenticated delete merchant menus"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'merchant-menus');
  END IF;
END$$;

COMMIT;
