-- Promotions system for customers, merchants, drivers

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_audience_enum') THEN
    CREATE TYPE promotion_audience_enum AS ENUM ('customer','merchant','driver','all');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_type_enum') THEN
    CREATE TYPE discount_type_enum AS ENUM ('flat','percent');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  audience promotion_audience_enum NOT NULL,
  target_id UUID NULL, -- optional specific profile/merchant/driver id
  discount_type discount_type_enum NOT NULL,
  discount_amount NUMERIC NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Read for authenticated users (clients may need to fetch applicable promos)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='promotions' AND policyname='promotions_select_all'
  ) THEN
    CREATE POLICY promotions_select_all
    ON promotions FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

-- Write only for admins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='promotions' AND policyname='promotions_admin_write'
  ) THEN
    CREATE POLICY promotions_admin_write
    ON promotions FOR ALL
    TO authenticated
    USING (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin')
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin')
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_promotions_active_time ON promotions(is_active, start_at, end_at);
