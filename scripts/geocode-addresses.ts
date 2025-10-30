/**
 * أداة لتحديث إحداثيات GPS للعناوين الموجودة
 * تُستخدم مرة واحدة لإصلاح البيانات القديمة
 */

import { supabase } from '../lib/supabase';
import { geocodeAddress, delay } from '../utils/geocoding';

interface Address {
  id: string;
  street_address: string;
  city: string;
  district: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * جلب جميع العناوين بدون إحداثيات
 */
async function getAddressesWithoutCoordinates(): Promise<Address[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select('id, street_address, city, district, country, latitude, longitude')
    .or('latitude.is.null,longitude.is.null');

  if (error) {
    console.error('❌ خطأ في جلب العناوين:', error);
    return [];
  }

  return data || [];
}

/**
 * تحديث إحداثيات عنوان واحد
 */
async function updateAddressCoordinates(
  address: Address
): Promise<boolean> {
  try {
    // بناء العنوان الكامل
    const fullAddress = [
      address.street_address,
      address.district,
      address.city,
      address.country || 'مصر',
    ]
      .filter(Boolean)
      .join(', ');

    console.log(`🔍 جاري البحث عن: ${fullAddress}`);

    // تحويل العنوان إلى GPS
    const result = await geocodeAddress(fullAddress);

    if (!result) {
      console.log(`⚠️  لم يتم العثور على نتائج لـ: ${fullAddress}`);
      return false;
    }

    // تحديث قاعدة البيانات
    const { error } = await supabase
      .from('addresses')
      .update({
        latitude: result.latitude,
        longitude: result.longitude,
        updated_at: new Date().toISOString(),
      })
      .eq('id', address.id);

    if (error) {
      console.error(`❌ خطأ في التحديث:`, error);
      return false;
    }

    console.log(`✅ تم التحديث: ${result.latitude}, ${result.longitude}`);
    return true;
  } catch (error) {
    console.error(`❌ خطأ:`, error);
    return false;
  }
}

/**
 * تشغيل الأداة
 */
async function main() {
  console.log('🚀 بدء تحديث إحداثيات GPS للعناوين...\n');

  // 1. جلب العناوين
  const addresses = await getAddressesWithoutCoordinates();
  
  if (addresses.length === 0) {
    console.log('✅ جميع العناوين تحتوي على إحداثيات!');
    return;
  }

  console.log(`📊 تم العثور على ${addresses.length} عنوان بدون إحداثيات\n`);

  // 2. تحديث كل عنوان
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    console.log(`\n[${i + 1}/${addresses.length}] معالجة العنوان:`);
    console.log(`   ID: ${address.id}`);
    console.log(`   العنوان: ${address.street_address}`);

    const success = await updateAddressCoordinates(address);

    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // انتظار ثانية واحدة (rate limit لـ Nominatim)
    if (i < addresses.length - 1) {
      console.log('⏳ انتظار ثانية واحدة...');
      await delay(1000);
    }
  }

  // 3. عرض النتائج
  console.log('\n' + '='.repeat(50));
  console.log('📊 النتائج النهائية:');
  console.log(`✅ نجح: ${successCount}`);
  console.log(`❌ فشل: ${failCount}`);
  console.log(`📝 إجمالي: ${addresses.length}`);
  console.log('='.repeat(50));
}

// تشغيل الأداة
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ اكتملت العملية بنجاح!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ حدث خطأ:', error);
      process.exit(1);
    });
}

export { main as geocodeAllAddresses };
