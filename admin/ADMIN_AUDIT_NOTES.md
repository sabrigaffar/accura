# ملاحظات تدقيق لوحة تحكم الأدمن (Admin Audit Notes)

هذه المذكرة توثق مراجعة شاملة لملفات قسم الأدمن، الملاحظات والمشاكل الموجودة حالياً، والأعمال المقترحة لتكامل كامل مع العملاء/التجار/السائقين والإعلانات المموّلة.

## خلاصة سريعة (أهم النقاط)
- __إعدادات Supabase في تطبيق الأدمن__: الملف `admin/src/lib/supabase.ts` يستخدم قيم افتراضية `YOUR_SUPABASE_URL` و`YOUR_ANON_KEY`. بدون إعداد متغيرات البيئة `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` لن يعمل الجلب في صفحات الأدمن (سبب رئيسي لعدم ظهور التجار/السائقين/العملاء).
- __سياسات RLS__: يجب السماح لمستخدم من نوع `admin` بالقراءة/التعديل لجداول رئيسية (profiles, merchants, driver_profiles, orders, sponsored_ads, wallets, wallet_transactions, platform_settings, platform_ad_settings, app_settings). غياب هذه السياسات يؤدي إلى نتائج فارغة.
- __لوحة البيانات (Dashboard)__:
  - لا تعرض عدد الإعلانات المموّلة الكلي ولا عدد الطلبات المعلقة. 
  - الرسوم البيانية تعتمد على Views غير موجودة (`v_orders_monthly`, `v_users_monthly`, `v_user_types_distribution`, `v_merchants_categories`). يجب إنشاؤها بمigration.
- __الصفحات: Users / Merchants / Drivers__ تعمل عبر Hooks لكن قد تُرجع صفراً بسبب (1) إعدادات Supabase غير صحيحة، أو (2) RLS تمنع القراءة. 
- __SettingsPage__: تحفظ في `platform_settings` و`app_settings`. تأكد من وجود الجداول وسياسات RLS. كثير من الإعدادات UI فقط وغير موصولة بسلوك النظام (مثلاً الإشعارات).
- __SponsoredAdsPage__: جيدة إجمالاً (approve/reject موجودة كـ RPC). ينقص تكامل عدادات عامة وفلترة إضافية. 
- __AdminWalletPage__: يعتمد على Query مباشر وقد تمنع RLS إنشاء/قراءة المحفظة. ينقص عرض معاملات `ad_payment`/`ad_refund` الخاصة بالإعلانات.

---

## ملاحظات تفصيلية حسب الملفات

### 1) `admin/src/lib/supabase.ts`
- __مشكلة__: استخدام قيم افتراضية بدل متغيرات البيئة:
  ```ts
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';
  ```
  هذا يمنع الاتصال الصحيح.
- __حل مقترح__:
  - ضبط ملف `.env` الخاص بتطبيق الأدمن:
    ```env
    VITE_SUPABASE_URL=... 
    VITE_SUPABASE_ANON_KEY=...
    ```
  - تجنب استخدام Service Key في المتصفح. إن احتجنا صلاحيات أعلى، نضبط RLS للسماح لمستخدم `admin` (من profiles) بالوصول.

### 2) `admin/src/contexts/AuthContext.tsx`
- يتحقق من أن المستخدم Admin ويُخرج غير ذلك. ممتاز.
- __مهم__: تأكد أن سياسات RLS مبنية على `profiles.user_type='admin'` للسماح للمدير بالقراءة على باقي الجداول.

### 3) `admin/src/hooks/useSupabaseData.ts`
- `useUsers`: يجلب من `profiles`. يعمل، لكن سياسات RLS قد تمنع. 
- `useOrders`: يجلب من `orders`. يعمل، لكن RLS أيضاً.
- `useMerchants`: يجلب من `merchants` بدون Join. البحث على `owner_id` متاح. إن رغبت بإظهار اسم المالك أضف Join إلى `profiles`.
- `useDrivers`:
  - يستخدم Select مع علاقة `profiles(full_name, phone_number)` ويقوم بالفلترة على `profiles.is_active`. يُفضل استخدام `profiles!inner` لضمان فلترة صحيحة:
    ```ts
    .select('*, profiles!inner(is_active, full_name, phone_number)')
    .eq('profiles.is_active', isActive)
    ```
- `useDashboardStats`:
  - يحسب: totalUsers, totalOrders, totalMerchants, totalDrivers, totalRevenue.
  - __نواقص__: لا يحسب `pendingOrders` ولا `totalSponsoredAds`/`pendingAdsCount`.
  - __أداء__: جمع الإيراد يتم بجلب كل `orders.total` للعميل ثم التجميع. الأفضل إنشاء View أو RPC `get_total_revenue()`.
- `useDashboardCharts`:
  - يعتمد على Views غير موجودة: `v_orders_monthly`, `v_users_monthly`, `v_user_types_distribution`, `v_merchants_categories`.
  - __حل__: إنشاؤها بمigration (انظر قسم الـ SQL أدناه).

### 4) `admin/src/pages/DashboardPage.tsx`
- يعرض بطاقات إحصائية ورسوم. 
- يوجد استدعاء `fetchPendingAds()` ويعرض صندوق تنبيه لعدد الإعلانات المعلقة (جيد).
- __نقائص مرئية__: لا توجد بطاقات لعدد الإعلانات المموّلة (الكلي)، ولا لعدد الطلبات المعلقة. 
- __مقترح__:
  - إضافة حقول في Hook: `totalSponsoredAds`, `pendingOrders`.
  - عرضها كبطاقتين جديدتين بجوار البطاقات الحالية.

### 5) `admin/src/pages/SponsoredAdsPage.tsx`
- يجلب إعلانات حسب `approval_status` مع Inner join على `merchants(name_ar)`، ويستدعي RPCs `approve_ad` و`reject_ad`.
- __مقترحات__:
  - إضافة تبويب "All" لعرض الكل مع فلاتر (نوع الإعلان/تاريخ/متجر/حالة النشاط).
  - عرض ملخص الإنفاق `total_spent` و ROI من `get_ad_analytics` للفترة المختارة.

### 6) `admin/src/pages/MerchantsPage.tsx`
- يعتمد على `useMerchants`. 
- __تحسينات__:
  - إظهار اسم المالك عبر Join (اختياري).
  - تنفيذ الأوامر الجماعية (تفعيل/تعطيل) عبر Update فعلي على DB بدلاً من placeholder.

### 7) `admin/src/pages/DriversPage.tsx`
- مشابه لـ MerchantsPage. 
- __ملاحظة__: فلترة الحالة والمتصل تعتمد على حقول في `driver_profiles`. تأكد من وجودها وتماسكها.

### 8) `admin/src/pages/UsersPage.tsx`
- يعمل على `profiles`. 
- __ملاحظة__: حرارة التصميم جيدة. تأكد من RLS.

### 9) `admin/src/pages/OrdersPage.tsx`
- يعتمد على `useOrders`.
- __مقترح__: إضافة شارة أعلى الصفحة لعدد الطلبات المعلقة (pending) وربطها بفلتر سريع.

### 10) `admin/src/pages/SettingsPage.tsx`
- يستخدم جداول: `platform_settings` (id=1) و`app_settings` (id='global').
- __تأكد__ من وجود الجداول وRLS.
- __مقترح__: ربط الإعدادات بسلوك فعلي (مثلاً: `email_notifications` يوقف إرسال الإيميلات؛ `push_notifications` يوقف إشعارات FCM)، عبر دوال أو Webhooks/Edge Functions.

### 11) `admin/src/pages/AdminWalletPage.tsx`
- ينشئ محفظة Admin إذا لم توجد ويحمل معاملات. قد تفشل بسبب RLS.
- __مقترح__:
  - إنشاء RPC `get_admin_wallet_overview()` (SECURITY DEFINER) تُعيد الرصيد والمعاملات (مع تصفية تشمل `ad_payment`, `ad_refund`).
  - توسيع فلاتر الواجهة لتشمل `ad_payment`/`ad_refund` لأنهما خاصتان بإعلانات ممولة.

### 12) `admin/src/layouts/DashboardLayout.tsx`
- يستخدم روابط `<a href>`؛ يفضل `<Link>` من `react-router-dom` لتفادي إعادة التحميل الكاملة (تحسين UX).

---

## أعمال قاعدة البيانات (مقترحات SQL)

### أ) Views مطلوبة للرسوم البيانية
- `v_orders_monthly`:
```sql
CREATE OR REPLACE VIEW v_orders_monthly AS
SELECT date_trunc('month', created_at) AS month,
       COUNT(*) AS orders,
       COALESCE(SUM(total),0) AS revenue
FROM orders
GROUP BY 1
ORDER BY 1;
```
- `v_users_monthly`:
```sql
CREATE OR REPLACE VIEW v_users_monthly AS
SELECT date_trunc('month', created_at) AS month,
       COUNT(*) FILTER (WHERE user_type='customer') AS customers,
       COUNT(*) FILTER (WHERE user_type='merchant') AS merchants,
       COUNT(*) FILTER (WHERE user_type='driver')   AS drivers,
       COUNT(*) FILTER (WHERE user_type='admin')    AS admins
FROM profiles
GROUP BY 1
ORDER BY 1;
```
- `v_user_types_distribution`:
```sql
CREATE OR REPLACE VIEW v_user_types_distribution AS
SELECT user_type, COUNT(*) AS count
FROM profiles
GROUP BY user_type;
```
- `v_merchants_categories`:
```sql
CREATE OR REPLACE VIEW v_merchants_categories AS
SELECT category, COUNT(*) AS count
FROM merchants
GROUP BY category;
```

### ب) RPC موحّد لإحصائيات لوحة التحكم
لتحسين الأداء وتقليل الطلبات من المتصفح:
```sql
CREATE OR REPLACE FUNCTION get_admin_overview()
RETURNS TABLE (
  total_users int,
  total_orders int,
  total_merchants int,
  total_drivers int,
  total_revenue numeric,
  total_sponsored_ads int,
  pending_orders int,
  pending_ads int
) AS $$
BEGIN
  SELECT COUNT(*) INTO total_users FROM profiles;
  SELECT COUNT(*) INTO total_orders FROM orders;
  SELECT COUNT(*) INTO total_merchants FROM merchants;
  SELECT COUNT(*) INTO total_drivers FROM driver_profiles;
  SELECT COALESCE(SUM(total),0) INTO total_revenue FROM orders;
  SELECT COUNT(*) INTO total_sponsored_ads FROM sponsored_ads;
  SELECT COUNT(*) INTO pending_orders FROM orders WHERE status='pending';
  SELECT COUNT(*) INTO pending_ads FROM sponsored_ads WHERE approval_status='pending';
  RETURN QUERY SELECT total_users, total_orders, total_merchants, total_drivers, total_revenue, total_sponsored_ads, pending_orders, pending_ads;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public;
GRANT EXECUTE ON FUNCTION get_admin_overview() TO authenticated;
```

### ج) سياسات RLS للأدمن (أمثلة)
لجدول `merchants` (كرّر الأنماط على باقي الجداول بما يناسب):
```sql
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='merchants' AND policyname='admin_select_merchants'
  ) THEN
    CREATE POLICY admin_select_merchants ON merchants FOR SELECT TO authenticated
      USING (EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type='admin'));
  END IF;
END $$;
```
طبّق نفس النهج على: `profiles`, `driver_profiles`, `orders`, `sponsored_ads`, `wallets`, `wallet_transactions`, `platform_settings`, `platform_ad_settings`, `app_settings` (مع سياسات UPDATE/INSERT محدّدة للكيانات الإدارية فقط عند الحاجة).

### د) جداول الإعدادات
تأكد من وجود الجداول المشار إليها:
- `platform_settings` (id=1, service_fee_flat, driver_commission_per_km, ...)
- `app_settings` (id='global', email_notifications, push_notifications, ...)
- `platform_ad_settings` (id ثابت: '00000000-0000-0000-0000-000000000001', cost_per_click, cost_per_impression, قيود الميزانية).

---

## تحسينات واجهة لوحة التحكم

- __Dashboard__:
  - إضافة بطاقات: "الإعلانات المموّلة" (إجمالي)، "الطلبات المعلقة".
  - استبدال التجميعات client-side باستدعاء `get_admin_overview()`.
  - تفعيل الرسوم باستحداث الـ Views.

- __Users/Merchants/Drivers__:
  - معالجة RLS.
  - تحسين الـ Joins لإظهار معلومات إضافية (مثل اسم مالك المتجر).
  - تفعيل الأوامر الجماعية (تفعيل/تعطيل) لتكتب على DB مع إشعارات نجاح/فشل.

- __SponsoredAds__:
  - تبويب "الكل" + فلاتر تاريخ/نوع/متجر.
  - عرض إنفاق وROI للفترة عبر `get_ad_analytics`.

- __Settings__:
  - ربط الإعدادات بسلوك فعلي (إيقاف/تشغيل الإشعارات/الإيميلات)، وإظهار حالة اتصال/مزود الخدمة.

- __Admin Wallet__:
  - قراءة عبر RPC آمن.
  - إضافة فلاتر `ad_payment` و`ad_refund`.

- __الترويسة/القائمة__:
  - استخدام `<Link>` بدلاً من `<a>` لسرعة التنقل داخل SPA.

---

## أسباب محتملة لعدم ظهور البيانات وكيفية معالجتها
- __بيئة Supabase غير مضبوطة في تطبيق الأدمن__: عالجها بإعداد `.env`.
- __RLS تمنع القراءة__: أضف سياسات تسمح للأدمن.
- __Views غير موجودة__: أنشئها حسب SQL أعلاه.
- __الانضمامات (Joins) في السائقين__: استخدم `profiles!inner` عند الحاجة للتصفية على الحقول المتداخلة.

---

## خطة تنفيذ مختصرة (Sprint)
1) إعداد `.env` لتطبيق الأدمن.
2) إضافة سياسات RLS للأدمن على الجداول المذكورة.
3) إنشاء الـ Views الأربع للرسوم.
4) إضافة RPC `get_admin_overview()` واستبدال الـ Stats به.
5) توسيع Dashboard لعرض: إجمالي الإعلانات المموّلة + الطلبات المعلقة.
6) إصلاح `useDrivers` بفلترة `profiles.is_active` عبر `profiles!inner`.
7) AdminWallet: إضافة فلاتر `ad_payment`/`ad_refund` أو إنشاء RPC.
8) Settings: تأكيد وجود الجداول وتفعيل السلوك المرتبط بالإعدادات.

---

هذه المذكرة تغطي الملاحظات البنيوية والعملية. عند الموافقة، يمكنني البدء بتنفيذ البنود تدريجياً (مigrations + تعديلات الواجهة + سياسات RLS) مع اختبارات لكل خطوة.
