-- فرض حساب رسوم التوصيل بالمسافة فقط
-- تاريخ: 2025-10-28
-- القرار: رسوم التوصيل تُحسب فقط بناءً على المسافة (لا يحددها التاجر)

-- 1. حذف أو تجاهل delivery_fee من جدول merchants (أو جعله للعرض فقط)
-- ملاحظة: لن نحذف العمود لأنه قد يكون مستخدم في أماكن أخرى
-- لكن سنضيف comment يوضح أنه للعرض فقط

COMMENT ON COLUMN merchants.delivery_fee IS 'للعرض فقط - الرسوم الفعلية تُحسب بالمسافة';

-- 2. التأكد من وجود الدالة الأساسية لحساب المسافة
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 NUMERIC,
  lon1 NUMERIC,
  lat2 NUMERIC,
  lon2 NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  R NUMERIC := 6371; -- نصف قطر الأرض بالكيلومتر
  dLat NUMERIC;
  dLon NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  dLat := radians(lat2 - lat1);
  dLon := radians(lon2 - lon1);
  
  a := sin(dLat/2) * sin(dLat/2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dLon/2) * sin(dLon/2);
  
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN R * c;
END;
$$;

-- 3. تحديث دالة حساب رسوم التوصيل (10 جنيه/كم)
CREATE OR REPLACE FUNCTION calculate_delivery_fee(distance_km NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
BEGIN
  -- 10 جنيه لكل كيلومتر
  -- يمكن تعديل المعدل حسب الحاجة
  RETURN GREATEST(distance_km * 10, 5); -- حد أدنى 5 جنيه
END;
$$;

-- 4. دالة حساب أرباح السائق (80% من رسوم التوصيل)
CREATE OR REPLACE FUNCTION calculate_driver_earnings(delivery_fee NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
BEGIN
  -- السائق يحصل على 80% من رسوم التوصيل
  RETURN delivery_fee * 0.8;
END;
$$;

-- 5. دالة حساب أرباح المنصة (20% من رسوم التوصيل)
CREATE OR REPLACE FUNCTION calculate_platform_commission(delivery_fee NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
BEGIN
  -- المنصة تحصل على 20% من رسوم التوصيل
  RETURN delivery_fee * 0.2;
END;
$$;

-- 6. اختبار الدوال
DO $$
DECLARE
  test_distance NUMERIC := 5; -- 5 كم
  test_fee NUMERIC;
  test_driver NUMERIC;
  test_platform NUMERIC;
BEGIN
  test_fee := calculate_delivery_fee(test_distance);
  test_driver := calculate_driver_earnings(test_fee);
  test_platform := calculate_platform_commission(test_fee);
  
  RAISE NOTICE 'مسافة: % كم', test_distance;
  RAISE NOTICE 'رسوم التوصيل: % جنيه', test_fee;
  RAISE NOTICE 'أرباح السائق (80%%): % جنيه', test_driver;
  RAISE NOTICE 'أرباح المنصة (20%%): % جنيه', test_platform;
END $$;

-- النتيجة المتوقعة:
-- مسافة: 5 كم
-- رسوم التوصيل: 50 جنيه
-- أرباح السائق: 40 جنيه
-- أرباح المنصة: 10 جنيه
