import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
  TextInput,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Navigation, Check, Save } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface AddressComponents {
  street?: string;
  city?: string;
  district?: string;
  country?: string;
  fullAddress?: string;
}

export default function PickLocationScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const mapRef = useRef<MapView>(null);

  // State للموقع
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationCoords | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  // State للعنوان
  const [address, setAddress] = useState<AddressComponents>({});
  const [addressTitle, setAddressTitle] = useState('');
  const [saveAddress, setSaveAddress] = useState(false); // حفظ العنوان أم لا

  useEffect(() => {
    requestLocationPermission();
  }, []);

  // طلب إذن الموقع والحصول على الموقع الحالي
  const requestLocationPermission = async () => {
    try {
      setLoading(true);

      // طلب الإذن
      const perm = await Location.getForegroundPermissionsAsync();
      let status = perm.status;
      if (status !== Location.PermissionStatus.GRANTED) {
        const res = await Location.requestForegroundPermissionsAsync();
        status = res.status;
      }

      if (status !== Location.PermissionStatus.GRANTED) {
        Alert.alert(
          'إذن الموقع مطلوب',
          'يحتاج التطبيق إلى إذن الوصول للموقع لتحديد عنوان التوصيل.\n\nالرجاء السماح بالوصول للموقع من إعدادات التطبيق.',
          [
            { text: 'إلغاء', onPress: () => router.back(), style: 'cancel' },
            { 
              text: 'فتح الإعدادات', 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  // على أندرويد
                  Linking.openSettings();
                }
              } 
            }
          ]
        );
        setLoading(false);
        return;
      }

      // الحصول على الموقع الحالي
      let currentLocation;
      try {
        currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 10000,
          mayShowUserSettingsDialog: true as any,
        } as any);
      } catch (primaryErr) {
        console.warn('⚠️ pick-location: primary getCurrentPosition failed, trying last known', primaryErr);
        currentLocation = await Location.getLastKnownPositionAsync();
        if (!currentLocation) {
          throw primaryErr;
        }
      }

      const coords: LocationCoords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      setLocation(coords);
      setSelectedLocation(coords);

      // تركيز الخريطة على الموقع الحالي
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          ...coords,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }

      // جلب العنوان
      await reverseGeocode(coords);

    } catch (error: any) {
      console.error('Error getting location:', error);
      Alert.alert(
        'خطأ',
        'لم نتمكن من الحصول على موقعك الحالي.\n\nتأكد من:\n• تفعيل خدمات الموقع\n• الاتصال بالإنترنت\n• السماح للتطبيق بالوصول للموقع',
        [
          { text: 'إعادة المحاولة', onPress: requestLocationPermission },
          { text: 'إلغاء', onPress: () => router.back(), style: 'cancel' }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  // تحويل الإحداثيات إلى عنوان باستخدام Nominatim API
  const reverseGeocode = async (coords: LocationCoords) => {
    try {
      setLoadingAddress(true);

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&accept-language=ar`,
        {
          headers: {
            'User-Agent': 'DeliveryApp/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error('فشل في جلب العنوان');
      }

      const data = await response.json();

      if (data && data.address) {
        const addressData: AddressComponents = {
          street: data.address.road || data.address.street || '',
          city: data.address.city || data.address.town || data.address.village || '',
          district: data.address.suburb || data.address.neighbourhood || data.address.quarter || '',
          country: data.address.country || '',
          fullAddress: data.display_name || '',
        };

        setAddress(addressData);

        // تعيين عنوان افتراضي إذا كان فارغاً
        if (!addressTitle) {
          const title = addressData.district || addressData.city || 'موقعي';
          setAddressTitle(title);
        }
      }
    } catch (error: any) {
      console.error('Error reverse geocoding:', error);
      
      // في حالة عدم توفر الإنترنت أو فشل API
      setAddress({
        fullAddress: `خط العرض: ${coords.latitude.toFixed(6)}, خط الطول: ${coords.longitude.toFixed(6)}`,
      });
      
      Alert.alert(
        'تنبيه',
        'لم نتمكن من تحديد العنوان تلقائياً. يمكنك إدخال العنوان يدوياً أو إعادة المحاولة.\n\nتأكد من الاتصال بالإنترنت.',
        [{ text: 'حسناً' }]
      );
    } finally {
      setLoadingAddress(false);
    }
  };

  // عند تحريك الخريطة - تحديث الموقع المحدد
  const handleRegionChangeComplete = async (region: any) => {
    const newCoords: LocationCoords = {
      latitude: region.latitude,
      longitude: region.longitude,
    };

    setSelectedLocation(newCoords);
    
    // جلب العنوان الجديد
    await reverseGeocode(newCoords);
  };

  // الرجوع للموقع الحالي
  const goToCurrentLocation = async () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        ...location,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);

      setSelectedLocation(location);
      await reverseGeocode(location);
    }
  };

  // حفظ الموقع
  const confirmLocation = async () => {
    if (!selectedLocation) {
      Alert.alert('خطأ', 'الرجاء تحديد موقع التوصيل');
      return;
    }

    if (saveAddress && !addressTitle.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال اسم للعنوان لحفظه (مثل: المنزل، العمل)');
      return;
    }

    try {
      setSavingLocation(true);

      let addressId = null;

      // إذا كان المستخدم يريد حفظ العنوان
      if (saveAddress) {
        const { data, error } = await supabase
          .from('addresses')
          .insert({
            user_id: user?.id,
            title: addressTitle.trim(),
            street_address: address.street || 'غير محدد',
            city: address.city || 'غير محدد',
            district: address.district || null,
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            is_default: false,
          })
          .select()
          .single();

        if (error) throw error;
        addressId = data.id;
      }

      // العودة للصفحة السابقة مع بيانات الموقع
      // يتم تمرير الموقع كـ params ليستخدم في الطلب
      if (params.returnTo) {
        // الاحتفاظ بجميع الـ params القديمة (مثل items و merchantId)
        const newParams: any = {
          ...params, // الاحتفاظ بكل شيء
          selectedLat: selectedLocation.latitude.toString(),
          selectedLon: selectedLocation.longitude.toString(),
          selectedAddress: address.fullAddress || `${address.street || ''}, ${address.city || ''}`.trim(),
          addressId: addressId || '',
        };
        
        // حذف returnTo لتجنب loop
        delete newParams.returnTo;
        
        router.replace({
          pathname: params.returnTo as any,
          params: newParams
        });
      } else {
        router.back();
      }
    } catch (error: any) {
      console.error('Error saving location:', error);
      Alert.alert('خطأ', error.message || 'حدث خطأ أثناء حفظ العنوان');
    } finally {
      setSavingLocation(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جاري تحديد موقعك...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تحديد عنوان التوصيل</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={
            location
              ? {
                  ...location,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }
              : undefined
          }
          onRegionChangeComplete={handleRegionChangeComplete}
          showsUserLocation
          showsMyLocationButton={false}
        />

        {/* Pin ثابت في المنتصف */}
        <View style={styles.centerMarker}>
          <MapPin size={40} color={colors.error} fill={colors.error} />
        </View>

        {/* زر الموقع الحالي */}
        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={goToCurrentLocation}
        >
          <Navigation size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Address Info Panel */}
      <View style={styles.bottomPanel}>
        {loadingAddress ? (
          <View style={styles.loadingAddressContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingAddressText}>جاري تحديد العنوان...</Text>
          </View>
        ) : (
          <>
            {/* Checkbox لحفظ العنوان */}
            <TouchableOpacity
              style={styles.saveAddressContainer}
              onPress={() => setSaveAddress(!saveAddress)}
            >
              <View style={[
                styles.checkbox,
                saveAddress && styles.checkboxChecked
              ]}>
                {saveAddress && <Check size={16} color={colors.white} />}
              </View>
              <View style={styles.saveAddressTextContainer}>
                <Text style={styles.saveAddressLabel}>💾 حفظ هذا العنوان</Text>
                <Text style={styles.saveAddressHint}>
                  (لاستخدامه في طلبات قادمة)
                </Text>
              </View>
            </TouchableOpacity>

            {saveAddress && (
              <View style={styles.addressSection}>
                <Text style={styles.addressLabel}>اسم العنوان *</Text>
                <TextInput
                  style={styles.addressTitleInput}
                  value={addressTitle}
                  onChangeText={setAddressTitle}
                  placeholder="مثال: المنزل، العمل، مكتب الشركة"
                  placeholderTextColor={colors.textLight}
                />
              </View>
            )}

            <View style={styles.addressSection}>
              <Text style={styles.addressLabel}>العنوان التفصيلي</Text>
              <View style={styles.addressBox}>
                {address.street && (
                  <Text style={styles.addressText}>📍 {address.street}</Text>
                )}
                {address.district && (
                  <Text style={styles.addressText}>🏘️ {address.district}</Text>
                )}
                {address.city && (
                  <Text style={styles.addressText}>🏙️ {address.city}</Text>
                )}
                {selectedLocation && (
                  <Text style={styles.coordsText}>
                    📌 {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                (savingLocation || !selectedLocation) && styles.confirmButtonDisabled
              ]}
              onPress={confirmLocation}
              disabled={savingLocation || !selectedLocation}
            >
              {savingLocation ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Check size={20} color={colors.white} />
                  <Text style={styles.confirmButtonText}>تأكيد الموقع</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textLight,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  centerMarker: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40,
    zIndex: 10,
  },
  currentLocationButton: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  bottomPanel: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.large,
  },
  loadingAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  loadingAddressText: {
    ...typography.body,
    color: colors.textLight,
    marginLeft: spacing.md,
  },
  addressSection: {
    marginBottom: spacing.lg,
  },
  addressLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  addressTitleInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.lightGray,
    textAlign: 'right',
  },
  addressBox: {
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  addressText: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'right',
  },
  coordsText: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    ...shadows.small,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  saveAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginRight: spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  saveAddressTextContainer: {
    flex: 1,
  },
  saveAddressLabel: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  saveAddressHint: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: 2,
  },
});
