-- Default promotion rules (automatic policies)

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promo_target_audience_enum') THEN
    CREATE TYPE promo_target_audience_enum AS ENUM ('customer','merchant','driver','all');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promo_apply_on_enum') THEN
    CREATE TYPE promo_apply_on_enum AS ENUM ('subtotal','delivery_fee','service_fee','merchant_commission');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promo_payment_filter_enum') THEN
    CREATE TYPE promo_payment_filter_enum AS ENUM ('any','card','cash');
  END IF;
END $$;

-- Ensure merchant_category_enum exists (used by merchant_category column)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'merchant_category_enum') THEN
    CREATE TYPE merchant_category_enum AS ENUM ('restaurant', 'grocery', 'pharmacy', 'gifts', 'other');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS promotion_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  audience promo_target_audience_enum NOT NULL DEFAULT 'all',
  store_id uuid NULL REFERENCES merchants(id) ON DELETE SET NULL,
  merchant_category merchant_category_enum NULL,
  discount_type discount_type_enum NOT NULL DEFAULT 'flat',
  discount_amount numeric NOT NULL DEFAULT 0,
  apply_on promo_apply_on_enum NOT NULL DEFAULT 'subtotal',
  payment_filter promo_payment_filter_enum NOT NULL DEFAULT 'any',
  min_subtotal numeric NULL,
  stackable boolean NOT NULL DEFAULT false,
  priority int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz NULL,
  created_by uuid NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE promotion_rules ENABLE ROW LEVEL SECURITY;

-- Read for authenticated
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='promotion_rules' AND policyname='promotion_rules_select_all'
  ) THEN
    CREATE POLICY promotion_rules_select_all ON promotion_rules FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Write for admins only
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='promotion_rules' AND policyname='promotion_rules_admin_write'
  ) THEN
    CREATE POLICY promotion_rules_admin_write ON promotion_rules FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_promo_rules_active ON promotion_rules(is_active, start_at, end_at, priority);
