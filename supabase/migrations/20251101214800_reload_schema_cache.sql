-- إعادة تحميل schema cache في PostgREST
-- هذا يجبر Supabase على إعادة قراءة تعريفات الجداول

-- إعادة تحميل schema cache
NOTIFY pgrst, 'reload schema';

-- التحقق من أن جميع الأعمدة موجودة
DO $$
DECLARE
    missing_cols TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- التحقق من الأعمدة المطلوبة
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'product_name_ar') THEN
        missing_cols := array_append(missing_cols, 'product_name_ar');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'unit_price') THEN
        missing_cols := array_append(missing_cols, 'unit_price');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'total_price') THEN
        missing_cols := array_append(missing_cols, 'total_price');
    END IF;
    
    IF array_length(missing_cols, 1) > 0 THEN
        RAISE EXCEPTION 'Missing columns in order_items: %', array_to_string(missing_cols, ', ');
    ELSE
        RAISE NOTICE '✅ All required columns exist in order_items';
    END IF;
END $$;
