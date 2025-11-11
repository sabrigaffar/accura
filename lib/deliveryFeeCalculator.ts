/**
 * دوال حساب المسافة ورسوم التوصيل
 * Distance and Delivery Fee Calculator
 */
import { supabase } from './supabase';

export interface Location {
  latitude: number;
  longitude: number;
}

/**
 * حساب المسافة بين نقطتين باستخدام Haversine formula
 * Calculate distance between two points using Haversine formula
 * 
 * @param point1 - النقطة الأولى (المتجر)
 * @param point2 - النقطة الثانية (العميل)
 * @returns المسافة بالكيلومتر
 */
export function calculateDistance(point1: Location, point2: Location): number {
  const R = 6371; // نصف قطر الأرض بالكيلومتر / Earth's radius in km
  
  const lat1 = point1.latitude * Math.PI / 180;
  const lat2 = point2.latitude * Math.PI / 180;
  const deltaLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const deltaLon = (point2.longitude - point1.longitude) * Math.PI / 180;

  const a = 
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * حساب رسوم التوصيل حسب المسافة
 * Calculate delivery fee based on distance
 * 
 * القاعدة: 10 جنيه لكل كيلومتر
 * كل متر من 1 إلى 1000 = 1 كيلو
 * 
 * أمثلة:
 * - 300 متر = 10 جنيه
 * - 1400 متر = 20 جنيه
 * - 2500 متر = 30 جنيه
 * 
 * @param distanceInKm - المسافة بالكيلومتر
 * @returns رسوم التوصيل
 */
export function calculateDeliveryFee(distanceInKm: number): number {
  // قراءة السعر الأساسي لكل كم من إعدادات المنصة (مع كاش داخلي)
  const feePerKm = getBaseFeePerKmCached();
  
  // تقريب لأعلى كيلو كامل
  // مثلاً: 0.3 كم → 1 كم
  // 1.4 كم → 2 كم
  // 2.5 كم → 3 كم
  const kilometers = Math.ceil(distanceInKm);
  
  const fee = kilometers * feePerKm;
  
  return fee;
}

/**
 * حساب رسوم التوصيل من المسافة بالمتر
 * Calculate delivery fee from distance in meters
 * 
 * @param distanceInMeters - المسافة بالمتر
 * @returns رسوم التوصيل
 */
export function calculateDeliveryFeeFromMeters(distanceInMeters: number): number {
  const distanceInKm = distanceInMeters / 1000;
  return calculateDeliveryFee(distanceInKm);
}

/**
 * تنسيق المسافة للعرض
 * Format distance for display
 * 
 * @param distanceInKm - المسافة بالكيلومتر
 * @returns نص منسق (مثلاً: "2.5 كم" أو "500 م")
 */
export function formatDistance(distanceInKm: number): string {
  if (distanceInKm < 1) {
    const meters = Math.round(distanceInKm * 1000);
    return `${meters} م`;
  }
  return `${distanceInKm.toFixed(1)} كم`;
}

/**
 * معلومات كاملة عن التوصيل
 * Complete delivery information
 */
export interface DeliveryInfo {
  distanceKm: number;
  distanceText: string;
  deliveryFee: number;
  estimatedTime: number; // بالدقائق
}

/**
 * حساب معلومات التوصيل الكاملة
 * Calculate complete delivery information
 * 
 * @param storeLocation - موقع المتجر
 * @param customerLocation - موقع العميل
 * @param baseDeliveryTime - متوسط وقت التوصيل الأساسي (دقيقة)
 * @returns معلومات التوصيل الكاملة
 */
export function calculateDeliveryInfo(
  storeLocation: Location,
  customerLocation: Location,
  baseDeliveryTime: number = 30
): DeliveryInfo {
  const distanceKm = calculateDistance(storeLocation, customerLocation);
  const distanceText = formatDistance(distanceKm);
  const deliveryFee = calculateDeliveryFee(distanceKm);
  
  // حساب الوقت المقدر: وقت أساسي + دقيقة لكل كيلو
  const estimatedTime = Math.round(baseDeliveryTime + (distanceKm * 2));
  
  return {
    distanceKm,
    distanceText,
    deliveryFee,
    estimatedTime
  };
}

/**
 * التحقق من إمكانية التوصيل
 * Check if delivery is possible
 * 
 * @param distanceKm - المسافة بالكيلومتر
 * @param maxDeliveryDistance - أقصى مسافة توصيل (افتراضي: 15 كم)
 * @returns هل يمكن التوصيل؟
 */
export function canDeliver(distanceKm: number, maxDeliveryDistance: number = 15): boolean {
  return distanceKm <= maxDeliveryDistance;
}

/**
 * كاش داخلي لإعداد base_fee_per_km من جدول platform_settings
 * - للمكالمات المتزامنة نستخدم الكاش الحالي ونحاول تحديثه في الخلفية.
 * - نوفر دالة Async للحصول على نتيجة دقيقة فوراً بعد الجلب.
 */
let baseFeePerKmCache: number | null = null;
let baseFeePerKmFetchedAt = 0;
let baseFeeFetchPromise: Promise<number> | null = null;
const BASE_FEE_TTL_MS = 5 * 60 * 1000; // 5 دقائق

async function fetchBaseFeePerKm(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_base_fee_per_km');
    if (error) throw error;
    const val = Number(data ?? 10);
    baseFeePerKmCache = isFinite(val) ? val : 10;
    baseFeePerKmFetchedAt = Date.now();
    return baseFeePerKmCache;
  } catch {
    // في حال فشل القراءة (مثلاً مستخدم غير مسجل)، نرجع آخر قيمة أو 10 افتراضياً
    return baseFeePerKmCache ?? 10;
  }
}

function ensureBaseFeeFresh() {
  const now = Date.now();
  const stale = !baseFeePerKmCache || (now - baseFeePerKmFetchedAt > BASE_FEE_TTL_MS);
  if (stale && !baseFeeFetchPromise) {
    baseFeeFetchPromise = fetchBaseFeePerKm().finally(() => {
      baseFeeFetchPromise = null;
    });
  }
}

export function getBaseFeePerKmCached(): number {
  ensureBaseFeeFresh();
  return baseFeePerKmCache ?? 10;
}

export async function calculateDeliveryFeeAsync(distanceInKm: number): Promise<number> {
  const feePerKm = await fetchBaseFeePerKm();
  const kilometers = Math.ceil(distanceInKm);
  return kilometers * feePerKm;
}

export async function refreshBaseFeePerKm(): Promise<void> {
  await fetchBaseFeePerKm();
}
