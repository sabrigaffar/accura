-- إضافة رقم هاتف لجدول merchants
-- يسمح لكل متجر بأن يكون له رقم هاتف خاص به

ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_merchants_phone ON merchants(phone_number);

COMMENT ON COLUMN merchants.phone_number IS 'رقم هاتف المتجر للاتصال المباشر';
