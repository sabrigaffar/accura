-- Wasalni Delivery Ecosystem - Part 2: Orders & Delivery
--
-- Tables Created:
-- 1. orders - Main orders table with status tracking
-- 2. order_items - Individual items in each order
-- 3. driver_profiles - Extended information for drivers
-- 4. driver_earnings - Track driver income per delivery

-- Create enum types for orders
CREATE TYPE order_status_enum AS ENUM (
  'pending', 'accepted', 'preparing', 'ready',
  'heading_to_merchant', 'heading_to_customer', 'out_for_delivery',
  'picked_up', 'on_the_way', 'delivered', 'cancelled'
);

CREATE TYPE payment_method_enum AS ENUM ('cash', 'card', 'wallet');
CREATE TYPE payment_status_enum AS ENUM ('pending', 'paid', 'refunded');
CREATE TYPE vehicle_type_enum AS ENUM ('car', 'motorcycle', 'bicycle');

-- 1. Orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_id uuid NOT NULL REFERENCES profiles(id),
  merchant_id uuid NOT NULL REFERENCES merchants(id),
  driver_id uuid REFERENCES profiles(id),
  status order_status_enum DEFAULT 'pending',
  delivery_address_id uuid REFERENCES addresses(id),
  pickup_lat numeric(10, 8),
  pickup_lng numeric(11, 8),
  delivery_lat numeric(10, 8),
  delivery_lng numeric(11, 8),
  subtotal numeric(10, 2) NOT NULL,
  delivery_fee numeric(10, 2) DEFAULT 0,
  service_fee numeric(10, 2) DEFAULT 0,
  tax numeric(10, 2) DEFAULT 0,
  discount numeric(10, 2) DEFAULT 0,
  total numeric(10, 2) NOT NULL,
  payment_method payment_method_enum NOT NULL,
  payment_status payment_status_enum DEFAULT 'pending',
  delivery_notes text,
  estimated_delivery_time timestamptz,
  actual_delivery_time timestamptz,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

CREATE POLICY "Customers can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Merchants can view their orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = orders.merchant_id
      AND merchants.owner_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can view assigned orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can update assigned orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

-- 2. Order Items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES merchant_products(id),
  product_name_ar text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10, 2) NOT NULL,
  total_price numeric(10, 2) NOT NULL,
  special_instructions text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view order items of their orders"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (
        orders.customer_id = auth.uid()
        OR orders.driver_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM merchants
          WHERE merchants.id = orders.merchant_id
          AND merchants.owner_id = auth.uid()
        )
      )
    )
  );

-- 3. Driver Profiles table
CREATE TABLE IF NOT EXISTS driver_profiles (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_type vehicle_type_enum NOT NULL,
  vehicle_model text,
  vehicle_color text,
  license_plate text,
  license_number text,
  license_expiry date,
  id_number text,
  id_expiry date,
  is_verified boolean DEFAULT false,
  is_online boolean DEFAULT false,
  current_lat numeric(10, 8),
  current_lng numeric(11, 8),
  total_earnings numeric(10, 2) DEFAULT 0,
  total_deliveries integer DEFAULT 0,
  average_rating numeric(2, 1) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view own profile"
  ON driver_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Drivers can update own profile"
  ON driver_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Driver Earnings table
CREATE TABLE IF NOT EXISTS driver_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES profiles(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  base_fee numeric(10, 2) DEFAULT 0,
  distance_fee numeric(10, 2) DEFAULT 0,
  tip_amount numeric(10, 2) DEFAULT 0,
  bonus numeric(10, 2) DEFAULT 0,
  total_earning numeric(10, 2) NOT NULL,
  status text DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE driver_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view own earnings"
  ON driver_earnings FOR SELECT
  TO authenticated
  USING (auth.uid() = driver_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_driver_online ON driver_profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver ON driver_earnings(driver_id);