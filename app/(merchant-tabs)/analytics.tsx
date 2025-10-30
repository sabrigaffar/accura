import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingUp, Package, ShoppingCart, DollarSign, Star } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useActiveStore } from '@/contexts/ActiveStoreContext';
import { StoreButton } from '@/components/StoreSelector';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  averageOrderValue: number;
  topSellingProducts: Array<{ name: string; count: number }>;
  revenueByDay: Array<{ date: string; revenue: number }>;
}

export default function MerchantAnalytics() {
  const { activeStore, stores, isAllStoresSelected } = useActiveStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currency, setCurrency] = useState('ريال');
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    averageOrderValue: 0,
    topSellingProducts: [],
    revenueByDay: [],
  });

  useEffect(() => {
    loadCurrency();
  }, []);

  useEffect(() => {
    if (activeStore || isAllStoresSelected) {
      fetchAnalytics();
    }
  }, [activeStore, isAllStoresSelected]);

  const loadCurrency = async () => {
    try {
      const symbol = await AsyncStorage.getItem('app_currency_symbol');
      setCurrency(symbol || 'ريال');
    } catch {}
  };

  const fetchAnalytics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // ✅ جلب متاجر التاجر
      const { data: merchantStores } = await supabase
        .from('merchants')
        .select('id')
        .eq('owner_id', user.id);

      if (!merchantStores || merchantStores.length === 0) {
        setAnalytics({
          totalRevenue: 0,
          totalOrders: 0,
          totalProducts: 0,
          averageOrderValue: 0,
          topSellingProducts: [],
          revenueByDay: [],
        });
        setLoading(false);
        return;
      }

      const storeIds = merchantStores.map(s => s.id);

      // ✅ جلب الطلبات (استخدم total وليس total_amount)
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, total, created_at')
        .in('merchant_id', storeIds);

      // ✅ الحالات المكتملة
      const revenueStatuses = ['accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
      
      const completedOrders = orders?.filter(o => 
        revenueStatuses.includes(o.status)
      ) || [];

      const totalRevenue = completedOrders.reduce((sum, order) => 
        sum + (parseFloat(order.total?.toString() || '0') || 0), 0
      );

      const averageOrderValue = completedOrders.length > 0 
        ? totalRevenue / completedOrders.length 
        : 0;

      // جلب المنتجات
      let productsQuery = supabase
        .from('products')
        .select('id, is_active, store_id')
        .eq('merchant_id', user.id);

      let products: any[] = [];
      if (isAllStoresSelected && stores.length > 0) {
        const storeIds = stores.map(s => s.id);
        const { data } = await productsQuery.in('store_id', storeIds);
        products = data || [];
      } else if (activeStore) {
        const { data, error } = await productsQuery.eq('store_id', activeStore.id);
        if (error && error.code === '42703') {
          const fallback = await supabase
            .from('products')
            .select('id, is_active')
            .eq('merchant_id', user.id);
          products = fallback.data || [];
        } else {
          products = data || [];
        }
      }

      setAnalytics({
        totalRevenue,
        totalOrders: completedOrders.length,
        totalProducts: products?.length || 0,
        averageOrderValue,
        topSellingProducts: [],
        revenueByDay: [],
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>الإحصائيات</Text>
          <StoreButton />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الإحصائيات</Text>
        <StoreButton />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* بطاقات الإحصائيات */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.success + '20' }]}>
              <DollarSign size={24} color={colors.success} />
            </View>
            <Text style={styles.statValue}>{analytics.totalRevenue.toFixed(2)} {currency}</Text>
            <Text style={styles.statLabel}>إجمالي الإيرادات</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.primary + '20' }]}>
              <ShoppingCart size={24} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>{analytics.totalOrders}</Text>
            <Text style={styles.statLabel}>إجمالي الطلبات</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.warning + '20' }]}>
              <Package size={24} color={colors.warning} />
            </View>
            <Text style={styles.statValue}>{analytics.totalProducts}</Text>
            <Text style={styles.statLabel}>عدد المنتجات</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.error + '20' }]}>
              <TrendingUp size={24} color={colors.error} />
            </View>
            <Text style={styles.statValue}>{analytics.averageOrderValue.toFixed(2)} {currency}</Text>
            <Text style={styles.statLabel}>متوسط قيمة الطلب</Text>
          </View>
        </View>

        {/* معلومات إضافية */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ملاحظة</Text>
          <Text style={styles.infoText}>
            الإحصائيات معروضة للطلبات المكتملة والجاهزة فقط
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  header: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg, 
    backgroundColor: colors.white, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border 
  },
  headerTitle: { 
    ...typography.h2, 
    color: colors.text 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { 
    flex: 1,
    padding: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  statLabel: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: colors.primary + '10',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  infoTitle: {
    ...typography.bodyMedium,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  infoText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 20,
  },
});
