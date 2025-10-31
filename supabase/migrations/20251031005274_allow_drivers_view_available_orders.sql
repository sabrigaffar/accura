-- السماح للسائقين برؤية الطلبات الجاهزة المتاحة (ready + no driver assigned)
-- هذا ضروري ليتمكن السائقون من رؤية الطلبات المتاحة في صفحة "الطلبات المتاحة"

-- حذف policy القديم إذا كان موجوداً
DROP POLICY IF EXISTS "Drivers can view available orders" ON orders;

-- إنشاء policy جديد
CREATE POLICY "Drivers can view available orders"
ON orders
FOR SELECT
TO authenticated
USING (
  -- السائق يمكنه رؤية:
  -- 1. الطلبات المعيّنة له (أي حالة)
  -- 2. الطلبات الجاهزة بدون سائق (status = 'ready' AND driver_id IS NULL)
  auth.uid() IN (
    SELECT id FROM driver_profiles WHERE id = auth.uid()
  )
  AND (
    -- ✅ يمكنه رؤية أي طلب معيّن له (بغض النظر عن الحالة)
    driver_id = auth.uid()
    -- أو الطلبات الجاهزة للقبول
    OR (status = 'ready' AND driver_id IS NULL)
  )
);

-- تحديث policy التحديث ليشمل قبول الطلبات
DROP POLICY IF EXISTS "Drivers can update assigned orders" ON orders;

CREATE POLICY "Drivers can update assigned orders"
ON orders
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM driver_profiles WHERE id = auth.uid()
  )
  AND (
    -- يمكن تحديث الطلبات المعيّنة له
    driver_id = auth.uid()
    -- أو قبول طلب متاح
    OR (status = 'ready' AND driver_id IS NULL)
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM driver_profiles WHERE id = auth.uid()
  )
  AND driver_id = auth.uid()
);

-- إضافة index لتسريع الاستعلامات
CREATE INDEX IF NOT EXISTS idx_orders_ready_no_driver 
ON orders(status, driver_id) 
WHERE status = 'ready' AND driver_id IS NULL;

-- إضافة comment للتوضيح
COMMENT ON POLICY "Drivers can view available orders" ON orders IS 
'يسمح للسائقين برؤية الطلبات المعيّنة لهم أو الطلبات الجاهزة المتاحة (ready + no driver)';
