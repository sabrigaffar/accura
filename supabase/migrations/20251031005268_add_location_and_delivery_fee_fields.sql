-- إضافة حقول الموقع ورسوم التوصيل
-- Add location and delivery fee fields

-- ═══════════════════════════════════════════════
-- 1. تحديث جدول merchants
-- ═══════════════════════════════════════════════

-- إضافة حقول الموقع للمتجر (إذا لم تكن موجودة)
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC,
ADD COLUMN IF NOT EXISTS max_delivery_distance NUMERIC DEFAULT 15;

-- إضافة تعليقات على الأعمدة
COMMENT ON COLUMN merchants.latitude IS 'خط العرض لموقع المتجر - Store latitude';
COMMENT ON COLUMN merchants.longitude IS 'خط الطول لموقع المتجر - Store longitude';
COMMENT ON COLUMN merchants.max_delivery_distance IS 'أقصى مسافة توصيل بالكيلومتر - Maximum delivery distance in kilometers';

-- إنشاء فهرس للموقع
CREATE INDEX IF NOT EXISTS merchants_location_idx ON merchants(latitude, longitude);

-- ═══════════════════════════════════════════════
-- 2. تحديث جدول orders
-- ═══════════════════════════════════════════════

-- إضافة حقول الموقع والمسافة للطلب
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_latitude NUMERIC,
ADD COLUMN IF NOT EXISTS customer_longitude NUMERIC,
ADD COLUMN IF NOT EXISTS delivery_distance_km NUMERIC,
ADD COLUMN IF NOT EXISTS calculated_delivery_fee NUMERIC;

-- إضافة تعليقات على الأعمدة
COMMENT ON COLUMN orders.customer_latitude IS 'خط العرض لموقع العميل - Customer latitude';
COMMENT ON COLUMN orders.customer_longitude IS 'خط الطول لموقع العميل - Customer longitude';
COMMENT ON COLUMN orders.delivery_distance_km IS 'المسافة بالكيلومتر بين المتجر والعميل - Delivery distance in kilometers';
COMMENT ON COLUMN orders.calculated_delivery_fee IS 'رسوم التوصيل المحسوبة حسب المسافة - Calculated delivery fee based on distance';

-- إنشاء فهرس للموقع
CREATE INDEX IF NOT EXISTS orders_customer_location_idx ON orders(customer_latitude, customer_longitude);

-- ═══════════════════════════════════════════════
-- 3. إنشاء دالة لحساب المسافة
-- ═══════════════════════════════════════════════

-- دالة حساب المسافة بين نقطتين باستخدام Haversine formula
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 NUMERIC,
  lon1 NUMERIC,
  lat2 NUMERIC,
  lon2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  r NUMERIC := 6371; -- نصف قطر الأرض بالكيلومتر
  dlat NUMERIC;
  dlon NUMERIC;
  a NUMERIC;
  c NUMERIC;
  distance NUMERIC;
BEGIN
  -- التحقق من المدخلات
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;

  -- تحويل الدرجات إلى راديان
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  
  -- حساب Haversine
  a := sin(dlat/2) * sin(dlat/2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dlon/2) * sin(dlon/2);
  
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  distance := r * c;
  
  RETURN ROUND(distance::NUMERIC, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_distance IS 'حساب المسافة بالكيلومتر بين نقطتين جغرافيتين - Calculate distance in kilometers between two geographic points';

-- ═══════════════════════════════════════════════
-- 4. إنشاء دالة لحساب رسوم التوصيل
-- ═══════════════════════════════════════════════

-- دالة حساب رسوم التوصيل: 10 جنيه لكل كيلو
CREATE OR REPLACE FUNCTION calculate_delivery_fee(
  distance_km NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  fee_per_km NUMERIC := 10; -- 10 جنيه لكل كيلو
  kilometers INTEGER;
  fee NUMERIC;
BEGIN
  -- التحقق من المدخلات
  IF distance_km IS NULL OR distance_km < 0 THEN
    RETURN 0;
  END IF;

  -- تقريب لأعلى كيلو كامل
  kilometers := CEIL(distance_km);
  
  -- حساب الرسوم
  fee := kilometers * fee_per_km;
  
  RETURN fee;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_delivery_fee IS 'حساب رسوم التوصيل: 10 جنيه لكل كيلومتر - Calculate delivery fee: 10 per kilometer';

-- ═══════════════════════════════════════════════
-- 5. إنشاء trigger لحساب المسافة ورسوم التوصيل تلقائياً
-- ═══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_order_delivery_info()
RETURNS TRIGGER AS $$
DECLARE
  merchant_lat NUMERIC;
  merchant_lon NUMERIC;
  distance NUMERIC;
BEGIN
  -- جلب موقع المتجر
  SELECT latitude, longitude 
  INTO merchant_lat, merchant_lon
  FROM merchants m
  WHERE m.id = NEW.merchant_id;
  
  -- إذا كان الموقع متوفر للمتجر والعميل
  IF merchant_lat IS NOT NULL AND merchant_lon IS NOT NULL AND
     NEW.customer_latitude IS NOT NULL AND NEW.customer_longitude IS NOT NULL THEN
    
    -- حساب المسافة
    distance := calculate_distance(
      merchant_lat, 
      merchant_lon, 
      NEW.customer_latitude, 
      NEW.customer_longitude
    );
    
    -- تحديث المسافة ورسوم التوصيل
    NEW.delivery_distance_km := distance;
    NEW.calculated_delivery_fee := calculate_delivery_fee(distance);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء trigger
DROP TRIGGER IF EXISTS trigger_update_order_delivery_info ON orders;
CREATE TRIGGER trigger_update_order_delivery_info
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_delivery_info();

COMMENT ON TRIGGER trigger_update_order_delivery_info ON orders IS 'تحديث معلومات التوصيل تلقائياً عند إنشاء/تحديث الطلب - Auto-update delivery info on order creation/update';

-- ═══════════════════════════════════════════════
-- 6. إنشاء view لعرض معلومات التوصيل
-- ═══════════════════════════════════════════════

CREATE OR REPLACE VIEW orders_with_delivery_info AS
SELECT 
  o.*,
  m.name_ar as store_name,
  m.latitude as store_latitude,
  m.longitude as store_longitude,
  CASE 
    WHEN o.delivery_distance_km IS NOT NULL THEN
      CASE 
        WHEN o.delivery_distance_km < 1 THEN 
          ROUND((o.delivery_distance_km * 1000)::NUMERIC, 0)::TEXT || ' م'
        ELSE 
          ROUND(o.delivery_distance_km::NUMERIC, 1)::TEXT || ' كم'
      END
    ELSE NULL
  END as distance_text
FROM orders o
LEFT JOIN merchants m ON o.merchant_id = m.id;

COMMENT ON VIEW orders_with_delivery_info IS 'عرض الطلبات مع معلومات التوصيل المفصلة - Orders view with detailed delivery information';
