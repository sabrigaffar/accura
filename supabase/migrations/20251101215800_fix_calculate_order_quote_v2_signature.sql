-- إصلاح توقيع دالة calculate_order_quote_v2 لتقبل payment_method_enum
-- المشكلة: الدالة تستخدم text بدلاً من payment_method_enum

-- 1. التحقق من وجود enum للـ payment_method
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_enum') THEN
        -- إنشاء enum إذا لم يكن موجوداً
        CREATE TYPE payment_method_enum AS ENUM ('cash', 'card', 'wallet', 'online', 'cod');
        RAISE NOTICE 'Created payment_method_enum type';
    END IF;
END $$;

-- 2. إنشاء نسخة overload من الدالة تقبل payment_method_enum
CREATE OR REPLACE FUNCTION calculate_order_quote_v2(
  p_customer_id uuid,
  p_store_id uuid,
  p_items jsonb,
  p_payment_method payment_method_enum,  -- استخدام enum بدلاً من text
  p_delivery_fee numeric,
  p_tax numeric DEFAULT 0
) RETURNS TABLE(
  subtotal numeric,
  service_fee numeric,
  discount numeric,
  total numeric,
  applied_promotion uuid,
  applied_rule uuid,
  apply_on text
) AS $$
BEGIN
  -- استدعاء النسخة الأصلية التي تقبل text
  RETURN QUERY
  SELECT * FROM calculate_order_quote_v2(
    p_customer_id,
    p_store_id,
    p_items,
    p_payment_method::text,  -- تحويل enum إلى text
    p_delivery_fee,
    p_tax
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. منح الصلاحيات
GRANT EXECUTE ON FUNCTION calculate_order_quote_v2(uuid, uuid, jsonb, payment_method_enum, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_order_quote_v2(uuid, uuid, jsonb, payment_method_enum, numeric, numeric) TO anon;

-- 4. التحقق من النجاح
SELECT 
    p.proname AS "اسم الدالة",
    pg_get_function_arguments(p.oid) AS "المعاملات"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'calculate_order_quote_v2'
ORDER BY p.proname;
