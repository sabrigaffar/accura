-- إصلاح schema جدول order_items
-- تاريخ الإنشاء: 2025-10-28

-- التحقق من الحقول الموجودة وإصلاحها
DO $$
BEGIN
    -- إذا كان full_name موجوداً، احذفه
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'full_name'
    ) THEN
        ALTER TABLE order_items DROP COLUMN full_name;
    END IF;

    -- إذا كان product_name_ar موجوداً، احذفه
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'product_name_ar'
    ) THEN
        ALTER TABLE order_items DROP COLUMN product_name_ar;
    END IF;

    -- إضافة product_name إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'product_name'
    ) THEN
        ALTER TABLE order_items ADD COLUMN product_name TEXT NOT NULL DEFAULT '';
    END IF;

    -- إضافة quantity إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'quantity'
    ) THEN
        ALTER TABLE order_items ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;
    END IF;

    -- إضافة price إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'price'
    ) THEN
        ALTER TABLE order_items ADD COLUMN price NUMERIC(10, 2) NOT NULL DEFAULT 0;
    END IF;

    -- إضافة total إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'total'
    ) THEN
        ALTER TABLE order_items ADD COLUMN total NUMERIC(10, 2) NOT NULL DEFAULT 0;
    END IF;
END $$;

-- إزالة DEFAULT من product_name بعد التأكد من وجود البيانات
ALTER TABLE order_items ALTER COLUMN product_name DROP DEFAULT;

-- التحقق من النتيجة
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'order_items'
ORDER BY ordinal_position;
