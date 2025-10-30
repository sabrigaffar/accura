# 📍 دليل المسافة ورسوم التوصيل
# Distance & Delivery Fee Guide

## 🎯 الغرض من هذا الدليل

هذا الدليل يوضح:
1. **الوضع الحالي**: كيف تعمل رسوم التوصيل الآن
2. **التحسين المستقبلي**: كيف يمكن حساب المسافة تلقائياً
3. **رسوم ديناميكية**: رسوم توصيل حسب المسافة

---

## 📊 الوضع الحالي (Current Status)

### ❌ المشكلة:
```
التاجر لا يعرف المسافة بين متجره والعميل
↓
رسوم التوصيل ثابتة لجميع العملاء
```

### كيف يعمل النظام الآن:

```typescript
// التاجر يضع رسوماً ثابتة
delivery_fee: 10 جنيه

// جميع العملاء يدفعون نفس المبلغ
العميل قريب (1 كم) → 10 جنيه
العميل متوسط (5 كم) → 10 جنيه
العميل بعيد (15 كم) → 10 جنيه
```

### ⚠️ المشكلة:
- العميل القريب يدفع كثيراً
- العميل البعيد لا يدفع كفاية
- التاجر قد يخسر أحياناً

---

## 💡 كيف يحدد التاجر الرسوم حالياً؟

### الطريقة الحالية (تقديرية):

التاجر يعتمد على:

#### 1. **الخبرة السابقة**
```
مثال:
- معظم عملائي في دائرة 5 كم
- تكلفة السائق للمسافة المتوسطة: 7 جنيه
- أضيف هامش ربح: 3 جنيه
- رسوم التوصيل = 10 جنيه
```

#### 2. **متوسط المنطقة**
```
إذا كان المتجر في:
- وسط المدينة → معظم العملاء قريبين → رسوم قليلة (5-7 جنيه)
- ضواحي المدينة → العملاء بعيدين → رسوم أعلى (15-20 جنيه)
```

#### 3. **المنافسة**
```
المتاجر المنافسة رسومها:
متجر أ: 8 جنيه
متجر ب: 12 جنيه
متجر ج: 10 جنيه
↓
التاجر يختار: 10 جنيه (متوسط تنافسي)
```

#### 4. **استراتيجية التسويق**
```
- توصيل مجاني → 0 جنيه (لجذب عملاء جدد)
- رسوم منخفضة → 5 جنيه (للمنافسة)
- رسوم عادية → 10-15 جنيه (لتغطية التكاليف)
```

---

## 🚀 الحل المستقبلي: رسوم ديناميكية حسب المسافة

### كيف يمكن حساب المسافة؟

#### 1. **استخدام GPS**

```typescript
// مثال بسيط
interface Location {
  latitude: number;
  longitude: number;
}

// موقع المتجر (محفوظ في قاعدة البيانات)
const storeLocation: Location = {
  latitude: 24.7136,
  longitude: 46.6753
};

// موقع العميل (من GPS الهاتف)
const customerLocation: Location = {
  latitude: 24.7500,
  longitude: 46.7000
};

// حساب المسافة بين نقطتين
function calculateDistance(
  store: Location, 
  customer: Location
): number {
  const R = 6371; // نصف قطر الأرض بالكيلومتر
  
  const lat1 = store.latitude * Math.PI / 180;
  const lat2 = customer.latitude * Math.PI / 180;
  const deltaLat = (customer.latitude - store.latitude) * Math.PI / 180;
  const deltaLon = (customer.longitude - store.longitude) * Math.PI / 180;

  const a = 
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // المسافة بالكيلومتر
  
  return distance;
}

// مثال
const distance = calculateDistance(storeLocation, customerLocation);
console.log(`المسافة: ${distance.toFixed(2)} كم`);
// النتيجة: المسافة: 5.34 كم
```

#### 2. **استخدام Google Maps API**

```typescript
import * as Location from 'expo-location';

async function getDistance(
  storeAddress: string,
  customerAddress: string
): Promise<number> {
  // استخدام Google Distance Matrix API
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?` +
    `origins=${storeAddress}&` +
    `destinations=${customerAddress}&` +
    `key=YOUR_API_KEY`
  );
  
  const data = await response.json();
  const distanceInMeters = data.rows[0].elements[0].distance.value;
  const distanceInKm = distanceInMeters / 1000;
  
  return distanceInKm;
}
```

---

## 💰 رسوم توصيل ديناميكية

### استراتيجية 1: **رسوم بسيطة حسب المسافة**

```typescript
function calculateDeliveryFee(distance: number): number {
  if (distance <= 3) {
    return 5; // قريب جداً
  } else if (distance <= 7) {
    return 10; // متوسط
  } else if (distance <= 15) {
    return 15; // بعيد
  } else {
    return 20; // بعيد جداً
  }
}

// أمثلة
calculateDeliveryFee(2);   // → 5 جنيه
calculateDeliveryFee(5);   // → 10 جنيه
calculateDeliveryFee(10);  // → 15 جنيه
calculateDeliveryFee(20);  // → 20 جنيه
```

### استراتيجية 2: **رسوم تصاعدية**

```typescript
function calculateDeliveryFee(distance: number): number {
  const baseFee = 5; // رسوم أساسية
  const perKm = 1.5; // رسوم لكل كيلومتر إضافي
  const freeDistance = 2; // أول 2 كم مجاناً
  
  if (distance <= freeDistance) {
    return baseFee;
  }
  
  const extraDistance = distance - freeDistance;
  const totalFee = baseFee + (extraDistance * perKm);
  
  return Math.ceil(totalFee); // تقريب لأعلى
}

// أمثلة
calculateDeliveryFee(1);   // → 5 جنيه (رسوم أساسية)
calculateDeliveryFee(3);   // → 7 جنيه (5 + 1.5)
calculateDeliveryFee(5);   // → 10 جنيه (5 + 4.5)
calculateDeliveryFee(10);  // → 17 جنيه (5 + 12)
```

### استراتيجية 3: **رسوم بحد أقصى**

```typescript
function calculateDeliveryFee(distance: number): number {
  const baseFee = 5;
  const perKm = 2;
  const maxFee = 25; // حد أقصى للرسوم
  
  const calculatedFee = baseFee + (distance * perKm);
  
  return Math.min(calculatedFee, maxFee);
}

// أمثلة
calculateDeliveryFee(2);   // → 9 جنيه
calculateDeliveryFee(5);   // → 15 جنيه
calculateDeliveryFee(10);  // → 25 جنيه (الحد الأقصى)
calculateDeliveryFee(20);  // → 25 جنيه (الحد الأقصى)
```

### استراتيجية 4: **رسوم ذكية (Smart)**

```typescript
function calculateDeliveryFee(
  distance: number,
  orderAmount: number,
  isRushHour: boolean
): number {
  let fee = 0;
  
  // 1. حساب حسب المسافة
  if (distance <= 3) fee = 5;
  else if (distance <= 7) fee = 10;
  else if (distance <= 15) fee = 15;
  else fee = 20;
  
  // 2. توصيل مجاني للطلبات الكبيرة
  if (orderAmount >= 200) {
    return 0; // توصيل مجاني
  }
  
  // 3. خصم للطلبات المتوسطة
  if (orderAmount >= 100) {
    fee = fee * 0.5; // خصم 50%
  }
  
  // 4. رسوم إضافية في أوقات الذروة
  if (isRushHour) {
    fee = fee * 1.3; // زيادة 30%
  }
  
  return Math.ceil(fee);
}

// أمثلة
calculateDeliveryFee(5, 50, false);   // → 10 جنيه
calculateDeliveryFee(5, 150, false);  // → 5 جنيه (خصم 50%)
calculateDeliveryFee(5, 250, false);  // → 0 جنيه (مجاني)
calculateDeliveryFee(5, 50, true);    // → 13 جنيه (ذروة)
```

---

## 🎯 كيف يمكن تطبيق هذا؟

### المرحلة 1: **إضافة موقع المتجر**

```typescript
// في merchant-profile.tsx
interface MerchantProfile {
  // ... الحقول الموجودة
  latitude?: number;
  longitude?: number;
  delivery_radius?: number; // نطاق التوصيل بالكيلومتر
}

// السماح للتاجر بتحديد موقعه
const pickStoreLocation = async () => {
  const location = await Location.getCurrentPositionAsync({});
  
  await supabase
    .from('merchants')
    .update({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    })
    .eq('id', merchantId);
};
```

### المرحلة 2: **حساب المسافة عند الطلب**

```typescript
// في checkout أو order creation
const calculateOrderTotal = async (
  storeId: string,
  customerAddress: Location
) => {
  // 1. جلب موقع المتجر
  const { data: store } = await supabase
    .from('merchants')
    .select('latitude, longitude')
    .eq('id', storeId)
    .single();
  
  // 2. حساب المسافة
  const distance = calculateDistance(
    { latitude: store.latitude, longitude: store.longitude },
    customerAddress
  );
  
  // 3. حساب رسوم التوصيل
  const deliveryFee = calculateDeliveryFee(distance);
  
  // 4. حساب الإجمالي
  const productsTotal = cart.reduce((sum, item) => sum + item.price, 0);
  const total = productsTotal + deliveryFee;
  
  return { productsTotal, deliveryFee, total, distance };
};
```

### المرحلة 3: **عرض المسافة ورسوم التوصيل للعميل**

```tsx
// في صفحة المتجر أو checkout
<View style={styles.deliveryInfo}>
  <MapPin size={16} color={colors.primary} />
  <Text style={styles.distance}>
    على بُعد {distance.toFixed(1)} كم منك
  </Text>
  <Text style={styles.fee}>
    رسوم التوصيل: {deliveryFee} {currency}
  </Text>
</View>

// مثال:
// 🗺️ على بُعد 3.5 كم منك
// رسوم التوصيل: 10 جنيه
```

---

## 📱 تجربة المستخدم المحسّنة

### للعميل:

```
┌─────────────────────────────────┐
│     🏪 متجر البقالة            │
│  ⭐⭐⭐⭐⭐ 4.5 (120)         │
├─────────────────────────────────┤
│  📍 على بُعد 2.3 كم منك       │
│  🚚 رسوم التوصيل: 5 جنيه      │
│  ⏱️ متوسط التوصيل: 20 دقيقة   │
│                                 │
│  💡 اطلب بـ 50 جنيه إضافية    │
│     واحصل على توصيل مجاني!    │
└─────────────────────────────────┘
```

### للتاجر:

```
┌─────────────────────────────────┐
│  📊 إعدادات رسوم التوصيل      │
├─────────────────────────────────┤
│  📍 موقع المتجر:               │
│     [تحديد الموقع]  ✓ محدد    │
│                                 │
│  💰 استراتيجية الرسوم:         │
│     ○ ثابتة (الوضع الحالي)    │
│     ● حسب المسافة              │
│     ○ ذكية (متقدم)             │
│                                 │
│  📏 نطاق التوصيل:              │
│     [⚫━━━━━━━○━━] 10 كم       │
│                                 │
│  💵 رسوم حسب المسافة:          │
│     0-3 كم:   5 جنيه           │
│     3-7 كم:   10 جنيه          │
│     7-15 كم:  15 جنيه          │
│     +15 كم:   لا يوصل          │
└─────────────────────────────────┘
```

---

## 🔧 الكود المقترح للتطبيق

### 1. إضافة جدول إعدادات التوصيل

```sql
CREATE TABLE delivery_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  
  -- نوع الرسوم
  fee_type TEXT CHECK (fee_type IN ('fixed', 'distance', 'smart')),
  
  -- رسوم ثابتة
  fixed_fee NUMERIC DEFAULT 0,
  
  -- رسوم حسب المسافة
  base_fee NUMERIC DEFAULT 5,
  per_km_fee NUMERIC DEFAULT 1.5,
  max_fee NUMERIC DEFAULT 25,
  
  -- نطاق التوصيل
  max_delivery_distance NUMERIC DEFAULT 15,
  
  -- توصيل مجاني
  free_delivery_above NUMERIC, -- إذا كان الطلب أكبر من هذا المبلغ
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 2. دالة حساب رسوم التوصيل

```typescript
// lib/deliveryFeeCalculator.ts
export interface DeliverySettings {
  feeType: 'fixed' | 'distance' | 'smart';
  fixedFee: number;
  baseFee: number;
  perKmFee: number;
  maxFee: number;
  maxDeliveryDistance: number;
  freeDeliveryAbove?: number;
}

export const calculateDeliveryFee = (
  distance: number,
  orderAmount: number,
  settings: DeliverySettings
): { fee: number; canDeliver: boolean } => {
  // تحقق من نطاق التوصيل
  if (distance > settings.maxDeliveryDistance) {
    return { fee: 0, canDeliver: false };
  }
  
  // توصيل مجاني للطلبات الكبيرة
  if (settings.freeDeliveryAbove && orderAmount >= settings.freeDeliveryAbove) {
    return { fee: 0, canDeliver: true };
  }
  
  let fee = 0;
  
  switch (settings.feeType) {
    case 'fixed':
      fee = settings.fixedFee;
      break;
      
    case 'distance':
      fee = settings.baseFee + (distance * settings.perKmFee);
      fee = Math.min(fee, settings.maxFee);
      break;
      
    case 'smart':
      // منطق ذكي مخصص
      fee = smartCalculation(distance, orderAmount, settings);
      break;
  }
  
  return { fee: Math.ceil(fee), canDeliver: true };
};

function smartCalculation(
  distance: number,
  orderAmount: number,
  settings: DeliverySettings
): number {
  let fee = settings.baseFee + (distance * settings.perKmFee);
  
  // خصم للطلبات المتوسطة
  if (orderAmount >= 100) {
    fee = fee * 0.7; // خصم 30%
  }
  
  return Math.min(fee, settings.maxFee);
}
```

---

## ✅ الخلاصة

### 🔴 الوضع الحالي:
- رسوم توصيل **ثابتة** لجميع العملاء
- التاجر **لا يعرف** المسافة
- يعتمد على **التقدير** والخبرة

### 🟢 الحل المستقبلي:
- حساب المسافة **تلقائياً** باستخدام GPS
- رسوم **ديناميكية** حسب المسافة
- **توصيل مجاني** للطلبات الكبيرة
- **عدالة** للعميل والتاجر

### 📊 الفوائد:

**للعميل:**
- ✅ رسوم عادلة حسب المسافة
- ✅ يعرف التكلفة قبل الطلب
- ✅ حافز للطلبات الكبيرة

**للتاجر:**
- ✅ تغطية تكاليف التوصيل الحقيقية
- ✅ عدم خسارة في التوصيل البعيد
- ✅ جذب المزيد من العملاء بالعدالة

---

## 🚀 الخطوات التالية

إذا أردت تطبيق هذا:

1. **إضافة موقع المتجر** في قاعدة البيانات
2. **طلب إذن GPS** من المستخدم
3. **حساب المسافة** عند عرض المتجر
4. **إضافة إعدادات الرسوم** للتاجر
5. **تحديث واجهة المستخدم** لعرض المسافة

**هل تريد أن أبدأ بتطبيق هذا؟** 🎯
