-- Enable RLS and policies for platform_settings

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone authenticated to read (for client-side displays)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_settings' AND policyname = 'platform_settings_select_all'
  ) THEN
    CREATE POLICY platform_settings_select_all
    ON platform_settings FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

-- Allow only admins to insert/update
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_settings' AND policyname = 'platform_settings_upsert_admins'
  ) THEN
    CREATE POLICY platform_settings_upsert_admins
    ON platform_settings FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.user_type = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.user_type = 'admin'
      )
    );
  END IF;
END $$;
