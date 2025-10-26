import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// تحميل متغيرات البيئة من ملف .env
dotenv.config();

// استخدام المتغيرات البيئية
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'your_supabase_url_here';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_supabase_service_role_key_here';

console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY);

// استخدام service role key لإنشاء عميل Supabase (يتجاوز سياسات RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function finalRatingTest() {
  console.log('Final rating system test...\n');

  try {
    // الحصول على طلب مُسلَّم
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, 
        order_number, 
        merchant_id,
        driver_id,
        merchant:merchants(owner_id)
      `)
      .eq('status', 'delivered')
      .limit(1);

    if (orderError) {
      console.error('Error fetching delivered order:', orderError);
      return;
    }

    if (!orders || orders.length === 0) {
      console.log('No delivered orders found.');
      return;
    }

    const order = orders[0];
    console.log('Testing with order:', order.order_number);
    
    // Handle merchant data (could be an array or object)
    const merchantData = Array.isArray(order.merchant) ? order.merchant[0] : order.merchant;
    console.log('Merchant Owner ID:', merchantData?.owner_id);
    console.log('Driver ID:', order.driver_id);

    // التحقق من التقييمات الموجودة مسبقاً
    console.log('\nChecking existing reviews...');
    
    const { data: existingReviews, error: existingReviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('order_id', order.id);

    if (existingReviewsError) {
      console.error('Error fetching existing reviews:', existingReviewsError);
    } else {
      console.log(`Found ${existingReviews.length} existing reviews for this order`);
      existingReviews.forEach(review => {
        console.log(`  - ${review.reviewee_type}: ${review.rating} stars`);
      });
    }

    // التحقق من تقييمات السائق والمتجر قبل الاختبار
    if (order.driver_id) {
      const { data: driverProfile, error: driverError } = await supabase
        .from('driver_profiles')
        .select('average_rating, total_deliveries')
        .eq('id', order.driver_id)
        .single();

      if (driverError) {
        console.error('Error fetching driver profile:', driverError);
      } else {
        console.log(`\nDriver rating before test: ${driverProfile.average_rating}`);
        console.log(`Total deliveries: ${driverProfile.total_deliveries}`);
      }
    }

    if (order.merchant_id) {
      const { data: merchantProfile, error: merchantError } = await supabase
        .from('merchants')
        .select('rating, total_reviews')
        .eq('id', order.merchant_id)
        .single();

      if (merchantError) {
        console.error('Error fetching merchant profile:', merchantError);
      } else {
        console.log(`\nMerchant rating before test: ${merchantProfile.rating}`);
        console.log(`Total reviews: ${merchantProfile.total_reviews}`);
      }
    }

    console.log('\n🎉 Final rating system test completed successfully!');
  } catch (error) {
    console.error('Unexpected error during final rating system test:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('final-rating-test.ts');
if (isMainModule) {
  finalRatingTest();
}