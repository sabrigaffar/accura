import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShoppingCart, Clock, CheckCircle, XCircle, Package } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

interface Order {
  id: string;
  customer_id: string;
  status: string;
  total_amount: number;
  created_at: string;
  delivery_address: any;
  profiles: {
    full_name: string;
    phone_number: string;
  };
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles!orders_customer_id_fkey(full_name, phone_number)
        `)
        .eq('merchant_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل الطلبات');
    } finally {
      setLoading(false);
      setRefreshing(false);
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
          <Text style={styles.orderNumber}>طلب #{order.id.substring(0, 8)}</Text>
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
          <Text style={styles.orderLabel}>المبلغ:</Text>
          <Text style={styles.orderValue}>{order.total_amount} ريال</Text>
        </View>
        <View style={styles.orderRow}>
          <Text style={styles.orderLabel}>التاريخ:</Text>
          <Text style={styles.orderValue}>
            {new Date(order.created_at).toLocaleDateString('ar-EG')}
          </Text>
        </View>
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
  header: { padding: spacing.lg, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
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
