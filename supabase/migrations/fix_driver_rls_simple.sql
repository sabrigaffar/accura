-- إصلاح RLS policies للسائقين - نسخة مبسطة وفعالة
-- هذا يحل مشكلة عدم ظهور الطلبات النشطة للسائق

-- 1. حذف policies القديمة
DROP POLICY IF EXISTS "Drivers can view available orders" ON orders;
DROP POLICY IF EXISTS "Drivers can view assigned orders" ON orders;
DROP POLICY IF EXISTS "Drivers can update assigned orders" ON orders;

-- 2. إنشاء policy بسيط للقراءة (SELECT)
CREATE POLICY "Drivers can view their orders"
ON orders
FOR SELECT
TO authenticated
USING (
  -- السائق يمكنه رؤية:
  -- 1. أي طلب معيّن له (بأي حالة)
  -- 2. الطلبات الجاهزة بدون سائق
  driver_id = auth.uid()
  OR (status = 'ready' AND driver_id IS NULL)
);

-- 3. إنشاء policy بسيط للتحديث (UPDATE)
CREATE POLICY "Drivers can accept and update orders"
ON orders
FOR UPDATE
TO authenticated
USING (
  -- يمكن تحديث:
  -- 1. الطلبات المعيّنة له
  -- 2. الطلبات الجاهزة (لقبولها)
  driver_id = auth.uid()
  OR (status = 'ready' AND driver_id IS NULL)
)
WITH CHECK (
  -- بعد التحديث، يجب أن يكون الطلب معيّن له
  driver_id = auth.uid()
);

-- 4. Index للأداء
CREATE INDEX IF NOT EXISTS idx_orders_driver_status 
ON orders(driver_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_ready_available 
ON orders(status, driver_id) 
WHERE status = 'ready' AND driver_id IS NULL;

-- Comments للتوضيح
COMMENT ON POLICY "Drivers can view their orders" ON orders IS 
'يسمح للسائقين برؤية طلباتهم (أي حالة) والطلبات الجاهزة المتاحة';

COMMENT ON POLICY "Drivers can accept and update orders" ON orders IS 
'يسمح للسائقين بقبول الطلبات المتاحة وتحديث طلباتهم';
