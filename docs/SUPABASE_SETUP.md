# إعداد Supabase لتطبيق "مسافة السكة"

## معلومات المشروع

تم إعداد مشروع Supabase بالفعل بالمعلومات التالية:

- **Project URL**: `https://jhngtyyqiqhgnuclduhc.supabase.co`
- **API Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impobmd0eXlxaXFoZ251Y2xkdWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMTU4MjQsImV4cCI6MjA3Njc5MTgyNH0.SPS1C2yTseDHUtPlS0IzNnx6Mxjt2OgcpkiaQPN6UbE`

## الخطوة 1: تفعيل المصادقة عبر الهاتف

1. انتقل إلى [Supabase Dashboard](https://app.supabase.com)
2. سجل الدخول باستخدام حسابك
3. اختر المشروع "jhngtyyqiqhgnuclduhc"
4. انتقل إلى قسم Authentication → Settings
5. في قسم "Phone Numbers" فعّل "Enable phone login"
6. إذا كنت في وضع التطوير، يمكنك استخدام رموز OTP التجريبية

## الخطوة 2: تشغيل سكريبت تهيئة قاعدة البيانات

```bash
npm run init-db
```

## الخطوة 3: إضافة بيانات تجريبية

```bash
npm run seed
```

## معلومات إضافية

### هيكل قاعدة البيانات

التطبيق يستخدم الجداول التالية:

1. **profiles** - معلومات المستخدمين
2. **addresses** - عناوين التوصيل
3. **merchants** - معلومات المتاجر
4. **merchant_products** - المنتجات
5. **orders** - الطلبات
6. **order_items** - عناصر الطلبات
7. **driver_profiles** - معلومات السائقين
8. **chat_conversations** - محادثات العملاء والسائقين
9. **chat_messages** - الرسائل
10. **transactions** - المعاملات المالية
11. **reviews** - المراجعات والتقييمات

### سياسات الأمان (RLS)

جميع الجداول مزودة بسياسات أمان تضمن:
- المستخدمون يمكنهم فقط مشاهدة وتعديل بياناتهم الخاصة
- السائقون يمكنهم فقط مشاهدة الطلبات المعينة لهم
- التجار يمكنهم فقط إدارة منتجاتهم وطلباتهم

## استكشاف الأخطاء وإصلاحها

### إذا لم يعمل التطبيق:

1. تأكد من صحة `SUPABASE_URL` و `SUPABASE_ANON_KEY` في ملف .env
2. تحقق من تفعيل المصادقة عبر الهاتف في لوحة تحكم Supabase
3. تأكد من تشغيل سكريبت تهيئة قاعدة البيانات
4. راجع سجل الأخطاء في لوحة تحكم Supabase

### في وضع التطوير:

- يمكنك الحصول على رموز OTP من لوحة تحكم Supabase
- استخدم أرقام هاتف تجريبية مثل: +1234567890