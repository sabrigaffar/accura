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

async function testOrderRating() {
  console.log('Testing order rating functionality...\n');

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
      console.log('No delivered orders found. Creating a test delivered order...');
      
      // إنشاء طلب مُسلَّم تجريبي إذا لم يكن هناك طلبات مُسلَّمة
      await createTestDeliveredOrder();
      return;
    }

    const order = orders[0];
    console.log('Order to rate:', order.order_number);
    
    // Handle merchant data (could be an array or object)
    const merchantData = Array.isArray(order.merchant) ? order.merchant[0] : order.merchant;
    console.log('Merchant Owner ID:', merchantData?.owner_id);
    console.log('Driver ID:', order.driver_id);

    // اختبار تقييم الطلب
    const rating = 5;
    const comment = 'خدمة ممتازة وسريع جداً';

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
      }
    }

    // تحديث حالة الطلب
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ 
        rating: rating, 
        review_text: comment,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (orderUpdateError) {
      console.error('Error updating order rating:', orderUpdateError);
    } else {
      console.log('✅ Order rating updated successfully');
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

    console.log('\n🎉 Order rating test completed successfully!');
  } catch (error) {
    console.error('Unexpected error during order rating test:', error);
  }
}

async function createTestDeliveredOrder() {
  try {
    // الحصول على أول تاجر من قاعدة البيانات
    const { data: merchants, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .limit(1);

    if (merchantError) {
      console.error('Error fetching merchant:', merchantError);
      return;
    }

    if (!merchants || merchants.length === 0) {
      console.error('No merchants found.');
      return;
    }

    const merchantId = merchants[0].id;
    
    // الحصول على السائق
    const { data: drivers, error: driverError } = await supabase
      .from('driver_profiles')
      .select('id')
      .limit(1);

    if (driverError) {
      console.error('Error fetching driver:', driverError);
      return;
    }

    if (!drivers || drivers.length === 0) {
      console.error('No drivers found.');
      return;
    }

    const driverId = drivers[0].id;

    // الحصول على المستخدم
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (userError) {
      console.error('Error fetching user:', userError);
      return;
    }

    if (!users || users.length === 0) {
      console.error('No users found.');
      return;
    }

    const userId = users[0].id;

    // إنشاء طلب مُسلَّم تجريبي
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: `RATING-TEST-${Date.now()}`,
        customer_id: userId,
        merchant_id: merchantId,
        driver_id: driverId,
        status: 'delivered',
        subtotal: 50.00,
        delivery_fee: 10.00,
        service_fee: 2.50,
        tax: 1.50,
        discount: 0.00,
        total: 64.00,
        payment_method: 'cash',
        payment_status: 'pending',
        actual_delivery_time: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating test delivered order:', orderError);
      return;
    }

    console.log('Test delivered order created successfully!');
    console.log('Order ID:', order.id);
    console.log('Order Number:', order.order_number);
    
    // الآن اختبار تقييم الطلب
    const rating = 4;
    const comment = 'خدمة جيدة جداً';

    console.log(`\nSubmitting rating: ${rating} stars`);
    console.log(`Comment: "${comment}"`);

    // إدراج التقييم للسائق
    const { error: driverReviewError } = await supabase
      .from('reviews')
      .insert({
        order_id: order.id,
        reviewer_id: userId,
        reviewee_id: driverId,
        reviewee_type: 'driver',
        rating: rating,
        comment: comment,
      });

    if (driverReviewError) {
      console.error('Error creating driver review:', driverReviewError);
    } else {
      console.log('✅ Driver review created successfully');
    }

    // إدراج التقييم للمتجر
    const { error: merchantReviewError } = await supabase
      .from('reviews')
      .insert({
        order_id: order.id,
        reviewer_id: userId,
        reviewee_id: merchantId,
        reviewee_type: 'merchant',
        rating: rating,
        comment: comment,
      });

    if (merchantReviewError) {
      console.error('Error creating merchant review:', merchantReviewError);
    } else {
      console.log('✅ Merchant review created successfully');
    }

    // تحديث حالة الطلب
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ 
        rating: rating, 
        review_text: comment,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (orderUpdateError) {
      console.error('Error updating order rating:', orderUpdateError);
    } else {
      console.log('✅ Order rating updated successfully');
    }

    console.log('\n🎉 Test order rating completed successfully!');
  } catch (error) {
    console.error('Unexpected error during test order creation:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('test-order-rating.ts');
if (isMainModule) {
  testOrderRating();
}