const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

// Use environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'your_supabase_url_here';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_supabase_service_role_key_here';

console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY);

// Create Supabase client using service role key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function seedDatabase() {
  console.log('Seeding database with sample merchants...');

  // Use the existing user ID
  const userId = '5d7f980b-3836-4fb2-9d67-507cf716f15c';
  
  try {
    // Check if profile exists
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return;
    }

    console.log('Using existing profile:', profileData.full_name);

    const sampleMerchants = [
      {
        owner_id: userId,
        name_ar: 'برجر هاوس',
        name_en: 'Burger House',
        description_ar: 'أفضل برجر في المدينة',
        category: 'restaurant',
        logo_url: 'https://images.pexels.com/photos/1633578/pexels-photo-1633578.jpeg',
        banner_url: 'https://images.pexels.com/photos/1633578/pexels-photo-1633578.jpeg',
        rating: 4.5,
        total_reviews: 120,
        avg_delivery_time: 25,
        min_order_amount: 30,
        delivery_fee: 10,
        is_open: true,
        address: 'الرياض، حي النخيل',
        latitude: 24.7136,
        longitude: 46.6753,
        is_active: true,
      },
      {
        owner_id: userId,
        name_ar: 'بيتزا إكسبرس',
        name_en: 'Pizza Express',
        description_ar: 'بيتزا إيطالية أصلية',
        category: 'restaurant',
        logo_url: 'https://images.pexels.com/photos/2147491/pexels-photo-2147491.jpeg',
        banner_url: 'https://images.pexels.com/photos/2147491/pexels-photo-2147491.jpeg',
        rating: 4.3,
        total_reviews: 85,
        avg_delivery_time: 30,
        min_order_amount: 40,
        delivery_fee: 15,
        is_open: true,
        address: 'الرياض، حي العليا',
        latitude: 24.7243,
        longitude: 46.6780,
        is_active: true,
      },
      {
        owner_id: userId,
        name_ar: 'سوشي ماستر',
        name_en: 'Sushi Master',
        description_ar: 'سوشي ياباني فاخر',
        category: 'restaurant',
        logo_url: 'https://images.pexels.com/photos/357756/pexels-photo-357756.jpeg',
        banner_url: 'https://images.pexels.com/photos/357756/pexels-photo-357756.jpeg',
        rating: 4.7,
        total_reviews: 200,
        avg_delivery_time: 35,
        min_order_amount: 50,
        delivery_fee: 0,
        is_open: true,
        address: 'الرياض، حي الملقا',
        latitude: 24.7714,
        longitude: 46.6489,
        is_active: true,
      },
      {
        owner_id: userId,
        name_ar: 'صيدلية النهدي',
        name_en: 'Nahdi Pharmacy',
        description_ar: 'صيدلية شاملة',
        category: 'pharmacy',
        logo_url: 'https://images.pexels.com/photos/139398/thermometer-headache-pain-pills-139398.jpeg',
        banner_url: 'https://images.pexels.com/photos/139398/thermometer-headache-pain-pills-139398.jpeg',
        rating: 4.6,
        total_reviews: 150,
        avg_delivery_time: 20,
        min_order_amount: 0,
        delivery_fee: 10,
        is_open: true,
        address: 'الرياض، حي السليمانية',
        latitude: 24.7030,
        longitude: 46.7020,
        is_active: true,
      },
      {
        owner_id: userId,
        name_ar: 'بقالة الخير',
        name_en: 'Al Khair Grocery',
        description_ar: 'بقالة متكاملة',
        category: 'grocery',
        logo_url: 'https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg',
        banner_url: 'https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg',
        rating: 4.2,
        total_reviews: 95,
        avg_delivery_time: 25,
        min_order_amount: 20,
        delivery_fee: 5,
        is_open: true,
        address: 'الرياض، حي الربوة',
        latitude: 24.7392,
        longitude: 46.6553,
        is_active: true,
      },
      {
        owner_id: userId,
        name_ar: 'متجر الهدايا',
        name_en: 'Gifts Store',
        description_ar: 'هدايا مميزة لكل المناسبات',
        category: 'gifts',
        logo_url: 'https://images.pexels.com/photos/264842/pexels-photo-264842.jpeg',
        banner_url: 'https://images.pexels.com/photos/264842/pexels-photo-264842.jpeg',
        rating: 4.8,
        total_reviews: 75,
        avg_delivery_time: 40,
        min_order_amount: 100,
        delivery_fee: 20,
        is_open: true,
        address: 'الرياض، حي الورود',
        latitude: 24.7595,
        longitude: 46.7218,
        is_active: true,
      }
    ];

    // Insert merchants with owner_id
    for (const merchant of sampleMerchants) {
      const { data, error } = await supabase
        .from('merchants')
        .insert(merchant)
        .select();

      if (error) {
        console.error('Error inserting merchant:', error);
      } else {
        console.log('Inserted merchant:', data[0].name_ar);
      }
    }

    console.log('Database seeding completed!');
  } catch (error) {
    console.error('Unexpected error during seeding:', error);
  }
}

// Run the script if called directly
if (require.main === module) {
  seedDatabase();
}