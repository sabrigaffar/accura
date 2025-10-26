import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, ShoppingCart, TrendingUp, DollarSign, Plus, Eye } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  pendingOrders: number;
  totalOrders: number;
  todayRevenue: number;
  totalRevenue: number;
}

export default function MerchantDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    activeProducts: 0,
    pendingOrders: 0,
    totalOrders: 0,
    todayRevenue: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch products stats
      const { data: products } = await supabase
        .from('products')
        .select('id, is_active')
        .eq('merchant_id', user.id);

      const totalProducts = products?.length || 0;
      const activeProducts = products?.filter(p => p.is_active).length || 0;

      // Fetch orders stats
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at')
        .eq('merchant_id', user.id);

      const totalOrders = orders?.length || 0;
      const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;

      // Calculate revenue
      const totalRevenue = orders?.reduce((sum, order) => {
        if (order.status !== 'rejected' && order.status !== 'cancelled') {
          return sum + (order.total_amount || 0);
        }
        return sum;
      }, 0) || 0;

      const today = new Date().toISOString().split('T')[0];
      const todayRevenue = orders?.reduce((sum, order) => {
        const orderDate = new Date(order.created_at).toISOString().split('T')[0];
        if (orderDate === today && order.status !== 'rejected' && order.status !== 'cancelled') {
          return sum + (order.total_amount || 0);
        }
        return sum;
      }, 0) || 0;

      setStats({
        totalProducts,
        activeProducts,
        pendingOrders,
        totalOrders,
        todayRevenue,
        totalRevenue,
      });
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>لوحة التحكم</Text>
          <Text style={styles.headerSubtitle}>مرحباً بك في متجرك</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* إحصائيات سريعة */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.primary + '20' }]}>
              <Package size={24} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>{stats.activeProducts}/{stats.totalProducts}</Text>
            <Text style={styles.statLabel}>منتج نشط</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.warning + '20' }]}>
              <ShoppingCart size={24} color={colors.warning} />
            </View>
            <Text style={styles.statValue}>{stats.pendingOrders}</Text>
            <Text style={styles.statLabel}>طلب قيد الانتظار</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.success + '20' }]}>
              <TrendingUp size={24} color={colors.success} />
            </View>
            <Text style={styles.statValue}>{stats.totalOrders}</Text>
            <Text style={styles.statLabel}>إجمالي الطلبات</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.error + '20' }]}>
              <DollarSign size={24} color={colors.error} />
            </View>
            <Text style={styles.statValue}>{stats.todayRevenue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>ريال اليوم</Text>
          </View>
        </View>

        {/* إجمالي الإيرادات */}
        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>إجمالي الإيرادات</Text>
          <Text style={styles.revenueValue}>{stats.totalRevenue.toFixed(2)} ريال</Text>
        </View>

        {/* إجراءات سريعة */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/merchant/add-product' as any)}
          >
            <Plus size={20} color={colors.primary} />
            <Text style={styles.actionText}>إضافة منتج جديد</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/(merchant-tabs)/products' as any)}
          >
            <Eye size={20} color={colors.primary} />
            <Text style={styles.actionText}>عرض منتجاتي</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/(merchant-tabs)/orders' as any)}
          >
            <ShoppingCart size={20} color={colors.warning} />
            <Text style={styles.actionText}>عرض الطلبات ({stats.pendingOrders} قيد الانتظار)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  statCard: {
    width: '48%',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textLight,
  },
  revenueCard: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  revenueLabel: {
    ...typography.body,
    color: colors.white + 'CC',
    marginBottom: spacing.xs,
  },
  revenueValue: {
    ...typography.h1,
    color: colors.white,
    fontWeight: '700',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  actionText: {
    ...typography.bodyMedium,
    color: colors.text,
    marginLeft: spacing.md,
  },
});
