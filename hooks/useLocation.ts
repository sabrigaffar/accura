import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface LocationState {
  location: UserLocation | null;
  loading: boolean;
  error: string | null;
  permissionStatus: Location.PermissionStatus | null;
}

/**
 * Hook لإدارة موقع المستخدم باستخدام GPS
 * Hook for managing user location using GPS
 */
export function useLocation() {
  const [state, setState] = useState<LocationState>({
    location: null,
    loading: false,
    error: null,
    permissionStatus: null,
  });

  /**
   * طلب إذن الموقع من المستخدم
   * Request location permission from user
   */
  const requestPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      setState(prev => ({ ...prev, permissionStatus: status }));
      
      if (status !== Location.PermissionStatus.GRANTED) {
        Alert.alert(
          'إذن الموقع مطلوب',
          'يحتاج التطبيق إلى إذن الوصول للموقع لحساب رسوم التوصيل بدقة.',
          [
            { text: 'إلغاء', style: 'cancel' },
            { 
              text: 'السماح', 
              onPress: () => requestPermission()
            }
          ]
        );
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'فشل في طلب إذن الموقع' 
      }));
      return false;
    }
  };

  /**
   * الحصول على الموقع الحالي
   * Get current location
   */
  const getCurrentLocation = async (): Promise<UserLocation | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // التحقق من الإذن أولاً
      const { status } = await Location.getForegroundPermissionsAsync();
      
      if (status !== Location.PermissionStatus.GRANTED) {
        const granted = await requestPermission();
        if (!granted) {
          setState(prev => ({ ...prev, loading: false }));
          return null;
        }
      }
      
      // الحصول على الموقع
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const userLocation: UserLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? undefined,
      };
      
      setState({
        location: userLocation,
        loading: false,
        error: null,
        permissionStatus: status,
      });
      
      return userLocation;
    } catch (error) {
      console.error('Error getting location:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'فشل في الحصول على الموقع';
      
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage 
      }));
      
      Alert.alert(
        'خطأ في الموقع',
        'لم نتمكن من تحديد موقعك. تأكد من تفعيل خدمات الموقع.',
        [{ text: 'حسناً' }]
      );
      
      return null;
    }
  };

  /**
   * التحقق من حالة الإذن
   * Check permission status
   */
  const checkPermissionStatus = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setState(prev => ({ ...prev, permissionStatus: status }));
    return status;
  };

  return {
    ...state,
    getCurrentLocation,
    requestPermission,
    checkPermissionStatus,
  };
}

/**
 * Hook بسيط للحصول على الموقع فوراً عند تحميل الصفحة
 * Simple hook to get location immediately on mount
 */
export function useCurrentLocation(autoFetch: boolean = false) {
  const location = useLocation();
  
  useEffect(() => {
    if (autoFetch) {
      location.getCurrentLocation();
    }
  }, [autoFetch]);
  
  return location;
}
