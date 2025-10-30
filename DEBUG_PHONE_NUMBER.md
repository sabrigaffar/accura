# 🔍 تشخيص مشكلة رقم الهاتف - Phone Number Debug

**تاريخ:** 2025-10-26  
**المشكلة:** رقم الهاتف لا يُحفظ في profiles رغم إدخاله أثناء التسجيل

---

## 🎯 ما تم إضافته

أضفت **console.log** في 3 نقاط مهمة لتتبع رقم الهاتف:

### 1️⃣ عند تنسيق رقم الهاتف
```typescript
if (phone.trim()) {
  const cleanPhone = phone.replace(/\D/g, '');
  formattedPhone = `${selectedCountry.code}${cleanPhone.replace(/^0+/, '')}`;
  console.log('Phone formatted:', formattedPhone); // ← جديد
} else {
  console.log('No phone number entered'); // ← جديد
}
```

### 2️⃣ عند حفظ البيانات المؤقتة
```typescript
const tempData = {
  userId: data.user?.id,
  fullName: fullName.trim(),
  formattedPhone, // ← هل الرقم موجود هنا؟
  userType,
};
console.log('Saving tempUserData:', tempData); // ← جديد
setTempUserData(tempData);
```

### 3️⃣ عند إنشاء profile
```typescript
console.log('Creating profile with tempUserData:', tempUserData); // ← جديد

const profileData = {
  id: data.user.id,
  full_name: tempUserData.fullName,
  phone_number: tempUserData.formattedPhone || null, // ← هل الرقم موجود هنا؟
  user_type: tempUserData.userType,
  is_active: true,
  created_at: new Date().toISOString(),
};

console.log('Profile data to insert:', profileData); // ← جديد
```

---

## 🧪 كيفية الاختبار

### الخطوات:
1. **احذف المستخدم القديم** من Supabase (إذا موجود)

2. **أعد تشغيل التطبيق:**
   ```bash
   npx expo start --clear
   ```

3. **سجّل حساب جديد:**
   - ✅ أدخل اسم
   - ✅ أدخل إيميل
   - ✅ **أدخل رقم هاتف (مهم!)** - مثلاً: `512345678`
   - ✅ أدخل كلمة مرور
   - ✅ اختر نوع الحساب

4. **اضغط "إنشاء حساب"**

5. **راقب Console** - يجب أن ترى:
   ```
   Phone formatted: +966512345678
   Saving tempUserData: { userId: '...', fullName: '...', formattedPhone: '+966512345678', userType: 'customer' }
   ```

6. **أدخل OTP وتحقق**

7. **راقب Console مرة أخرى** - يجب أن ترى:
   ```
   Creating profile with tempUserData: { userId: '...', fullName: '...', formattedPhone: '+966512345678', ... }
   Profile data to insert: { id: '...', full_name: '...', phone_number: '+966512345678', ... }
   ```

---

## 🔍 ماذا تبحث عنه في Console

### سيناريو 1: رقم الهاتف موجود ✅
```
Phone formatted: +966512345678
Saving tempUserData: { formattedPhone: '+966512345678' }
Creating profile with tempUserData: { formattedPhone: '+966512345678' }
Profile data to insert: { phone_number: '+966512345678' }
```
**النتيجة:** يجب أن يُحفظ الرقم في profiles ✅

---

### سيناريو 2: لم يتم إدخال رقم ⚠️
```
No phone number entered
Saving tempUserData: { formattedPhone: null }
Creating profile with tempUserData: { formattedPhone: null }
Profile data to insert: { phone_number: null }
```
**النتيجة:** لن يُحفظ رقم (طبيعي إذا لم تدخله)

---

### سيناريو 3: tempUserData فارغة ❌
```
Phone formatted: +966512345678
Saving tempUserData: { formattedPhone: '+966512345678' }
Creating profile with tempUserData: undefined
```
**المشكلة:** tempUserData ضاعت بين signUp و verifyOtp!  
**الحل:** مشكلة في State management

---

### سيناريو 4: formattedPhone غير موجودة في tempUserData ❌
```
Phone formatted: +966512345678
Saving tempUserData: { formattedPhone: undefined }
```
**المشكلة:** المتغير `formattedPhone` خارج scope!  
**الحل:** تحقق من الكود

---

## 🐛 المشاكل المحتملة والحلول

### المشكلة 1: State يضيع
**الأعراض:**
- tempUserData موجودة بعد signUp
- لكن undefined في verifyOtp

**السبب:**
- إعادة تحميل Component
- Navigation يعيد تعيين State

**الحل:**
استخدام AsyncStorage أو Context:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// عند signUp:
await AsyncStorage.setItem('tempUserData', JSON.stringify(tempData));

// عند verifyOtp:
const saved = await AsyncStorage.getItem('tempUserData');
const tempUserData = JSON.parse(saved);
```

---

### المشكلة 2: formattedPhone خارج scope
**الأعراض:**
- console.log يظهر الرقم منسق
- لكن tempUserData.formattedPhone = undefined

**السبب:**
- المتغير `formattedPhone` داخل try block
- لا يمكن الوصول له في setTempUserData

**الحل:**
تعريف formattedPhone خارج try:
```typescript
const signUp = async () => {
  let formattedPhone = null; // ← خارج try
  
  try {
    if (phone.trim()) {
      formattedPhone = ...;
    }
    // باقي الكود
  }
}
```

---

### المشكلة 3: الرقم غير منسق صحيح
**الأعراض:**
- Phone formatted: +96605123456 (زيادة 0)
- أو: +966123 (ناقص)

**الحل:**
تحقق من التنسيق:
```typescript
const cleanPhone = phone.replace(/\D/g, ''); // إزالة كل شيء غير رقمي
formattedPhone = `${selectedCountry.code}${cleanPhone.replace(/^0+/, '')}`; // إزالة الأصفار البادئة
```

---

## 📊 الخلاصة

بعد إضافة console.log:

1. **سجّل حساب جديد**
2. **راقب Console**
3. **أخبرني ماذا ترى في Console**
4. **تحقق من Supabase → profiles → phone_number**

سأساعدك في حل المشكلة بناءً على ما تراه! 🔍

---

**ملاحظة مهمة:**
إذا كان Console يظهر الرقم صحيح في جميع المراحل، لكن لا يُحفظ في قاعدة البيانات، فالمشكلة قد تكون:
- ❌ RLS Policy (لكن حللناها)
- ❌ Trigger في قاعدة البيانات يحذف الرقم
- ❌ الرقم يُحفظ لكن في عمود خاطئ

---

**تاريخ الإنشاء:** 2025-10-26  
**الحالة:** 🔍 في انتظار نتائج الاختبار
