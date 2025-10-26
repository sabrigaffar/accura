# 🔔💬 دليل نظام الإشعارات والدردشة

دليل شامل لنظام الإشعارات والدردشة المبني باستخدام Supabase و Expo Notifications

---

## 📋 جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [المتطلبات](#المتطلبات)
3. [إعداد قاعدة البيانات](#إعداد-قاعدة-البيانات)
4. [تثبيت الحزم](#تثبيت-الحزم)
5. [إعداد Expo Notifications](#إعداد-expo-notifications)
6. [البنية المعمارية](#البنية-المعمارية)
7. [كيفية الاستخدام](#كيفية-الاستخدام)
8. [الاختبار](#الاختبار)
9. [استكشاف الأخطاء](#استكشاف-الأخطاء)

---

## 🎯 نظرة عامة

تم بناء نظام متكامل للإشعارات والدردشة يتضمن:

### ✨ الميزات الرئيسية

#### نظام الإشعارات 🔔
- ✅ Push Notifications باستخدام Expo Notifications
- ✅ إشعارات في الوقت الفعلي عبر Supabase Realtime
- ✅ تخزين الإشعارات في قاعدة البيانات
- ✅ عداد الإشعارات غير المقروءة
- ✅ وضع علامة مقروء على الإشعارات
- ✅ حذف الإشعارات

#### نظام الدردشة 💬
- ✅ محادثات في الوقت الفعلي بين جميع الأطراف
- ✅ دعم Customer ↔ Merchant
- ✅ دعم Customer ↔ Driver
- ✅ دعم Merchant ↔ Driver
- ✅ محادثات مرتبطة بالطلبات
- ✅ عداد الرسائل غير المقروءة
- ✅ حالة الاتصال (Online/Offline)
- ✅ تحرير وحذف الرسائل

---

## 📦 المتطلبات

### البرمجيات المطلوبة
- Node.js >= 18
- Expo CLI
- Supabase Account

### الحزم المطلوبة
```json
{
  "expo-notifications": "latest",
  "expo-device": "latest",
  "@supabase/supabase-js": "^2.58.0"
}
```

---

## 🗄️ إعداد قاعدة البيانات

### 1. تطبيق Schema على Supabase

افتح Supabase Dashboard → SQL Editor ونفّذ الملف:
```bash
NOTIFICATIONS_CHAT_SCHEMA.sql
```

هذا الملف يحتوي على:
- ✅ جداول: `push_tokens`, `notifications`, `conversations`, `conversation_participants`, `messages`
- ✅ RLS Policies للأمان
- ✅ Indexes لتحسين الأداء
- ✅ Triggers تلقائية
- ✅ Functions مساعدة
- ✅ Realtime enabled

### 2. التحقق من التفعيل

تأكد من تفعيل Realtime في Supabase Dashboard:
```
Settings → API → Realtime
```

تأكد من تفعيل الجداول التالية:
- ✅ messages
- ✅ conversations
- ✅ conversation_participants
- ✅ notifications

---

## 📥 تثبيت الحزم

### تثبيت expo-notifications و expo-device

```bash
npx expo install expo-notifications expo-device
```

### التحقق من التثبيت

```bash
npm list expo-notifications expo-device
```

---

## ⚙️ إعداد Expo Notifications

### 1. إضافة Project ID في app.json

افتح `app.json` وأضف/حدّث:
```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "your-project-id-here"
      }
    }
  }
}
```

**⚠️ مهم:** احصل على Project ID من:
- https://expo.dev/accounts/[your-username]/projects/[project-name]/settings

### 2. تحديث notificationService.ts

افتح `lib/notificationService.ts` واستبدل:
```typescript
const token = await Notifications.getExpoPushTokenAsync({
  projectId: 'your-project-id', // 👈 ضع Project ID هنا
});
```

### 3. إعداد للـ Android (اختياري)

إذا كنت تريد استخدام Firebase Cloud Messaging:
1. أنشئ مشروع Firebase
2. احصل على `google-services.json`
3. ضعه في مجلد root
4. تم بالفعل تحديث `app.json`

### 4. إعداد للـ iOS (اختياري)

لا يحتاج إعدادات إضافية - Expo يدير كل شيء!

---

## 🏗️ البنية المعمارية

### الملفات الرئيسية

```
project/
├── types/
│   ├── chat.ts                     # أنواع الدردشة
│   └── notification.ts             # أنواع الإشعارات
├── lib/
│   ├── chatService.ts              # خدمة الدردشة
│   ├── notificationService.ts      # خدمة الإشعارات
│   └── supabase.ts                 # Supabase Client
├── contexts/
│   ├── ChatContext.tsx             # Context الدردشة
│   └── NotificationContext.tsx     # Context الإشعارات
├── app/
│   ├── _layout.tsx                 # Root Layout + Providers
│   ├── (tabs)/
│   │   ├── chat.tsx               # قائمة المحادثات
│   │   └── notifications.tsx       # قائمة الإشعارات
│   └── chat/
│       └── [id].tsx               # المحادثة الفردية
└── NOTIFICATIONS_CHAT_SCHEMA.sql   # Schema قاعدة البيانات
```

### معمارية النظام

```
┌─────────────────────────────────────┐
│         Mobile App (Expo)           │
├─────────────────────────────────────┤
│  NotificationContext | ChatContext  │
├─────────────────────────────────────┤
│ notificationService | chatService   │
├─────────────────────────────────────┤
│       Supabase Client + Realtime    │
└─────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────┐
│         Supabase Backend            │
├─────────────────────────────────────┤
│  PostgreSQL + RLS + Triggers        │
├─────────────────────────────────────┤
│      Realtime Subscriptions         │
└─────────────────────────────────────┘
```

---

## 💻 كيفية الاستخدام

### استخدام نظام الإشعارات

#### 1. في أي Component

```typescript
import { useNotifications } from '@/contexts/NotificationContext';

function MyComponent() {
  const {
    notifications,
    unreadCount,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // عرض الإشعارات
  return (
    <View>
      <Text>لديك {unreadCount} إشعار غير مقروء</Text>
      {notifications.map(notif => (
        <NotificationItem key={notif.id} notification={notif} />
      ))}
    </View>
  );
}
```

#### 2. إرسال إشعار من الخادم/Backend

```typescript
import { notificationService } from '@/lib/notificationService';

await notificationService.createNotification({
  user_id: 'user-uuid',
  title: 'طلب جديد',
  body: 'تم استلام طلبك بنجاح',
  type: 'order',
  data: { order_id: 'order-123' }
});
```

### استخدام نظام الدردشة

#### 1. في أي Component

```typescript
import { useChat } from '@/contexts/ChatContext';

function MyComponent() {
  const {
    conversations,
    currentConversation,
    messages,
    unreadCount,
    selectConversation,
    sendMessage,
  } = useChat();

  // فتح محادثة
  const openChat = async (conversationId: string) => {
    await selectConversation(conversationId);
  };

  // إرسال رسالة
  const send = async (text: string) => {
    await sendMessage({
      conversation_id: currentConversation!.id,
      content: text,
      type: 'text',
    });
  };
}
```

#### 2. إنشاء محادثة جديدة

```typescript
import { chatService } from '@/lib/chatService';

// بين Customer و Merchant
const conversationId = await chatService.getOrCreateConversation(
  'customer_merchant',
  customerId,
  'customer',
  merchantId,
  'merchant',
  orderId  // اختياري
);
```

#### 3. البحث في الرسائل

```typescript
const results = await chatService.searchMessages(
  conversationId,
  'كلمة البحث'
);
```

---

## 🧪 الاختبار

### 1. اختبار الإشعارات

```typescript
// في أي component أو screen
import { notificationService } from '@/lib/notificationService';

// اختبار إشعار محلي
await notificationService.sendLocalNotification(
  'عنوان الاختبار',
  'محتوى الاختبار',
  { test: true }
);

// اختبار إشعار من قاعدة البيانات
await notificationService.createNotification({
  user_id: currentUserId,
  title: 'اختبار',
  body: 'هذا إشعار تجريبي',
  type: 'system',
});
```

### 2. اختبار الدردشة

افتح تطبيقين (أو استخدم Simulator + Device):

**الجهاز 1 (Merchant):**
```typescript
// افتح المحادثة
router.push('/chat/[conversation-id]');
```

**الجهاز 2 (Customer):**
```typescript
// أرسل رسالة
await sendMessage({
  conversation_id: 'conversation-id',
  content: 'مرحبا!',
});
```

**التحقق:**
- ✅ يجب أن تظهر الرسالة فوراً في الجهاز 1
- ✅ يجب أن يتحدث عداد غير المقروءة
- ✅ يجب أن يصل Push Notification

### 3. اختبار Realtime

افتح Supabase Dashboard → Database → Tables → messages
أدخل رسالة يدوياً:
```sql
INSERT INTO messages (conversation_id, sender_id, content)
VALUES ('conversation-id', 'sender-id', 'رسالة اختبار');
```

**التحقق:**
- ✅ يجب أن تظهر الرسالة فوراً في التطبيق

---

## 🔧 استكشاف الأخطاء

### المشكلة: الإشعارات لا تعمل

**الحلول:**
1. ✅ تأكد من تشغيل التطبيق على **جهاز حقيقي** (ليس Simulator)
2. ✅ تحقق من منح الأذونات:
   ```typescript
   const { status } = await Notifications.getPermissionsAsync();
   console.log('Permission status:', status);
   ```
3. ✅ تحقق من Project ID في `notificationService.ts`
4. ✅ تحقق من تسجيل Push Token:
   ```typescript
   const token = notificationService.getPushToken();
   console.log('Push Token:', token);
   ```

### المشكلة: الرسائل لا تظهر في الوقت الفعلي

**الحلول:**
1. ✅ تحقق من تفعيل Realtime في Supabase
2. ✅ تحقق من الاشتراكات:
   ```typescript
   // في ChatContext
   console.log('Subscribed to messages for:', conversationId);
   ```
3. ✅ تحقق من RLS Policies - قد تمنع القراءة
4. ✅ تحقق من Console في Supabase Dashboard

### المشكلة: "User not authenticated"

**الحل:**
```typescript
// تحقق من حالة المصادقة
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  console.error('User not logged in!');
}
```

### المشكلة: عداد غير المقروءة لا يتحدث

**الحل:**
1. ✅ تحقق من Trigger `update_conversation_on_new_message`
2. ✅ تحقق من Function `reset_unread_count`
3. ✅ نفّذ يدوياً:
   ```sql
   SELECT * FROM conversation_participants 
   WHERE user_id = 'your-user-id';
   ```

---

## 📚 مراجع إضافية

### الوثائق الرسمية
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)

### أمثلة الاستخدام
- `app/(tabs)/notifications.tsx` - شاشة الإشعارات
- `app/(tabs)/chat.tsx` - قائمة المحادثات
- `app/chat/[id].tsx` - المحادثة الفردية

---

## 🎉 الخلاصة

تم بناء نظام متكامل للإشعارات والدردشة باستخدام:
- ✅ Supabase للخلفية والـ Realtime
- ✅ Expo Notifications للإشعارات
- ✅ React Context للإدارة الحالة
- ✅ TypeScript للأمان في الكود
- ✅ RLS Policies للأمان في قاعدة البيانات

**جاهز للاستخدام! 🚀**

---

## 📞 الدعم

إذا واجهت أي مشاكل:
1. راجع قسم [استكشاف الأخطاء](#استكشاف-الأخطاء)
2. تحقق من Console Logs
3. راجع Supabase Dashboard → Logs
4. تأكد من تطبيق Schema بشكل صحيح

**آخر تحديث:** 2025-10-26
