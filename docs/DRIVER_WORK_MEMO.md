# 📋 مذكرة عمل نظام السائق - المتبقي والتحسينات

## 📊 ملخص المقارنة

### ✅ ما تم تنفيذه (80% من الخطة الأساسية)

#### 1️⃣ صفحة الطلبات المتاحة (`index.tsx`) ✅
- ✅ عرض جميع الطلبات الجاهزة (`status = ready` بدون سائق)
- ✅ معلومات الطلب: رقم الطلب، اسم المتجر، اسم العميل، العنوان، القيمة، الأجرة
- ✅ زر قبول الطلب مع تأكيد
- ✅ تحديث حالة الطلب → `out_for_delivery`
- ✅ ربط `driver_id` بالطلب
- ✅ الانتقال التلقائي لصفحة الطلبات النشطة
- ✅ Pull to refresh
- ✅ حالات فارغة

**❌ لم يتم:**
- ❌ فلترة وترتيب (الأقرب مسافة، الأعلى أجراً، الأحدث)
- ❌ حساب المسافة الفعلية (حالياً random)
- ❌ عرض الوقت المتوقع للتوصيل

#### 2️⃣ صفحة الطلبات النشطة (`active-orders.tsx`) ✅
- ✅ عرض الطلب النشط للسائق
- ✅ معلومات المتجر (اسم، عنوان)
- ✅ معلومات العميل (اسم، رقم هاتف، عنوان توصيل)
- ✅ زر "تم التسليم" → تحديث `status = delivered`
- ✅ إضافة سجل في `driver_earnings`
- ✅ تسجيل `delivered_at`
- ✅ زر "اتصال" (جاهز للتفعيل)
- ✅ زر "التنقل" (جاهز للتكامل)

**❌ لم يتم:**
- ❌ خطوات التوصيل التفصيلية:
  - ❌ تم القبول
  - ❌ في الطريق للمتجر
  - ❌ تم الاستلام من المتجر (`picked_up_at`)
  - ❌ في الطريق للعميل
  - ❌ تم التسليم
- ❌ زر "تم الاستلام من المتجر"
- ❌ إلغاء الطلب في حالة طارئة
- ❌ الاتصال الفعلي بالعميل/التاجر (مجرد Alert حالياً)
- ❌ التكامل الفعلي مع Google Maps / Apple Maps

#### 3️⃣ صفحة الأرباح (`earnings.tsx`) ✅
- ✅ إحصائيات: اليوم، الأسبوع، الشهر، الإجمالي
- ✅ عدد التوصيلات المكتملة
- ✅ فلترة حسب الفترة (اليوم، الأسبوع، الشهر، الكل)
- ✅ سجل الأرباح التفصيلي
- ✅ معلومات كل طلب (رقم، مبلغ، تاريخ، اسم عميل)

**❌ لم يتم:**
- ❌ إحصائيات الأداء:
  - ❌ متوسط التقييم
  - ❌ متوسط وقت التوصيل
  - ❌ نسبة إتمام الطلبات (مُسلمة / ملغاة)
- ❌ رسم بياني للأرباح (Victory Native Charts)
- ❌ عرض المسافة لكل طلب في السجل
- ❌ عرض التقييم لكل طلب

#### 4️⃣ صفحة الحساب (`profile.tsx`) ✅
- ✅ موجودة بالفعل

---

## 🎯 المتبقي - مقسم حسب الأولوية

### 🔴 أولوية عالية جداً (إكمال الوظائف الأساسية)

#### 1. خطوات التوصيل التفصيلية في الطلبات النشطة
**الملف:** `app/(driver-tabs)/active-orders.tsx`

**المطلوب:**
```typescript
// إضافة enum لحالات التوصيل
enum DeliveryStep {
  ACCEPTED = 'accepted',           // تم القبول
  HEADING_TO_MERCHANT = 'heading_to_merchant',  // في الطريق للمتجر
  PICKED_UP = 'picked_up',         // تم الاستلام
  HEADING_TO_CUSTOMER = 'heading_to_customer',  // في الطريق للعميل
  DELIVERED = 'delivered'          // تم التسليم
}

// إضافة UI لخطوات التوصيل
- عرض المرحلة الحالية بشكل بصري (Stepper)
- زر "وصلت للمتجر" → تحديث picked_up_at
- زر "تم الاستلام - في الطريق للعميل"
- زر "تم التسليم"
```

**تحديثات قاعدة البيانات المطلوبة:**
```sql
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS heading_to_merchant_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS heading_to_customer_at TIMESTAMP;
```

**الوقت المقدر:** 2-3 ساعات

---

#### 2. إلغاء الطلب من طرف السائق (حالة طارئة)
**الملف:** `app/(driver-tabs)/active-orders.tsx`

**المطلوب:**
```typescript
// إضافة زر إلغاء الطلب
- Modal لإدخال سبب الإلغاء
- تحديث الطلب:
  * إزالة driver_id
  * status = 'ready' (إعادته للطلبات المتاحة)
  * OR status = 'cancelled_by_driver'
  * إضافة cancellation_reason

// جدول جديد لتتبع الإلغاءات
CREATE TABLE driver_cancellations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES profiles(id),
  order_id UUID REFERENCES orders(id),
  reason TEXT NOT NULL,
  cancelled_at TIMESTAMP DEFAULT NOW()
);
```

**الوقت المقدر:** 1-2 ساعة

---

### 🟡 أولوية عالية (تحسينات UX مهمة)

#### 3. فلترة وترتيب الطلبات المتاحة
**الملف:** `app/(driver-tabs)/index.tsx`

**المطلوب:**
```typescript
// إضافة dropdown للفلترة
- الأقرب مسافة (يتطلب حساب المسافة)
- الأعلى أجراً
- الأحدث

// State للفلتر
const [sortBy, setSortBy] = useState<'nearest' | 'highest_fee' | 'newest'>('newest');

// دالة الترتيب
const sortOrders = (orders: Order[]) => {
  switch(sortBy) {
    case 'highest_fee':
      return orders.sort((a, b) => b.delivery_fee - a.delivery_fee);
    case 'newest':
      return orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    case 'nearest':
      // يتطلب حساب المسافة
      return orders.sort((a, b) => a.distance - b.distance);
  }
};
```

**الوقت المقدر:** 1-2 ساعة

---

#### 4. حساب المسافة الفعلية
**الملفات:** `index.tsx`, `active-orders.tsx`

**المطلوب:**
```typescript
// استخدام Google Distance Matrix API أو Haversine Formula
import * as Location from 'expo-location';

// دالة حساب المسافة
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  // Haversine formula
  const R = 6371; // نصف قطر الأرض بالكيلومتر
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
};

// الحصول على موقع السائق
const [driverLocation, setDriverLocation] = useState(null);
useEffect(() => {
  (async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      let location = await Location.getCurrentPositionAsync({});
      setDriverLocation(location.coords);
    }
  })();
}, []);
```

**تحديثات قاعدة البيانات:**
```sql
-- إضافة إحداثيات للعناوين
ALTER TABLE addresses 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
```

**الوقت المقدر:** 2-3 ساعات

---

#### 5. التكامل الفعلي مع الخرائط (Navigation)
**الملف:** `app/(driver-tabs)/active-orders.tsx`

**المطلوب:**
```typescript
import * as Linking from 'expo-linking';

const openInMaps = (address: string, lat?: number, lng?: number) => {
  const scheme = Platform.select({ 
    ios: 'maps:0,0?q=', 
    android: 'geo:0,0?q=' 
  });
  
  const latLng = lat && lng ? `${lat},${lng}` : '';
  const label = encodeURIComponent(address);
  const url = Platform.select({
    ios: `${scheme}${label}@${latLng}`,
    android: `${scheme}${latLng}(${label})`
  });

  Linking.openURL(url || '');
};

// أو استخدام Google Maps مباشرة
const openGoogleMaps = (lat: number, lng: number) => {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  Linking.openURL(url);
};
```

**الوقت المقدر:** 1 ساعة

---

#### 6. الاتصال الفعلي بالعميل/التاجر
**الملف:** `app/(driver-tabs)/active-orders.tsx`

**المطلوب:**
```typescript
import * as Linking from 'expo-linking';

const callPhone = (phoneNumber: string) => {
  const url = `tel:${phoneNumber}`;
  Linking.canOpenURL(url)
    .then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('خطأ', 'لا يمكن إجراء المكالمة');
      }
    });
};

// في الـ UI
<TouchableOpacity onPress={() => callPhone(activeOrder.customer_phone)}>
  <Phone size={18} color={colors.white} />
  <Text>اتصال</Text>
</TouchableOpacity>
```

**الوقت المقدر:** 30 دقيقة

---

### 🟢 أولوية متوسطة (إحصائيات وتحليلات متقدمة)

#### 7. إحصائيات الأداء المتقدمة في صفحة الأرباح
**الملف:** `app/(driver-tabs)/earnings.tsx`

**المطلوب:**
```typescript
// إضافة بطاقات إحصائيات جديدة
interface PerformanceStats {
  avgRating: number;           // متوسط التقييم
  avgDeliveryTime: number;     // متوسط وقت التوصيل (بالدقائق)
  completionRate: number;      // نسبة إتمام الطلبات
  totalCancelled: number;      // عدد الطلبات الملغاة
}

// Query لحساب الإحصائيات
const calculatePerformanceStats = async () => {
  // متوسط التقييم
  const { data: ratingData } = await supabase
    .from('reviews')
    .select('rating')
    .eq('reviewee_id', user.id)
    .eq('review_type', 'driver');

  const avgRating = ratingData.reduce((sum, r) => sum + r.rating, 0) / ratingData.length;

  // متوسط وقت التوصيل
  const { data: ordersData } = await supabase
    .from('orders')
    .select('created_at, delivered_at')
    .eq('driver_id', user.id)
    .eq('status', 'delivered')
    .not('delivered_at', 'is', null);

  const avgTime = ordersData.reduce((sum, o) => {
    const diff = new Date(o.delivered_at) - new Date(o.created_at);
    return sum + (diff / 60000); // تحويل لدقائق
  }, 0) / ordersData.length;

  // نسبة الإتمام
  const { count: completed } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('driver_id', user.id)
    .eq('status', 'delivered');

  const { count: cancelled } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('driver_id', user.id)
    .eq('status', 'cancelled_by_driver');

  const completionRate = (completed / (completed + cancelled)) * 100;

  return { avgRating, avgDeliveryTime: avgTime, completionRate, totalCancelled: cancelled };
};
```

**الوقت المقدر:** 2-3 ساعات

---

#### 8. رسم بياني للأرباح (Charts)
**الملف:** `app/(driver-tabs)/earnings.tsx`

**المطلوب:**
```bash
# تثبيت المكتبة
npm install victory-native react-native-svg
```

```typescript
import { VictoryBar, VictoryChart, VictoryTheme, VictoryAxis } from 'victory-native';

// بيانات آخر 7 أيام
const getLast7DaysEarnings = () => {
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayEarnings = earnings.filter(e => 
      new Date(e.earned_at).toDateString() === date.toDateString()
    ).reduce((sum, e) => sum + e.amount, 0);
    
    data.push({
      day: date.toLocaleDateString('ar-SA', { weekday: 'short' }),
      earnings: dayEarnings
    });
  }
  return data;
};

// الرسم البياني
<VictoryChart theme={VictoryTheme.material} width={350} height={200}>
  <VictoryAxis />
  <VictoryAxis dependentAxis />
  <VictoryBar
    data={getLast7DaysEarnings()}
    x="day"
    y="earnings"
    style={{ data: { fill: colors.primary } }}
  />
</VictoryChart>
```

**الوقت المقدر:** 2-3 ساعات

---

### 🔵 أولوية منخفضة (ميزات إضافية - Nice to Have)

#### 9. وضع متصل/غير متصل (Online/Offline Mode)
**الملف:** `app/(driver-tabs)/index.tsx`

**المطلوب:**
```typescript
// إضافة حقل في profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS driver_is_available BOOLEAN DEFAULT true;

// Toggle في واجهة الطلبات المتاحة
const [isAvailable, setIsAvailable] = useState(true);

const toggleAvailability = async () => {
  const { error } = await supabase
    .from('profiles')
    .update({ driver_is_available: !isAvailable })
    .eq('id', user.id);
  
  if (!error) {
    setIsAvailable(!isAvailable);
  }
};

// UI Toggle
<Switch
  value={isAvailable}
  onValueChange={toggleAvailability}
  trackColor={{ false: colors.border, true: colors.success }}
/>
```

**الوقت المقدر:** 1-2 ساعة

---

#### 10. إحصائيات متقدمة (أفضل أوقات العمل، المناطق الأكثر طلباً)
**الملف:** صفحة جديدة `app/(driver-tabs)/analytics.tsx`

**المطلوب:**
```typescript
// تحليل أفضل أوقات العمل
interface HourlyEarnings {
  hour: number;
  earnings: number;
  orders_count: number;
}

const getBestWorkingHours = async () => {
  const { data } = await supabase
    .from('orders')
    .select('delivered_at, delivery_fee')
    .eq('driver_id', user.id)
    .eq('status', 'delivered');

  // تجميع حسب الساعة
  const hourlyData = Array(24).fill(0).map((_, hour) => ({
    hour,
    earnings: 0,
    orders_count: 0
  }));

  data.forEach(order => {
    const hour = new Date(order.delivered_at).getHours();
    hourlyData[hour].earnings += order.delivery_fee;
    hourlyData[hour].orders_count += 1;
  });

  return hourlyData.sort((a, b) => b.earnings - a.earnings).slice(0, 5);
};

// تحليل المناطق الأكثر طلباً
const getTopAreas = async () => {
  const { data } = await supabase
    .from('orders')
    .select(`
      id,
      delivery_fee,
      addresses!orders_delivery_address_id_fkey (city, district)
    `)
    .eq('driver_id', user.id)
    .eq('status', 'delivered');

  // تجميع حسب المنطقة
  const areaStats = {};
  data.forEach(order => {
    const area = `${order.addresses.city} - ${order.addresses.district}`;
    if (!areaStats[area]) {
      areaStats[area] = { orders: 0, earnings: 0 };
    }
    areaStats[area].orders += 1;
    areaStats[area].earnings += order.delivery_fee;
  });

  return Object.entries(areaStats)
    .sort((a, b) => b[1].orders - a[1].orders)
    .slice(0, 5);
};
```

**الوقت المقدر:** 3-4 ساعات

---

#### 11. صفحة سجل التوصيلات (History)
**الملف:** صفحة جديدة `app/(driver-tabs)/history.tsx`

**المطلوب:**
```typescript
// عرض جميع الطلبات المكتملة والملغاة
interface DeliveryHistory {
  id: string;
  order_number: string;
  status: 'delivered' | 'cancelled_by_driver';
  merchant_name: string;
  customer_name: string;
  delivery_fee: number;
  completed_at: string;
  rating?: number;
}

// فلترة حسب الحالة
const [filter, setFilter] = useState<'all' | 'delivered' | 'cancelled'>('all');

// بحث حسب رقم الطلب أو اسم العميل
const [searchQuery, setSearchQuery] = useState('');
```

**الوقت المقدر:** 2-3 ساعات

---

## 📊 ملخص الوقت المقدر

| الأولوية | العدد | الوقت الإجمالي |
|---------|-------|----------------|
| 🔴 عالية جداً | 2 | 3-5 ساعات |
| 🟡 عالية | 5 | 7-11 ساعة |
| 🟢 متوسطة | 2 | 4-6 ساعات |
| 🔵 منخفضة | 3 | 6-9 ساعات |
| **المجموع** | **12** | **20-31 ساعة** |

---

## 🎯 التوصيات

### المرحلة 1 (الأسبوع الأول):
1. ✅ خطوات التوصيل التفصيلية
2. ✅ إلغاء الطلب
3. ✅ الاتصال الفعلي
4. ✅ التكامل مع الخرائط

### المرحلة 2 (الأسبوع الثاني):
5. ✅ فلترة وترتيب الطلبات
6. ✅ حساب المسافة الفعلية
7. ✅ إحصائيات الأداء المتقدمة

### المرحلة 3 (لاحقاً):
8. رسم بياني للأرباح
9. وضع متصل/غير متصل
10. إحصائيات متقدمة
11. صفحة سجل التوصيلات

---

## 📝 ملاحظات مهمة

1. **قاعدة البيانات جاهزة بنسبة 90%** - معظم الأعمدة موجودة في `schema.sql`
2. **RLS Policies جاهزة** - السائقون يمكنهم الوصول للبيانات المطلوبة
3. **التكامل بين الأنظمة يعمل** - التاجر → السائق → العميل
4. **النظام الأساسي مكتمل وقابل للاستخدام الآن**

---

## 🚀 الخطوة التالية

اختر أحد الخيارات:
1. **البدء بالمرحلة 1** (التحسينات الأساسية)
2. **اختبار النظام الحالي** أولاً
3. **الانتقال لنظام الإشعارات** (أولوية قصوى للنظام ككل)
4. **تحسينات أخرى** حسب الأولوية
