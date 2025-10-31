-- إضافة دعم العملات المتعددة
ALTER TABLE driver_profiles 
ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(10) DEFAULT 'SAR';

-- إضافة تعليق توضيحي
COMMENT ON COLUMN driver_profiles.preferred_currency IS 'العملة المفضلة للسائق (SAR, EGP, AED, USD, EUR)';

-- يمكن إضافة جدول للعملات المدعومة (اختياري)
CREATE TABLE IF NOT EXISTS supported_currencies (
  code VARCHAR(10) PRIMARY KEY,
  name_ar VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- إدراج العملات المدعومة
INSERT INTO supported_currencies (code, name_ar, name_en, symbol) VALUES
  ('SAR', 'ريال سعودي', 'Saudi Riyal', 'ر.س'),
  ('EGP', 'جنيه مصري', 'Egyptian Pound', 'ج.م'),
  ('AED', 'درهم إماراتي', 'UAE Dirham', 'د.إ'),
  ('USD', 'دولار أمريكي', 'US Dollar', '$'),
  ('EUR', 'يورو', 'Euro', '€')
ON CONFLICT (code) DO NOTHING;
