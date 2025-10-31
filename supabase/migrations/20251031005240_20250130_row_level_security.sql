-- ========================================
-- Row Level Security (RLS) Policies
-- تطبيق سياسات الأمان على مستوى الصفوف
-- ========================================

-- 1. تفعيل RLS على جميع الجداول المهمة
-- ========================================

ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallet_holds ENABLE ROW LEVEL SECURITY;

-- 2. سياسات جدول orders (الطلبات)
-- ========================================

-- السماح للعملاء بمشاهدة طلباتهم فقط
DROP POLICY IF EXISTS "Customers can view their own orders" ON orders;
CREATE POLICY "Customers can view their own orders"
ON orders FOR SELECT
USING (auth.uid() = customer_id);

-- السماح للسائقين بمشاهدة طلباتهم المسندة
DROP POLICY IF EXISTS "Drivers can view their assigned orders" ON orders;
CREATE POLICY "Drivers can view their assigned orders"
ON orders FOR SELECT
USING (auth.uid() = driver_id);

-- السماح للتجار بمشاهدة طلبات متاجرهم
DROP POLICY IF EXISTS "Merchants can view their store orders" ON orders;
CREATE POLICY "Merchants can view their store orders"
ON orders FOR SELECT
USING (
  merchant_id IN (
    SELECT id FROM merchants WHERE owner_id = auth.uid()
  )
);

-- السماح للعملاء بإنشاء طلبات جديدة
DROP POLICY IF EXISTS "Customers can create orders" ON orders;
CREATE POLICY "Customers can create orders"
ON orders FOR INSERT
WITH CHECK (auth.uid() = customer_id);

-- السماح للتجار بتحديث حالة طلباتهم
DROP POLICY IF EXISTS "Merchants can update their orders" ON orders;
CREATE POLICY "Merchants can update their orders"
ON orders FOR UPDATE
USING (
  merchant_id IN (
    SELECT id FROM merchants WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  merchant_id IN (
    SELECT id FROM merchants WHERE owner_id = auth.uid()
  )
);

-- السماح للسائقين بتحديث طلباتهم المسندة
DROP POLICY IF EXISTS "Drivers can update their assigned orders" ON orders;
CREATE POLICY "Drivers can update their assigned orders"
ON orders FOR UPDATE
USING (auth.uid() = driver_id)
WITH CHECK (auth.uid() = driver_id);

-- 3. سياسات جدول products (المنتجات)
-- ========================================

-- السماح للجميع بمشاهدة المنتجات النشطة
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    DROP POLICY IF EXISTS "Anyone can view active products" ON products;
    CREATE POLICY "Anyone can view active products"
    ON products FOR SELECT
    USING (is_active = true);

    -- السماح للتجار بإدارة منتجاتهم فقط
    DROP POLICY IF EXISTS "Merchants can manage their own products" ON products;
    CREATE POLICY "Merchants can manage their own products"
    ON products FOR ALL
    USING (auth.uid() = merchant_id)
    WITH CHECK (auth.uid() = merchant_id);
  END IF;
END $$;

-- 4. سياسات جدول driver_profiles (ملفات السائقين)
-- ========================================

-- السماح للسائقين بمشاهدة وتحديث ملفاتهم فقط
DROP POLICY IF EXISTS "Drivers can view their own profile" ON driver_profiles;
CREATE POLICY "Drivers can view their own profile"
ON driver_profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Drivers can update their own profile" ON driver_profiles;
CREATE POLICY "Drivers can update their own profile"
ON driver_profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5. سياسات جدول merchants (التجار)
-- ========================================

-- السماح للجميع بمشاهدة التجار النشطين
DROP POLICY IF EXISTS "Anyone can view active merchants" ON merchants;
CREATE POLICY "Anyone can view active merchants"
ON merchants FOR SELECT
USING (is_active = true);

-- السماح للتجار بإدارة متاجرهم فقط
DROP POLICY IF EXISTS "Merchants can manage their own stores" ON merchants;
CREATE POLICY "Merchants can manage their own stores"
ON merchants FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- 6. سياسات جدول order_items (عناصر الطلبات)
-- ========================================

-- السماح بمشاهدة عناصر الطلبات للأطراف المعنية فقط
DROP POLICY IF EXISTS "Order items visible to related parties" ON order_items;
CREATE POLICY "Order items visible to related parties"
ON order_items FOR SELECT
USING (
  order_id IN (
    SELECT id FROM orders 
    WHERE customer_id = auth.uid() 
       OR driver_id = auth.uid()
       OR merchant_id IN (
         SELECT id FROM merchants WHERE owner_id = auth.uid()
       )
  )
);

-- 7. سياسات جدول reviews (التقييمات)
-- ========================================

-- السماح للجميع بمشاهدة التقييمات
DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
CREATE POLICY "Anyone can view reviews"
ON reviews FOR SELECT
USING (true);

-- السماح للمستخدمين بإضافة تقييمات لطلباتهم فقط
DROP POLICY IF EXISTS "Users can review their completed orders" ON reviews;
CREATE POLICY "Users can review their completed orders"
ON reviews FOR INSERT
WITH CHECK (
  reviewer_id = auth.uid() AND
  order_id IN (
    SELECT id FROM orders 
    WHERE (customer_id = auth.uid() OR driver_id = auth.uid())
    AND status = 'delivered'
  )
);

-- 8. سياسات جدول wallets (المحافظ)
-- ========================================

-- السماح للمستخدمين بمشاهدة محافظهم فقط
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wallets'
  ) THEN
    DROP POLICY IF EXISTS "Users can view their own wallet" ON wallets;
    CREATE POLICY "Users can view their own wallet"
    ON wallets FOR SELECT
    USING (auth.uid() = owner_id);
  END IF;
END $$;

-- السماح بتحديث المحفظة عبر RPC functions فقط (SECURITY DEFINER)
-- لا حاجة لسياسة UPDATE هنا

-- 9. سياسات جدول wallet_transactions (معاملات المحفظة)
-- ========================================

-- السماح للمستخدمين بمشاهدة معاملات محافظهم فقط
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions'
  ) THEN
    DROP POLICY IF EXISTS "Users can view their wallet transactions" ON wallet_transactions;
    CREATE POLICY "Users can view their wallet transactions"
    ON wallet_transactions FOR SELECT
    USING (
      wallet_id IN (
        SELECT id FROM wallets WHERE owner_id = auth.uid()
      )
    );
  END IF;
END $$;

-- 10. سياسات جدول wallet_holds (الحجوزات)
-- ========================================

-- السماح للمستخدمين بمشاهدة حجوزات محافظهم
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wallet_holds'
  ) THEN
    DROP POLICY IF EXISTS "Users can view their wallet holds" ON wallet_holds;
    CREATE POLICY "Users can view their wallet holds"
    ON wallet_holds FOR SELECT
    USING (
      wallet_id IN (
        SELECT id FROM wallets WHERE owner_id = auth.uid()
      )
    );
  END IF;
END $$;

-- 11. إنشاء فهارس لتحسين الأداء
-- ========================================

-- فهارس جدول orders
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant_id ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- فهارس جدول products
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_products_merchant_id ON products(merchant_id);
    CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  END IF;
END $$;

-- فهارس جدول merchants
CREATE INDEX IF NOT EXISTS idx_merchants_owner_id ON merchants(owner_id);
CREATE INDEX IF NOT EXISTS idx_merchants_is_active ON merchants(is_active);
CREATE INDEX IF NOT EXISTS idx_merchants_category ON merchants(category);

-- فهارس جدول reviews
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON reviews(order_id);

-- فهارس جدول wallets
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wallets'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_wallets_owner_id ON wallets(owner_id);
    CREATE INDEX IF NOT EXISTS idx_wallets_owner_type ON wallets(owner_type);
  END IF;
END $$;

-- 12. تحسين الـ RPC functions الموجودة
-- ========================================

-- دالة آمنة لقبول الطلب (مع التحقق من الصلاحيات)
CREATE OR REPLACE FUNCTION accept_order_safe(p_order_id uuid)
RETURNS TABLE(accepted boolean, message text) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_id uuid;
  v_order_status text;
  v_current_driver uuid;
  v_driver_has_active boolean;
BEGIN
  -- التحقق من تسجيل الدخول
  v_driver_id := auth.uid();
  IF v_driver_id IS NULL THEN
    RETURN QUERY SELECT false, 'يجب تسجيل الدخول'::text;
    RETURN;
  END IF;

  -- التحقق من حالة الطلب
  SELECT status, driver_id INTO v_order_status, v_current_driver
  FROM orders WHERE id = p_order_id;

  IF v_order_status IS NULL THEN
    RETURN QUERY SELECT false, 'الطلب غير موجود'::text;
    RETURN;
  END IF;

  IF v_order_status != 'pending' THEN
    RETURN QUERY SELECT false, 'الطلب غير متاح للقبول'::text;
    RETURN;
  END IF;

  -- التحقق من عدم وجود طلب نشط للسائق
  SELECT EXISTS(
    SELECT 1 FROM orders 
    WHERE driver_id = v_driver_id 
    AND status IN ('accepted', 'picked_up', 'heading_to_merchant', 'heading_to_customer')
  ) INTO v_driver_has_active;

  IF v_driver_has_active THEN
    RETURN QUERY SELECT false, 'لديك طلب نشط بالفعل'::text;
    RETURN;
  END IF;

  -- قبول الطلب
  UPDATE orders 
  SET driver_id = v_driver_id,
      status = 'accepted',
      accepted_at = now()
  WHERE id = p_order_id 
    AND status = 'pending' 
    AND driver_id IS NULL;

  IF FOUND THEN
    RETURN QUERY SELECT true, 'تم قبول الطلب بنجاح'::text;
  ELSE
    RETURN QUERY SELECT false, 'فشل قبول الطلب. ربما تم قبوله من سائق آخر'::text;
  END IF;
END;
$$;

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION accept_order_safe TO authenticated;

-- 13. ملاحظات مهمة
-- ========================================

COMMENT ON POLICY "Customers can view their own orders" ON orders IS 
'يسمح للعملاء بمشاهدة طلباتهم الخاصة فقط';

COMMENT ON POLICY "Drivers can view their assigned orders" ON orders IS 
'يسمح للسائقين بمشاهدة الطلبات المسندة لهم';

COMMENT ON POLICY "Merchants can view their store orders" ON orders IS 
'يسمح للتجار بمشاهدة طلبات متاجرهم';

-- ========================================
-- تم تطبيق Row Level Security بنجاح!
-- ========================================
