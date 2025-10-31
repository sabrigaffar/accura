-- Ensure orders has a discount column used by promotions engine
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount NUMERIC NOT NULL DEFAULT 0;
