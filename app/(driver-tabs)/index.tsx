import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Map, Package, MapPin, Clock, DollarSign } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface AvailableOrder {
  id: string;
  order_number: string;
  customer_name: string;
  merchant_name: string;
  delivery_address: string;
  total: number;
  delivery_fee: number;
  estimated_delivery_time: number;
  distance: number;
  created_at: string;
  items_count: number;
}

type SortOption = 'newest' | 'highest_fee' | 'nearest';

export default function DriverAvailableOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<AvailableOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<AvailableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    fetchAvailableOrders();
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setDriverLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } else {
        Alert.alert(
          'تفعيل الموقع',
          'يرجى تفعيل صلاحية الموقع لحساب المسافة بدقة'
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  // Haversine formula لحساب المسافة بين نقطتين
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // نصف قطر الأرض بالكيلومتر
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return Math.round(distance * 10) / 10; // تقريب لمنزلة عشرية واحدة
  };

  const fetchAvailableOrders = async () => {
    try {
      setLoading(true);
      
      // جلب الطلبات الجاهزة للتوصيل (status = ready and no driver assigned)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total,
          delivery_fee,
          estimated_delivery_time,
          created_at,
          delivery_address:addresses!orders_delivery_address_id_fkey (
            street_address,
            city,
            district,
            latitude,
            longitude
          ),
          customer:profiles!orders_customer_id_fkey (
            full_name
          ),
          merchant:merchants!orders_merchant_id_fkey (
            name_ar
          )
        `)
        .eq('status', 'ready')
        .is('driver_id', null)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // جلب عدد الأصناف لكل طلب
      const ordersWithItems = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { count } = await supabase
            .from('order_items')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', order.id);

          const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
          const merchant = Array.isArray(order.merchant) ? order.merchant[0] : order.merchant;
          const address = Array.isArray(order.delivery_address) ? order.delivery_address[0] : order.delivery_address;

          return {
            id: order.id,
            order_number: order.order_number,
            customer_name: customer?.full_name || 'عميل',
            merchant_name: merchant?.name_ar || 'متجر',
            delivery_address: address
              ? `${address.street_address}, ${address.district || ''}, ${address.city}`
              : 'غير محدد',
            total: order.total,
            delivery_fee: order.delivery_fee || 0,
            estimated_delivery_time: order.estimated_delivery_time || 30,
            distance:
              driverLocation && address?.latitude && address?.longitude
                ? calculateDistance(
                    driverLocation.latitude,
                    driverLocation.longitude,
                    parseFloat(address.latitude),
                    parseFloat(address.longitude)
                  )
                : Math.floor(Math.random() * 5) + 1, // fallback إذا لم تكن الإحداثيات متوفرة
            created_at: order.created_at,
            items_count: count || 0,
          };
        })
      );

      setOrders(ordersWithItems);
      setFilteredOrders(ordersWithItems);
    } catch (error) {
      console.error('Error fetching available orders:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل الطلبات المتاحة');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const sortOrders = (ordersToSort: AvailableOrder[], sortOption: SortOption): AvailableOrder[] => {
    const sorted = [...ordersToSort];
    
    switch (sortOption) {
      case 'highest_fee':
        return sorted.sort((a, b) => b.delivery_fee - a.delivery_fee);
      case 'nearest':
        return sorted.sort((a, b) => a.distance - b.distance);
      case 'newest':
      default:
        return sorted.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  };

  useEffect(() => {
    if (orders.length > 0) {
      const sorted = sortOrders(orders, sortBy);
      setFilteredOrders(sorted);
    }
  }, [sortBy, orders]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAvailableOrders();
  };

  const handleAcceptOrder = async (orderId: string) => {
    if (!user) {
      Alert.alert('خطأ', 'يجب تسجيل الدخول أولاً');
      return;
    }

    Alert.alert(
      'تأكيد قبول الطلب',
      'هل تريد قبول هذا الطلب؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'قبول',
          onPress: async () => {
            try {
              setAccepting(orderId);

              // تحديث الطلب بإضافة السائق وتغيير الحالة
              const { error: updateError } = await supabase
                .from('orders')
                .update({
                  driver_id: user.id,
                  status: 'out_for_delivery',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', orderId);

              if (updateError) throw updateError;

              Alert.alert('نجح', 'تم قبول الطلب بنجاح', [
                {
                  text: 'موافق',
                  onPress: () => {
                    // الانتقال لصفحة الطلبات النشطة
                    router.push('/(driver-tabs)/active-orders');
                  },
                },
              ]);

              // تحديث القائمة
              fetchAvailableOrders();
            } catch (error) {
              console.error('Error accepting order:', error);
              Alert.alert('خطأ', 'حدث خطأ أثناء قبول الطلب');
            } finally {
              setAccepting(null);
            }
          },
        },
      ]
    );
  };

  const renderOrderCard = ({ item }: { item: AvailableOrder }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderNumberBadge}>
          <Package size={16} color={colors.primary} />
          <Text style={styles.orderNumber}>#{item.order_number}</Text>
        </View>
        <View style={styles.deliveryFeeBadge}>
          <DollarSign size={16} color={colors.success} />
          <Text style={styles.deliveryFeeText}>{item.delivery_fee.toFixed(2)} ر.س</Text>
        </View>
      </View>

      <View style={styles.orderInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>المتجر:</Text>
          <Text style={styles.infoValue}>{item.merchant_name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>العميل:</Text>
          <Text style={styles.infoValue}>{item.customer_name}</Text>
        </View>
        <View style={styles.infoRow}>
          <MapPin size={14} color={colors.textLight} />
          <Text style={styles.addressText} numberOfLines={1}>
            {item.delivery_address}
          </Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.detailItem}>
          <Clock size={16} color={colors.textLight} />
          <Text style={styles.detailText}>{item.estimated_delivery_time} دقيقة</Text>
        </View>
        <View style={styles.detailItem}>
          <Map size={16} color={colors.textLight} />
          <Text style={styles.detailText}>{item.distance} كم</Text>
        </View>
        <View style={styles.detailItem}>
          <Package size={16} color={colors.textLight} />
          <Text style={styles.detailText}>{item.items_count} صنف</Text>
        </View>
      </View>

      <View style={styles.orderFooter}>
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>إجمالي الطلب:</Text>
          <Text style={styles.totalAmount}>{item.total.toFixed(2)} ر.س</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.acceptButton,
            accepting === item.id && styles.acceptButtonDisabled,
          ]}
          onPress={() => handleAcceptOrder(item.id)}
          disabled={accepting === item.id}
        >
          {accepting === item.id ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.acceptButtonText}>قبول الطلب</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>الطلبات المتاحة</Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>متاح للتوصيل</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل الطلبات...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الطلبات المتاحة</Text>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>متاح للتوصيل</Text>
        </View>
      </View>

      {/* Sort Options */}
      {orders.length > 0 && (
        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>ترتيب حسب:</Text>
          <View style={styles.sortButtons}>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'newest' && styles.sortButtonActive]}
              onPress={() => setSortBy('newest')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'newest' && styles.sortButtonTextActive]}>
                الأحدث
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'highest_fee' && styles.sortButtonActive]}
              onPress={() => setSortBy('highest_fee')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'highest_fee' && styles.sortButtonTextActive]}>
                الأعلى أجراً
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'nearest' && styles.sortButtonActive]}
              onPress={() => setSortBy('nearest')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'nearest' && styles.sortButtonTextActive]}>
                الأقرب
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {filteredOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <Map size={64} color={colors.textLight} />
          <Text style={styles.emptyTitle}>لا توجد طلبات متاحة حالياً</Text>
          <Text style={styles.emptyText}>سيتم إعلامك عند توفر طلبات جديدة</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrderCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    color: colors.success,
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.lg,
  },
  emptyText: {
    ...typography.body,
    color: colors.textLight,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  listContent: {
    padding: spacing.md,
  },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  orderNumberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  orderNumber: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  deliveryFeeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  deliveryFeeText: {
    ...typography.bodyMedium,
    color: colors.success,
  },
  orderInfo: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoLabel: {
    ...typography.body,
    color: colors.textLight,
    width: 60,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.text,
    flex: 1,
  },
  addressText: {
    ...typography.body,
    color: colors.textLight,
    flex: 1,
    marginLeft: spacing.xs,
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    ...typography.caption,
    color: colors.text,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalSection: {
    flex: 1,
  },
  totalLabel: {
    ...typography.body,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  totalAmount: {
    ...typography.h3,
    color: colors.text,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minWidth: 120,
    alignItems: 'center',
  },
  acceptButtonDisabled: {
    opacity: 0.6,
  },
  acceptButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  sortContainer: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortLabel: {
    ...typography.body,
    color: colors.textLight,
    marginBottom: spacing.sm,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sortButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  sortButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortButtonText: {
    ...typography.caption,
    color: colors.text,
  },
  sortButtonTextActive: {
    color: colors.white,
  },
});
