-- إصلاح شامل لمشكلة full_name في الطلبات
-- تاريخ: 2025-10-28

-- 1. حذف جميع policies القديمة على جدول orders
DROP POLICY IF EXISTS "Customers can view own orders" ON orders;
DROP POLICY IF EXISTS "Customers can create orders" ON orders;
DROP POLICY IF EXISTS "Customers can update own orders" ON orders;
DROP POLICY IF EXISTS "Merchants can view orders" ON orders;
DROP POLICY IF EXISTS "Merchants can update orders" ON orders;
DROP POLICY IF EXISTS "Drivers can view assigned orders" ON orders;
DROP POLICY IF EXISTS "Drivers can update assigned orders" ON orders;

-- 2. إنشاء policies جديدة بسيطة بدون full_name
-- Policy للعملاء - القراءة
CREATE POLICY "Customers can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

-- Policy للعملاء - الإنشاء
CREATE POLICY "Customers can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- Policy للعملاء - التحديث
CREATE POLICY "Customers can update own orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- Policy للتجار - القراءة
CREATE POLICY "Merchants can view orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = orders.merchant_id
      AND merchants.owner_id = auth.uid()
    )
  );

-- Policy للتجار - التحديث
CREATE POLICY "Merchants can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = orders.merchant_id
      AND merchants.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = orders.merchant_id
      AND merchants.owner_id = auth.uid()
    )
  );

-- Policy للسائقين - القراءة
CREATE POLICY "Drivers can view assigned orders"
  ON orders FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

-- Policy للسائقين - التحديث
CREATE POLICY "Drivers can update assigned orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

-- 3. حذف أي triggers قديمة قد تسبب المشكلة
DROP TRIGGER IF EXISTS check_order_full_name ON orders;
DROP TRIGGER IF EXISTS validate_order_data ON orders;

-- 4. التحقق من النجاح - عرض جميع policies
SELECT 
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'orders';

-- 5. التحقق من الأعمدة
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders'
ORDER BY ordinal_position;
