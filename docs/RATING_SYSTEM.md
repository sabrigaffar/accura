# ⭐ نظام التقييم - Rating System

## نظام تقييم شامل للسائقين والمتاجر

تم تنفيذ نظام تقييم كامل يسمح للعملاء بتقييم السائقين والمتاجر بعد إكمال الطلب.

---

## ✅ الميزات المُنفذة

### 1. **مكون التقييم بالنجوم** (`RatingStars`)
- تفاعلي للتقييم أو للعرض فقط (readonly)
- 5 نجوم مع ألوان ذهبية
- نصوص عربية (سيء، متوسط، جيد، ممتاز)
- قابل للتخصيص (الحجم، الـ style)

### 2. **صفحة التقييم** (`rate-order.tsx`)
- تقييم السائق والمتجر في صفحة واحدة
- تعليقات اختيارية
- نصائح للتقييم
- تحديث تلقائي لمتوسط التقييم
- دعم Dark Mode

### 3. **Triggers تلقائية**
- تحديث `average_rating` للسائق تلقائياً
- تحديث `rating` و `total_reviews` للمتجر تلقائياً
- عند إضافة تقييم جديد

### 4. **Views و Functions**
- `driver_rating_stats` - إحصائيات تفصيلية
- `get_top_rated_drivers()` - أفضل السائقين
- تحليلات متقدمة

### 5. **RLS Policies**
- تقييم واحد فقط لكل طلب
- الجميع يمكنه رؤية التقييمات
- حماية من التقييمات المكررة

---

## 📁 الملفات المُنشأة

### 1. `components/RatingStars.tsx`
```tsx
import { RatingStars } from '@/components/RatingStars';

// للعرض فقط
<RatingStars rating={4.5} readonly size={24} />

// تفاعلي
<RatingStars 
  rating={rating} 
  onRatingChange={setRating}
  showLabel
  size={40}
/>
```

**Props:**
- `rating` - التقييم الحالي (0-5)
- `onRatingChange?` - دالة تُستدعى عند التغيير
- `size?` - حجم النجوم (default: 32)
- `readonly?` - للعرض فقط (default: false)
- `showLabel?` - إظهار النص (سيء، جيد، إلخ)
- `style?` - تخصيص الـ style

### 2. `app/order/rate-order.tsx`
صفحة كاملة لتقييم الطلب بعد الاكتمال.

**Query Parameters:**
```tsx
router.push({
  pathname: '/order/rate-order',
  params: {
    orderId: 'uuid',
    driverName: 'اسم السائق',
    merchantName: 'اسم المتجر',
    driverId: 'uuid',
    merchantId: 'uuid',
  },
});
```

### 3. `supabase/migrations/rating_system.sql`
- Triggers تلقائية
- Functions للتحليلات
- Views للإحصائيات
- RLS Policies محدثة

---

## 🗄️ قاعدة البيانات

### جدول `reviews` (موجود):

| الحقل | النوع | الوصف |
|------|------|--------|
| `id` | UUID | المعرف الفريد |
| `order_id` | UUID | معرف الطلب |
| `reviewer_id` | UUID | معرف المُقيِّم (العميل) |
| `reviewee_id` | UUID | معرف المُقيَّم (سائق/متجر) |
| `reviewee_type` | TEXT | 'driver' أو 'merchant' |
| `rating` | INTEGER | 1-5 نجوم |
| `comment` | TEXT | تعليق اختياري |
| `created_at` | TIMESTAMP | وقت الإنشاء |

### Triggers:

```sql
-- عند إضافة تقييم لسائق
trigger_update_driver_rating
  → update_driver_average_rating()
  → تحديث driver_profiles.average_rating

-- عند إضافة تقييم لمتجر
trigger_update_merchant_rating
  → update_merchant_average_rating()
  → تحديث merchants.rating و total_reviews
```

---

## 🚀 كيفية الاستخدام

### 1. **من صفحة الطلبات المكتملة:**

```tsx
import { router } from 'expo-router';

// بعد إكمال الطلب
const handleRateOrder = () => {
  router.push({
    pathname: '/order/rate-order',
    params: {
      orderId: order.id,
      driverName: order.driver_name,
      merchantName: order.merchant_name,
      driverId: order.driver_id,
      merchantId: order.merchant_id,
    },
  });
};
```

### 2. **عرض تقييم موجود:**

```tsx
import { RatingStars } from '@/components/RatingStars';

<RatingStars rating={driver.average_rating} readonly size={20} />
<Text>{driver.average_rating} ({totalReviews} تقييم)</Text>
```

### 3. **الحصول على أفضل السائقين:**

```sql
SELECT * FROM get_top_rated_drivers(10);
```

أو من TypeScript:
```tsx
const { data: topDrivers } = await supabase
  .rpc('get_top_rated_drivers', { limit_count: 10 });
```

### 4. **عرض إحصائيات السائق:**

```sql
SELECT * FROM driver_rating_stats WHERE id = 'driver-uuid';
```

---

## 📊 التحليلات و Dashboard

### إحصائيات التقييمات:

```sql
-- توزيع النجوم لسائق
SELECT 
  five_stars,
  four_stars,
  three_stars,
  two_stars,
  one_star
FROM driver_rating_stats
WHERE id = 'driver-uuid';
```

### متوسط التقييمات حسب الفترة:

```sql
SELECT 
  DATE_TRUNC('month', created_at) as month,
  AVG(rating) as avg_rating,
  COUNT(*) as total_reviews
FROM reviews
WHERE reviewee_id = 'driver-uuid'
  AND reviewee_type = 'driver'
GROUP BY month
ORDER BY month DESC;
```

### التعليقات الأخيرة:

```sql
SELECT 
  r.rating,
  r.comment,
  r.created_at,
  p.full_name as customer_name
FROM reviews r
JOIN profiles p ON p.id = r.reviewer_id
WHERE r.reviewee_id = 'driver-uuid'
  AND r.reviewee_type = 'driver'
  AND r.comment IS NOT NULL
ORDER BY r.created_at DESC
LIMIT 10;
```

---

## 🎨 واجهة المستخدم

### صفحة التقييم تتضمن:

1. **Header:**
   - زر رجوع
   - عنوان "تقييم الطلب"

2. **قسم تقييم السائق:**
   - اسم السائق
   - نجوم تفاعلية (1-5)
   - نص التقييم (سيء، متوسط، جيد، ممتاز)
   - حقل تعليق (اختياري)

3. **قسم تقييم المتجر:**
   - اسم المتجر
   - نجوم تفاعلية (1-5)
   - نص التقييم
   - حقل تعليق (اختياري)

4. **نصائح:**
   - كن منصفاً
   - ساعد الآخرين
   - تجنب الإساءة

5. **زر الإرسال:**
   - معطّل إذا لم يتم اختيار تقييم
   - Loading indicator عند الإرسال
   - رسالة نجاح

---

## 🔐 الأمان

### RLS Policies:

1. **إنشاء تقييم:**
   ```sql
   - يجب أن يكون المُقيِّم هو صاحب الطلب
   - تقييم واحد فقط لكل (طلب + نوع)
   - منع التقييمات المكررة
   ```

2. **عرض التقييمات:**
   ```sql
   - الجميع يمكنه رؤية التقييمات (عامة)
   - للشفافية وبناء الثقة
   ```

3. **تحديث التقييم:**
   ```sql
   - غير مسموح (يمكن إضافة في المستقبل)
   ```

---

## 📈 مقاييس النجاح

### KPIs:

- **معدل التقييم:** نسبة الطلبات المُقيَّمة
- **متوسط التقييم:** للسائقين والمتاجر
- **توزيع النجوم:** لتحديد نقاط التحسين
- **التعليقات:** feedback نوعي

### استعلامات مفيدة:

```sql
-- معدل التقييم العام
SELECT 
  COUNT(DISTINCT r.order_id)::FLOAT / COUNT(DISTINCT o.id) * 100 as rating_rate
FROM orders o
LEFT JOIN reviews r ON r.order_id = o.id
WHERE o.status = 'delivered';

-- متوسط التقييم العام للسائقين
SELECT AVG(average_rating) FROM driver_profiles WHERE average_rating > 0;

-- أفضل 10 سائقين
SELECT * FROM get_top_rated_drivers(10);
```

---

## 🐛 استكشاف الأخطاء

### المشكلة: التقييم لا يظهر بعد الإرسال

✅ **الحل:**
1. تحقق من تطبيق SQL migration
2. تأكد من Triggers مفعّلة
3. راجع RLS Policies

### المشكلة: خطأ "duplicate key"

✅ **الحل:**
- العميل حاول تقييم نفس الطلب مرتين
- RLS Policy تمنع ذلك
- هذا سلوك صحيح

### المشكلة: متوسط التقييم لا يتحدث

✅ **الحل:**
```sql
-- تحديث يدوي
SELECT update_driver_average_rating() 
FROM reviews WHERE reviewee_id = 'driver-uuid' LIMIT 1;
```

---

## 🚀 الخطوات التالية (اختياري)

### تحسينات مستقبلية:

1. **تعديل التقييم:**
   - السماح بتعديل التقييم خلال 24 ساعة
   - إضافة UPDATE policy

2. **الرد على التقييمات:**
   - السائق/المتجر يرد على التعليقات
   - جدول `review_replies`

3. **شارات الإنجاز:**
   - "سائق 5 نجوم"
   - "أفضل 10 سائقين"
   - Gamification

4. **تحليلات متقدمة:**
   - Sentiment analysis للتعليقات
   - Trending topics
   - AI insights

5. **إشعارات:**
   - إشعار للسائق عند تلقي تقييم
   - تحفيز على تحسين الخدمة

---

## 📝 ملاحظات مهمة

1. **التقييم مطلوب:**
   - من الجيد جعل التقييم إلزامياً لإكمال دورة الطلب
   - يحسن جودة البيانات

2. **الخصوصية:**
   - أسماء العملاء مخفية في التقييمات العامة
   - فقط الإدارة ترى من قيّم

3. **الاعتدال:**
   - مراجعة التعليقات السلبية
   - حذف المحتوى المسيء

4. **التحفيز:**
   - مكافآت للسائقين ذوي التقييم العالي
   - عروض خاصة

---

## 📞 API Reference

### Frontend:

```tsx
// Submit rating
const submitRating = async (orderId, driverId, rating, comment) => {
  const { error } = await supabase.from('reviews').insert({
    order_id: orderId,
    reviewer_id: user.id,
    reviewee_id: driverId,
    reviewee_type: 'driver',
    rating: rating,
    comment: comment,
  });
};

// Get driver reviews
const getDriverReviews = async (driverId) => {
  const { data } = await supabase
    .from('reviews')
    .select('*, reviewer:profiles(full_name)')
    .eq('reviewee_id', driverId)
    .eq('reviewee_type', 'driver')
    .order('created_at', { ascending: false });
};
```

---

**تم التنفيذ بنجاح! 🎉**

نظام تقييم متكامل جاهز للاستخدام.
