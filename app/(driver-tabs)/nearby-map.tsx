import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MapView, { Marker, UrlTile, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { spacing, typography, borderRadius, shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, MapPin, Package } from 'lucide-react-native';

interface AvailableOrder {
  id: string;
  order_number: string;
  merchant_name: string;
  dest_lat?: number;
  dest_lng?: number;
  distance: number;
}

export default function NearbyMapScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const colors = theme;
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [orders, setOrders] = useState<AvailableOrder[]>([]);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await fetchDriverLocation();
        await fetchOrders();
      } catch (e) {
        console.error('nearby map load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchDriverLocation = async () => {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== Location.PermissionStatus.GRANTED) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
          Alert.alert(
            'إذن الموقع مطلوب',
            'يرجى منح إذن الموقع لعرض الطلبات على الخريطة. يمكنك تفعيله من إعدادات الجهاز.',
            [
              { text: 'إلغاء', style: 'cancel' },
              {
                text: 'فتح الإعدادات',
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                },
              },
            ]
          );
          return;
        }
      }

      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 10000,
          mayShowUserSettingsDialog: true as any,
        } as any);
        setDriverLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch (primaryErr) {
        console.warn('⚠️ nearby-map: primary location fetch failed, trying last known', primaryErr);
        const last = await Location.getLastKnownPositionAsync();
        if (last?.coords) {
          setDriverLocation({ latitude: last.coords.latitude, longitude: last.coords.longitude });
        } else {
          Alert.alert('تنبيه', 'تعذر الحصول على موقعك حالياً. تأكد من تفعيل خدمات الموقع ثم أعد المحاولة.');
        }
      }
    } catch (e) {
      console.error('driver location error', e);
    }
  };

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // كم
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fetchOrders = async () => {
    try {
      console.log('🗺️ [Map] Fetching orders for map...');
      
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          created_at,
          customer_latitude,
          customer_longitude,
          merchant:merchants!orders_merchant_id_fkey (
            name_ar
          )
        `)
        .eq('status', 'ready')
        .is('driver_id', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [Map] Error fetching orders:', error);
        throw error;
      }
      
      console.log(`✅ [Map] Fetched ${ordersData?.length || 0} orders`);

      const mapped: AvailableOrder[] = (ordersData || []).map((o: any) => {
        const merchant = Array.isArray(o.merchant) ? o.merchant[0] : o.merchant;
        const dest_lat = o.customer_latitude ? parseFloat(o.customer_latitude) : undefined;
        const dest_lng = o.customer_longitude ? parseFloat(o.customer_longitude) : undefined;

        let distance = 0;
        if (driverLocation && dest_lat && dest_lng) {
          distance = Math.round(haversine(driverLocation.latitude, driverLocation.longitude, dest_lat, dest_lng) * 10) / 10;
        }
        return {
          id: o.id,
          order_number: o.order_number,
          merchant_name: merchant?.name_ar || 'متجر',
          dest_lat,
          dest_lng,
          distance,
        };
      });
      setOrders(mapped);
    } catch (e) {
      console.error('fetch orders error', e);
    }
  };

  const initialRegion: Region | undefined = useMemo(() => {
    if (driverLocation) {
      return {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      };
    }
    const firstWithCoords = orders.find(o => o.dest_lat && o.dest_lng);
    if (firstWithCoords) {
      return {
        latitude: firstWithCoords.dest_lat as number,
        longitude: firstWithCoords.dest_lng as number,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      };
    }
    return undefined;
  }, [driverLocation, orders]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل الخريطة...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الطلبات القريبة</Text>
        <View style={{ width: 22 }} />
      </View>

      {!initialRegion ? (
        <View style={styles.loadingContainer}>
          <Package size={48} color={colors.textLight} />
          <Text style={styles.loadingText}>لا توجد طلبات على الخريطة الآن</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <MapView style={{ flex: 1 }} initialRegion={initialRegion}>
            <UrlTile
              urlTemplate="https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=5fa1378c665246bf84d40a5909a01c7f"
              maximumZ={19}
              flipY={false}
            />

            {driverLocation && (
              <Marker
                coordinate={{ latitude: driverLocation.latitude, longitude: driverLocation.longitude }}
                title="موقعي"
                description="موقع السائق الحالي"
              >
                <View style={styles.driverDot} />
              </Marker>
            )}

            {orders
              .filter(o => o.dest_lat && o.dest_lng)
              .map((o) => (
                <Marker
                  key={o.id}
                  coordinate={{ latitude: o.dest_lat as number, longitude: o.dest_lng as number }}
                  title={`طلب #${o.order_number}`}
                  description={`${o.merchant_name}${o.distance ? ` • ${o.distance} كم` : ''}`}
                />
              ))}
          </MapView>

          <View style={styles.overlayPanel}>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>طلبات</Text>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendText}>موقعي</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.myLocationBtn}
            onPress={fetchDriverLocation}
          >
            <MapPin size={18} color={colors.white} />
            <Text style={styles.myLocationText}>موقعي</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textLight,
    marginTop: spacing.md,
  },
  driverDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
  },
  overlayPanel: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    ...shadows.small,
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...typography.caption,
    color: colors.text,
  },
  myLocationBtn: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    ...shadows.small,
  },
  myLocationText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
});
