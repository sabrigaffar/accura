-- تم إنشاء هذا الملف تلقائياً لإنشاء مخطط قاعدة بيانات تطبيق "مسافة السكة"

-- إنشاء جدول المستخدمين
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL DEFAULT 'customer',
  full_name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  language TEXT DEFAULT 'ar',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء فهارس لجدول المستخدمين
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone_number);

-- إنشاء جدول العناوين
CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  street_address TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT,
  building_number TEXT,
  floor_number TEXT,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء جدول التجار
CREATE TABLE IF NOT EXISTS merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  description_ar TEXT,
  description_en TEXT,
  category TEXT NOT NULL,
  logo_url TEXT,
  banner_url TEXT,
  rating NUMERIC(2, 1) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  avg_delivery_time INTEGER DEFAULT 30,
  min_order_amount NUMERIC(10, 2) DEFAULT 0,
  delivery_fee NUMERIC(10, 2) DEFAULT 0,
  is_open BOOLEAN DEFAULT true,
  address TEXT NOT NULL,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  working_hours JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء جدول المنتجات
CREATE TABLE IF NOT EXISTS merchant_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  description_ar TEXT,
  description_en TEXT,
  price NUMERIC(10, 2) NOT NULL,
  image_url TEXT,
  category TEXT,
  is_available BOOLEAN DEFAULT true,
  preparation_time INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء جدول الطلبات
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id uuid NOT NULL REFERENCES profiles(id),
  merchant_id uuid NOT NULL REFERENCES merchants(id),
  driver_id uuid REFERENCES profiles(id),
  status TEXT DEFAULT 'pending',
  delivery_address_id uuid REFERENCES addresses(id),
  pickup_lat NUMERIC(10, 8),
  pickup_lng NUMERIC(11, 8),
  delivery_lat NUMERIC(10, 8),
  delivery_lng NUMERIC(11, 8),
  subtotal NUMERIC(10, 2) NOT NULL,
  delivery_fee NUMERIC(10, 2) DEFAULT 0,
  service_fee NUMERIC(10, 2) DEFAULT 0,
  tax NUMERIC(10, 2) DEFAULT 0,
  discount NUMERIC(10, 2) DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT DEFAULT 'pending',
  delivery_notes TEXT,
  estimated_delivery_time TIMESTAMPTZ,
  actual_delivery_time TIMESTAMPTZ,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء جدول عناصر الطلبات
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES merchant_products(id),
  product_name_ar TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL,
  special_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء جدول معلومات السائقين
CREATE TABLE IF NOT EXISTS driver_profiles (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL,
  vehicle_model TEXT,
  vehicle_color TEXT,
  license_plate TEXT,
  license_number TEXT,
  license_expiry DATE,
  id_number TEXT,
  id_expiry DATE,
  is_verified BOOLEAN DEFAULT false,
  is_online BOOLEAN DEFAULT false,
  current_lat NUMERIC(10, 8),
  current_lng NUMERIC(11, 8),
  total_earnings NUMERIC(10, 2) DEFAULT 0,
  total_deliveries INTEGER DEFAULT 0,
  average_rating NUMERIC(2, 1) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء جدول مكاسب السائقين
CREATE TABLE IF NOT EXISTS driver_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES profiles(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  base_fee NUMERIC(10, 2) DEFAULT 0,
  distance_fee NUMERIC(10, 2) DEFAULT 0,
  tip_amount NUMERIC(10, 2) DEFAULT 0,
  bonus NUMERIC(10, 2) DEFAULT 0,
  total_earning NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء جدول محادثات الدردشة
CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES profiles(id),
  driver_id uuid NOT NULL REFERENCES profiles(id),
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء جدول رسائل الدردشة
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id),
  message_text TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء جدول المعاملات
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL,
  reference_id uuid,
  user_id uuid REFERENCES profiles(id),
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'SAR',
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء جدول قواعد العمولة
CREATE TABLE IF NOT EXISTS commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_category TEXT NOT NULL,
  commission_percentage NUMERIC(5, 2) DEFAULT 0,
  commission_fixed NUMERIC(10, 2) DEFAULT 0,
  min_commission NUMERIC(10, 2),
  max_commission NUMERIC(10, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء جدول المراجعات
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  reviewer_id uuid NOT NULL REFERENCES profiles(id),
  reviewee_id uuid NOT NULL REFERENCES profiles(id),
  reviewee_type TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء جدول الإشعارات
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title_ar TEXT NOT NULL,
  title_en TEXT,
  body_ar TEXT NOT NULL,
  body_en TEXT,
  notification_type TEXT,
  reference_id uuid,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء جدول تذاكر الدعم
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  assigned_to uuid REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء سياسات الأمان (RLS) لجدول المستخدمين
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

-- إنشاء سياسات الأمان (RLS) لجدول العناوين
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own addresses"
  ON addresses FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- إنشاء سياسات الأمان (RLS) لجدول التجار
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

-- إنشاء سياسات الأمان (RLS) لجدول المنتجات
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

-- إنشاء سياسات الأمان (RLS) لجدول الطلبات
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

-- إنشاء سياسات الأمان (RLS) لجدول عناصر الطلبات
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

-- إنشاء سياسات الأمان (RLS) لجدول معلومات السائقين
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

-- إنشاء سياسات الأمان (RLS) لجدول مكاسب السائقين
ALTER TABLE driver_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view own earnings"
  ON driver_earnings FOR SELECT
  TO authenticated
  USING (auth.uid() = driver_id);

-- إنشاء سياسات الأمان (RLS) لجدول محادثات الدردشة
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view conversations"
  ON chat_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id OR auth.uid() = driver_id);

CREATE POLICY "Customers can create conversations for their orders"
  ON chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_id
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = chat_conversations.order_id
      AND orders.customer_id = auth.uid()
    )
  );

-- إنشاء سياسات الأمان (RLS) لجدول رسائل الدردشة
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversation participants can view messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND (chat_conversations.customer_id = auth.uid() OR chat_conversations.driver_id = auth.uid())
    )
  );

CREATE POLICY "Conversation participants can send messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND (chat_conversations.customer_id = auth.uid() OR chat_conversations.driver_id = auth.uid())
    )
    AND auth.uid() = sender_id
  );

-- إنشاء سياسات الأمان (RLS) لجدول المعاملات
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- إنشاء سياسات الأمان (RLS) لجدول قواعد العمولة
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active commission rules"
  ON commission_rules FOR SELECT
  TO authenticated
  USING (is_active = true);

-- إنشاء سياسات الأمان (RLS) لجدول المراجعات
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reviews about them"
  ON reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = reviewee_id OR auth.uid() = reviewer_id);

CREATE POLICY "Customers can create reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

-- إنشاء سياسات الأمان (RLS) لجدول الإشعارات
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- إنشاء سياسات الأمان (RLS) لجدول تذاكر الدعم
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);