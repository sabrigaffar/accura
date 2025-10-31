-- إضافة إحداثيات GPS للعناوين
-- Migration: Add GPS coordinates support

-- إضافة أعمدة للإحداثيات
ALTER TABLE addresses 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- تعليقات
COMMENT ON COLUMN addresses.latitude IS 'خط العرض GPS';
COMMENT ON COLUMN addresses.longitude IS 'خط الطول GPS';

-- Index للبحث الجغرافي (اختياري - للاستخدام المستقبلي)
CREATE INDEX IF NOT EXISTS idx_addresses_coordinates 
ON addresses(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
