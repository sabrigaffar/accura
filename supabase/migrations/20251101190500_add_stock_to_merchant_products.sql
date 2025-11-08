-- Add stock column to merchant_products to store available quantity entered by merchants
BEGIN;

ALTER TABLE public.merchant_products
  ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.merchant_products.stock IS 'Available stock quantity for product';

COMMIT;
