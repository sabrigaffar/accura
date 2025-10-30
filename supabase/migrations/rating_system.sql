-- نظام التقييم - Rating System
-- تحديث تلقائي للتقييمات عند إضافة تقييم جديد

-- ==============================================
-- 1. إضافة index للأداء
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id, reviewee_type);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- ==============================================
-- 2. دالة لحساب وتحديث متوسط التقييم للسائق
-- ==============================================

CREATE OR REPLACE FUNCTION update_driver_average_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  avg_rating NUMERIC;
  total_reviews INTEGER;
BEGIN
  -- حساب متوسط التقييم وعدد التقييمات للسائق
  SELECT 
    ROUND(AVG(rating)::NUMERIC, 1),
    COUNT(*)
  INTO avg_rating, total_reviews
  FROM reviews
  WHERE reviewee_id = NEW.reviewee_id 
    AND reviewee_type = 'driver';

  -- تحديث driver_profiles
  UPDATE driver_profiles
  SET 
    average_rating = COALESCE(avg_rating, 0),
    updated_at = NOW()
  WHERE id = NEW.reviewee_id;

  RETURN NEW;
END;
$$;

-- ==============================================
-- 3. دالة لحساب وتحديث متوسط التقييم للمتجر
-- ==============================================

CREATE OR REPLACE FUNCTION update_merchant_average_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  avg_rating NUMERIC;
  total_reviews INTEGER;
BEGIN
  -- حساب متوسط التقييم وعدد التقييمات للمتجر
  SELECT 
    ROUND(AVG(rating)::NUMERIC, 1),
    COUNT(*)
  INTO avg_rating, total_reviews
  FROM reviews
  WHERE reviewee_id = NEW.reviewee_id 
    AND reviewee_type = 'merchant';

  -- تحديث merchants
  UPDATE merchants
  SET 
    rating = COALESCE(avg_rating, 0),
    total_reviews = COALESCE(total_reviews, 0),
    updated_at = NOW()
  WHERE id = NEW.reviewee_id;

  RETURN NEW;
END;
$$;

-- ==============================================
-- 4. Triggers لتحديث التقييمات تلقائياً
-- ==============================================

-- Trigger للسائق
DROP TRIGGER IF EXISTS trigger_update_driver_rating ON reviews;
CREATE TRIGGER trigger_update_driver_rating
  AFTER INSERT ON reviews
  FOR EACH ROW
  WHEN (NEW.reviewee_type = 'driver')
  EXECUTE FUNCTION update_driver_average_rating();

-- Trigger للمتجر
DROP TRIGGER IF EXISTS trigger_update_merchant_rating ON reviews;
CREATE TRIGGER trigger_update_merchant_rating
  AFTER INSERT ON reviews
  FOR EACH ROW
  WHEN (NEW.reviewee_type = 'merchant')
  EXECUTE FUNCTION update_merchant_average_rating();

-- ==============================================
-- 5. View لعرض إحصائيات التقييمات
-- ==============================================

CREATE OR REPLACE VIEW driver_rating_stats AS
SELECT 
  dp.id,
  p.full_name,
  dp.average_rating,
  COUNT(r.id) as total_reviews,
  COUNT(CASE WHEN r.rating = 5 THEN 1 END) as five_stars,
  COUNT(CASE WHEN r.rating = 4 THEN 1 END) as four_stars,
  COUNT(CASE WHEN r.rating = 3 THEN 1 END) as three_stars,
  COUNT(CASE WHEN r.rating = 2 THEN 1 END) as two_stars,
  COUNT(CASE WHEN r.rating = 1 THEN 1 END) as one_star
FROM driver_profiles dp
JOIN profiles p ON p.id = dp.id
LEFT JOIN reviews r ON r.reviewee_id = dp.id AND r.reviewee_type = 'driver'
GROUP BY dp.id, p.full_name, dp.average_rating;

COMMENT ON VIEW driver_rating_stats IS 'إحصائيات تفصيلية لتقييمات السائقين';

-- ==============================================
-- 6. دالة للحصول على أفضل السائقين
-- ==============================================

CREATE OR REPLACE FUNCTION get_top_rated_drivers(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  driver_id UUID,
  driver_name TEXT,
  average_rating NUMERIC,
  total_reviews BIGINT,
  total_deliveries INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dp.id,
    p.full_name,
    dp.average_rating,
    COUNT(r.id) as total_reviews,
    dp.total_deliveries
  FROM driver_profiles dp
  JOIN profiles p ON p.id = dp.id
  LEFT JOIN reviews r ON r.reviewee_id = dp.id AND r.reviewee_type = 'driver'
  WHERE dp.is_verified = true
  GROUP BY dp.id, p.full_name, dp.average_rating, dp.total_deliveries
  HAVING COUNT(r.id) >= 5  -- على الأقل 5 تقييمات
  ORDER BY dp.average_rating DESC, COUNT(r.id) DESC
  LIMIT limit_count;
END;
$$;

COMMENT ON FUNCTION get_top_rated_drivers IS 'الحصول على أفضل السائقين المُقيّمين';

-- ==============================================
-- 7. RLS Policies للتقييمات
-- ==============================================

-- السماح للعملاء بإنشاء تقييم واحد فقط لكل طلب
DROP POLICY IF EXISTS "Customers can create one review per order" ON reviews;
CREATE POLICY "Customers can create one review per order"
ON reviews FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = reviewer_id
  AND NOT EXISTS (
    SELECT 1 FROM reviews
    WHERE order_id = reviews.order_id
      AND reviewer_id = auth.uid()
      AND reviewee_type = reviews.reviewee_type
  )
);

-- السماح بعرض التقييمات العامة
DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
CREATE POLICY "Anyone can view reviews"
ON reviews FOR SELECT
TO authenticated
USING (true);

-- ==============================================
-- 8. تعليقات ووصف
-- ==============================================

COMMENT ON COLUMN reviews.reviewer_id IS 'معرف المُقيِّم (العميل عادة)';
COMMENT ON COLUMN reviews.reviewee_id IS 'معرف المُقيَّم (سائق أو متجر)';
COMMENT ON COLUMN reviews.reviewee_type IS 'نوع المُقيَّم: driver أو merchant';
COMMENT ON COLUMN reviews.rating IS 'التقييم من 1 إلى 5 نجوم';
COMMENT ON COLUMN reviews.comment IS 'تعليق اختياري من العميل';

-- ==============================================
-- 9. رسالة نجاح
-- ==============================================

DO $$
BEGIN
  RAISE NOTICE '✅ تم إنشاء نظام التقييم بنجاح!';
  RAISE NOTICE '✅ Triggers تلقائية لتحديث المتوسطات';
  RAISE NOTICE '✅ Views وDashboards جاهزة';
  RAISE NOTICE '✅ RLS Policies محدثة';
END $$;
