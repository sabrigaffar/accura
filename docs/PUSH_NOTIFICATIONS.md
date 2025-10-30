# 🔔 Push Notifications System

## نظام الإشعارات الفورية للسائقين

تم تنفيذ نظام إشعارات فورية كامل للسائقين باستخدام Expo Notifications.

---

## ✅ الميزات المُنفذة

### 1. **PushNotificationContext**
- Context كامل لإدارة الإشعارات
- تسجيل تلقائي للـ Push Token عند تسجيل الدخول
- حفظ Token في قاعدة البيانات
- استماع للإشعارات الواردة
- معالجة النقر على الإشعارات

### 2. **طلب الأذونات**
- طلب تلقائي لأذونات الإشعارات
- التعامل مع رفض الأذونات
- دعم iOS و Android

### 3. **تكامل مع الصوت**
- تشغيل صوت تنبيه عند وصول إشعار
- استخدام `playNotificationSound()` الموجود

### 4. **Navigation عند النقر**
- التنقل التلقائي للصفحة المناسبة عند النقر
- دعم أنواع إشعارات مختلفة

### 5. **زر اختبار**
- زر في صفحة الإعدادات لإرسال إشعار تجريبي
- للتأكد من عمل النظام

---

## 📁 الملفات المُنشأة

### 1. `contexts/PushNotificationContext.tsx`
```tsx
import { usePushNotifications } from '@/contexts/PushNotificationContext';

function MyComponent() {
  const { 
    expoPushToken,           // Push token للجهاز
    notification,            // آخر إشعار تم استلامه
    registerForPushNotifications, // تسجيل يدوي
    sendTestNotification     // إرسال إشعار تجريبي
  } = usePushNotifications();
}
```

### 2. `supabase/migrations/add_push_notifications.sql`
حقول جديدة في `driver_profiles`:
- `push_token` - Expo Push Token
- `push_enabled` - هل الإشعارات مفعلة
- `last_notification_at` - آخر إشعار

---

## 🚀 كيفية الاستخدام

### للسائق:

1. **عند تسجيل الدخول:**
   - يتم طلب أذونات الإشعارات تلقائياً
   - يتم حفظ Push Token في قاعدة البيانات

2. **عند وصول طلب جديد:**
   - يصل إشعار فوري للسائق
   - يتم تشغيل صوت التنبيه
   - يمكن النقر على الإشعار للانتقال للصفحة

3. **اختبار الإشعارات:**
   - اذهب إلى الإعدادات
   - اضغط على "إشعار تجريبي"
   - سيصلك إشعار فوري

---

## 🔧 التكوين المطلوب

### 1. **تحديث app.json**
```json
{
  "expo": {
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#00B074",
      "androidMode": "default",
      "androidCollapsedTitle": "{{unread_count}} طلبات جديدة"
    }
  }
}
```

### 2. **تطبيق SQL Migration**
قم بتشغيل:
```bash
# تطبيق migration على قاعدة البيانات
psql -h your-db-host -U postgres -d your-database -f supabase/migrations/add_push_notifications.sql
```

أو من Supabase Dashboard:
1. اذهب إلى SQL Editor
2. الصق محتويات `add_push_notifications.sql`
3. اضغط Run

### 3. **تكوين Expo Project ID**
في `.env`:
```
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id
```

---

## 📱 إرسال الإشعارات

### من Backend (Supabase Edge Function مثلاً):

```typescript
async function sendPushNotification(pushToken: string, title: string, body: string, data?: any) {
  const message = {
    to: pushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
    priority: 'high',
  };

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}

// مثال: إشعار بطلب جديد
await sendPushNotification(
  driverPushToken,
  '🎉 طلب جديد!',
  'لديك طلب توصيل جديد بقيمة 50 ر.س',
  { type: 'new_order', orderId: '123' }
);
```

### Trigger تلقائي:

تم إنشاء Trigger في SQL يتم تفعيله تلقائياً عند إنشاء طلب جديد:
```sql
CREATE TRIGGER new_order_notification_trigger
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_new_order_notifications();
```

---

## 🎨 أنواع الإشعارات المدعومة

### 1. **طلب جديد** (`new_order`)
```typescript
{
  type: 'new_order',
  orderId: 'uuid',
  amount: 50,
  distance: 3.5
}
```
→ ينتقل إلى: Dashboard (available orders)

### 2. **تحديث طلب** (`order_update`)
```typescript
{
  type: 'order_update',
  orderId: 'uuid',
  status: 'accepted'
}
```
→ ينتقل إلى: Active Orders

### 3. **رسالة جديدة** (`new_message`)
```typescript
{
  type: 'new_message',
  chatId: 'uuid',
  from: 'customer_name'
}
```
→ ينتقل إلى: Chat

---

## 🐛 استكشاف الأخطاء

### المشكلة: لا تصل الإشعارات

✅ **الحلول:**
1. تأكد من أن الجهاز حقيقي (ليس simulator)
2. تحقق من أذونات الإشعارات في إعدادات الجهاز
3. تأكد من أن `push_token` محفوظ في قاعدة البيانات
4. تأكد من أن `push_enabled = true`

### المشكلة: الصوت لا يعمل

✅ **الحلول:**
1. تحقق من أن الجهاز ليس في وضع صامت
2. تأكد من أن ملف الصوت موجود في `assets/sounds/`
3. جرّب استخدام الإشعار التجريبي

---

## 📊 قاعدة البيانات

### جدول `driver_profiles` - حقول جديدة:

| الحقل | النوع | الوصف |
|------|------|--------|
| `push_token` | TEXT | Expo Push Token |
| `push_enabled` | BOOLEAN | تفعيل/إيقاف الإشعارات |
| `last_notification_at` | TIMESTAMP | آخر إشعار |

### الاستعلامات المفيدة:

```sql
-- جلب جميع السائقين المتاحين للإشعارات
SELECT id, full_name, push_token
FROM driver_profiles
WHERE is_online = true 
  AND push_enabled = true 
  AND push_token IS NOT NULL;

-- تحديث حالة الإشعارات لسائق
UPDATE driver_profiles
SET push_enabled = false
WHERE id = 'driver-uuid';

-- حذف token (مثلاً عند تسجيل الخروج)
UPDATE driver_profiles
SET push_token = NULL
WHERE id = 'driver-uuid';
```

---

## 🔐 الأمان

- ✅ Push Tokens محفوظة بشكل آمن في قاعدة البيانات
- ✅ RLS policies تضمن أن كل سائق يرى بياناته فقط
- ✅ التحقق من الأذونات قبل إرسال الإشعارات
- ✅ عدم إرسال بيانات حساسة في الإشعار نفسه

---

## 🚀 الخطوات التالية (اختياري)

### 1. **Rich Notifications**
- إضافة صور للإشعارات
- أزرار actions (قبول/رفض)
- Progress notifications

### 2. **تحليلات**
- تتبع معدل فتح الإشعارات
- A/B testing للعناوين
- أفضل أوقات الإرسال

### 3. **تخصيص**
- اختيار صوت التنبيه
- تفضيلات الإشعارات
- Do Not Disturb hours

---

## 📝 ملاحظات مهمة

1. **Expo Go**: 
   - الإشعارات تعمل في Expo Go للتجربة
   - للإنتاج، يُفضل build standalone app

2. **iOS**:
   - يتطلب Apple Developer Account
   - يحتاج push notification certificate

3. **Android**:
   - يعمل مباشرة بدون تكوين إضافي
   - تأكد من Firebase Cloud Messaging (اختياري)

4. **Rate Limiting**:
   - Expo لديها حدود على عدد الإشعارات
   - للإنتاج، استخدم Firebase أو OneSignal

---

## 📞 الدعم

للمساعدة أو الإبلاغ عن مشاكل:
- راجع [Expo Notifications Docs](https://docs.expo.dev/push-notifications/overview/)
- راجع [Supabase Realtime](https://supabase.com/docs/guides/realtime)

---

**تم التنفيذ بنجاح! 🎉**
