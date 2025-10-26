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

// الحالات التي يمكن فيها إلغاء الطلب
const ALLOWED_CANCELLATION_STATUSES = ['pending', 'accepted', 'preparing', 'ready'];

// الحالات التي لا يمكن فيها إلغاء الطلب
const BLOCKED_CANCELLATION_STATUSES = ['on_the_way', 'delivered', 'cancelled'];

async function demonstrateBusinessLogicCancellation() {
  console.log('Demonstrating business logic for order cancellation...\n');

  try {
    // إنشاء طلب تجريبي في حالة "قيد الانتظار"
    const pendingOrderId = await createTestOrderWithStatus('pending');
    
    if (pendingOrderId) {
      console.log('📋 Testing cancellation of "pending" order:');
      const canCancel = await canOrderBeCancelled(pendingOrderId);
      console.log(`  Can cancel: ${canCancel ? '✅ Yes' : '❌ No'}`);
      
      if (canCancel) {
        const cancelled = await cancelOrderWithBusinessLogic(pendingOrderId);
        console.log(`  Cancellation result: ${cancelled ? '✅ Success' : '❌ Failed'}`);
      }
      console.log('');
    }
    
    // إنشاء طلب تجريبي في حالة "قيد التوصيل"
    const onTheWayOrderId = await createTestOrderWithStatus('on_the_way');
    
    if (onTheWayOrderId) {
      console.log('🚚 Testing cancellation of "on_the_way" order:');
      const canCancel = await canOrderBeCancelled(onTheWayOrderId);
      console.log(`  Can cancel: ${canCancel ? '✅ Yes' : '❌ No'}`);
      
      if (canCancel) {
        const cancelled = await cancelOrderWithBusinessLogic(onTheWayOrderId);
        console.log(`  Cancellation result: ${cancelled ? '✅ Success' : '❌ Failed'}`);
      } else {
        console.log('  ℹ️  Cancellation blocked by business logic');
      }
      console.log('');
    }
    
    console.log('🎉 Business logic demonstration completed!');
  } catch (error) {
    console.error('Unexpected error during business logic demonstration:', error);
  }
}

async function createTestOrderWithStatus(status: string): Promise<string | null> {
  try {
    // الحصول على أول تاجر من قاعدة البيانات
    const { data: merchants, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .limit(1);

    if (merchantError) {
      console.error('Error fetching merchant:', merchantError);
      return null;
    }

    if (!merchants || merchants.length === 0) {
      console.error('No merchants found.');
      return null;
    }

    const merchantId = merchants[0].id;
    
    // الحصول على أول مستخدم من قاعدة البيانات
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (userError) {
      console.error('Error fetching user:', userError);
      return null;
    }

    if (!users || users.length === 0) {
      console.error('No users found.');
      return null;
    }

    const userId = users[0].id;

    // إنشاء طلب تجريبي
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: `BUSINESS-LOGIC-${status}-${Date.now()}`,
        customer_id: userId,
        merchant_id: merchantId,
        status: status,
        subtotal: 50.00,
        delivery_fee: 10.00,
        service_fee: 2.50,
        tax: 1.50,
        discount: 0.00,
        total: 64.00,
        payment_method: 'cash',
        payment_status: 'pending',
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating test order:', orderError);
      return null;
    }

    console.log(`  Created test order: ${order.order_number}`);
    return order.id;
  } catch (error) {
    console.error('Error creating test order:', error);
    return null;
  }
}

async function canOrderBeCancelled(orderId: string): Promise<boolean> {
  try {
    // الحصول على حالة الطلب
    const { data: order, error } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('Error fetching order:', error);
      return false;
    }

    // التحقق مما إذا كانت الحالة تسمح بالإلغاء
    return ALLOWED_CANCELLATION_STATUSES.includes(order.status);
  } catch (error) {
    console.error('Error checking order cancellation eligibility:', error);
    return false;
  }
}

async function cancelOrderWithBusinessLogic(orderId: string): Promise<boolean> {
  try {
    // التحقق من إمكانية الإلغاء أولاً
    const canCancel = await canOrderBeCancelled(orderId);
    
    if (!canCancel) {
      console.log('  ⚠️  Order cannot be cancelled based on business rules');
      return false;
    }

    // إلغاء الطلب
    const { error: cancelError } = await supabase
      .from('orders')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (cancelError) {
      console.error('  Error cancelling order:', cancelError);
      return false;
    }

    console.log('  🎉 Order cancelled successfully');
    return true;
  } catch (error) {
    console.error('Error during order cancellation:', error);
    return false;
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('business-logic-order-cancellation.ts');
if (isMainModule) {
  demonstrateBusinessLogicCancellation();
}