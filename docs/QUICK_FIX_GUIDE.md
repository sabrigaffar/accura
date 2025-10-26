# 🔧 دليل الإصلاح السريع - مشاكل نظام السائق

## ❌ المشاكل المكتشفة:

1. **جدول التجار**: الكود يبحث عن `merchant_profiles` لكن الجدول الفعلي اسمه `merchants`
2. **جدول الأرباح**: `driver_earnings` غير موجود أو به مشاكل
3. **خطوات التوصيل**: الأعمدة غير موجودة في جدول orders
4. **جدول الإلغاءات**: `driver_cancellations` غير موجود

---

## ✅ الحل السريع (5 دقائق):

### **الخطوة 1: تطبيق SQL الشامل**

1. افتح **Supabase Dashboard** → **SQL Editor**
2. انسخ والصق الكود التالي:

```sql
-- إصلاح شامل لجميع مشاكل السائق

-- 1. إنشاء جدول driver_earnings الصحيح
DROP TABLE IF EXISTS driver_earnings CASCADE;

CREATE TABLE driver_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  earned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_driver_earnings_driver ON driver_earnings(driver_id, earned_at DESC);
CREATE INDEX idx_driver_earnings_order ON driver_earnings(order_id);

-- RLS Policies
ALTER TABLE driver_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view their own earnings"
ON driver_earnings FOR SELECT
TO authenticated
USING (driver_id = auth.uid());

CREATE POLICY "System can insert earnings"
ON driver_earnings FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. إضافة أعمدة خطوات التوصيل
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS heading_to_merchant_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS heading_to_customer_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_steps 
ON orders(driver_id, picked_up_at, heading_to_customer_at) 
WHERE driver_id IS NOT NULL;

-- 3. إنشاء جدول driver_cancellations
CREATE TABLE IF NOT EXISTS driver_cancellations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  cancelled_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_cancellations_driver 
ON driver_cancellations(driver_id, cancelled_at DESC);

ALTER TABLE driver_cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view their own cancellations"
ON driver_cancellations FOR SELECT
TO authenticated
USING (driver_id = auth.uid());

CREATE POLICY "Drivers can insert cancellations"
ON driver_cancellations FOR INSERT
TO authenticated
WITH CHECK (driver_id = auth.uid());

-- 4. إضافة إحداثيات GPS
ALTER TABLE addresses 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

CREATE INDEX IF NOT EXISTS idx_addresses_coordinates 
ON addresses(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```

3. اضغط **Run** أو **F5**
4. تأكد من ظهور رسالة النجاح

---

### **الخطوة 2: إعادة تشغيل التطبيق**

```bash
# أوقف التطبيق (Ctrl + C)
# ثم شغله مرة أخرى
npx expo start --clear
```

---

### **الخطوة 3: التحقق من نجاح الإصلاح**

افتح **Supabase Dashboard** → **SQL Editor** وشغل:

```sql
-- التحقق من جدول driver_earnings
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'driver_earnings';

-- يجب أن ترى:
-- id, driver_id, order_id, amount, earned_at, created_at, updated_at

-- التحقق من أعمدة orders
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('picked_up_at', 'heading_to_merchant_at', 'heading_to_customer_at');

-- يجب أن ترى الأعمدة الثلاثة

-- التحقق من driver_cancellations
SELECT * FROM information_schema.tables 
WHERE table_name = 'driver_cancellations';

-- يجب أن يظهر الجدول
```

---

## 🧪 اختبار بعد الإصلاح:

1. **سجل دخول كسائق**
2. **تحقق من الأخطاء في Console** - يجب ألا تظهر أخطاء
3. **جرب فتح تبويب "الطلبات المتاحة"** - يجب أن يعمل
4. **جرب فتح تبويب "أرباحي"** - يجب أن يعمل

---

## 📝 ملاحظات مهمة:

### **بخصوص حساب السائق:**

إذا فتح التطبيق كعميل بدلاً من سائق، تحقق من:

```sql
-- التحقق من دور المستخدم
SELECT id, email, role FROM profiles 
WHERE email = 'driver_email@example.com';

-- إذا كان role ليس 'driver'، قم بتحديثه:
UPDATE profiles 
SET role = 'driver' 
WHERE email = 'driver_email@example.com';
```

### **إنشاء بيانات اختبار:**

إذا لم توجد طلبات للاختبار:

```sql
-- إنشاء طلب اختباري بحالة ready (جاهز للتوصيل)
INSERT INTO orders (
  customer_id, 
  merchant_id, 
  status, 
  total_amount, 
  delivery_fee,
  delivery_address_id
) VALUES (
  'customer_user_id',
  'merchant_user_id',
  'ready',
  100.00,
  15.00,
  'address_id'
);
```

---

## ✅ Checklist التحقق:

- [ ] تم تطبيق SQL الشامل
- [ ] لا توجد أخطاء في Supabase
- [ ] تم إعادة تشغيل التطبيق بـ `--clear`
- [ ] لا توجد أخطاء في Console
- [ ] تبويب "الطلبات المتاحة" يعمل
- [ ] تبويب "أرباحي" يعمل
- [ ] دور المستخدم `driver` في قاعدة البيانات

---

## 🆘 إذا استمرت المشاكل:

1. **مسح الكاش:**
   ```bash
   npx expo start --clear
   ```

2. **إعادة تشغيل Metro Bundler:**
   ```bash
   # أوقف التطبيق
   # احذف مجلد .expo
   rm -rf .expo
   # شغل من جديد
   npx expo start
   ```

3. **التحقق من الاتصال بـ Supabase:**
   ```typescript
   // في أي ملف
   console.log('Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
   ```

---

**بعد تطبيق هذه الإصلاحات، يجب أن يعمل نظام السائق بدون أخطاء! 🚀**
