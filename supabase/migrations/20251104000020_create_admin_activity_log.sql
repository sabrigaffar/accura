-- Create admin_activity_log table to audit admin actions
BEGIN;

CREATE TABLE IF NOT EXISTS admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  details jsonb,
  timestamp timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Admins can select all logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_activity_log' AND policyname='admin_select_admin_activity_log'
  ) THEN
    CREATE POLICY admin_select_admin_activity_log ON admin_activity_log FOR SELECT TO authenticated
      USING (is_admin());
  END IF;
END $$;

-- Any authenticated user can insert their own admin actions (front-end writes best-effort)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_activity_log' AND policyname='insert_admin_activity_log'
  ) THEN
    CREATE POLICY insert_admin_activity_log ON admin_activity_log FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

COMMIT;
