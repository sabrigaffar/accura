# 🗺️ Geocoding API - تحويل العناوين إلى GPS

نظام تلقائي لتحويل العناوين النصية إلى إحداثيات GPS باستخدام **Nominatim API** (مجاني من OpenStreetMap).

---

## ✅ ما تم إضافته:

### 1. **`utils/geocoding.ts`**
دوال مساعدة للتعامل مع Geocoding:
- `geocodeAddress()` - تحويل عنوان → GPS
- `reverseGeocode()` - تحويل GPS → عنوان
- `isValidCoordinates()` - التحقق من صحة الإحداثيات
- `delay()` - احترام rate limit

### 2. **`hooks/useGeocoding.ts`**
React Hook للاستخدام في التطبيق:
- `geocode()` - تحويل عنوان
- `updateAddressCoordinates()` - تحديث DB
- `geocodeAndUpdate()` - تحويل وتحديث مباشرة

### 3. **`scripts/geocode-addresses.ts`**
أداة لتحديث العناوين الموجودة بدون GPS:
- جلب جميع العناوين بدون إحداثيات
- تحويلها تلقائياً
- تحديث قاعدة البيانات

---

## 🚀 كيفية الاستخدام:

### **1. في التطبيق (React Native):**

```tsx
import { useGeocoding } from '@/hooks/useGeocoding';

function AddressForm() {
  const { geocodeAndUpdate, loading, error } = useGeocoding();

  const handleSaveAddress = async (addressId: string, address: string) => {
    const success = await geocodeAndUpdate(addressId, address, 'مصر');
    
    if (success) {
      Alert.alert('✅ تم الحفظ', 'تم إضافة الموقع بنجاح');
    } else {
      Alert.alert('⚠️ تنبيه', error || 'فشل تحديد الموقع');
    }
  };

  return (
    // UI...
  );
}
```

### **2. تحديث العناوين الموجودة:**

```bash
# من terminal
cd project
npm run geocode-addresses
```

أو يدوياً:
```typescript
import { geocodeAllAddresses } from './scripts/geocode-addresses';

await geocodeAllAddresses();
```

### **3. استخدام مباشر:**

```typescript
import { geocodeAddress } from '@/utils/geocoding';

const result = await geocodeAddress('أرض الجمارك، مركز بدر، البحيرة، مصر');

if (result) {
  console.log(`📍 GPS: ${result.latitude}, ${result.longitude}`);
}
```

---

## 🔧 Nominatim API:

### **المميزات:**
- ✅ **مجاني 100%**
- ✅ بدون API Key
- ✅ يدعم العربية
- ✅ دقة جيدة
- ✅ عالمي (جميع الدول)

### **القيود:**
- ⏱️ **Rate Limit:** طلب واحد كل ثانية
- 📏 **Usage Policy:** يجب احترام سياسة الاستخدام
- 🔄 **Caching:** احفظ النتائج ولا تكرر الطلبات

### **البدائل المدفوعة:**
- Google Geocoding API ($5 per 1000 requests)
- Mapbox Geocoding ($0.50 per 1000 requests)
- Here Geocoding (مدفوع)

---

## 📊 أمثلة:

### **مثال 1: تحويل عنوان عند الإنشاء**

```typescript
// عند إنشاء عنوان جديد
const createAddress = async (data: AddressData) => {
  // 1. حفظ العنوان أولاً
  const { data: address, error } = await supabase
    .from('addresses')
    .insert({
      street_address: data.street,
      city: data.city,
      district: data.district,
    })
    .select()
    .single();

  if (error || !address) return;

  // 2. تحويل إلى GPS تلقائياً
  const fullAddress = `${data.street}, ${data.district}, ${data.city}`;
  const gps = await geocodeAddress(fullAddress, 'مصر');

  // 3. تحديث الإحداثيات
  if (gps) {
    await supabase
      .from('addresses')
      .update({
        latitude: gps.latitude,
        longitude: gps.longitude,
      })
      .eq('id', address.id);
  }
};
```

### **مثال 2: Reverse Geocoding**

```typescript
// تحويل GPS إلى عنوان
import { reverseGeocode } from '@/utils/geocoding';

const location = await reverseGeocode(24.7136, 46.6753);
console.log(location); // "مركز بدر، محافظة البحيرة، مصر"
```

### **مثال 3: التحقق من الإحداثيات**

```typescript
import { isValidCoordinates } from '@/utils/geocoding';

if (isValidCoordinates(lat, lng)) {
  // الإحداثيات صحيحة
} else {
  // الإحداثيات خاطئة
}
```

---

## ⚠️ ملاحظات مهمة:

### **1. Rate Limiting:**
```typescript
// احترام rate limit (1 request/second)
for (const address of addresses) {
  await geocodeAddress(address);
  await delay(1000); // انتظار ثانية
}
```

### **2. Error Handling:**
```typescript
const result = await geocodeAddress(address);

if (!result) {
  // لم يتم العثور على نتائج
  // يمكن طلب من المستخدم إدخال GPS يدوياً
  console.warn('No results found');
}
```

### **3. Cache Results:**
```typescript
// احفظ النتائج في قاعدة البيانات
// لا تعيد الطلب للعنوان نفسه
if (address.latitude && address.longitude) {
  return; // already geocoded
}
```

---

## 🔄 تحديث تلقائي عند إضافة عنوان:

يمكن إضافة Trigger في Supabase:

```sql
-- Trigger تلقائي (يحتاج Edge Function)
CREATE OR REPLACE FUNCTION trigger_geocode_address()
RETURNS TRIGGER AS $$
BEGIN
  -- إذا كان العنوان جديد بدون GPS
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    -- استدعاء Edge Function للتحويل
    PERFORM net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/geocode',
      body := jsonb_build_object('address_id', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_address_insert
  AFTER INSERT ON addresses
  FOR EACH ROW
  EXECUTE FUNCTION trigger_geocode_address();
```

---

## 📝 الخلاصة:

| الميزة | الحالة |
|--------|--------|
| **Geocoding Utility** | ✅ جاهز |
| **React Hook** | ✅ جاهز |
| **Batch Tool** | ✅ جاهز |
| **مجاني** | ✅ نعم |
| **يدعم العربية** | ✅ نعم |
| **دقة عالية** | ✅ جيد |

**الآن يمكنك تحويل أي عنوان إلى GPS تلقائياً! 🎉**
