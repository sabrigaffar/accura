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

async function testDriverRating() {
  console.log('Testing driver rating...\n');

  try {
    // الحصول على طلب مُسلَّم مع سائق
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, 
        order_number, 
        driver_id
      `)
      .eq('status', 'delivered')
      .not('driver_id', 'is', null)
      .limit(1);

    if (orderError) {
      console.error('Error fetching delivered order with driver:', orderError);
      return;
    }

    if (!orders || orders.length === 0) {
      console.log('No delivered orders with drivers found.');
      return;
    }

    const order = orders[0];
    console.log('Order to rate:', order.order_number);
    console.log('Driver ID:', order.driver_id);

    // اختبار تقييم السائق
    const rating = 5;
    const comment = 'سائق محترف وسريع جداً';

    console.log(`\nSubmitting driver rating: ${rating} stars`);
    console.log(`Comment: "${comment}"`);

    // إدراج التقييم للسائق
    const { error: driverReviewError } = await supabase
      .from('reviews')
      .insert({
        order_id: order.id,
        reviewer_id: 'f9851062-029a-4fb5-8dcd-d846b97fdc06', // المستخدم sabri
        reviewee_id: order.driver_id,
        reviewee_type: 'driver',
        rating: rating,
        comment: comment,
      });

    if (driverReviewError) {
      console.error('Error creating driver review:', driverReviewError);
    } else {
      console.log('✅ Driver review created successfully');
    }

    // التحقق من التقييم المُدخل
    console.log('\nVerifying submitted review...');
    
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('order_id', order.id)
      .eq('reviewee_type', 'driver');

    if (reviewsError) {
      console.error('Error fetching driver reviews:', reviewsError);
    } else {
      console.log(`Found ${reviews.length} driver reviews for this order:`);
      reviews.forEach(review => {
        console.log(`  - ${review.rating} stars - "${review.comment}"`);
      });
    }

    console.log('\n🎉 Driver rating test completed successfully!');
  } catch (error) {
    console.error('Unexpected error during driver rating test:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('test-driver-rating.ts');
if (isMainModule) {
  testDriverRating();
}