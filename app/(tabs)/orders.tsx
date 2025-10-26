import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, Clock, CheckCircle, XCircle } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { Order } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

interface OrderWithMerchant extends Order {
  merchant?: {
    name_ar: string;
  };
}

const ORDER_STATUS_CONFIG = {
  pending: { label: 'قيد الانتظار', color: colors.warning, icon: Clock },
  accepted: { label: 'تم القبول', color: colors.primary, icon: CheckCircle },
  preparing: { label: 'قيد التحضير', color: colors.primary, icon: Package },
  ready: { label: 'جاهز', color: colors.primary, icon: CheckCircle },
  picked_up: { label: 'تم الاستلام', color: colors.primary, icon: Package },
  on_the_way: { label: 'في الطريق', color: colors.primary, icon: Package },
  delivered: { label: 'تم التوصيل', color: colors.success, icon: CheckCircle },
  cancelled: { label: 'ملغي', color: colors.error, icon: XCircle },
};

export default function OrdersScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithMerchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user, activeTab]);

  const fetchOrders = async () => {
    if (!user) return;

    setLoading(true);
    let query = supabase
      .from('orders')
      .select(`
        *,
        merchant:merchants(name_ar)
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (activeTab === 'active') {
      query = query.in('status', ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'on_the_way']);
    } else {
      query = query.in('status', ['delivered', 'cancelled']);
    }

    const { data, error } = await query;

    if (data) {
      setOrders(data);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const renderOrderCard = ({ item }: { item: OrderWithMerchant }) => {
    const statusConfig = ORDER_STATUS_CONFIG[item.status];
    const StatusIcon = statusConfig.icon;

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => router.push(`/order/${item.id}`)}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderNumber}>
            <Text style={styles.orderNumberText}>#{item.order_number}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
            <StatusIcon size={16} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View style={styles.orderBody}>
          <View style={styles.orderInfo}>
            <Text style={styles.merchantName}>{item.merchant?.name_ar || 'متجر'}</Text>
            <Text style={styles.orderDate}>
              {new Date(item.created_at).toLocaleDateString('ar-SA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>

          <View style={styles.orderFooter}>
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>الإجمالي:</Text>
              <Text style={styles.totalAmount}>{item.total.toFixed(2)} ر.س</Text>
            </View>
            {item.payment_method === 'cash' && (
              <View style={styles.paymentBadge}>
                <Text style={styles.paymentText}>نقدي</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>طلباتي</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            الطلبات الحالية
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
            الطلبات السابقة
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>جاري التحميل...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Package size={64} color={colors.textLight} />
          <Text style={styles.emptyTitle}>لا توجد طلبات</Text>
          <Text style={styles.emptyText}>
            {activeTab === 'active' ? 'ليس لديك طلبات حالية' : 'ليس لديك طلبات سابقة'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
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
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.body,
    color: colors.textLight,
  },
  tabTextActive: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  listContent: {
    padding: spacing.md,
  },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.small,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.lightGray,
  },
  orderNumber: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderNumberText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  statusText: {
    ...typography.caption,
  },
  orderBody: {
    padding: spacing.md,
  },
  orderInfo: {
    marginBottom: spacing.md,
  },
  merchantName: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  orderDate: {
    ...typography.caption,
    color: colors.textLight,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalLabel: {
    ...typography.body,
    color: colors.textLight,
    marginLeft: spacing.xs,
  },
  totalAmount: {
    ...typography.h3,
    color: colors.primary,
  },
  paymentBadge: {
    backgroundColor: colors.lightGray,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  paymentText: {
    ...typography.caption,
    color: colors.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
  },
});
