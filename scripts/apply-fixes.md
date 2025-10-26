# دليل تطبيق الإصلاحات السريع

## خطوة بخطوة لتطبيق الإصلاحات

### 1. تطبيق Database Migration

**عبر Supabase Dashboard** (الطريقة الموصى بها):

1. افتح [Supabase Dashboard](https://app.supabase.com)
2. اختر مشروعك
3. من القائمة الجانبية، اختر **SQL Editor**
4. انسخ والصق الكود التالي:

```sql
-- إنشاء دالة لإنشاء profile تلقائياً عند التسجيل
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, user_type, full_name, phone_number)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'user_type', 'customer'),
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.phone, new.raw_user_meta_data->>'phone_number', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- حذف الـ trigger القديم
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- إنشاء trigger جديد
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- إضافة RLS policies لجدول profiles (مهم جداً!)
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- تحديث RLS للعناوين
DROP POLICY IF EXISTS "Users can delete their own addresses" ON addresses;
CREATE POLICY "Users can delete their own addresses"
  ON addresses FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own addresses" ON addresses;
CREATE POLICY "Users can update their own addresses"
  ON addresses FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

5. اضغط **Run** أو **Ctrl+Enter**
6. تأكد من ظهور رسالة "Success"

---

### 2. إصلاح المستخدمين الحاليين (إذا لزم الأمر)

إذا كان لديك مستخدمون مسجلون بالفعل ولا تظهر بياناتهم، نفذ هذا SQL:

```sql
-- إنشاء profiles للمستخدمين الحاليين
INSERT INTO profiles (id, user_type, full_name, phone_number, is_active)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'user_type', 'customer') as user_type,
  COALESCE(raw_user_meta_data->>'full_name', 'مستخدم') as full_name,
  COALESCE(phone, raw_user_meta_data->>'phone_number', '') as phone_number,
  true as is_active
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;
```

---

### 3. إعادة تشغيل التطبيق

في terminal مشروعك:

```bash
# أوقف التطبيق إذا كان يعمل (Ctrl+C)

# ثم أعد تشغيله
npm start
```

---

### 4. اختبار الميزات

#### أ. اختبار التسجيل:
1. افتح التطبيق
2. اذهب إلى صفحة التسجيل
3. اختر "تاجر" كنوع حساب
4. املأ البيانات (اسم + رقم جوال + كلمة مرور)
5. اضغط "إنشاء حساب"
6. ✅ يجب أن تظهر رسالة نجاح

#### ب. اختبار الملف الشخصي:
1. اذهب إلى تبويب "الملف الشخصي"
2. ✅ يجب أن تظهر بياناتك (الاسم ورقم الجوال)

#### ج. اختبار العناوين:
1. من الملف الشخصي، اختر "عناويني"
2. اضغط زر "+" لإضافة عنوان جديد
3. املأ البيانات واضغط "إضافة"
4. ✅ يجب أن يُضاف العنوان بنجاح
5. اضغط على أيقونة القلم لتعديل العنوان
6. ✅ يجب أن تفتح نافذة التعديل
7. عدّل البيانات واضغط "تحديث"
8. ✅ يجب أن يتم التحديث بنجاح
9. اضغط على أيقونة سلة المهملات لحذف العنوان
10. ✅ يجب أن يُحذف العنوان بنجاح

---

## ✅ قائمة التحقق النهائية

- [ ] تم تطبيق SQL migration بنجاح
- [ ] تم إعادة تشغيل التطبيق
- [ ] التسجيل يعمل ويحفظ البيانات
- [ ] الملف الشخصي يعرض البيانات بشكل صحيح
- [ ] إضافة عنوان يعمل
- [ ] تعديل عنوان يعمل
- [ ] حذف عنوان يعمل
- [ ] لا توجد أخطاء في console

---

## المشاكل الشائعة والحلول

### المشكلة: "Function already exists"
**الحل**: هذا طبيعي، الكود يستبدل الدالة القديمة. تجاهل هذا التحذير.

### المشكلة: "Permission denied"
**الحل**: تأكد من أنك صاحب المشروع أو لديك صلاحيات admin في Supabase.

### المشكلة: التطبيق لا يعمل بعد التحديثات
**الحل**: 
```bash
# امسح cache وأعد التشغيل
npx expo start -c
```

### المشكلة: البيانات لا تزال لا تظهر
**الحل**: 
1. تحقق من Supabase Dashboard → Table Editor → profiles
2. تأكد من وجود سجل للمستخدم
3. إذا لم يكن موجوداً، نفذ SQL الخاص بإصلاح المستخدمين الحاليين

---

## تفعيل OTP (اختياري)

إذا أردت إرسال رسائل تأكيد SMS:

### الخطوة 1: إعداد Twilio
1. سجّل في [Twilio](https://www.twilio.com/try-twilio)
2. احصل على:
   - Account SID
   - Auth Token
   - رقم هاتف Twilio

### الخطوة 2: إعداد Supabase
1. في Supabase Dashboard
2. اذهب إلى **Authentication** → **Providers**
3. فعّل **Phone**
4. اختر **Twilio** كمزود
5. أدخل البيانات:
   - Twilio Account SID
   - Twilio Auth Token
   - Twilio Phone Number

### الخطوة 3: تحديث الكود (اختياري)
الكود جاهز بالفعل! فقط فعّل الإعدادات وسيعمل OTP تلقائياً.

---

**ملاحظة**: إرسال SMS ليس مجانياً. Twilio يوفر رصيد تجريبي، لكن للإنتاج ستحتاج اشتراك مدفوع.

**البديل المجاني**: استخدم Email Authentication بدلاً من Phone.

---

## الدعم

للمزيد من التفاصيل، راجع:
- `docs/FIXES_DOCUMENTATION.md` - توثيق شامل
- [Supabase Docs](https://supabase.com/docs) - توثيق Supabase
- [Expo Docs](https://docs.expo.dev/) - توثيق Expo

---

**آخر تحديث**: 2025-10-25
