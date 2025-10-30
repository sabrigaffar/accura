-- إضافة دعم صور المتجر (Logo و Banner)
-- تاريخ الإنشاء: 2025-10-28

-- إضافة حقول الصور إلى جدول merchants
ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- إضافة تعليقات توضيحية
COMMENT ON COLUMN merchants.logo_url IS 'رابط شعار المتجر (Logo) من Supabase Storage';
COMMENT ON COLUMN merchants.banner_url IS 'رابط صورة غلاف المتجر (Banner) من Supabase Storage';

-- تحديث البيانات الموجودة (اختياري - يمكن حذفه إذا لم تكن هناك بيانات تجريبية)
-- UPDATE merchants SET logo_url = NULL, banner_url = NULL WHERE logo_url IS NULL;
