-- إصلاح منطق حساب رسوم التوصيل
-- تاريخ: 2025-10-28
-- المشكلة: تعارض بين رسوم المتجر الثابتة ورسوم الحساب بالمسافة

-- الحل المقترح:
-- 1. إذا كان المتجر delivery_fee = 0 (مجاني) → السائق يأخذ رسوم أساسية ثابتة (مثلاً 5 جنيه)
-- 2. إذا كان المتجر delivery_fee > 0 (مدفوع) → السائق يأخذ نسبة من رسوم التوصيل
-- 3. إذا كان هناك calculated_delivery_fee (بالمسافة) → يتم استخدامه بدلاً من delivery_fee الثابت

-- تعديل دالة calculate_delivery_fee لتدعم المنطق الجديد
CREATE OR REPLACE FUNCTION calculate_delivery_fee(distance_km NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
BEGIN
  -- 10 جنيه لكل كيلومتر (يمكن تعديله حسب الحاجة)
  RETURN distance_km * 10;
END;
$$;

-- دالة جديدة لحساب أرباح السائق
CREATE OR REPLACE FUNCTION calculate_driver_earnings(
  merchant_delivery_fee NUMERIC,
  calculated_delivery_fee NUMERIC,
  delivery_distance_km NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  driver_fee NUMERIC;
BEGIN
  -- إذا كان هناك رسوم محسوبة بالمسافة، استخدمها
  IF calculated_delivery_fee IS NOT NULL AND calculated_delivery_fee > 0 THEN
    driver_fee := calculated_delivery_fee * 0.8; -- السائق يأخذ 80%
  
  -- إذا كان المتجر مجاني (0)، السائق يأخذ رسوم أساسية
  ELSIF merchant_delivery_fee = 0 THEN
    driver_fee := 5; -- 5 جنيه رسوم أساسية
  
  -- إذا كان المتجر يحدد رسوم، السائق يأخذ نسبة
  ELSE
    driver_fee := merchant_delivery_fee * 0.7; -- السائق يأخذ 70%
  END IF;
  
  RETURN driver_fee;
END;
$$;

-- ملاحظة: يمكن تعديل النسب (80%, 70%, الرسوم الأساسية) حسب نموذج العمل
