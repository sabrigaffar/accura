-- إصلاح نهائي لأعمدة order_items
-- المشكلة: schema.sql يحتوي product_name_ar/unit_price/total_price
-- لكن قاعدة البيانات الفعلية لا تحتويهم في schema cache

-- الحل: إضافة الأعمدة المفقودة أو تحديث الموجودة

DO $$
BEGIN
    -- 1. إضافة product_name_ar إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'order_items' 
        AND column_name = 'product_name_ar'
    ) THEN
        -- إذا كان product_name موجود، انسخ منه
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'order_items' 
            AND column_name = 'product_name'
        ) THEN
            ALTER TABLE public.order_items ADD COLUMN product_name_ar TEXT;
            UPDATE public.order_items SET product_name_ar = product_name WHERE product_name_ar IS NULL;
            ALTER TABLE public.order_items ALTER COLUMN product_name_ar SET NOT NULL;
        ELSE
            ALTER TABLE public.order_items ADD COLUMN product_name_ar TEXT NOT NULL DEFAULT '';
        END IF;
        RAISE NOTICE 'Added product_name_ar column';
    END IF;

    -- 2. إضافة unit_price إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'order_items' 
        AND column_name = 'unit_price'
    ) THEN
        -- إذا كان price موجود، انسخ منه
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'order_items' 
            AND column_name = 'price'
        ) THEN
            ALTER TABLE public.order_items ADD COLUMN unit_price NUMERIC(10, 2);
            UPDATE public.order_items SET unit_price = price WHERE unit_price IS NULL;
            ALTER TABLE public.order_items ALTER COLUMN unit_price SET NOT NULL;
        ELSE
            ALTER TABLE public.order_items ADD COLUMN unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0;
        END IF;
        RAISE NOTICE 'Added unit_price column';
    END IF;

    -- 3. إضافة total_price إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'order_items' 
        AND column_name = 'total_price'
    ) THEN
        -- إذا كان total موجود، انسخ منه
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'order_items' 
            AND column_name = 'total'
        ) THEN
            ALTER TABLE public.order_items ADD COLUMN total_price NUMERIC(10, 2);
            UPDATE public.order_items SET total_price = total WHERE total_price IS NULL;
            ALTER TABLE public.order_items ALTER COLUMN total_price SET NOT NULL;
        ELSE
            ALTER TABLE public.order_items ADD COLUMN total_price NUMERIC(10, 2) NOT NULL DEFAULT 0;
        END IF;
        RAISE NOTICE 'Added total_price column';
    END IF;

    -- 4. إزالة DEFAULT بعد التأكد من وجود البيانات
    ALTER TABLE public.order_items ALTER COLUMN product_name_ar DROP DEFAULT;
    ALTER TABLE public.order_items ALTER COLUMN unit_price DROP DEFAULT;
    ALTER TABLE public.order_items ALTER COLUMN total_price DROP DEFAULT;

END $$;

-- التحقق من النتيجة
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'order_items'
ORDER BY ordinal_position;
