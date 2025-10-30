-- Migration: Add store_id to products table for multi-store support
-- This allows merchants with multiple stores to associate products with specific stores

-- Add store_id column to products table (nullable for backward compatibility)
ALTER TABLE products
ADD COLUMN store_id UUID REFERENCES merchants(id) ON DELETE CASCADE;

-- Create index for faster queries when filtering by store
CREATE INDEX idx_products_store_id ON products(store_id);

-- Optional: Add a comment explaining the column
COMMENT ON COLUMN products.store_id IS 'Links product to a specific merchant store. If null, product belongs to merchant''s default store.';

-- Update RLS policies to allow filtering by store_id
-- The existing merchant_id = auth.uid() policy still applies for security
-- store_id is just for organizational purposes within the merchant's data
