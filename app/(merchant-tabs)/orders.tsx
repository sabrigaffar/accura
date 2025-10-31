import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ShoppingCart, Clock, CheckCircle, XCircle, Package } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useActiveStore } from '@/contexts/ActiveStoreContext';
import { StoreButton } from '@/components/StoreSelector';
import { useMerchantRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { useAuth } from '@/contexts/AuthContext';

interface Order {
  id: string;
  order_number?: string;
  customer_id: string;
  status: string;
  total: number;  // إجمالي العميل (legacy)
  product_total?: number | null;
  delivery_fee?: number | null;
  service_fee?: number | null;
  tax_amount?: number | null;
  customer_total?: number | null;
  merchant_amount?: number | null; // مستحقات المتجر
  created_at: string;
  customer_latitude?: number | string | null;
  customer_longitude?: number | string | null;
  delivery_address?: any;
  profiles?: {
    full_name: string;
    phone_number: string;
  } | null;
  order_items?: Array<{
    id: string;
    quantity: number;
    price: number;
    products?: {
      name_ar?: string;
      name?: string;
    };
  }>;
}

const ORDER_STATUSES = [
  { value: 'all', label: 'الكل', color: colors.text },
  { value: 'pending', label: 'قيد الانتظار', color: colors.warning },
  { value: 'accepted', label: 'مقبول', color: colors.success },
  { value: 'preparing', label: 'قيد التحضير', color: colors.primary },
  { value: 'ready', label: 'جاهز', color: colors.success },
  { value: 'rejected', label: 'مرفوض', color: colors.error },
];

export default function MerchantOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const { activeStore, stores, isAllStoresSelected } = useActiveStore();
  const fetchingRef = React.useRef(false);

  // Real-time subscriptions للطلبات
  const merchantIds = React.useMemo(() => stores.map(s => s.id), [stores]);
  useMerchantRealtimeOrders(
    user?.id || '',
    merchantIds,
    (event, order) => {
      console.log('🏪 [Merchant] Order event:', event, order);
      if (event === 'INSERT') {
        Alert.alert(
          '🔔 طلب جديد!',
          `طلب جديد #${order.order_number} بقيمة ${order.customer_total || order.total} جنيه`,
          [
            { text: 'حسناً', onPress: () => fetchOrders() }
          ]
        );
      } else if (event === 'UPDATE') {
        fetchOrders();
      }
    }
  );

  useEffect(() => {
    fetchOrders();
  }, [activeStore, isAllStoresSelected]);

  // إعادة تحميل الطلبات عند العودة للصفحة (مهم لعرض الطلبات الجديدة)
  useFocusEffect(
    useCallback(() => {
      console.log('👩‍💼 [Merchant] Orders screen focused - refreshing orders...');
      fetchOrders();
    }, [activeStore, isAllStoresSelected])
  );

  const fetchOrders = async () => {
    try {
      if (fetchingRef.current) {
        return;
      }
      fetchingRef.current = true;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ [Merchant] No user - cannot fetch orders');
        return;
      }

      console.log('🔍 [Merchant] Fetching orders for merchant:', user.id);

      // جلب المتاجر التي يملكها التاجر
      const { data: merchantStores, error: storesError } = await supabase
        .from('merchants')
        .select('id')
        .eq('owner_id', user.id);

      if (storesError) {
        console.error('❌ [Merchant] Error fetching stores:', storesError);
        throw storesError;
      }

      if (!merchantStores || merchantStores.length === 0) {
        console.log('⚠️ [Merchant] No stores found for this merchant');
        setOrders([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const storeIds = merchantStores.map(s => s.id);
      console.log('🏪 [Merchant] Store IDs:', storeIds);

      // جلب الطلبات من جميع متاجر التاجر
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_id,
          status,
          total,
          product_total,
          delivery_fee,
          service_fee,
          tax_amount,
          customer_total,
          created_at,
          customer_latitude,
          customer_longitude,
          profiles:profiles!orders_customer_id_fkey(full_name, phone_number),
          order_items(
            id,
            quantity,
            price,
            products(name)
          )
        `)
        .in('merchant_id', storeIds)
        .order('created_at', { ascending: false });

      // ✅ تنفيذ الاستعلام مباشرة
      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) {
        console.error('❌ [Merchant] Error fetching orders:', ordersError);
        throw ordersError;
      }

      
      console.log(`✅ [Merchant] Fetched ${ordersData?.length || 0} orders`);
      // ✅ بعض نسخ Supabase قد تُرجع العلاقة كـ Array بدلاً من Object
      const normalizedOrders: Order[] = (ordersData || []).map((o: any) => ({
        ...o,
        profiles: Array.isArray(o?.profiles) ? (o.profiles[0] || null) : (o?.profiles ?? null),
      }));
      setOrders(normalizedOrders);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل الطلبات');
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchingRef.current = false;
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      
      fetchOrders();
      Alert.alert('تم', 'تم تحديث حالة الطلب بنجاح');
    } catch (error: any) {
      Alert.alert('خطأ', 'حدث خطأ أثناء تحديث حالة الطلب');
    }
  };

  const getStatusColor = (status: string) => {
    const statusObj = ORDER_STATUSES.find(s => s.value === status);
    return statusObj?.color || colors.text;
  };

  const getStatusLabel = (status: string) => {
    const statusObj = ORDER_STATUSES.find(s => s.value === status);
    return statusObj?.label || status;
  };

  const filteredOrders = selectedStatus === 'all'
    ? orders
    : orders.filter(order => order.status === selectedStatus);

  const renderOrder = (order: Order) => (
    <View key={order.id} style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderNumber}>#{order.order_number || order.id.substring(0, 8)}</Text>
          <Text style={styles.customerName}>{order.profiles?.full_name || 'عميل'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
            {getStatusLabel(order.status)}
          </Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.orderRow}>
          <Text style={styles.orderLabel}>مستحقات المتجر:</Text>
          <Text style={styles.orderValue}>
            {(() => {
              // إذا كان merchant_amount موجود استخدمه
              if (order.merchant_amount != null && order.merchant_amount > 0) {
                return order.merchant_amount.toFixed(2);
              }
              // إذا كان product_total موجود
              if (order.product_total != null && order.product_total > 0) {
                return ((order.product_total ?? 0) + (order.tax_amount ?? 0)).toFixed(2);
              }
              // احسب من customer_total بخصم الرسوم
              const customerTotal = order.customer_total ?? order.total ?? 0;
              const deliveryFee = order.delivery_fee ?? 0;
              const serviceFee = order.service_fee ?? 0;
              const merchantEarnings = customerTotal - deliveryFee - serviceFee;
              return Math.max(0, merchantEarnings).toFixed(2);
            })()} جنيه
          </Text>
        </View>
        <View style={styles.orderRow}>
          <Text style={styles.orderLabel}>إجمالي العميل:</Text>
          <Text style={styles.orderValue}>
            {(order.customer_total ?? order.total ?? 0).toFixed(2)} جنيه
          </Text>
        </View>
        <View style={styles.orderRow}>
          <Text style={styles.orderLabel}>التاريخ:</Text>
          <Text style={styles.orderValue}>
            {new Date(order.created_at).toLocaleDateString('ar-EG')}
          </Text>
        </View>
        <View style={styles.orderRow}>
          <Text style={styles.orderLabel}>📞 الهاتف:</Text>
          <Text style={styles.orderValue}>{order.profiles?.phone_number || 'غير متاح'}</Text>
        </View>
        {(order.delivery_address || (order.customer_latitude && order.customer_longitude)) && (
          <View style={styles.orderRow}>
            <Text style={styles.orderLabel}>📍 العنوان:</Text>
            <Text style={styles.orderValue}>
              {order.customer_latitude && order.customer_longitude
                ? `موقع محدد: ${Number(order.customer_latitude).toFixed(4)}, ${Number(order.customer_longitude).toFixed(4)}`
                : (typeof order.delivery_address === 'string' 
                  ? order.delivery_address 
                  : order.delivery_address?.street_address || '—')}
            </Text>
          </View>
        )}
        {/* ✅ عرض المنتجات */}
        {order.order_items && order.order_items.length > 0 && (
          <View style={styles.orderRow}>
            <Text style={styles.orderLabel}>📦 المنتجات:</Text>
            <View style={{ flex: 1 }}>
              {order.order_items.map((item: any, index: number) => (
                <Text key={item.id} style={styles.orderValue}>
                  {item.products?.name || 'منتج'} ({item.quantity}×)
                </Text>
              ))}
            </View>
          </View>
        )}
      </View>

      {order.status === 'pending' && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => updateOrderStatus(order.id, 'rejected')}
          >
            <XCircle size={16} color={colors.white} />
            <Text style={styles.actionButtonText}>رفض</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => updateOrderStatus(order.id, 'accepted')}
          >
            <CheckCircle size={16} color={colors.white} />
            <Text style={styles.actionButtonText}>قبول</Text>
          </TouchableOpacity>
        </View>
      )}

      {order.status === 'accepted' && (
        <TouchableOpacity
          style={[styles.actionButton, styles.preparingButton]}
          onPress={() => updateOrderStatus(order.id, 'preparing')}
        >
          <Clock size={16} color={colors.white} />
          <Text style={styles.actionButtonText}>بدء التحضير</Text>
        </TouchableOpacity>
      )}

      {order.status === 'preparing' && (
        <TouchableOpacity
          style={[styles.actionButton, styles.readyButton]}
          onPress={() => updateOrderStatus(order.id, 'ready')}
        >
          <Package size={16} color={colors.white} />
          <Text style={styles.actionButtonText}>جاهز للتوصيل</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الطلبات ({filteredOrders.length})</Text>
        <StoreButton />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilter}>
        {ORDER_STATUSES.map((status) => (
          <TouchableOpacity
            key={status.value}
            style={[
              styles.statusFilterButton,
              selectedStatus === status.value && styles.statusFilterButtonActive
            ]}
            onPress={() => setSelectedStatus(status.value)}
          >
            <Text style={[
              styles.statusFilterText,
              selectedStatus === status.value && styles.statusFilterTextActive
            ]}>
              {status.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <ShoppingCart size={64} color={colors.textLight} />
            <Text style={styles.emptyText}>لا توجد طلبات</Text>
          </View>
        ) : (
          filteredOrders.map(renderOrder)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h2, color: colors.text },
  statusFilter: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  statusFilterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginRight: spacing.sm,
    backgroundColor: colors.background,
  },
  statusFilterButtonActive: {
    backgroundColor: colors.primary,
  },
  statusFilterText: {
    ...typography.body,
    color: colors.text,
  },
  statusFilterTextActive: {
    color: colors.white,
  },
  content: { flex: 1, padding: spacing.lg },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  orderNumber: {
    ...typography.h3,
    color: colors.text,
  },
  customerName: {
    ...typography.body,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  orderDetails: {
    marginBottom: spacing.md,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  orderLabel: {
    ...typography.body,
    color: colors.textLight,
  },
  orderValue: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  rejectButton: {
    backgroundColor: colors.error,
  },
  acceptButton: {
    backgroundColor: colors.success,
  },
  preparingButton: {
    backgroundColor: colors.primary,
  },
  readyButton: {
    backgroundColor: colors.success,
  },
  actionButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: { ...typography.body, color: colors.textLight, marginTop: spacing.md },
});
