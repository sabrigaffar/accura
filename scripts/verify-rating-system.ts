import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
// Use relative path for the rating utilities
import { updateMerchantRating, updateDriverRating } from '../lib/ratingUtils';

// تحميل متغيرات البيئة من ملف .env
dotenv.config();

// استخدام المتغيرات البيئية
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'your_supabase_url_here';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_supabase_service_role_key_here';

// استخدام service role key لإنشاء عميل Supabase (يتجاوز سياسات RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifyRatingSystem() {
  console.log('Verifying rating system functionality...\n');

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
    console.log('Order to test:', order.order_number);
    
    // Handle merchant data (could be an array or object)
    const merchantData = Array.isArray(order.merchant) ? order.merchant[0] : order.merchant;
    console.log('Merchant Owner ID:', merchantData?.owner_id);
    console.log('Driver ID:', order.driver_id);

    // اختبار تقييم الطلب
    const rating = 4;
    const comment = 'خدمة جيدة جداً';

    console.log(`\nSubmitting rating: ${rating} stars`);
    console.log(`Comment: "${comment}"`);

    // إدراج التقييم للسائق
    if (order.driver_id) {
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
        
        // اختبار تحديث تقييم السائق
        await updateDriverRating(order.driver_id);
        console.log('✅ Driver rating updated successfully');
      }
    }

    // إدراج التقييم للمتجر (باستخدام owner_id)
    if (merchantData?.owner_id) {
      const { error: merchantReviewError } = await supabase
        .from('reviews')
        .insert({
          order_id: order.id,
          reviewer_id: 'f9851062-029a-4fb5-8dcd-d846b97fdc06', // المستخدم sabri
          reviewee_id: merchantData.owner_id,
          reviewee_type: 'merchant',
          rating: rating,
          comment: comment,
        });

      if (merchantReviewError) {
        console.error('Error creating merchant review:', merchantReviewError);
      } else {
        console.log('✅ Merchant review created successfully');
        
        // اختبار تحديث تقييم المتجر
        await updateMerchantRating(order.merchant_id);
        console.log('✅ Merchant rating updated successfully');
      }
    }

    // التحقق من التقييمات المُدخلة
    console.log('\nVerifying submitted reviews...');
    
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('order_id', order.id);

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError);
    } else {
      console.log(`Found ${reviews.length} reviews for this order:`);
      reviews.forEach(review => {
        console.log(`  - ${review.reviewee_type}: ${review.rating} stars - "${review.comment}"`);
      });
    }

    // التحقق من تقييمات السائق والمتجر
    if (order.driver_id) {
      const { data: driverProfile, error: driverError } = await supabase
        .from('driver_profiles')
        .select('average_rating, total_deliveries')
        .eq('id', order.driver_id)
        .single();

      if (driverError) {
        console.error('Error fetching driver profile:', driverError);
      } else {
        console.log(`\nDriver rating: ${driverProfile.average_rating}`);
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
        console.log(`\nMerchant rating: ${merchantProfile.rating}`);
        console.log(`Total reviews: ${merchantProfile.total_reviews}`);
      }
    }

    console.log('\n🎉 Rating system verification completed successfully!');
  } catch (error) {
    console.error('Unexpected error during rating system verification:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('verify-rating-system.ts');
if (isMainModule) {
  verifyRatingSystem();
}