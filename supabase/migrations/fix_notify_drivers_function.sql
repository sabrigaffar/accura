-- إصلاح دالة notify_available_drivers
-- تاريخ: 2025-10-28
-- المشكلة: الدالة تحاول الوصول لـ full_name من driver_profiles بدلاً من profiles

-- حذف الدالة القديمة
DROP FUNCTION IF EXISTS notify_available_drivers(uuid);

-- إنشاء الدالة المُصلحة
CREATE OR REPLACE FUNCTION notify_available_drivers(order_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  driver_record RECORD;
BEGIN
  -- جلب جميع السائقين المتاحين (online + لديهم push_token)
  -- ✅ إصلاح: JOIN مع profiles للحصول على full_name
  FOR driver_record IN 
    SELECT 
      dp.id, 
      dp.push_token, 
      p.full_name
    FROM driver_profiles dp
    JOIN profiles p ON p.id = dp.id
    WHERE dp.is_online = true 
      AND dp.push_enabled = true 
      AND dp.push_token IS NOT NULL
  LOOP
    -- هنا يمكنك إضافة منطق الإشعارات الخارجية (مثل Firebase Cloud Functions)
    -- لكن للبساطة، سنقوم بتسجيل الحدث فقط
    RAISE NOTICE 'Notify driver % about order %', driver_record.full_name, order_id;
  END LOOP;
END;
$$;

-- التحقق من نجاح الإصلاح
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'notify_available_drivers';
