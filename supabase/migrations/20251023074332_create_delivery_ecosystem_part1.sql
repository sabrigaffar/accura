-- Wasalni Delivery Ecosystem - Part 1: Core Tables
-- 
-- This migration creates the foundation tables for a Mrsool-inspired delivery platform
-- including user profiles, addresses, merchants, and products.
--
-- Tables Created:
-- 1. profiles - Extended user profiles for customers, drivers, merchants, and admins
-- 2. addresses - User delivery addresses with geolocation
-- 3. merchants - Store/restaurant information
-- 4. merchant_products - Products and menu items

-- Create enum types
CREATE TYPE user_type_enum AS ENUM ('customer', 'driver', 'merchant', 'admin');
CREATE TYPE merchant_category_enum AS ENUM ('restaurant', 'grocery', 'pharmacy', 'gifts', 'other');

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type user_type_enum NOT NULL DEFAULT 'customer',
  full_name text NOT NULL,
  phone_number text UNIQUE NOT NULL,
  avatar_url text,
  language text DEFAULT 'ar',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Public can view active merchant profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (user_type = 'merchant' AND is_active = true);

-- 2. Addresses table
CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  street_address text NOT NULL,
  city text NOT NULL,
  district text,
  building_number text,
  floor_number text,
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own addresses"
  ON addresses FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Merchants table
CREATE TABLE IF NOT EXISTS merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text,
  description_ar text,
  description_en text,
  category merchant_category_enum NOT NULL,
  logo_url text,
  banner_url text,
  rating numeric(2, 1) DEFAULT 0,
  total_reviews integer DEFAULT 0,
  avg_delivery_time integer DEFAULT 30,
  min_order_amount numeric(10, 2) DEFAULT 0,
  delivery_fee numeric(10, 2) DEFAULT 0,
  is_open boolean DEFAULT true,
  address text NOT NULL,
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  working_hours jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active merchants"
  ON merchants FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Merchant owners can update own merchant"
  ON merchants FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- 4. Merchant Products table
CREATE TABLE IF NOT EXISTS merchant_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text,
  description_ar text,
  description_en text,
  price numeric(10, 2) NOT NULL,
  image_url text,
  category text,
  is_available boolean DEFAULT true,
  preparation_time integer DEFAULT 15,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE merchant_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available products"
  ON merchant_products FOR SELECT
  TO authenticated
  USING (is_available = true);

CREATE POLICY "Merchant owners can manage products"
  ON merchant_products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = merchant_products.merchant_id
      AND merchants.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = merchant_products.merchant_id
      AND merchants.owner_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_merchants_category ON merchants(category);
CREATE INDEX IF NOT EXISTS idx_merchants_active ON merchants(is_active);
CREATE INDEX IF NOT EXISTS idx_products_merchant ON merchant_products(merchant_id);