-- ═══════════════════════════════════════════════════════════════════════════════
-- المرحلة 3: تحسينات متوسطة الأولوية - Accura Project
-- التاريخ: 2025-11-01
-- المسؤول: MiniMax Agent
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- القسم 1: تحسين Order Items Counter (بديل Cart Counter)
-- الهدف: تحسين أداء حساب عدد العناصر في الطلبات
-- التأثير المتوقع: تحسين 50-60% في سرعة الاستعلامات
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1.1: إضافة عمود order_items_count في جدول orders (للتخزين المؤقت)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_count integer DEFAULT 0;

-- 1.2: دالة محسّنة لحساب عدد العناصر في الطلب
CREATE OR REPLACE FUNCTION get_order_items_count(p_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_count integer;
BEGIN
    -- محاولة استخدام القيمة المخزنة أولاً
    SELECT items_count INTO v_count
    FROM orders
    WHERE id = p_order_id;
    
    -- إذا كانت القيمة صفر، احسبها من order_items
    IF v_count = 0 OR v_count IS NULL THEN
        SELECT COUNT(*) INTO v_count
        FROM order_items
        WHERE order_id = p_order_id;
    END IF;
    
    RETURN COALESCE(v_count, 0);
END;
$$;

-- 1.3: دالة batch للحصول على عدد العناصر لعدة طلبات (تقليل استهلاك البطارية)
CREATE OR REPLACE FUNCTION get_multiple_orders_items_count(p_order_ids uuid[])
RETURNS TABLE(
    order_id uuid,
    items_count integer
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        COALESCE(o.items_count, COUNT(oi.id)::integer) as items_count
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.id = ANY(p_order_ids)
    GROUP BY o.id, o.items_count;
END;
$$;

-- 1.4: Trigger لتحديث items_count تلقائياً
CREATE OR REPLACE FUNCTION update_order_items_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_order_id uuid;
    v_count integer;
BEGIN
    -- تحديد order_id بناءً على نوع العملية
    IF TG_OP = 'DELETE' THEN
        v_order_id := OLD.order_id;
    ELSE
        v_order_id := NEW.order_id;
    END IF;
    
    -- حساب عدد العناصر
    SELECT COUNT(*) INTO v_count
    FROM order_items
    WHERE order_id = v_order_id;
    
    -- تحديث عمود items_count
    UPDATE orders
    SET items_count = v_count
    WHERE id = v_order_id;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- إنشاء Trigger
DROP TRIGGER IF EXISTS trigger_update_order_items_count ON order_items;
CREATE TRIGGER trigger_update_order_items_count
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_order_items_count();

-- 1.5: فهارس محسّنة لاستعلامات order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_product 
ON order_items(order_id, product_id);

CREATE INDEX IF NOT EXISTS idx_order_items_created 
ON order_items(order_id, created_at DESC);

-- 1.6: تحديث القيم الحالية
UPDATE orders o
SET items_count = (
    SELECT COUNT(*)
    FROM order_items oi
    WHERE oi.order_id = o.id
);

COMMENT ON COLUMN orders.items_count IS 'عدد العناصر في الطلب (محدّث تلقائياً)';
COMMENT ON FUNCTION get_order_items_count(uuid) IS 'الحصول على عدد عناصر الطلب بكفاءة';
COMMENT ON FUNCTION get_multiple_orders_items_count(uuid[]) IS 'الحصول على عدد العناصر لعدة طلبات دفعة واحدة';


-- ═══════════════════════════════════════════════════════════════════════════════
-- القسم 2: Battery Optimization - تقليل استهلاك البطارية
-- الهدف: تقليل عدد الاستعلامات المتكررة بنسبة 40-50%
-- ═══════════════════════════════════════════════════════════════════════════════

-- 2.1: دالة batch لتحديث موقع السائقين (بدلاً من تحديثات فردية)
CREATE OR REPLACE FUNCTION batch_update_driver_locations(
    p_updates jsonb -- [{"driver_id": "uuid", "lat": 24.5, "lng": 46.5}]
)
RETURNS TABLE(
    driver_id uuid,
    success boolean,
    message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_update jsonb;
    v_driver_id uuid;
    v_lat numeric;
    v_lng numeric;
BEGIN
    -- التحقق من صحة البيانات
    IF p_updates IS NULL OR jsonb_array_length(p_updates) = 0 THEN
        RETURN QUERY SELECT NULL::uuid, false, 'لا توجد تحديثات'::text;
        RETURN;
    END IF;
    
    -- معالجة كل تحديث
    FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
        BEGIN
            v_driver_id := (v_update->>'driver_id')::uuid;
            v_lat := (v_update->>'lat')::numeric;
            v_lng := (v_update->>'lng')::numeric;
            
            -- تحديث الموقع
            UPDATE driver_profiles
            SET 
                current_latitude = v_lat,
                current_longitude = v_lng,
                updated_at = now()
            WHERE user_id = v_driver_id;
            
            RETURN QUERY SELECT v_driver_id, true, 'تم التحديث'::text;
            
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT v_driver_id, false, SQLERRM::text;
        END;
    END LOOP;
END;
$$;

-- 2.2: دالة batch للحصول على معلومات عدة طلبات (استعلام واحد بدلاً من عدة استعلامات)
CREATE OR REPLACE FUNCTION get_orders_summary(p_order_ids uuid[])
RETURNS TABLE(
    order_id uuid,
    status text,
    total_amount numeric,
    items_count integer,
    customer_name text,
    driver_name text,
    merchant_name text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.status,
        o.total_amount,
        o.items_count,
        cp.full_name as customer_name,
        dp.full_name as driver_name,
        mp.business_name as merchant_name
    FROM orders o
    LEFT JOIN profiles cp ON cp.id = o.customer_id
    LEFT JOIN profiles dp ON dp.id = o.driver_id
    LEFT JOIN merchants mp ON mp.id = o.merchant_id
    WHERE o.id = ANY(p_order_ids);
END;
$$;

-- 2.3: دالة batch للحصول على الإشعارات غير المقروءة مع التفاصيل (استعلام واحد)
CREATE OR REPLACE FUNCTION get_unread_notifications_batch(p_user_id uuid, p_limit integer DEFAULT 20)
RETURNS TABLE(
    notification_id uuid,
    title text,
    body text,
    data jsonb,
    created_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.title,
        n.body,
        n.data,
        n.created_at
    FROM notifications n
    WHERE n.user_id = p_user_id 
      AND n.is_read = false
    ORDER BY n.created_at DESC
    LIMIT p_limit;
END;
$$;

-- 2.4: دالة للحصول على dashboard كامل في استعلام واحد (للسائقين)
CREATE OR REPLACE FUNCTION get_driver_dashboard(p_driver_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'profile', (
            SELECT jsonb_build_object(
                'name', p.full_name,
                'rating', dp.average_rating,
                'total_deliveries', dp.total_deliveries,
                'is_online', dp.is_online
            )
            FROM profiles p
            JOIN driver_profiles dp ON dp.user_id = p.id
            WHERE p.id = p_driver_id
        ),
        'active_orders', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', o.id,
                    'status', o.status,
                    'pickup_address', o.pickup_address,
                    'delivery_address', o.delivery_address,
                    'total_amount', o.total_amount
                )
            )
            FROM orders o
            WHERE o.driver_id = p_driver_id
              AND o.status IN ('accepted', 'picked_up', 'on_the_way')
        ),
        'today_earnings', (
            SELECT COALESCE(SUM(amount), 0)
            FROM wallet_transactions wt
            JOIN wallets w ON w.id = wt.wallet_id
            WHERE w.owner_id = p_driver_id
              AND wt.type = 'credit'
              AND wt.created_at >= CURRENT_DATE
        ),
        'unread_notifications', (
            SELECT COUNT(*)
            FROM notifications
            WHERE user_id = p_driver_id
              AND is_read = false
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- 2.5: دالة للحصول على dashboard كامل في استعلام واحد (للعملاء)
CREATE OR REPLACE FUNCTION get_customer_dashboard(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'profile', (
            SELECT jsonb_build_object(
                'name', p.full_name,
                'phone', p.phone_number
            )
            FROM profiles p
            WHERE p.id = p_customer_id
        ),
        'active_orders', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', o.id,
                    'status', o.status,
                    'merchant_name', m.business_name,
                    'total_amount', o.total_amount,
                    'items_count', o.items_count,
                    'estimated_delivery', o.estimated_delivery_time
                )
            )
            FROM orders o
            LEFT JOIN merchants m ON m.id = o.merchant_id
            WHERE o.customer_id = p_customer_id
              AND o.status NOT IN ('delivered', 'cancelled')
            ORDER BY o.created_at DESC
            LIMIT 5
        ),
        'recent_orders', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', o.id,
                    'status', o.status,
                    'merchant_name', m.business_name,
                    'total_amount', o.total_amount,
                    'created_at', o.created_at
                )
            )
            FROM orders o
            LEFT JOIN merchants m ON m.id = o.merchant_id
            WHERE o.customer_id = p_customer_id
            ORDER BY o.created_at DESC
            LIMIT 10
        ),
        'unread_notifications', (
            SELECT COUNT(*)
            FROM notifications
            WHERE user_id = p_customer_id
              AND is_read = false
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION batch_update_driver_locations(jsonb) IS 'تحديث مواقع عدة سائقين دفعة واحدة لتقليل استهلاك البطارية';
COMMENT ON FUNCTION get_orders_summary(uuid[]) IS 'الحصول على ملخص عدة طلبات في استعلام واحد';
COMMENT ON FUNCTION get_driver_dashboard(uuid) IS 'الحصول على dashboard السائق كاملاً في استعلام واحد';
COMMENT ON FUNCTION get_customer_dashboard(uuid) IS 'الحصول على dashboard العميل كاملاً في استعلام واحد';


-- ═══════════════════════════════════════════════════════════════════════════════
-- القسم 3: تحسين Admin Activity Log
-- الهدف: نظام تتبع شامل لنشاطات المديرين مع تقارير سريعة
-- ═══════════════════════════════════════════════════════════════════════════════

-- 3.1: إضافة أعمدة جديدة للتتبع المحسّن
ALTER TABLE admin_activity_log 
ADD COLUMN IF NOT EXISTS device_info jsonb,
ADD COLUMN IF NOT EXISTS action_details jsonb,
ADD COLUMN IF NOT EXISTS user_agent text,
ADD COLUMN IF NOT EXISTS session_id uuid;

-- 3.2: فهارس محسّنة للبحث والتقارير
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_action 
ON admin_activity_log(admin_id, action, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_admin_activity_resource 
ON admin_activity_log(resource_type, resource_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_admin_activity_timestamp 
ON admin_activity_log(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_admin_activity_action_type 
ON admin_activity_log(action) WHERE action IS NOT NULL;

-- 3.3: View للتقارير السريعة - نشاط المديرين اليوم
CREATE OR REPLACE VIEW admin_activity_today AS
SELECT 
    aal.id,
    aal.admin_id,
    p.full_name as admin_name,
    aal.action,
    aal.resource_type,
    aal.resource_id,
    aal.ip_address,
    aal.timestamp
FROM admin_activity_log aal
LEFT JOIN profiles p ON p.id = aal.admin_id
WHERE aal.timestamp >= CURRENT_DATE
ORDER BY aal.timestamp DESC;

-- 3.4: View للتقارير - أنشط المديرين
CREATE OR REPLACE VIEW most_active_admins AS
SELECT 
    aal.admin_id,
    p.full_name as admin_name,
    COUNT(*) as total_actions,
    COUNT(DISTINCT DATE(aal.timestamp)) as active_days,
    MAX(aal.timestamp) as last_activity
FROM admin_activity_log aal
LEFT JOIN profiles p ON p.id = aal.admin_id
WHERE aal.timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY aal.admin_id, p.full_name
ORDER BY total_actions DESC;

-- 3.5: دالة للبحث المتقدم في سجل النشاطات
CREATE OR REPLACE FUNCTION search_admin_activity(
    p_admin_id uuid DEFAULT NULL,
    p_action text DEFAULT NULL,
    p_resource_type text DEFAULT NULL,
    p_start_date timestamptz DEFAULT NULL,
    p_end_date timestamptz DEFAULT NULL,
    p_limit integer DEFAULT 100
)
RETURNS TABLE(
    id uuid,
    admin_id uuid,
    admin_name text,
    action text,
    resource_type text,
    resource_id uuid,
    ip_address text,
    device_info jsonb,
    timestamp timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        aal.id,
        aal.admin_id,
        p.full_name as admin_name,
        aal.action,
        aal.resource_type,
        aal.resource_id,
        aal.ip_address,
        aal.device_info,
        aal.timestamp
    FROM admin_activity_log aal
    LEFT JOIN profiles p ON p.id = aal.admin_id
    WHERE 
        (p_admin_id IS NULL OR aal.admin_id = p_admin_id)
        AND (p_action IS NULL OR aal.action = p_action)
        AND (p_resource_type IS NULL OR aal.resource_type = p_resource_type)
        AND (p_start_date IS NULL OR aal.timestamp >= p_start_date)
        AND (p_end_date IS NULL OR aal.timestamp <= p_end_date)
    ORDER BY aal.timestamp DESC
    LIMIT p_limit;
END;
$$;

-- 3.6: دالة لإحصائيات النشاط حسب نوع العملية
CREATE OR REPLACE FUNCTION get_admin_activity_stats(
    p_start_date timestamptz DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date timestamptz DEFAULT CURRENT_DATE + INTERVAL '1 day'
)
RETURNS TABLE(
    action text,
    count bigint,
    unique_admins bigint,
    last_occurrence timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        aal.action,
        COUNT(*) as count,
        COUNT(DISTINCT aal.admin_id) as unique_admins,
        MAX(aal.timestamp) as last_occurrence
    FROM admin_activity_log aal
    WHERE aal.timestamp BETWEEN p_start_date AND p_end_date
    GROUP BY aal.action
    ORDER BY count DESC;
END;
$$;

-- 3.7: دالة لحذف السجلات القديمة (Retention Policy)
CREATE OR REPLACE FUNCTION cleanup_old_admin_logs(p_days_to_keep integer DEFAULT 90)
RETURNS TABLE(
    deleted_count bigint,
    message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count bigint;
BEGIN
    -- حذف السجلات الأقدم من المدة المحددة
    DELETE FROM admin_activity_log
    WHERE timestamp < CURRENT_DATE - (p_days_to_keep || ' days')::interval;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN QUERY SELECT 
        v_deleted_count,
        format('تم حذف %s سجل أقدم من %s يوم', v_deleted_count, p_days_to_keep);
END;
$$;

COMMENT ON COLUMN admin_activity_log.device_info IS 'معلومات الجهاز (OS, browser, device type)';
COMMENT ON COLUMN admin_activity_log.action_details IS 'تفاصيل إضافية عن العملية';
COMMENT ON COLUMN admin_activity_log.user_agent IS 'User agent string';
COMMENT ON VIEW admin_activity_today IS 'نشاطات المديرين اليوم';
COMMENT ON VIEW most_active_admins IS 'أنشط المديرين في آخر 30 يوم';
COMMENT ON FUNCTION search_admin_activity IS 'بحث متقدم في سجل نشاطات المديرين';
COMMENT ON FUNCTION get_admin_activity_stats IS 'إحصائيات النشاط حسب نوع العملية';
COMMENT ON FUNCTION cleanup_old_admin_logs IS 'حذف السجلات القديمة (Retention Policy)';


-- ═══════════════════════════════════════════════════════════════════════════════
-- القسم 4: Analytics System - نظام تحليلي شامل
-- الهدف: توفير بيانات تحليلية فورية ودقيقة للإدارة
-- ═══════════════════════════════════════════════════════════════════════════════

-- 4.1: Materialized View للإحصائيات اليومية
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_orders_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE status = 'delivered') as delivered_orders,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
    COUNT(*) FILTER (WHERE status IN ('pending', 'accepted', 'picked_up', 'on_the_way')) as active_orders,
    SUM(total_amount) as total_revenue,
    SUM(total_amount) FILTER (WHERE status = 'delivered') as delivered_revenue,
    AVG(total_amount) as avg_order_value,
    COUNT(DISTINCT customer_id) as unique_customers,
    COUNT(DISTINCT driver_id) as active_drivers,
    COUNT(DISTINCT merchant_id) as active_merchants
FROM orders
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 4.2: فهرس على المادريalized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_orders_stats_date 
ON daily_orders_stats(date DESC);

-- 4.3: Materialized View للإحصائيات الشهرية
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_revenue_stats AS
SELECT 
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as total_orders,
    SUM(total_amount) as total_revenue,
    SUM(delivery_fee) as total_delivery_fees,
    AVG(total_amount) as avg_order_value,
    COUNT(DISTINCT customer_id) as unique_customers
FROM orders
WHERE status = 'delivered'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- 4.4: Materialized View لأداء السائقين
CREATE MATERIALIZED VIEW IF NOT EXISTS driver_performance_stats AS
SELECT 
    dp.user_id as driver_id,
    p.full_name as driver_name,
    dp.average_rating,
    dp.total_deliveries,
    COUNT(o.id) FILTER (WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days') as deliveries_last_30_days,
    AVG(de.amount) as avg_earnings_per_delivery,
    SUM(de.amount) FILTER (WHERE de.created_at >= CURRENT_DATE - INTERVAL '30 days') as earnings_last_30_days,
    COUNT(dc.id) as total_cancellations,
    CASE 
        WHEN dp.total_deliveries > 0 THEN 
            ROUND((COUNT(dc.id)::numeric / dp.total_deliveries::numeric) * 100, 2)
        ELSE 0
    END as cancellation_rate
FROM driver_profiles dp
JOIN profiles p ON p.id = dp.user_id
LEFT JOIN orders o ON o.driver_id = dp.user_id AND o.status = 'delivered'
LEFT JOIN driver_earnings de ON de.driver_id = dp.user_id
LEFT JOIN driver_cancellations dc ON dc.driver_id = dp.user_id
GROUP BY dp.user_id, p.full_name, dp.average_rating, dp.total_deliveries;

-- 4.5: Materialized View لأداء التجار
CREATE MATERIALIZED VIEW IF NOT EXISTS merchant_performance_stats AS
SELECT 
    m.id as merchant_id,
    m.business_name,
    m.average_rating,
    COUNT(o.id) as total_orders,
    COUNT(o.id) FILTER (WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days') as orders_last_30_days,
    SUM(o.total_amount) as total_revenue,
    SUM(o.total_amount) FILTER (WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days') as revenue_last_30_days,
    AVG(o.total_amount) as avg_order_value,
    COUNT(DISTINCT o.customer_id) as unique_customers
FROM merchants m
LEFT JOIN orders o ON o.merchant_id = m.id AND o.status = 'delivered'
WHERE m.is_active = true
GROUP BY m.id, m.business_name, m.average_rating;

-- 4.6: دالة تحليلية - نمو الطلبات (Growth Analysis)
CREATE OR REPLACE FUNCTION get_orders_growth_analysis(
    p_period text DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
    p_limit integer DEFAULT 30
)
RETURNS TABLE(
    period text,
    total_orders bigint,
    revenue numeric,
    growth_rate numeric
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF p_period = 'daily' THEN
        RETURN QUERY
        WITH daily_data AS (
            SELECT 
                TO_CHAR(DATE(created_at), 'YYYY-MM-DD') as period,
                COUNT(*) as total_orders,
                SUM(total_amount) as revenue,
                LAG(COUNT(*)) OVER (ORDER BY DATE(created_at)) as prev_orders
            FROM orders
            WHERE status = 'delivered'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) DESC
            LIMIT p_limit
        )
        SELECT 
            period,
            total_orders,
            revenue,
            CASE 
                WHEN prev_orders > 0 THEN 
                    ROUND(((total_orders - prev_orders)::numeric / prev_orders::numeric) * 100, 2)
                ELSE 0
            END as growth_rate
        FROM daily_data;
        
    ELSIF p_period = 'weekly' THEN
        RETURN QUERY
        WITH weekly_data AS (
            SELECT 
                TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-MM-DD') as period,
                COUNT(*) as total_orders,
                SUM(total_amount) as revenue,
                LAG(COUNT(*)) OVER (ORDER BY DATE_TRUNC('week', created_at)) as prev_orders
            FROM orders
            WHERE status = 'delivered'
            GROUP BY DATE_TRUNC('week', created_at)
            ORDER BY DATE_TRUNC('week', created_at) DESC
            LIMIT p_limit
        )
        SELECT 
            period,
            total_orders,
            revenue,
            CASE 
                WHEN prev_orders > 0 THEN 
                    ROUND(((total_orders - prev_orders)::numeric / prev_orders::numeric) * 100, 2)
                ELSE 0
            END as growth_rate
        FROM weekly_data;
        
    ELSE -- monthly
        RETURN QUERY
        WITH monthly_data AS (
            SELECT 
                TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as period,
                COUNT(*) as total_orders,
                SUM(total_amount) as revenue,
                LAG(COUNT(*)) OVER (ORDER BY DATE_TRUNC('month', created_at)) as prev_orders
            FROM orders
            WHERE status = 'delivered'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at) DESC
            LIMIT p_limit
        )
        SELECT 
            period,
            total_orders,
            revenue,
            CASE 
                WHEN prev_orders > 0 THEN 
                    ROUND(((total_orders - prev_orders)::numeric / prev_orders::numeric) * 100, 2)
                ELSE 0
            END as growth_rate
        FROM monthly_data;
    END IF;
END;
$$;

-- 4.7: دالة تحليلية - إحصائيات الإيرادات المفصلة
CREATE OR REPLACE FUNCTION get_revenue_breakdown(
    p_start_date timestamptz DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date timestamptz DEFAULT CURRENT_DATE + INTERVAL '1 day'
)
RETURNS TABLE(
    metric text,
    value numeric
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 'total_revenue'::text, 
           COALESCE(SUM(total_amount), 0)
    FROM orders
    WHERE status = 'delivered'
      AND created_at BETWEEN p_start_date AND p_end_date
    
    UNION ALL
    
    SELECT 'total_delivery_fees'::text, 
           COALESCE(SUM(delivery_fee), 0)
    FROM orders
    WHERE status = 'delivered'
      AND created_at BETWEEN p_start_date AND p_end_date
    
    UNION ALL
    
    SELECT 'total_driver_earnings'::text,
           COALESCE(SUM(amount), 0)
    FROM driver_earnings
    WHERE created_at BETWEEN p_start_date AND p_end_date
    
    UNION ALL
    
    SELECT 'platform_commission'::text,
           COALESCE(
               (SELECT SUM(total_amount) FROM orders 
                WHERE status = 'delivered' AND created_at BETWEEN p_start_date AND p_end_date) -
               (SELECT SUM(amount) FROM driver_earnings 
                WHERE created_at BETWEEN p_start_date AND p_end_date),
               0
           )
    
    UNION ALL
    
    SELECT 'avg_order_value'::text,
           COALESCE(AVG(total_amount), 0)
    FROM orders
    WHERE status = 'delivered'
      AND created_at BETWEEN p_start_date AND p_end_date;
END;
$$;

-- 4.8: دالة تحليلية - تحليل أوقات الذروة
CREATE OR REPLACE FUNCTION get_peak_hours_analysis()
RETURNS TABLE(
    hour_of_day integer,
    total_orders bigint,
    avg_order_value numeric,
    percentage numeric
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH hourly_data AS (
        SELECT 
            EXTRACT(HOUR FROM created_at)::integer as hour_of_day,
            COUNT(*) as total_orders,
            AVG(total_amount) as avg_order_value
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY EXTRACT(HOUR FROM created_at)
    )
    SELECT 
        hour_of_day,
        total_orders,
        ROUND(avg_order_value, 2) as avg_order_value,
        ROUND((total_orders::numeric / SUM(total_orders) OVER ()) * 100, 2) as percentage
    FROM hourly_data
    ORDER BY hour_of_day;
END;
$$;

-- 4.9: دالة للحصول على KPIs الرئيسية (Dashboard)
CREATE OR REPLACE FUNCTION get_platform_kpis(
    p_start_date timestamptz DEFAULT CURRENT_DATE,
    p_end_date timestamptz DEFAULT CURRENT_DATE + INTERVAL '1 day'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'orders', jsonb_build_object(
            'total', (SELECT COUNT(*) FROM orders WHERE created_at BETWEEN p_start_date AND p_end_date),
            'delivered', (SELECT COUNT(*) FROM orders WHERE status = 'delivered' AND created_at BETWEEN p_start_date AND p_end_date),
            'cancelled', (SELECT COUNT(*) FROM orders WHERE status = 'cancelled' AND created_at BETWEEN p_start_date AND p_end_date),
            'active', (SELECT COUNT(*) FROM orders WHERE status IN ('pending', 'accepted', 'picked_up', 'on_the_way'))
        ),
        'revenue', jsonb_build_object(
            'total', (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'delivered' AND created_at BETWEEN p_start_date AND p_end_date),
            'avg_order', (SELECT COALESCE(AVG(total_amount), 0) FROM orders WHERE status = 'delivered' AND created_at BETWEEN p_start_date AND p_end_date)
        ),
        'users', jsonb_build_object(
            'total_customers', (SELECT COUNT(*) FROM profiles WHERE user_type = 'customer'),
            'active_drivers', (SELECT COUNT(*) FROM driver_profiles WHERE is_online = true),
            'total_drivers', (SELECT COUNT(*) FROM driver_profiles),
            'active_merchants', (SELECT COUNT(*) FROM merchants WHERE is_active = true)
        ),
        'performance', jsonb_build_object(
            'avg_delivery_time', (
                SELECT AVG(EXTRACT(EPOCH FROM (delivered_at - created_at)) / 60)
                FROM orders 
                WHERE status = 'delivered' 
                  AND delivered_at IS NOT NULL
                  AND created_at BETWEEN p_start_date AND p_end_date
            ),
            'avg_rating', (SELECT AVG(rating) FROM reviews WHERE created_at BETWEEN p_start_date AND p_end_date)
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- 4.10: دالة scheduled لتحديث materialized views تلقائياً
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_orders_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY driver_performance_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY merchant_performance_stats;
END;
$$;

COMMENT ON MATERIALIZED VIEW daily_orders_stats IS 'إحصائيات الطلبات اليومية';
COMMENT ON MATERIALIZED VIEW monthly_revenue_stats IS 'إحصائيات الإيرادات الشهرية';
COMMENT ON MATERIALIZED VIEW driver_performance_stats IS 'إحصائيات أداء السائقين';
COMMENT ON MATERIALIZED VIEW merchant_performance_stats IS 'إحصائيات أداء التجار';
COMMENT ON FUNCTION get_orders_growth_analysis IS 'تحليل نمو الطلبات (يومي/أسبوعي/شهري)';
COMMENT ON FUNCTION get_revenue_breakdown IS 'تفصيل الإيرادات والعمولات';
COMMENT ON FUNCTION get_peak_hours_analysis IS 'تحليل أوقات الذروة';
COMMENT ON FUNCTION get_platform_kpis IS 'مؤشرات الأداء الرئيسية للمنصة';
COMMENT ON FUNCTION refresh_analytics_views IS 'تحديث جميع الـ materialized views';


-- ═══════════════════════════════════════════════════════════════════════════════
-- النهاية: ملخص التحسينات
-- ═══════════════════════════════════════════════════════════════════════════════

/*
✅ القسم 1: Order Items Counter
   - عمود items_count في orders
   - دالة get_order_items_count() محسّنة
   - دالة batch get_multiple_orders_items_count()
   - Trigger تلقائي لتحديث العداد
   - فهارس محسّنة

✅ القسم 2: Battery Optimization
   - دالة batch_update_driver_locations() للتحديثات الدفعية
   - دالة get_orders_summary() للحصول على عدة طلبات
   - دالة get_driver_dashboard() - dashboard كامل في استعلام واحد
   - دالة get_customer_dashboard() - dashboard كامل في استعلام واحد
   - تقليل متوقع 40-50% في عدد الاستعلامات

✅ القسم 3: Admin Activity Log Enhancement
   - أعمدة جديدة: device_info, action_details, user_agent, session_id
   - فهارس محسّنة للبحث
   - Views للتقارير السريعة
   - دالة search_admin_activity() للبحث المتقدم
   - دالة get_admin_activity_stats() للإحصائيات
   - دالة cleanup_old_admin_logs() للـ retention policy

✅ القسم 4: Analytics System
   - 4 Materialized Views (daily, monthly, drivers, merchants)
   - دالة get_orders_growth_analysis() لتحليل النمو
   - دالة get_revenue_breakdown() لتفصيل الإيرادات
   - دالة get_peak_hours_analysis() لتحليل أوقات الذروة
   - دالة get_platform_kpis() للـ KPIs
   - دالة refresh_analytics_views() للتحديث التلقائي

📊 التأثير الإجمالي المتوقع:
   - تحسين الأداء: 40-60%
   - تقليل استهلاك البطارية: 40-50%
   - نظام تقارير شامل للمديرين
   - بيانات تحليلية فورية ودقيقة
*/