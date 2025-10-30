import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Navigation, Phone, MapPin, Clock, Store, Home, Eye, EyeOff } from 'lucide-react-native';
import MapView, { Marker, UrlTile, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface DriverLocation {
  latitude: number;
  longitude: number;
  lastUpdate: string;
}

interface MerchantLocation {
  latitude: number;
  longitude: number;
  name: string;
}

interface CustomerLocation {
  latitude: number;
  longitude: number;
  address: string;
}

interface OrderDetails {
  id: string;
  order_number: string;
  status: string;
  driver_name: string;
  driver_phone: string;
  driver_vehicle_type: string;
  driver_vehicle_color?: string;
  driver_license_plate?: string;
  delivery_address: string;
  merchant_id: string;
}

export default function TrackDriverScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [merchantLocation, setMerchantLocation] = useState<MerchantLocation | null>(null);
  const [customerLocation, setCustomerLocation] = useState<CustomerLocation | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showMap, setShowMap] = useState(true);

  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    fetchOrderAndDriverLocation();
    
    // تحديث الموقع كل 20 ثانية
    const interval = setInterval(() => {
      fetchDriverLocation();
    }, 20000);

    return () => clearInterval(interval);
  }, [id]);

  const fetchOrderAndDriverLocation = async () => {
    try {
      setLoading(true);

      // جلب تفاصيل الطلب والسائق والمتجر
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          merchant_id,
          customer_latitude,
          customer_longitude,
          driver:profiles!orders_driver_id_fkey (
            id,
            full_name,
            phone_number,
            driver_profiles(
              vehicle_type,
              vehicle_color,
              license_plate,
              current_lat,
              current_lng,
              updated_at
            )
          ),
          merchant:merchants!orders_merchant_id_fkey (
            name_ar,
            latitude,
            longitude
          )
        `)
        .eq('id', id)
        .single();

      if (orderError) throw orderError;

      if (!orderData || !orderData.driver) {
        Alert.alert('⚠️ لم يتم تعيين سائق', 'هذا الطلب لم يتم تعيين سائق له بعد. سيتم إشعارك فور التعيين.', [{ text: 'حسناً' }]);
        router.back();
        return;
      }

      const driver = Array.isArray(orderData.driver) ? orderData.driver[0] : orderData.driver;
      const dprofRaw = driver?.driver_profiles;
      const dprof = Array.isArray(dprofRaw) ? dprofRaw[0] : dprofRaw;
      const merchant = Array.isArray(orderData.merchant) ? orderData.merchant[0] : orderData.merchant;

      // ✅ استخدام موقع العميل التلقائي
      const customerLat = orderData.customer_latitude;
      const customerLng = orderData.customer_longitude;

      setOrderDetails({
        id: orderData.id,
        order_number: orderData.order_number,
        status: orderData.status,
        driver_name: driver?.full_name || 'السائق',
        driver_phone: driver?.phone_number || '',
        driver_vehicle_type: getVehicleTypeText(dprof?.vehicle_type),
        driver_vehicle_color: dprof?.vehicle_color,
        driver_license_plate: dprof?.license_plate,
        delivery_address: customerLat && customerLng
          ? `موقع التوصيل: ${Number(customerLat).toFixed(4)}, ${Number(customerLng).toFixed(4)}`
          : 'غير محدد',
        merchant_id: orderData.merchant_id,
      });

      if (dprof && dprof.current_lat && dprof.current_lng) {
        setDriverLocation({
          latitude: parseFloat(dprof.current_lat),
          longitude: parseFloat(dprof.current_lng),
          lastUpdate: dprof.updated_at,
        });
      }

      // جلب موقع المتجر
      if (merchant?.latitude && merchant?.longitude) {
        setMerchantLocation({
          latitude: parseFloat(merchant.latitude),
          longitude: parseFloat(merchant.longitude),
          name: merchant.name_ar || 'المتجر',
        });
      }

      // جلب موقع العميل من الحقول المباشرة
      if (customerLat && customerLng) {
        setCustomerLocation({
          latitude: parseFloat(String(customerLat)),
          longitude: parseFloat(String(customerLng)),
          address: `موقع التوصيل`,
        });
      }
    } catch (error) {
      console.error('Error fetching order and driver:', error);
      Alert.alert('❌ خطأ', 'لم نتمكن من تحميل بيانات السائق. تحقق من الاتصال بالإنترنت.', [{ text: 'حسناً' }]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDriverLocation = async () => {
    try {
      setRefreshing(true);

      const { data: orderData, error } = await supabase
        .from('orders')
        .select(`
          driver:profiles!orders_driver_id_fkey (
            driver_profiles(
              current_lat,
              current_lng,
              updated_at
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      const driver = Array.isArray(orderData?.driver) ? orderData.driver[0] : orderData?.driver;
      const dprofRaw = driver?.driver_profiles;
      const dprof = Array.isArray(dprofRaw) ? dprofRaw[0] : dprofRaw;

      if (dprof && dprof.current_lat && dprof.current_lng) {
        setDriverLocation({
          latitude: parseFloat(dprof.current_lat),
          longitude: parseFloat(dprof.current_lng),
          lastUpdate: dprof.updated_at,
        });
      }
    } catch (error) {
      console.error('Error fetching driver location:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getVehicleTypeText = (type?: string) => {
    switch (type) {
      case 'car': return 'سيارة';
      case 'motorcycle': return 'دراجة نارية';
      case 'bicycle': return 'دراجة';
      default: return type || 'مركبة';
    }
  };

  const handleCallDriver = () => {
    if (!orderDetails?.driver_phone) {
      Alert.alert('❌ خطأ', 'رقم هاتف السائق غير متوفر', [{ text: 'حسناً' }]);
      return;
    }

    const phoneUrl = `tel:${orderDetails.driver_phone}`;
    Linking.canOpenURL(phoneUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(phoneUrl);
        } else {
          Alert.alert('❌ خطأ', 'لا يمكن إجراء المكالمة على هذا الجهاز', [{ text: 'حسناً' }]);
        }
      })
      .catch((err) => console.error('Error making call:', err));
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'out_for_delivery': return '🚗 في الطريق إليك';
      case 'delivered': return '✅ تم التسليم';
      case 'picked_up': return '📦 تم استلام الطلب';
      case 'heading_to_merchant': return '🛍️ في الطريق للمتجر';
      default: return status;
    }
  };

  const getLastUpdateTime = () => {
    if (!driverLocation?.lastUpdate) return 'غير متوفر';
    
    const updateTime = new Date(driverLocation.lastUpdate);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - updateTime.getTime()) / 1000);
    
    if (diffSeconds < 30) return 'الآن';
    if (diffSeconds < 60) return `منذ ${diffSeconds} ثانية`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
    return 'منذ أكثر من ساعة';
  };

  // حساب Polyline بناءً على حالة الطلب
  const routeCoordinates = useMemo(() => {
    if (!driverLocation) return [];

    const coords = [{
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
    }];

    // إذا الطلب لم يتم استلامه بعد، نرسم المسار للمتجر
    if (orderDetails?.status === 'accepted' || orderDetails?.status === 'preparing') {
      if (merchantLocation) {
        coords.push({
          latitude: merchantLocation.latitude,
          longitude: merchantLocation.longitude,
        });
      }
    } 
    // إذا الطلب في الطريق، نرسم المسار للعميل
    else if (orderDetails?.status === 'out_for_delivery') {
      if (customerLocation) {
        coords.push({
          latitude: customerLocation.latitude,
          longitude: customerLocation.longitude,
        });
      }
    }

    return coords;
  }, [driverLocation, merchantLocation, customerLocation, orderDetails?.status]);

  // لون Polyline بناءً على الحالة
  const polylineColor = useMemo(() => {
    if (orderDetails?.status === 'accepted' || orderDetails?.status === 'preparing') {
      return '#FF6B35'; // برتقالي للمسار نحو المتجر
    }
    return '#10B981'; // أخضر للمسار نحو العميل
  }, [orderDetails?.status]);

  // حساب المنطقة المرئية للخريطة
  const mapRegion = useMemo(() => {
    if (!driverLocation) return null;

    const coords: { latitude: number; longitude: number }[] = [driverLocation];
    if (merchantLocation && (orderDetails?.status === 'accepted' || orderDetails?.status === 'preparing')) {
      coords.push(merchantLocation);
    }
    if (customerLocation && orderDetails?.status === 'out_for_delivery') {
      coords.push(customerLocation);
    }

    if (coords.length === 1) {
      return {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    // حساب المركز
    const latitudes = coords.map(c => c.latitude);
    const longitudes = coords.map(c => c.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latDelta = (maxLat - minLat) * 1.5; // padding
    const lngDelta = (maxLng - minLng) * 1.5;

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(latDelta, 0.01),
      longitudeDelta: Math.max(lngDelta, 0.01),
    };
  }, [driverLocation, merchantLocation, customerLocation, orderDetails?.status]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>جاري تحميل موقع السائق...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!orderDetails || !driverLocation) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>تتبع السائق</Text>
        </View>
        <View style={styles.emptyContainer}>
          <MapPin size={64} color={theme.textLight} />
          <Text style={styles.emptyTitle}>موقع السائق غير متوفر</Text>
          <Text style={styles.emptyText}>
            السائق لم يقم بتحديث موقعه بعد، يرجى المحاولة لاحقاً
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تتبع السائق</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowMap(!showMap)} style={styles.iconButton}>
            {showMap ? (
              <EyeOff size={20} color={theme.text} />
            ) : (
              <Eye size={20} color={theme.text} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCallDriver} style={styles.callButton}>
            <Phone size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Map */}
      {showMap && mapRegion && (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={mapRegion}
            region={mapRegion}
          >
            {/* Thunderforest Cycle Tiles */}
            <UrlTile
              urlTemplate="https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=5fa1378c665246bf84d40a5909a01c7f"
              maximumZ={19}
              flipY={false}
            />
            
            {/* Polyline - المسار */}
            {routeCoordinates.length > 1 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor={polylineColor}
                strokeWidth={4}
                lineDashPattern={[1]}
              />
            )}

            {/* Driver Marker - 🟢 السائق */}
            <Marker
              coordinate={{
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
              }}
              title={orderDetails.driver_name}
              description={`${orderDetails.driver_vehicle_type}${
                orderDetails.driver_vehicle_color ? ` - ${orderDetails.driver_vehicle_color}` : ''
              }`}
            >
              <View style={styles.markerContainer}>
                <View style={[styles.markerIcon, { backgroundColor: '#10B981' }]}>
                  <Navigation size={20} color="#FFFFFF" />
                </View>
              </View>
            </Marker>

            {/* Merchant Marker - 🟠 المتجر */}
            {merchantLocation && (orderDetails.status === 'accepted' || orderDetails.status === 'preparing') && (
              <Marker
                coordinate={{
                  latitude: merchantLocation.latitude,
                  longitude: merchantLocation.longitude,
                }}
                title={merchantLocation.name}
                description="المتجر"
              >
                <View style={styles.markerContainer}>
                  <View style={[styles.markerIcon, { backgroundColor: '#FF6B35' }]}>
                    <Store size={20} color="#FFFFFF" />
                  </View>
                </View>
              </Marker>
            )}

            {/* Customer Marker - 🔴 العميل */}
            {customerLocation && (
              <Marker
                coordinate={{
                  latitude: customerLocation.latitude,
                  longitude: customerLocation.longitude,
                }}
                title="موقع التسليم"
                description={customerLocation.address}
              >
                <View style={styles.markerContainer}>
                  <View style={[styles.markerIcon, { backgroundColor: '#EF4444' }]}>
                    <Home size={20} color="#FFFFFF" />
                  </View>
                </View>
              </Marker>
            )}
          </MapView>

          {/* Refresh Indicator */}
          {refreshing && (
            <View style={styles.refreshIndicator}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={styles.refreshText}>جاري التحديث...</Text>
            </View>
          )}

          {/* Last Update Badge */}
          <View style={styles.updateBadge}>
            <Clock size={14} color={theme.textLight} />
            <Text style={styles.updateText}>آخر تحديث: {getLastUpdateTime()}</Text>
          </View>
        </View>
      )}

      {/* Driver Info Card */}
      <View style={styles.driverInfoCard}>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{getStatusText(orderDetails.status)}</Text>
        </View>

        <View style={styles.driverDetails}>
          <View style={styles.driverRow}>
            <Text style={styles.driverLabel}>السائق:</Text>
            <Text style={styles.driverValue}>{orderDetails.driver_name}</Text>
          </View>

          <View style={styles.driverRow}>
            <Text style={styles.driverLabel}>المركبة:</Text>
            <Text style={styles.driverValue}>
              {orderDetails.driver_vehicle_type}
              {orderDetails.driver_vehicle_color && ` - ${orderDetails.driver_vehicle_color}`}
            </Text>
          </View>

          {orderDetails.driver_license_plate && (
            <View style={styles.driverRow}>
              <Text style={styles.driverLabel}>رقم اللوحة:</Text>
              <Text style={styles.driverValue}>{orderDetails.driver_license_plate}</Text>
            </View>
          )}

          <View style={styles.driverRow}>
            <Text style={styles.driverLabel}>رقم الطلب:</Text>
            <Text style={styles.driverValue}>#{orderDetails.order_number}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.callDriverButton} onPress={handleCallDriver}>
          <Phone size={20} color={colors.white} />
          <Text style={styles.callDriverButtonText}>الاتصال بالسائق</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: theme.textLight,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
    color: theme.text,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  iconButton: {
    padding: spacing.xs,
  },
  callButton: {
    backgroundColor: colors.success,
    padding: spacing.sm,
    borderRadius: borderRadius.full,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: theme.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: theme.textLight,
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.surface,
    ...shadows.medium,
  },
  refreshIndicator: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    ...shadows.small,
  },
  refreshText: {
    ...typography.caption,
    color: theme.text,
    marginLeft: spacing.sm,
  },
  updateBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    ...shadows.small,
  },
  updateText: {
    ...typography.caption,
    color: theme.textLight,
    marginLeft: spacing.xs,
  },
  driverInfoCard: {
    backgroundColor: theme.surface,
    padding: spacing.md,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    ...shadows.large,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  statusText: {
    ...typography.bodyMedium,
    color: colors.success,
  },
  driverDetails: {
    marginBottom: spacing.md,
  },
  driverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  driverLabel: {
    ...typography.body,
    color: theme.textLight,
  },
  driverValue: {
    ...typography.bodyMedium,
    color: theme.text,
  },
  callDriverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  callDriverButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
});
