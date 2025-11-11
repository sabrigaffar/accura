import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, ShoppingCart, TrendingUp, DollarSign, Plus, Eye } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useActiveStore } from '@/contexts/ActiveStoreContext';
import { StoreButton } from '@/components/StoreSelector';

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
  const [currency, setCurrency] = useState('ريال');
  const { activeStore, loading: storesLoading, stores, isAllStoresSelected } = useActiveStore();
  const [totalStoresCount, setTotalStoresCount] = useState(0);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  useEffect(() => {
    loadCurrency();
  }, []);

  // عرض إشعار نجاح بعد إنشاء متجر جديد (بدلاً من إظهار التنبيه فوق شاشة تسجيل الدخول)
  useEffect(() => {
    (async () => {
      try {
        const justCreated = await AsyncStorage.getItem('merchant_just_created');
        if (justCreated === 'true') {
          await AsyncStorage.setItem('merchant_just_created', 'false');
          Alert.alert('تم إنشاء المتجر', 'تم إنشاء متجرك بنجاح وهو مفعّل الآن. يمكنك البدء بإدارته من لوحة التاجر.');
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (activeStore || isAllStoresSelected) {
      fetchDashboardData();
    }
  }, [activeStore, isAllStoresSelected]);

  // احسب المسافة إلى المتجر النشط (أو أقرب متجر عند اختيار الجميع)
  useEffect(() => {
    (async () => {
      try {
        setDistanceKm(null);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const toRad = (x: number) => (x * Math.PI) / 180;
        const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 6371;
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        };

        let best: number | null = null;
        if (!isAllStoresSelected && activeStore && activeStore.latitude != null && activeStore.longitude != null) {
          best = haversine(lat, lng, Number(activeStore.latitude), Number(activeStore.longitude));
        } else if (isAllStoresSelected && stores.length > 0) {
          for (const s of stores) {
            if (s.latitude != null && s.longitude != null) {
              const d = haversine(lat, lng, Number(s.latitude), Number(s.longitude));
              if (best == null || d < best) best = d;
            }
          }
        }
        if (best != null && isFinite(best)) setDistanceKm(best);
      } catch {}
    })();
  }, [activeStore?.id, isAllStoresSelected, stores.map(s => s.id).join(',')]);

  useEffect(() => {
    if (!storesLoading && !activeStore && !isAllStoresSelected) {
      setLoading(false);
    }
  }, [storesLoading, activeStore, isAllStoresSelected]);

  useEffect(() => {
    setTotalStoresCount(stores.length);
  }, [stores]);

  const loadCurrency = async () => {
    try {
      const symbol = await AsyncStorage.getItem('app_currency_symbol');
      setCurrency(symbol || 'ريال');
    } catch {}
  };

  // تحقق يومي بعد الساعة 2 صباحاً: تأكيد وجود إحداثيات للمتاجر وتحديث geog
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return;
        const lastKey = `merchant_coords_last_check_${user.id}`;
        const todayKey = `merchant_coords_last_day_${user.id}`;
        const last = await AsyncStorage.getItem(lastKey); // طابع زمني لآخر تحقق
        const lastDay = await AsyncStorage.getItem(todayKey); // آخر تاريخ YYYY-MM-DD تحقق بعد 2 صباحاً
        const now = new Date();

        // احسب "اليوم الحالي بعد 2 صباحاً" كتاريخ أساس
        const twoAM = new Date(now);
        twoAM.setHours(2, 0, 0, 0);
        const yyyy = String(twoAM.getFullYear());
        const mm = String(twoAM.getMonth() + 1).padStart(2, '0');
        const dd = String(twoAM.getDate()).padStart(2, '0');
        const todayMarker = `${yyyy}-${mm}-${dd}`;

        // الشرطان المطلوبان:
        // 1) الوقت الحالي تجاوز 2 صباحاً
        // 2) لم ننفّذ تحققاً اليوم (بعد 2 صباحاً) مسبقاً
        const nowPast2AM = now.getTime() >= twoAM.getTime();
        const alreadyToday = lastDay === todayMarker;
        if (!nowPast2AM || alreadyToday) return;

        // اجلب جميع متاجرك
        const { data: myStores, error } = await supabase
          .from('merchants')
          .select('id, latitude, longitude')
          .eq('owner_id', user.id);
        if (error || !Array.isArray(myStores)) return;

        // هل لدينا متاجر بلا إحداثيات؟
        const needCoords = myStores.filter((s: any) => s.latitude == null || s.longitude == null);
        let coords: { lat: number; lng: number } | null = null;
        if (needCoords.length > 0) {
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === Location.PermissionStatus.GRANTED) {
              const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            }
          } catch {}
        }

        // حدّث فقط المتاجر الناقصة للإحداثيات
        if (coords) {
          for (const s of needCoords) {
            await supabase
              .from('merchants')
              .update({ latitude: coords.lat, longitude: coords.lng, updated_at: new Date().toISOString() })
              .eq('id', s.id);
          }
        }

        // ملاحظة: تريجر DB سيحدّث geog تلقائياً عند أي تحديث latitude/longitude
        await AsyncStorage.multiSet([
          [lastKey, String(now.getTime())],
          [todayKey, todayMarker],
        ]);
      } catch {}
    })();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (!activeStore && !isAllStoresSelected) return;

      let finalProducts: any[] = [];
      
      if (isAllStoresSelected) {
        // جلب منتجات جميع المتاجر
        const storeIds = stores.map(s => s.id);
        const { data: products, error: prodErr } = await supabase
          .from('products')
          .select('id, is_active, store_id')
          .eq('merchant_id', user.id)
          .in('store_id', storeIds);
        if (prodErr && (prodErr as any).code === 'PGRST205') {
          const { data: legacy } = await supabase
            .from('merchant_products')
            .select('id, is_available, merchant_id')
            .in('merchant_id', storeIds);
          finalProducts = (legacy || []).map((r: any) => ({ id: r.id, is_active: r.is_available, store_id: r.merchant_id }));
        } else {
          finalProducts = products || [];
        }
      } else if (activeStore) {
        // تصفية المنتجات حسب المتجر النشط
        let productsQuery = supabase
          .from('products')
          .select('id, is_active')
          .eq('merchant_id', user.id);

        // محاولة تصفية بـ store_id إن كان متوفراً
        const { data: products, error: productsError } = await productsQuery.eq('store_id', activeStore.id);
        
        finalProducts = products || [];
        if (productsError && productsError.code === '42703') {
          // العمود store_id غير موجود، جلب كل المنتجات
          const fallback = await supabase
            .from('products')
            .select('id, is_active')
            .eq('merchant_id', user.id);
          finalProducts = fallback.data || [];
        } else if (productsError && (productsError as any).code === 'PGRST205') {
          const { data: legacy } = await supabase
            .from('merchant_products')
            .select('id, is_available')
            .eq('merchant_id', activeStore.id);
          finalProducts = (legacy || []).map((r: any) => ({ id: r.id, is_active: r.is_available }));
        }
      }

      const totalProducts = finalProducts?.length || 0;
      const activeProducts = finalProducts?.filter(p => p.is_active).length || 0;

      // جلب المتاجر التي يملكها التاجر
      const { data: merchantStores, error: storesError } = await supabase
        .from('merchants')
        .select('id')
        .eq('owner_id', user.id);

      if (storesError) {
        console.error('❌ [Dashboard] Error fetching stores:', storesError);
        throw storesError;
      }

      const allStoreIds = merchantStores?.map(s => s.id) || [];
      
      if (allStoreIds.length === 0) {
        console.log('⚠️ [Dashboard] No stores found');
        setStats({
          totalProducts: 0,
          activeProducts: 0,
          pendingOrders: 0,
          totalOrders: 0,
          todayRevenue: 0,
          totalRevenue: 0,
        });
        setLoading(false);
        setRefreshing(false);
        return;
      }

      console.log('🏪 [Dashboard] Store IDs:', allStoreIds);

      // جلب الطلبات من جميع متاجر التاجر
      let orders: any[] = [];  // ✅ تعريف النوع
      let ordersQuery = supabase
        .from('orders')
        .select('id, status, total, customer_total, delivery_fee, service_fee, product_total, subtotal, tax_amount, tax, created_at, store_id')
        .in('merchant_id', allStoreIds);  // ✅ يبحث في جميع متاجره
      
      if (isAllStoresSelected && stores.length > 0) {
        // جلب طلبات جميع المتاجر
        const { data } = await ordersQuery;
        orders = data || [];
      } else if (activeStore) {
        // طلبات متجر محدد
        const { data } = await ordersQuery.eq('store_id', activeStore.id);
        orders = data || [];
      } else {
        orders = [];
      }

      const totalOrders = orders?.length || 0;
      const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;

      console.log(`📊 [Dashboard] Orders stats: total=${totalOrders}, pending=${pendingOrders}`);

      // حساب الإيرادات
      // ✅ لا تُحتسب الإيرادات إلا بعد التسليم الفعلي
      const revenueStatuses = ['delivered'];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayOrders = orders?.filter(o => {
        const orderDate = new Date(o.created_at);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime() && revenueStatuses.includes(o.status);
      }) || [];

      // حساب حصة التاجر فقط = إجمالي العميل - (رسوم التوصيل + رسوم الخدمة)
      // نعتمد على customer_total وإن لم تتوفر فنستخدم total
      const todayRevenue = todayOrders.reduce((sum, o) => {
        const customerTotal = parseFloat(o.customer_total?.toString() || o.total?.toString() || '0') || 0;
        const deliveryFee = parseFloat(o.delivery_fee?.toString() || '0') || 0;
        const serviceFee = parseFloat(o.service_fee?.toString() || '0') || 0;
        const merchantShare = Math.max(customerTotal - deliveryFee - serviceFee, 0);
        return sum + merchantShare;
      }, 0);
      
      const completedOrders = orders?.filter(o => revenueStatuses.includes(o.status)) || [];
      const totalRevenue = completedOrders.reduce((sum, o) => {
        const customerTotal = parseFloat(o.customer_total?.toString() || o.total?.toString() || '0') || 0;
        const deliveryFee = parseFloat(o.delivery_fee?.toString() || '0') || 0;
        const serviceFee = parseFloat(o.service_fee?.toString() || '0') || 0;
        const merchantShare = Math.max(customerTotal - deliveryFee - serviceFee, 0);
        return sum + merchantShare;
      }, 0);

      console.log(`💰 [Dashboard] Revenue: today=${todayRevenue}, total=${totalRevenue}, completed orders=${completedOrders.length}`);

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
    loadCurrency();
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

  if (stores.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>لوحة التحكم</Text>
          </View>
        </View>
        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.revenueLabel}>لا يوجد متجر نشط</Text>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/auth/setup-merchant' as any)}
            >
              <Plus size={20} color={colors.primary} />
              <Text style={styles.actionText}>إنشاء متجر للبدء</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>لوحة التحكم</Text>
          <StoreButton />
        </View>
        {isAllStoresSelected ? (
          <>
            <Text style={styles.headerSubtitle}>جميع المتاجر ({totalStoresCount} متجر)</Text>
            {distanceKm != null && (
              <Text style={styles.headerSubtitle}>الأقرب يبعد عنك: {distanceKm.toFixed(1)} كم</Text>
            )}
          </>
        ) : activeStore ? (
          <>
            <Text style={styles.headerSubtitle}>{activeStore.name_ar}</Text>
            {distanceKm != null && (
              <Text style={styles.headerSubtitle}>يبعد عنك: {distanceKm.toFixed(1)} كم</Text>
            )}
          </>
        ) : null}
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
            <Text style={styles.statValue}>{`${stats.todayRevenue.toFixed(0)} ${currency}`}</Text>
            <Text style={styles.statLabel}>إيراد اليوم</Text>
          </View>
        </View>

        {/* إجمالي الإيرادات */}
        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>إجمالي الإيرادات</Text>
          <Text style={styles.revenueValue}>{`${stats.totalRevenue.toFixed(2)} ${currency}`}</Text>
        </View>

        {/* إجراءات سريعة */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/merchant/add-product' as any)}
            disabled={!activeStore && !isAllStoresSelected}
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

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/auth/setup-merchant' as any)}
          >
            <Plus size={20} color={colors.success} />
            <Text style={styles.actionText}>إضافة متجر جديد</Text>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
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
