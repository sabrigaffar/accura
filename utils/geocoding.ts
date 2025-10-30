/**
 * Geocoding Utility
 * تحويل العناوين النصية إلى إحداثيات GPS
 * باستخدام Nominatim API (OpenStreetMap - مجاني)
 */

interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName?: string;
}

/**
 * تحويل عنوان نصي إلى إحداثيات GPS
 * @param address - العنوان النصي (مثل: "جمارك، الرياض")
 * @param country - الدولة (افتراضي: "مصر")
 * @returns إحداثيات GPS أو null إذا فشل
 */
export async function geocodeAddress(
  address: string,
  country: string = 'مصر'
): Promise<GeocodingResult | null> {
  try {
    // بناء العنوان الكامل
    const fullAddress = `${address}, ${country}`;
    
    // استدعاء Nominatim API
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(fullAddress)}&` +
      `format=json&` +
      `limit=1&` +
      `accept-language=ar`,
      {
        headers: {
          'User-Agent': 'DeliveryApp/1.0', // مطلوب من Nominatim
        },
      }
    );

    if (!response.ok) {
      console.error('Geocoding API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      console.warn(`No results found for address: ${address}`);
      return null;
    }

    const result = data[0];
    
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      displayName: result.display_name,
    };
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
}

/**
 * تحويل إحداثيات GPS إلى عنوان نصي (Reverse Geocoding)
 * @param latitude - خط العرض
 * @param longitude - خط الطول
 * @returns العنوان النصي أو null إذا فشل
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?` +
      `lat=${latitude}&` +
      `lon=${longitude}&` +
      `format=json&` +
      `accept-language=ar`,
      {
        headers: {
          'User-Agent': 'DeliveryApp/1.0',
        },
      }
    );

    if (!response.ok) {
      console.error('Reverse geocoding API error:', response.status);
      return null;
    }

    const data = await response.json();

    return data.display_name || null;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return null;
  }
}

/**
 * التحقق من صحة الإحداثيات
 * @param latitude - خط العرض
 * @param longitude - خط الطول
 * @returns true إذا كانت صحيحة
 */
export function isValidCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  if (latitude == null || longitude == null) return false;
  
  return (
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * تأخير للالتزام بـ rate limit (1 request/second)
 * Nominatim يسمح بطلب واحد كل ثانية
 */
export function delay(ms: number = 1000): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
