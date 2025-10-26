-- ⚠️ SQL لإنشاء جداول نظام التاجر والسائق
-- نفذ هذا في Supabase Dashboard → SQL Editor

-- 1. جدول المنتجات (products)
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL CHECK (price >= 0),
  discount_price decimal(10,2) CHECK (discount_price >= 0),
  quantity integer DEFAULT 0 CHECK (quantity >= 0),
  category text,
  images text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 2. جدول الطلبات (orders)
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  merchant_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled')),
  total_amount decimal(10,2) NOT NULL CHECK (total_amount >= 0),
  delivery_address jsonb,
  delivery_fee decimal(10,2) DEFAULT 0,
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 3. جدول تفاصيل الطلبات (order_items)
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  price decimal(10,2) NOT NULL CHECK (price >= 0),
  total decimal(10,2) NOT NULL CHECK (total >= 0),
  created_at timestamp DEFAULT now()
);

-- 4. جدول التقييمات (reviews)
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp DEFAULT now()
);

-- 5. إنشاء indexes لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_products_merchant ON products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);

-- 6. RLS Policies للمنتجات
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- التجار يمكنهم رؤية منتجاتهم فقط
CREATE POLICY "Merchants can view own products"
  ON products FOR SELECT
  TO authenticated
  USING (merchant_id = auth.uid());

-- الجميع يمكنهم رؤية المنتجات النشطة
CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  USING (is_active = true);

-- التجار يمكنهم إضافة منتجات
CREATE POLICY "Merchants can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (merchant_id = auth.uid());

-- التجار يمكنهم تحديث منتجاتهم
CREATE POLICY "Merchants can update own products"
  ON products FOR UPDATE
  TO authenticated
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

-- التجار يمكنهم حذف منتجاتهم
CREATE POLICY "Merchants can delete own products"
  ON products FOR DELETE
  TO authenticated
  USING (merchant_id = auth.uid());

-- 7. RLS Policies للطلبات
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- التجار يمكنهم رؤية طلباتهم
CREATE POLICY "Merchants can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (merchant_id = auth.uid());

-- التجار يمكنهم تحديث طلباتهم
CREATE POLICY "Merchants can update own orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (merchant_id = auth.uid());


-- 8. RLS Policies لتفاصيل الطلبات
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- المستخدمون يمكنهم رؤية تفاصيل طلباتهم
CREATE POLICY "Users can view order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND (orders.customer_id = auth.uid() OR orders.merchant_id = auth.uid() OR orders.driver_id = auth.uid())
    )
  );

-- العملاء يمكنهم إضافة تفاصيل طلباتهم
CREATE POLICY "Customers can insert order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND orders.customer_id = auth.uid()
    )
  );

-- 9. RLS Policies للتقييمات
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- الجميع يمكنهم رؤية التقييمات
CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  USING (true);

-- المستخدمون يمكنهم إضافة تقييمات
CREATE POLICY "Users can create reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (reviewer_id = auth.uid());

-- 10. Function لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- تطبيق trigger على products
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- تطبيق trigger على orders
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
  
-- ✅ انتهى! اضغط RUN
-- بعد التنفيذ، يمكنك البدء بإضافة المنتجات والطلبات
