import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// تحميل متغيرات البيئة من ملف .env
dotenv.config();

// استخدام المتغيرات البيئية
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'your_supabase_url_here';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_supabase_service_role_key_here';

console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY);

// استخدام service role key لإنشاء عميل Supabase (يتجاوز سياسات RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function createTestOrder() {
  console.log('Creating a test order...');

  try {
    // الحصول على أول تاجر من قاعدة البيانات
    const { data: merchantData, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .limit(1);

    if (merchantError) {
      console.error('Error fetching merchant:', merchantError);
      return;
    }

    if (!merchantData || merchantData.length === 0) {
      console.error('No merchant found. Please seed merchants first.');
      return;
    }

    const merchantId = merchantData[0].id;
    console.log('Using merchant ID:', merchantId);

    // إنشاء منتجات تجريبية للتجار
    const sampleProducts = [
      {
        merchant_id: merchantId,
        name_ar: 'برجر كلاسيك',
        name_en: 'Classic Burger',
        description_ar: 'برجر لذيذ مع لحم بقري وجبن و خس و طماطم',
        price: 20.00,
        image_url: 'https://images.pexels.com/photos/1633578/pexels-photo-1633578.jpeg',
        category: 'وجبات سريعة',
        is_available: true,
        preparation_time: 15,
      },
      {
        merchant_id: merchantId,
        name_ar: 'بطاطس مقلية',
        name_en: 'French Fries',
        description_ar: 'بطاطس مقلية مقرمشة',
        price: 10.00,
        image_url: 'https://images.pexels.com/photos/1596888/pexels-photo-1596888.jpeg',
        category: 'مقبلات',
        is_available: true,
        preparation_time: 10,
      },
    ];

    const productIds = [];
    for (const product of sampleProducts) {
      const { data: productData, error: productError } = await supabase
        .from('merchant_products')
        .insert(product)
        .select();

      if (productError) {
        console.error('Error creating product:', productError);
        return;
      }

      productIds.push(productData[0].id);
      console.log('Created product:', productData[0].name_ar, 'with ID:', productData[0].id);
    }

    // الحصول على أول مستخدم من قاعدة البيانات
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (userError) {
      console.error('Error fetching user:', userError);
      return;
    }

    if (!userData || userData.length === 0) {
      console.error('No user found. Please create a user first.');
      return;
    }

    const userId = userData[0].id;
    console.log('Using user ID:', userId);

    // إنشاء عنوان توصيل تجريبي
    const { data: addressData, error: addressError } = await supabase
      .from('addresses')
      .insert({
        user_id: userId,
        title: 'المنزل',
        street_address: 'شارع الملك فهد',
        city: 'الرياض',
        district: 'النخيل',
        building_number: '123',
        floor_number: '3',
        is_default: true,
      })
      .select();

    if (addressError) {
      console.error('Error creating address:', addressError);
      return;
    }

    const addressId = addressData[0].id;
    console.log('Created address with ID:', addressId);

    // إنشاء طلب تجريبي
    const orderNumber = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: userId,
        merchant_id: merchantId,
        delivery_address_id: addressId,
        status: 'pending',
        subtotal: 50.00,
        delivery_fee: 10.00,
        service_fee: 2.50,
        tax: 1.50,
        discount: 0.00,
        total: 64.00,
        payment_method: 'cash',
        payment_status: 'pending',
        delivery_notes: 'يرجى تسليم الطلب إلى حارس المبنى',
      })
      .select();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return;
    }

    const orderId = orderData[0].id;
    console.log('Created order with ID:', orderId);
    console.log('Order number:', orderNumber);

    // إنشاء عناصر الطلب التجريبية
    const orderItems = [
      {
        order_id: orderId,
        product_id: productIds[0],
        product_name_ar: 'برجر كلاسيك',
        quantity: 2,
        unit_price: 20.00,
        total_price: 40.00,
      },
      {
        order_id: orderId,
        product_id: productIds[1],
        product_name_ar: 'بطاطس مقلية',
        quantity: 1,
        unit_price: 10.00,
        total_price: 10.00,
      },
    ];

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      return;
    }

    console.log('Created order items successfully!');
    console.log('Test order created successfully!');
    console.log('Order ID:', orderId);
    console.log('You can now test the order detail screen by navigating to /order/' + orderId);
  } catch (error) {
    console.error('Unexpected error during order creation:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('create-test-order.ts');
if (isMainModule) {
  createTestOrder();
}