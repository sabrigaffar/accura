import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Linking, Image } from 'react-native';
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
  driver_id?: string | null;
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
  driver?: {
    full_name: string;
    phone_number: string;
    avatar_url?: string | null;
    photo_url?: string | null;
  } | null;
  driver_avatar_url?: string | null;
  order_items?: Array<{
    id: string;
    quantity: number;
    price: number;
    products?: {
      name_ar?: string;
      name?: string;
    };
    merchant_products?: {
      name_ar?: string;
      name?: string;
    };
  }>;
}

const ORDER_STATUSES = [
  { value: 'all', label: 'الكل', color: colors.text, icon: '📊' },
  { value: 'pending', label: 'انتظار', color: colors.warning, icon: '⏰' },
  { value: 'accepted', label: 'مقبول', color: colors.success, icon: '✅' },
  { value: 'preparing', label: 'تحضير', color: colors.primary, icon: '🔵' },
  { value: 'ready', label: 'جاهز', color: colors.success, icon: '🎉' },
  { value: 'picked_up', label: 'تم الاستلام', color: colors.primary, icon: '📦' },
  { value: 'on_the_way', label: 'في الطريق', color: colors.primary, icon: '🛵' },
  { value: 'delivered', label: 'تم التوصيل', color: colors.success, icon: '✅' },
  { value: 'cancelled', label: 'ملغى', color: colors.error, icon: '❌' },
];

const SHOW_DRIVER_STATUSES = ['accepted', 'ready', 'picked_up', 'on_the_way', 'delivered'];

export default function MerchantOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const { activeStore, stores, isAllStoresSelected } = useActiveStore();
  const fetchingRef = React.useRef(false);
  const lastFetchAtRef = React.useRef(0);

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

  const fetchOrders = React.useCallback(async () => {
    try {
      const now = Date.now();
      if (fetchingRef.current) return;
      if (now - lastFetchAtRef.current < 800) return; // throttle
      lastFetchAtRef.current = now;
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
      // نبني select مع علاقة صريحة لـ merchant_products باستخدام اسم قيد FK
      const baseSelect = (embed: string) => `
        id,
        order_number,
        customer_id,
        driver_id,
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
        customer:profiles!orders_customer_id_fkey(full_name, phone_number),
        driver:profiles!orders_driver_id_fkey(full_name, phone_number, avatar_url),
        order_items(
          id,
          quantity,
          price,
          ${embed}
        )
      `;

      // المحاولة الأولى بقيد order_items_product_id_fkey
      const embed1 = `merchant_products!order_items_product_id_fkey ( name_ar )`;
      let resp1 = await supabase
        .from('orders')
        .select(baseSelect(embed1))
        .in('merchant_id', storeIds)
        .order('created_at', { ascending: false });

      let ordersData = resp1.data as any[] | null;
      let ordersError = resp1.error;

      // إذا ظهر خطأ تعدد العلاقات أو علاقة مختلفة، جرب الاسم البديل
      if (ordersError) {
        const embed2 = `merchant_products!order_items_product_fk ( name_ar )`;
        let resp2 = await supabase
          .from('orders')
          .select(baseSelect(embed2))
          .in('merchant_id', storeIds)
          .order('created_at', { ascending: false });
        ordersData = resp2.data as any[] | null;
        ordersError = resp2.error;
      }

      // إذا مازال هناك خطأ، حاول على الأقل بدون تضمين المنتج (سنعتمد على RPC الملخص إذا لزم)
      if (ordersError) {
        const resp3 = await supabase
          .from('orders')
          .select(`
            id, order_number, customer_id, driver_id, status, total, product_total, delivery_fee, service_fee, tax_amount, customer_total, created_at,
            customer_latitude, customer_longitude,
            customer:profiles!orders_customer_id_fkey(full_name, phone_number),
            driver:profiles!orders_driver_id_fkey(full_name, phone_number, avatar_url),
            order_items(id, quantity, price)
          `)
          .in('merchant_id', storeIds)
          .order('created_at', { ascending: false });
        ordersData = resp3.data as any[] | null;
        ordersError = resp3.error;
      }

      if (ordersError) {
        console.error('❌ [Merchant] Error fetching orders:', ordersError);
        throw ordersError;
      }

      console.log(`✅ [Merchant] Fetched ${ordersData?.length || 0} orders`);
      // ✅ بعض نسخ Supabase قد تُرجع العلاقة كـ Array بدلاً من Object
      let normalizedOrders: Order[] = (ordersData || []).map((o: any) => ({
        ...o,
        // ✅ بعض نسخ Supabase قد تُرجع العلاقة كـ Array بدلاً من Object
        customer: Array.isArray(o?.customer) ? (o.customer[0] || null) : (o?.customer ?? null),
        profiles: Array.isArray(o?.profiles) ? (o.profiles[0] || null) : (o?.profiles ?? null),
        driver: Array.isArray(o?.driver) ? (o.driver[0] || null) : (o?.driver ?? null),
      }));

      // 🔁 Fallback: إذا لم تُعد علاقة السائق لكن هناك driver_id، نجلب ملفات السائقين دفعة واحدة ونحقنها
      try {
        const missingDriver = normalizedOrders.some((o: any) => o.driver_id && !o.driver);
        if (missingDriver) {
          const driverIds = Array.from(new Set(normalizedOrders.filter((o: any) => o.driver_id).map((o: any) => o.driver_id)));
          if (driverIds.length > 0) {
            const { data: driversData, error: driversErr } = await supabase
              .from('profiles')
              .select('id, full_name, phone_number, avatar_url')
              .in('id', driverIds);
            if (!driversErr && Array.isArray(driversData)) {
              const dmap = new Map(driversData.map((d: any) => [d.id, { full_name: d.full_name, phone_number: d.phone_number, avatar_url: d.avatar_url } ]));
              normalizedOrders = normalizedOrders.map((o: any) => ({
                ...o,
                driver: o.driver || (o.driver_id ? dmap.get(o.driver_id) || null : null),
              }));
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Failed to backfill driver profiles for orders', e);
      }

      // 🔁 Fallback 2: لو لم نجد صورة في profiles، نحاول driver_profiles.photo_url
      try {
        const needPhoto = normalizedOrders.some((o: any) => o.driver_id && !((o as any).driver?.avatar_url) && !(o as any).driver_avatar_url);
        if (needPhoto) {
          const ids = Array.from(new Set(normalizedOrders.filter((o: any) => o.driver_id).map((o: any) => o.driver_id)));
          if (ids.length > 0) {
            const { data: dprofs, error: derr } = await supabase
              .from('driver_profiles')
              .select('id, photo_url')
              .in('id', ids);
            if (!derr && Array.isArray(dprofs)) {
              const pmap = new Map(dprofs.map((d: any) => {
                let url = d.photo_url as string | null;
                if (url && !url.startsWith('http')) {
                  const { data } = supabase.storage.from('driver-photos').getPublicUrl(url);
                  url = data?.publicUrl || url;
                }
                return [d.id, url];
              }));
              normalizedOrders = normalizedOrders.map((o: any) => ({
                ...o,
                driver_avatar_url: (o.driver?.avatar_url ?? null) || (o.driver_avatar_url ?? pmap.get(o.driver_id) ?? null),
                driver: o.driver ? { ...o.driver, photo_url: o.driver?.photo_url ?? pmap.get(o.driver_id) ?? null } : o.driver,
              }));
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Failed to backfill driver photo from driver_profiles', e);
      }
      // Debug counts
      try {
        const withDriverId = normalizedOrders.filter((o: any) => !!o.driver_id).length;
        const withDriverProfile = normalizedOrders.filter((o: any) => !!o.driver).length;
        console.log(`🏪 [Merchant] Orders with driver_id=${withDriverId}, with driver profile=${withDriverProfile}`);
      } catch {}

      setOrders(normalizedOrders);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل الطلبات');
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchingRef.current = false;
    }
  }, [activeStore, isAllStoresSelected]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      // اجلب حالة الطلب الحالية مرة واحدة لإتخاذ القرار
      const { data: currentOrder, error: currentErr } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();
      if (currentErr) {
        console.error('❌ Failed to load current order status before update:', currentErr);
      }

      // ✅ حجز المخزون يتم لمرة واحدة فقط عند الانتقال من pending
      const needsReserve = (currentOrder?.status === 'pending') && ['accepted','preparing','ready'].includes(newStatus);
      if (needsReserve) {
        const { data: reserveResult, error: reserveError } = await supabase.rpc('reserve_order_stock', { p_order_id: orderId });
        if (reserveError) {
          console.error('❌ Stock reservation error:', reserveError);
          Alert.alert('خطأ', 'حدث خطأ أثناء حجز المخزون');
          return;
        }
        if (reserveResult && reserveResult.length > 0 && !reserveResult[0].ok) {
          Alert.alert('مخزون غير كافٍ', reserveResult[0].message || 'لا يمكن قبول الطلب بسبب نقص المخزون', [{ text: 'حسناً' }]);
          return;
        }
      }

      // ✅ إرجاع المخزون عند إلغاء الطلب (فقط إذا كان قد تم حجزه سابقًا)
      if (newStatus === 'cancelled') {
        if (currentOrder && ['accepted', 'preparing', 'ready'].includes(currentOrder.status)) {
          await supabase.rpc('release_order_stock', { p_order_id: orderId });
        }
      }

      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('❌ Error updating order status:', error);
        throw error;
      }
      
      fetchOrders();
      Alert.alert('تم', 'تم تحديث حالة الطلب بنجاح');
    } catch (error: any) {
      console.error('❌ Update order error:', error);
      Alert.alert('خطأ', `حدث خطأ أثناء تحديث حالة الطلب: ${error.message || ''}`);
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

  const getStatusIcon = (status: string) => {
    const icons: { [key: string]: string } = {
      pending: '⏰',
      accepted: '✅',
      preparing: '👨‍🍳',
      ready: '🎉',
      picked_up: '📦',
      on_the_way: '🛵',
      delivered: '✅',
      cancelled: '❌',
    };
    return icons[status] || '📦';
  };

  const handleCallCustomer = (phoneNumber: string) => {
    if (phoneNumber && phoneNumber !== 'غير متاح') {
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      Alert.alert('خطأ', 'رقم الهاتف غير متاح');
    }
  };

  const filteredOrders = selectedStatus === 'all'
    ? orders
    : orders.filter(order => order.status === selectedStatus);

  // حساب الإحصائيات من الطلبات الحالية
  const stats = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeOrders = orders.filter(o => ['pending', 'accepted', 'preparing', 'ready'].includes(o.status));
    const urgentOrders = orders.filter(o => o.status === 'pending');
    const preparingOrders = orders.filter(o => o.status === 'preparing');
    
    const todayOrders = orders.filter(o => {
      const orderDate = new Date(o.created_at);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });
    
    const todayRevenue = todayOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.merchant_amount || o.product_total || 0), 0);
    
    return {
      active: activeOrders.length,
      urgent: urgentOrders.length,
      preparing: preparingOrders.length,
      todayRevenue: todayRevenue.toFixed(2),
    };
  }, [orders]);

  const handleOpenMap = (latitude: number | string | null | undefined, longitude: number | string | null | undefined) => {
    if (latitude && longitude) {
      const lat = Number(latitude);
      const lng = Number(longitude);
      const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('خطأ', 'لم نتمكن من فتح الخريطة');
      });
    } else {
      Alert.alert('خطأ', 'موقع العميل غير متاح');
    }
  };

  const renderOrder = (order: Order) => (
    <View key={order.id} style={styles.orderCard}>
      {/* Gradient Header */}
      <View style={[styles.gradientHeader, { backgroundColor: getStatusColor(order.status) + '15' }]}>
        <View style={styles.headerTop}>
          <Text style={styles.statusEmoji}>{getStatusIcon(order.status)}</Text>
          <View style={[styles.statusPill, { backgroundColor: getStatusColor(order.status) }]}>
            <Text style={styles.statusPillText}>{getStatusLabel(order.status)}</Text>
          </View>
        </View>
        <Text style={styles.orderNumber}>#{order.order_number || order.id.substring(0, 8)}</Text>
        <Text style={styles.orderTime}>
          {new Date(order.created_at).toLocaleDateString('ar-EG', { 
            day: 'numeric', 
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>

      {/* Customer & Contact Info */}
      <View style={styles.customerSection}>
        <View style={styles.customerRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.customerName}>{(order as any).customer?.full_name || order.profiles?.full_name || 'عميل'}</Text>
              <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>العميل</Text></View>
            </View>
            <Text style={styles.phoneNumber}>{(order as any).customer?.phone_number || order.profiles?.phone_number || 'غير متاح'}</Text>
          </View>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => handleCallCustomer((order as any).customer?.phone_number || order.profiles?.phone_number)}
          >
            <Text style={styles.iconButtonText}>📞</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Driver Info (if assigned and status allows) */}
      {(SHOW_DRIVER_STATUSES.includes(order.status) && (((order as any).driver) || (order as any).driver_id)) && (
        <View style={styles.customerSection}>
          <View style={styles.customerRow}>
            <View style={styles.rowLeft}>
              {(((order as any).driver?.avatar_url) || (order as any).driver_avatar_url || (order as any).driver?.photo_url) ? (
                <Image
                  source={{ uri: (order as any).driver?.avatar_url || (order as any).driver_avatar_url || (order as any).driver?.photo_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>🛵</Text></View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.customerName}>{(order as any).driver?.full_name || 'تم إسناد السائق'}</Text>
                  <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>السائق</Text></View>
                </View>
                <Text style={styles.phoneNumber}>{(order as any).driver?.phone_number || '—'}</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => handleCallCustomer((order as any).driver?.phone_number || '')}
            >
              <Text style={styles.iconButtonText}>📞</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Products - Compact */}
      {order.order_items && order.order_items.length > 0 && (
        <View style={styles.productsCompact}>
          <Text style={styles.productsText}>
            📦 {order.order_items.map((item: any) => 
              `${item.merchant_products?.name_ar || item.merchant_products?.name || 'منتج'} (×${item.quantity})`
            ).join(' • ')}
          </Text>
        </View>
      )}

      {/* Price & Location Row */}
      <View style={styles.bottomRow}>
        <View style={styles.priceCompact}>
          <Text style={styles.priceLabel}>💰</Text>
          <Text style={styles.priceValue}>
            {(() => {
              if (order.merchant_amount != null && order.merchant_amount > 0) {
                return order.merchant_amount.toFixed(2);
              }
              if (order.product_total != null && order.product_total > 0) {
                return ((order.product_total ?? 0) + (order.tax_amount ?? 0)).toFixed(2);
              }
              const customerTotal = order.customer_total ?? order.total ?? 0;
              const deliveryFee = order.delivery_fee ?? 0;
              const serviceFee = order.service_fee ?? 0;
              return Math.max(0, customerTotal - deliveryFee - serviceFee).toFixed(2);
            })()} ج
          </Text>
        </View>
        
        {(order.customer_latitude && order.customer_longitude) && (
          <TouchableOpacity 
            style={styles.locationCompact}
            onPress={() => handleOpenMap(order.customer_latitude, order.customer_longitude)}
          >
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationTextCompact}>عرض الموقع</Text>
          </TouchableOpacity>
        )}
      </View>



      {order.status === 'pending' && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => updateOrderStatus(order.id, 'cancelled')}
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
        <Text style={styles.headerTitle}>الطلبات ({orders.length})</Text>
        <StoreButton />
      </View>

      {/* Statistics Cards */}
      <View style={styles.statsSection}>
        <Text style={styles.statsSectionTitle}>📊 نظرة سريعة</Text>
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: colors.success + '15' }]}>
            <Text style={styles.statIcon}>🟢</Text>
            <Text style={styles.statValue}>{stats.active}</Text>
            <Text style={styles.statLabel}>نشطة</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: colors.warning + '15' }]}>
            <Text style={styles.statIcon}>⚡</Text>
            <Text style={styles.statValue}>{stats.urgent}</Text>
            <Text style={styles.statLabel}>عاجلة</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: colors.primary + '15' }]}>
            <Text style={styles.statIcon}>👨‍🍳</Text>
            <Text style={styles.statValue}>{stats.preparing}</Text>
            <Text style={styles.statLabel}>قيد التحضير</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: colors.secondary + '15' }]}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statValue}>{stats.todayRevenue}</Text>
            <Text style={styles.statLabel}>اليوم (ج)</Text>
          </View>
        </View>
      </View>

      <View style={styles.statusFilter}>
        {ORDER_STATUSES.map((status) => {
          const count = status.value === 'all' 
            ? orders.length 
            : orders.filter(o => o.status === status.value).length;
          
          return (
            <TouchableOpacity
              key={status.value}
              style={[
                styles.miniCard,
                selectedStatus === status.value && styles.miniCardActive
              ]}
              onPress={() => setSelectedStatus(status.value)}
            >
              <Text style={styles.miniCardCount}>{count}</Text>
              <Text style={styles.miniCardIcon}>{status.icon}</Text>
              <Text style={[
                styles.miniCardLabel,
                selectedStatus === status.value && styles.miniCardLabelActive
              ]}>
                {status.label}
              </Text>
              {selectedStatus === status.value && (
                <View style={styles.miniCardUnderline} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

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
  statsSection: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statsSectionTitle: {
    ...typography.bodyMedium,
    color: colors.textLight,
    marginBottom: spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.lg,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
  },
  statusFilter: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    justifyContent: 'space-around',
  },
  miniCard: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minWidth: 60,
    position: 'relative',
  },
  miniCardActive: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  miniCardCount: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  miniCardIcon: {
    fontSize: 20,
    marginBottom: spacing.xs,
  },
  miniCardLabel: {
    ...typography.caption,
    color: colors.textLight,
    fontSize: 11,
  },
  miniCardLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  miniCardUnderline: {
    position: 'absolute',
    bottom: 0,
    left: spacing.sm,
    right: spacing.sm,
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  content: { flex: 1, padding: spacing.lg },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  gradientHeader: {
    padding: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '50',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusEmoji: {
    fontSize: 28,
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
  },
  statusPillText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
  },
  orderNumber: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  orderTime: {
    ...typography.body,
    color: colors.textLight,
  },
  customerSection: {
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background + '80',
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  customerName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  roleBadge: {
    backgroundColor: colors.textLight + '20',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 999,
  },
  roleBadgeText: {
    ...typography.caption,
    color: colors.textLight,
    fontWeight: '600',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonText: {
    fontSize: 18,
  },
  phoneNumber: {
    ...typography.caption,
    color: colors.textLight,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: spacing.sm,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    fontSize: 18,
  },
  productsCompact: {
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary + '08',
  },
  productsText: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 18,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.success + '10',
  },
  priceCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  priceLabel: {
    fontSize: 18,
  },
  priceValue: {
    ...typography.bodyMedium,
    color: colors.success,
    fontWeight: '700',
  },
  locationCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  locationIcon: {
    fontSize: 16,
  },
  locationTextCompact: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
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
