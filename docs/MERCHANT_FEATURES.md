# 🏪 ميزات التاجر - دليل شامل

## نظرة عامة
هذا الملف يوثق جميع ميزات لوحة تحكم التاجر في التطبيق.

---

## 📋 الميزات الأساسية

### 1️⃣ لوحة التحكم (Dashboard)
**الموقع**: `app/(merchant-tabs)/index.tsx`

**المميزات**:
- إحصائيات سريعة (عدد المنتجات، الطلبات الجديدة، نسبة النجاح، الأرباح)
- إجراءات سريعة (إضافة منتج، عرض الطلبات)
- آخر الطلبات
- أداء المتجر

---

### 2️⃣ إدارة المنتجات (Products Management)
**الموقع**: `app/(merchant-tabs)/products.tsx`

**المميزات**:
- ✅ عرض جميع منتجات التاجر
- ✅ البحث والفلترة
- ✅ إضافة منتج جديد
- ✅ تعديل منتج موجود
- ✅ حذف منتج
- ✅ تفعيل/تعطيل منتج
- ✅ إدارة الكميات
- ✅ رفع صور المنتجات

**البيانات المطلوبة لكل منتج**:
```typescript
{
  id: uuid,
  merchant_id: uuid,
  name: string,
  description: string,
  price: number,
  discount_price?: number,
  quantity: number,
  category: string,
  images: string[],
  is_active: boolean,
  created_at: timestamp,
  updated_at: timestamp
}
```

---

### 3️⃣ إدارة الطلبات (Orders Management)
**الموقع**: `app/(merchant-tabs)/orders.tsx`

**المميزات**:
- عرض الطلبات الجديدة (pending)
- قبول/رفض الطلبات
- تحديث حالة الطلب (preparing, ready, delivered)
- عرض تفاصيل كل طلب
- فلترة حسب الحالة والتاريخ

**حالات الطلب**:
- `pending` - قيد الانتظار
- `accepted` - تم القبول
- `rejected` - تم الرفض
- `preparing` - قيد التحضير
- `ready` - جاهز للتوصيل
- `out_for_delivery` - في الطريق
- `delivered` - تم التوصيل

---

### 4️⃣ الإحصائيات (Analytics)
**الموقع**: `app/(merchant-tabs)/analytics.tsx`

**المميزات**:
- إجمالي المبيعات
- عدد الطلبات (يومي، أسبوعي، شهري)
- أكثر المنتجات مبيعاً
- تقييمات العملاء
- رسوم بيانية للأداء

---

## 🗄️ هيكل قاعدة البيانات

### جدول المنتجات (products)
```sql
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id uuid REFERENCES profiles(id),
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL,
  discount_price decimal(10,2),
  quantity integer DEFAULT 0,
  category text,
  images text[],
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

### جدول الطلبات (orders)
```sql
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid REFERENCES profiles(id),
  merchant_id uuid REFERENCES profiles(id),
  driver_id uuid REFERENCES profiles(id),
  status text DEFAULT 'pending',
  total_amount decimal(10,2),
  delivery_address jsonb,
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

### جدول تفاصيل الطلبات (order_items)
```sql
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid REFERENCES orders(id),
  product_id uuid REFERENCES products(id),
  quantity integer,
  price decimal(10,2),
  total decimal(10,2)
);
```

---

## 🚀 التنفيذ

سأبدأ بتنفيذ الميزات بالترتيب التالي:
1. ✅ إنشاء جداول قاعدة البيانات
2. ✅ صفحة إدارة المنتجات الكاملة
3. ✅ صفحة إضافة/تعديل منتج
4. ✅ صفحة إدارة الطلبات
5. ✅ لوحة تحكم الإحصائيات

---

## 📝 ملاحظات
- جميع الأسعار بالريال السعودي
- الصور تُخزن في Supabase Storage
- التقييمات مرتبطة بجدول reviews
- الإشعارات تُرسل عبر Firebase/Supabase Realtime
