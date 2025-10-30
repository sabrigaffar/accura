import { useState } from 'react';
import { geocodeAddress, reverseGeocode, isValidCoordinates } from '@/utils/geocoding';
import { supabase } from '@/lib/supabase';

interface UseGeocodingReturn {
  geocode: (address: string, country?: string) => Promise<{ lat: number; lng: number } | null>;
  reverseGeocode: (lat: number, lng: number) => Promise<string | null>;
  updateAddressCoordinates: (addressId: string, lat: number, lng: number) => Promise<boolean>;
  geocodeAndUpdate: (addressId: string, address: string, country?: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

/**
 * Hook لاستخدام Geocoding في التطبيق
 */
export function useGeocoding(): UseGeocodingReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * تحويل عنوان إلى GPS
   */
  const geocode = async (
    address: string,
    country: string = 'مصر'
  ): Promise<{ lat: number; lng: number } | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await geocodeAddress(address, country);
      
      if (!result) {
        setError('لم نتمكن من العثور على موقع هذا العنوان');
        return null;
      }

      return {
        lat: result.latitude,
        lng: result.longitude,
      };
    } catch (err) {
      setError('حدث خطأ أثناء تحويل العنوان');
      console.error('Geocoding error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * تحديث إحداثيات عنوان في قاعدة البيانات
   */
  const updateAddressCoordinates = async (
    addressId: string,
    lat: number,
    lng: number
  ): Promise<boolean> => {
    try {
      if (!isValidCoordinates(lat, lng)) {
        setError('الإحداثيات غير صحيحة');
        return false;
      }

      const { error: updateError } = await supabase
        .from('addresses')
        .update({
          latitude: lat,
          longitude: lng,
          updated_at: new Date().toISOString(),
        })
        .eq('id', addressId);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      setError('فشل تحديث الإحداثيات');
      console.error('Update coordinates error:', err);
      return false;
    }
  };

  /**
   * تحويل عنوان وتحديثه في قاعدة البيانات مباشرة
   */
  const geocodeAndUpdate = async (
    addressId: string,
    address: string,
    country: string = 'مصر'
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      // 1. تحويل العنوان إلى GPS
      const result = await geocodeAddress(address, country);
      
      if (!result) {
        setError('لم نتمكن من العثور على موقع هذا العنوان');
        return false;
      }

      // 2. تحديث قاعدة البيانات
      const updated = await updateAddressCoordinates(
        addressId,
        result.latitude,
        result.longitude
      );

      if (updated) {
        console.log(`✅ تم تحديث العنوان ${addressId} بنجاح`);
        console.log(`📍 GPS: ${result.latitude}, ${result.longitude}`);
      }

      return updated;
    } catch (err) {
      setError('حدث خطأ أثناء العملية');
      console.error('Geocode and update error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    geocode,
    reverseGeocode,
    updateAddressCoordinates,
    geocodeAndUpdate,
    loading,
    error,
  };
}
