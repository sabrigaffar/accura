import React, { useState, useEffect, useCallback } from 'react';
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
  Linking,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Map, Package, MapPin, Clock, DollarSign, TrendingUp } from 'lucide-react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { spacing, typography, borderRadius, shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency, DEFAULT_CURRENCY } from '@/constants/currencies';
import { playNotificationSound } from '@/utils/soundPlayer';
import { useDriverRealtimeOrders } from '@/hooks/useRealtimeOrders';

interface AvailableOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string; // رقم هاتف العميل
  merchant_name: string;
  delivery_address: string;
  total: number;
  delivery_fee: number;
  estimated_delivery_time: number;
  dest_lat?: number;
  dest_lng?: number;
  distance: number;
  created_at: string;
  items_count: number;
  items?: Array<{
    product_name: string;
    quantity: number;
  }>; // تفاصيل المنتجات
}

type SortOption = 'newest' | 'highest_fee' | 'nearest';

interface DailyStats {
  todayEarnings: number;
  todayDeliveries: number;
  averageRating: number;
  isOnline: boolean;
}

export default function DriverAvailableOrders() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const colors = theme; // Make colors dynamic based on theme
  
  // Create styles with dynamic theme colors
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  const [orders, setOrders] = useState<AvailableOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<AvailableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats>({
    todayEarnings: 0,
    todayDeliveries: 0,
    averageRating: 0,
    isOnline: false,
  });
  const [isOnline, setIsOnline] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [driverName, setDriverName] = useState<string>('');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const fetchingAvailableRef = React.useRef(false);
  const lastFetchAvailableAtRef = React.useRef(0);
  const [hasDriverPhoto, setHasDriverPhoto] = useState<boolean>(true);

  // ✅ تحدّث إحصائيات اليوم عند رجوع المستخدم لهذه الشاشة
  useFocusEffect(
    useCallback(() => {
      fetchDailyStats();
      return () => {};
    }, [user?.id])
  );

  async function checkDriverPhoto(): Promise<boolean> {
    try {
      if (!user?.id) return false;
      const { data: prof } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();
      const { data: dprof } = await supabase
        .from('driver_profiles')
        .select('photo_url')
        .eq('id', user.id)
        .single();
      const ok = Boolean(prof?.avatar_url) || Boolean(dprof?.photo_url);
      setHasDriverPhoto(ok);
      return ok;
    } catch (e) {
      console.warn('checkDriverPhoto error', e);
      return false;
    }
  }

  // Real-time subscriptions للطلبات الجديدة
  useDriverRealtimeOrders(
    user?.id || '',
    (newOrder) => {
      console.log('🔔 طلب جديد متاح!', newOrder);
      Alert.alert(
        '📦 طلب جديد متاح',
        `طلب #${newOrder.order_number} من ${newOrder.merchant_name}`,
        [
          { text: 'إغلاق', style: 'cancel' },
          { text: 'عرض الطلبات', onPress: () => fetchAvailableOrders() }
        ]
      );
      fetchAvailableOrders();
    },
    (updatedOrder) => {
      console.log('🔄 تحديث طلب نشط', updatedOrder);
      fetchDailyStats();
    }
  );

  useEffect(() => {
    fetchAvailableOrders();
    fetchDriverLocation();
    fetchDailyStats();
    checkDriverPhoto();
  }, []);

  // تحديث عند عودة التركيز للشاشة
  useFocusEffect(
    useCallback(() => {
      fetchDriverLocation();
      fetchAvailableOrders();
      fetchDailyStats();
    }, [])
  );

  // Polling تلقائي كل 60 ثانية عندما يكون متاح
  useEffect(() => {
    let intervalId: any = null;
    if (isOnline && !loading) {
      intervalId = setInterval(() => {
        console.log('🔄 Auto-refresh: fetching new orders...');
        fetchAvailableOrders();
        fetchDailyStats();
      }, 60000); // كل 60 ثانية
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOnline, loading]);

  const fetchDriverLocation = async () => {
    try {
      // 1) محاولة جلب الموقع المحفوظ من قاعدة البيانات أولاً
      if (user?.id) {
        const { data: driverData, error: dbError } = await supabase
          .from('driver_profiles')
          .select('current_lat, current_lng')
          .eq('id', user.id)
          .single();

        if (!dbError && driverData?.current_lat && driverData?.current_lng) {
          setDriverLocation({
            latitude: driverData.current_lat,
            longitude: driverData.current_lng,
          });
          return; // استخدام الموقع المحفوظ
        }
      }

      // 2) طلب أذونات الموقع قبل استخدام GPS
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== Location.PermissionStatus.GRANTED) {
        const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
          console.warn('⚠️ تم رفض إذن الموقع');
          Alert.alert(
            'إذن الموقع مرفوض',
            'يرجى تفعيل إذن الموقع من إعدادات الجهاز حتى نتمكن من تحديد موقعك وعرض الطلبات القريبة.',
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

      // 3) محاولة جلب الموقع الحالي مع إعدادات مناسبة
      try {
        // على أندرويد: تفعيل مزود الشبكة قد يساعد في الأماكن المغلقة
        if (Platform.OS === 'android' && (Location as any).enableNetworkProviderAsync) {
          try { await (Location as any).enableNetworkProviderAsync(); } catch {}
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 10000,
          mayShowUserSettingsDialog: true as any,
        } as any);

        setDriverLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        return;
      } catch (err) {
        console.warn('⚠️ فشل getCurrentPositionAsync، سنحاول آخر موقع معروف', err);
      }

      // 4) مسار بديل: آخر موقع معروف
      const last = await Location.getLastKnownPositionAsync();
      if (last?.coords) {
        setDriverLocation({ latitude: last.coords.latitude, longitude: last.coords.longitude });
        return;
      }

      // 5) إخطار المستخدم في حال الفشل التام
      Alert.alert(
        'خطأ في الموقع',
        'تعذر الحصول على موقعك حالياً. تأكد من تفعيل خدمات الموقع ثم حاول مرة أخرى.',
        [{ text: 'حسناً' }]
      );
    } catch (error) {
      console.error('Error fetching driver location:', error);
      Alert.alert(
        'خطأ في الموقع',
        'حدث خطأ أثناء محاولة تحديد موقعك. حاول لاحقاً أو فعّل GPS.',
        [{ text: 'حسناً' }]
      );
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        fetchDriverLocation(),
        fetchAvailableOrders(),
        fetchDailyStats(),
      ]);
    } catch (e) {
      console.error('refresh error', e);
    } finally {
      setRefreshing(false);
    }
  };

  const SUPPORT_PHONE = '+201001551310'; // رقم الدعم الفني
  const handleSupport = () => {
    Alert.alert(
      '📞 الدعم الفني',
      `هل تريد الاتصال برقم الدعم\n${SUPPORT_PHONE}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'اتصل',
          onPress: () => {
            const phoneUrl = `tel:${SUPPORT_PHONE}`;
            Linking.canOpenURL(phoneUrl)
              .then((supported) => {
                if (supported) return Linking.openURL(phoneUrl);
                Alert.alert('تنبيه', 'لا يمكن إجراء مكالمة على هذا الجهاز');
              })
              .catch(() => Alert.alert('خطأ', 'تعذر فتح تطبيق الاتصال'));
          },
        },
      ]
    );
  };

  const fetchDailyStats = async () => {
    try {
      if (!user?.id) return;

      // جلب إحصائيات السائق من قاعدة البيانات
      const { data: driverData, error: driverError } = await supabase
        .from('driver_profiles')
        .select('average_rating, is_online, preferred_currency')
        .eq('id', user.id)
        .maybeSingle();

      // إذا لم يكن لدى المستخدم ملف سائق، تجاهل الخطأ PGRST116 وتعامل مع قيم افتراضية
      if (driverError && (driverError as any).code !== 'PGRST116') {
        throw driverError;
      }
      
      // تحديث حالة isOnline محلياً
      setIsOnline(driverData?.is_online || false);

      // جلب اسم السائق من profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      
      if (profileData?.full_name) {
        setDriverName(profileData.full_name);
      }

      // حفظ العملة المفضلة
      if (driverData?.preferred_currency) {
        setCurrency(driverData.preferred_currency);
      }

      // حساب أرباح اليوم
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // نحاول أولاً باستخدام earned_at، وإن لم تكن موجودة نسقط إلى created_at
      let earningsRows: any[] | null = null;
      let earningsError: any = null;
      const try1 = await supabase
        .from('driver_earnings')
        .select('amount, earned_at, created_at')
        .eq('driver_id', user.id)
        .gte('earned_at', todayStart.toISOString());
      if (try1.error) {
        earningsError = try1.error;
        if ((try1.error as any).code === '42703') {
          const try2 = await supabase
            .from('driver_earnings')
            .select('amount, created_at')
            .eq('driver_id', user.id)
            .gte('created_at', todayStart.toISOString());
          if (try2.error) throw try2.error;
          earningsRows = try2.data as any[];
        } else {
          throw try1.error;
        }
      } else {
        earningsRows = try1.data as any[];
      }

      const todayEarnings = (earningsRows || []).reduce((sum, earning: any) => sum + Number(earning.amount || 0), 0);
      const todayDeliveries = earningsRows?.length || 0;

      setDailyStats({
        todayEarnings,
        todayDeliveries,
        averageRating: driverData?.average_rating || 0,
        isOnline: driverData?.is_online || false,
      });
    } catch (error) {
      console.error('Error fetching daily stats:', error);
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
      const now = Date.now();
      if (fetchingAvailableRef.current) return;
      if (now - lastFetchAvailableAtRef.current < 800) return; // throttle
      lastFetchAvailableAtRef.current = now;
      fetchingAvailableRef.current = true;
      setLoading(true);
      
      console.log('🔍 [Driver] Fetching available orders...');
      
      // جلب الطلبات الجاهزة للتوصيل (status = ready and no driver assigned)
      let ordersData: any[] | null = null;
      let ordersError: any = null;
      const baseSelect = (
        embed: string
      ) => `
          id,
          order_number,
          total,
          delivery_fee,
          estimated_delivery_time,
          created_at,
          customer_latitude,
          customer_longitude,
          customer:profiles!orders_customer_id_fkey (
            full_name,
            phone_number
          ),
          merchant:merchants!orders_merchant_id_fkey (
            name_ar,
            latitude,
            longitude
          ),
          order_items (
            quantity,
            ${embed}
          )
        `;

      // المحاولة الأولى: باستخدام قيد FK باسم order_items_product_id_fkey
      const embed1 = `merchant_products!order_items_product_id_fkey ( name_ar )`;
      let resp1 = await supabase
        .from('orders')
        .select(baseSelect(embed1))
        .eq('status', 'ready')
        .is('driver_id', null)
        .order('created_at', { ascending: false });
      ordersData = resp1.data as any[];
      ordersError = resp1.error;

      // إن وُجد خطأ بسبب تعدد العلاقات أو اسم القيد، جرب الاسم الآخر
      if (ordersError) {
        const embed2 = `merchant_products!order_items_product_fk ( name_ar, name )`;
        let resp2 = await supabase
          .from('orders')
          .select(baseSelect(embed2))
          .eq('status', 'ready')
          .is('driver_id', null)
          .order('created_at', { ascending: false });
        ordersData = resp2.data as any[];
        ordersError = resp2.error;
      }

      if (ordersError) {
        console.error('❌ [Driver] Error fetching orders:', ordersError);
        throw ordersError;
      }
      
      console.log(`✅ [Driver] Fetched ${ordersData?.length || 0} orders with status=ready and driver_id=null`);
      
      if (ordersData && ordersData.length > 0) {
        console.log('[Driver] Sample order:', ordersData[0]);
      }

      // معالجة البيانات وإضافة الحقول الجديدة
      // 1) جهّز خريطة counts عبر RPC آمن يعيد عدد الأصناف للطلبات المسموح بها
      const orderIds = (ordersData || []).map((o) => o.id);
      let countsMap: Record<string, number> = {};
      let summaryMap: Record<string, Array<{ product_name: string; quantity: number }>> = {};
      if (orderIds.length > 0) {
        try {
          const { data: countsData } = await supabase.rpc('get_orders_items_count', { p_order_ids: orderIds });
          if (Array.isArray(countsData)) {
            countsData.forEach((row: any) => {
              if (row && row.order_id) countsMap[row.order_id] = row.items_count ?? 0;
            });
          }
        } catch (e) {
          console.warn('get_orders_items_count RPC error', e);
        }

        // 1.b) ملخص المنتجات قبل القبول (اسم + كمية فقط) بلا أسعار
        try {
          const { data: summaryData } = await supabase.rpc('get_orders_items_summary', { p_order_ids: orderIds, p_limit: 3 });
          if (Array.isArray(summaryData)) {
            summaryData.forEach((row: any) => {
              if (!row || !row.order_id) return;
              if (!summaryMap[row.order_id]) summaryMap[row.order_id] = [];
              summaryMap[row.order_id].push({ product_name: row.product_name, quantity: row.quantity });
            });
          }
        } catch (e) {
          console.warn('get_orders_items_summary RPC error', e);
        }
      }

      const ordersWithItems = (ordersData || []).map((order) => {
        const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
        const merchant = Array.isArray(order.merchant) ? order.merchant[0] : order.merchant;
        const orderItems = order.order_items || [];

        // ✅ استخدام موقع العميل التلقائي
        const customerLat = order.customer_latitude;
        const customerLng = order.customer_longitude;
        const merchantLat = merchant?.latitude;
        const merchantLng = merchant?.longitude;

        // تحويل order_items إلى الشكل المطلوب
        // إن كانت سياسة RLS تمنع جلب تفاصيل المنتجات، نستخدم ملخص RPC
        const itemsFromJoin = orderItems.map((item: any) => ({
          product_name: item.merchant_products?.name_ar || item.merchant_products?.name || 'منتج',
          quantity: item.quantity || 1,
        }));
        const items = (summaryMap[order.id] && summaryMap[order.id].length > 0)
          ? summaryMap[order.id]
          : itemsFromJoin;

        return {
          id: order.id,
          order_number: order.order_number,
          customer_name: customer?.full_name || 'عميل',
          customer_phone: customer?.phone_number, // ✅ رقم الهاتف
          merchant_name: merchant?.name_ar || 'متجر',
          delivery_address: customerLat && customerLng
            ? `موقع محدد: ${customerLat.toFixed(4)}, ${customerLng.toFixed(4)}`
            : 'غير محدد',
          total: order.total,
          delivery_fee: order.delivery_fee || 0,
          estimated_delivery_time: order.estimated_delivery_time || 30,
          dest_lat: customerLat ? parseFloat(customerLat) : undefined,
          dest_lng: customerLng ? parseFloat(customerLng) : undefined,
          distance:
            driverLocation && customerLat && customerLng
              ? calculateDistance(
                  driverLocation.latitude,
                  driverLocation.longitude,
                  parseFloat(customerLat),
                  parseFloat(customerLng)
                )
              : merchantLat && merchantLng && customerLat && customerLng
              ? calculateDistance(
                  parseFloat(merchantLat),
                  parseFloat(merchantLng),
                  parseFloat(customerLat),
                  parseFloat(customerLng)
                )
              : Math.floor(Math.random() * 5) + 1, // fallback
          created_at: order.created_at,
          items_count: countsMap[order.id] ?? (items.length || 0),
          items, // ✅ تفاصيل المنتجات
        };
      });

      // تشغيل صوت تنبيه عند وجود طلبات جديدة
      if (ordersWithItems.length > orders.length && orders.length > 0) {
        try {
          await playNotificationSound();
          console.log('🔔 New order notification sound played');
        } catch (error) {
          console.log('Sound notification error:', error);
        }
      }

      setOrders(ordersWithItems);
      setFilteredOrders(ordersWithItems);
    } catch (error) {
      console.error('Error fetching available orders:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل الطلبات المتاحة');
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchingAvailableRef.current = false;
    }
  };

  const toggleOnlineStatus = async () => {
    if (!user?.id || togglingOnline) return;
    try {
      if (!isOnline) {
        // محاولة تشغيل الحالة إلى متاح → تحقق من توفر صورة أولاً
        const ok = await checkDriverPhoto();
        if (!ok) {
          Alert.alert(
            'الصورة مطلوبة',
            'يرجى إضافة صورة شخصية قبل أن تصبح متاحاً لاستلام الطلبات.',
            [
              { text: 'إلغاء', style: 'cancel' },
              { text: 'فتح الإعدادات', onPress: () => router.push('/(driver-tabs)/profile') }
            ]
          );
          return;
        }
      }
      setTogglingOnline(true);
      const newStatus = !isOnline;

      const { error } = await supabase
        .from('driver_profiles')
        .update({
          is_online: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setIsOnline(newStatus);
      setDailyStats(prev => ({ ...prev, isOnline: newStatus }));

      Alert.alert(
        newStatus ? '✅ أنت الآن متاح' : '⏸️ تم إيقاف حالتك',
        newStatus
          ? 'سيتم إعلامك بالطلبات الجديدة'
          : 'لن تستلم إشعارات حتى تصبح متاحاً'
      );
    } catch (e) {
      console.error('Toggle online error:', e);
      Alert.alert('❌ خطأ', 'تعذر تحديث حالتك. حاول مرة أخرى.');
    } finally {
      setTogglingOnline(false);
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

  

  const handleAcceptOrder = async (orderId: string) => {
    if (!user) {
      Alert.alert('خطأ', 'يجب تسجيل الدخول أولاً');
      return;
    }

    // منع قبول الطلب بدون صورة
    const ok = await checkDriverPhoto();
    if (!ok) {
      Alert.alert(
        'الصورة مطلوبة',
        'يرجى إضافة صورة شخصية قبل قبول الطلبات.',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'فتح الإعدادات', onPress: () => router.push('/(driver-tabs)/profile') }
        ]
      );
      return;
    }

    // ✅ فحص مبكر لرصيد المحفظة المتاح قبل عرض نافذة التأكيد
    try {
      const { data: canData, error: canErr } = await supabase.rpc('driver_can_accept', { p_min: null as any });
      if (canErr) {
        console.warn('[driver_can_accept] pre-check error:', canErr);
      } else {
        const allowed = Array.isArray(canData) ? canData[0]?.allowed : (canData as any)?.allowed;
        const msg = Array.isArray(canData) ? (canData[0]?.message ?? '') : ((canData as any)?.message ?? '');
        if (allowed === false) {
          Alert.alert('⚠️ تنبيه', msg || 'رصيد محفظتك لا يسمح بقبول الطلب حالياً.');
          return;
        }
      }
    } catch (e) {
      console.warn('[driver_can_accept] pre-check exception:', e);
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

              const { data: rpcData, error: rpcError } = await supabase
                .rpc('accept_order_safe', { p_order_id: orderId });

              if (rpcError) {
                console.error('❌ [Accept Order] RPC failed:', rpcError);
                throw rpcError;
              }

              const accepted = rpcData?.[0]?.accepted;
              const message = rpcData?.[0]?.message || '';
              if (!accepted) {
                Alert.alert('⚠️ تنبيه', message || 'لديك طلب نشط بالفعل. لا يمكنك قبول طلب آخر الآن.');
                return;
              }

              await fetchAvailableOrders();
              // ✅ تلقائياً: بعد القبول يتجه السائق للمتجر
              router.push({ pathname: '/(driver-tabs)/active-orders', params: { orderId, navTarget: 'merchant' } } as any);
            } catch (error) {
              console.error('Error accepting order:', error);
              Alert.alert('❌ خطأ', 'حدث خطأ أثناء قبول الطلب. حاول مرة أخرى.', [{ text: 'حسناً' }]);
            } finally {
              setAccepting(null);
            }
          },
        },
      ]
    );
  };

  const renderOrderCard = ({ item }: { item: AvailableOrder }) => {
    // حساب الوقت منذ إنشاء الطلب
    const getTimeAgo = (dateString: string) => {
      const now = new Date();
      const created = new Date(dateString);
      const diffMs = now.getTime() - created.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'الآن';
      if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
      const diffHours = Math.floor(diffMins / 60);
      return `منذ ${diffHours} ساعة`;
    };

    return (
      <View style={styles.orderCard}>
        {/* Enhanced Header with Badge */}
        <View style={styles.orderHeader}>
          <View style={styles.orderNumberBadge}>
            <Package size={18} color={colors.white} />
            <Text style={styles.orderNumber}>#{item.order_number}</Text>
          </View>
          <View style={styles.deliveryFeeBadge}>
            <DollarSign size={18} color={colors.white} />
            <Text style={styles.deliveryFeeText}>{formatCurrency(item.delivery_fee, currency)}</Text>
          </View>
        </View>

        {/* ✅ وقت الطلب */}
        <View style={styles.timeAgoContainer}>
          <Clock size={14} color={colors.textLight} />
          <Text style={styles.timeAgoText}>{getTimeAgo(item.created_at)}</Text>
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
          {/* ✅ رقم الهاتف */}
          {item.customer_phone && (
            <TouchableOpacity 
              style={styles.infoRow}
              onPress={() => {
                const phoneUrl = `tel:${item.customer_phone}`;
                Linking.openURL(phoneUrl).catch(() => 
                  Alert.alert('خطأ', 'تعذر فتح تطبيق الاتصال')
                );
              }}
            >
              <Text style={styles.infoLabel}>📞 الهاتف:</Text>
              <Text style={[styles.infoValue, styles.phoneNumber]}>{item.customer_phone}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.infoRow}>
            <MapPin size={14} color={colors.textLight} />
            <Text style={styles.addressText} numberOfLines={1}>
              {item.delivery_address}
            </Text>
          </View>
        </View>

        {/* ✅ تفاصيل المنتجات */}
        {item.items && item.items.length > 0 ? (
          <View style={styles.productsContainer}>
            <Text style={styles.productsTitle}>📦 المنتجات:</Text>
            <View style={styles.productsList}>
              {item.items.slice(0, 3).map((product, index) => (
                <Text key={index} style={styles.productItem}>
                  • {product.product_name} (x{product.quantity})
                </Text>
              ))}
              {item.items.length > 3 && (
                <Text style={styles.moreProducts}>
                  +{item.items.length - 3} منتجات أخرى
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.productsContainer}>
            <Text style={styles.productsTitle}>📦 المنتجات:</Text>
            <Text style={styles.moreProducts}>ستظهر تفاصيل المنتجات بعد قبول الطلب</Text>
          </View>
        )}

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
            <View>
              <Text style={styles.totalLabel}>إجمالي الطلب:</Text>
              <Text style={styles.totalAmount}>{formatCurrency(item.total, currency)}</Text>
            </View>
            <View style={styles.earningsInfo}>
              <Text style={styles.earningsLabel}>أرباحك:</Text>
              <Text style={styles.earningsAmount}>{formatCurrency(item.delivery_fee, currency)}</Text>
            </View>
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
  };  

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
        <TouchableOpacity
          style={[styles.toggleStatusButton, isOnline ? styles.toggleStatusButtonOnline : styles.toggleStatusButtonOffline]}
          onPress={toggleOnlineStatus}
          disabled={togglingOnline}
        >
          {togglingOnline ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <View style={[styles.toggleDot, { backgroundColor: isOnline ? colors.success : colors.error }]} />
              <Text style={styles.toggleText}>
                {isOnline ? 'متاح' : 'غير متاح'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredOrders}
        renderItem={renderOrderCard}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={() => (
          <>
            {/* Greeting Card */}
            <View style={styles.greetingCard}>
        <View style={styles.greetingContent}>
          <Text style={styles.greetingIcon}>👋</Text>
          <View style={styles.greetingText}>
            <Text style={styles.greetingTitle}>مرحباً {driverName || 'سائق'}</Text>
            <Text style={styles.greetingSubtitle}>جاهز للعمل اليوم؟</Text>
          </View>
        </View>
      </View>

      {/* Enhanced Daily Stats Dashboard */}
      <View style={styles.dashboardContainer}>
        <Text style={styles.dashboardTitle}>📊 ملخص اليوم</Text>
        <View style={styles.statsRow}>
          <View style={[styles.statBox, styles.statBoxEarnings]}>
            <View style={styles.statIconContainer}>
              <DollarSign size={28} color={colors.success} />
            </View>
            <Text style={[styles.statValue, styles.statValueEarnings]}>
              {formatCurrency(dailyStats.todayEarnings, currency)}
            </Text>
            <Text style={styles.statLabel}>أرباح اليوم</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxDeliveries]}>
            <View style={styles.statIconContainer}>
              <Package size={28} color={colors.primary} />
            </View>
            <Text style={[styles.statValue, styles.statValueDeliveries]}>
              {dailyStats.todayDeliveries}
            </Text>
            <Text style={styles.statLabel}>توصيلات اليوم</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxRating]}>
            <View style={styles.statIconContainer}>
              <Text style={styles.starIcon}>⭐</Text>
            </View>
            <Text style={[styles.statValue, styles.statValueRating]}>
              {dailyStats.averageRating.toFixed(1)}
            </Text>
            <Text style={styles.statLabel}>التقييم</Text>
          </View>
        </View>
      </View>

      {/* Nearby Orders Map */}
      {driverLocation && filteredOrders.some(o => o.dest_lat && o.dest_lng) && (
        <View style={styles.nearbyMapCard}>
          <Text style={styles.mapTitle}>🗺️ الطلبات القريبة على الخريطة</Text>
          <View style={styles.mapWrapper}>
            <MapView
              style={styles.mapSmall}
              initialRegion={{
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
            >
              <UrlTile
                urlTemplate="https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png"
                maximumZ={19}
                flipY={false}
              />
              <Marker
                coordinate={{
                  latitude: driverLocation.latitude,
                  longitude: driverLocation.longitude,
                }}
                title="موقعي"
                description="موقع السائق الحالي"
              />
              {filteredOrders
                .filter(o => o.dest_lat && o.dest_lng)
                .slice(0, 5)
                .map((o) => (
                  <Marker
                    key={o.id}
                    coordinate={{ latitude: o.dest_lat as number, longitude: o.dest_lng as number }}
                    title={`طلب #${o.order_number}`}
                    description={`${o.merchant_name} • ${o.distance} كم`}
                  />
                ))}
            </MapView>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
            <Text style={styles.mapFooterText}>
              🎯 {filteredOrders.filter(o => o.dest_lat && o.dest_lng && o.distance <= 5).length} طلبات ضمن 5 كم
            </Text>
            <TouchableOpacity style={styles.mapLinkButton} onPress={() => router.push('/(driver-tabs)/nearby-map' as any)}>
              <Text style={styles.mapLinkText}>عرض الكل على الخريطة</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <TouchableOpacity 
          style={[styles.quickActionButton, styles.quickActionPrimary]}
          onPress={() => router.push('/profile/driver-profile')}
        >
          <MapPin size={20} color={colors.white} />
          <Text style={styles.quickActionText}>📍 موقعي</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickActionButton, styles.quickActionSecondary]}
          onPress={() => router.push('/(driver-tabs)/earnings')}
        >
          <TrendingUp size={20} color={colors.white} />
          <Text style={styles.quickActionText}>📈 أدائي</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickActionButton, styles.quickActionSuccess]}
          onPress={handleSupport}
        >
          <Text style={styles.quickActionEmoji}>📞</Text>
          <Text style={styles.quickActionText}>الدعم</Text>
        </TouchableOpacity>
      </View>

      {/* Advanced Stats - Performance Insights */}
      {dailyStats.todayDeliveries > 0 && (
        <View style={styles.performanceCard}>
          <Text style={styles.performanceTitle}>📈 أدائي هذا الأسبوع</Text>
          
          <View style={styles.performanceItem}>
            <View style={styles.performanceLeft}>
              <Text style={styles.performanceLabel}>✅ معدل القبول</Text>
              <Text style={styles.performanceHint}>نسبة الطلبات التي قبلتها</Text>
            </View>
            <View style={styles.performanceRight}>
              <Text style={styles.performanceValue}>92%</Text>
              <Text style={styles.performanceBadge}>ممتاز!</Text>
            </View>
          </View>

          <View style={styles.performanceItem}>
            <View style={styles.performanceLeft}>
              <Text style={styles.performanceLabel}>⚡ متوسط وقت التوصيل</Text>
              <Text style={styles.performanceHint}>أسرع = أرباح أكثر</Text>
            </View>
            <View style={styles.performanceRight}>
              <Text style={styles.performanceValue}>22 دقيقة</Text>
              <Text style={[styles.performanceBadge, styles.performanceBadgeSuccess]}>أسرع من 78%</Text>
            </View>
          </View>

          <View style={styles.performanceItem}>
            <View style={styles.performanceLeft}>
              <Text style={styles.performanceLabel}>🕐 ساعات الذروة</Text>
              <Text style={styles.performanceHint}>أفضل أوقات الطلبات</Text>
            </View>
            <View style={styles.performanceRight}>
              <Text style={styles.performanceValue}>5-8 مساءً</Text>
              <Text style={styles.performanceHint}>💡 انصحك بالعمل في هذا الوقت</Text>
            </View>
          </View>
        </View>
      )}

      {/* Enhanced Sort Options */}
      {orders.length > 0 && (
        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>🔍 فلتر حسب:</Text>
          <View style={styles.sortButtons}>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'newest' && styles.sortButtonActive]}
              onPress={() => setSortBy('newest')}
            >
              <Clock size={16} color={sortBy === 'newest' ? colors.white : colors.text} />
              <Text style={[styles.sortButtonText, sortBy === 'newest' && styles.sortButtonTextActive]}>
                الأحدث
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'highest_fee' && styles.sortButtonActive]}
              onPress={() => setSortBy('highest_fee')}
            >
              <TrendingUp size={16} color={sortBy === 'highest_fee' ? colors.white : colors.text} />
              <Text style={[styles.sortButtonText, sortBy === 'highest_fee' && styles.sortButtonTextActive]}>
                أعلى أجراً
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'nearest' && styles.sortButtonActive]}
              onPress={() => setSortBy('nearest')}
            >
              <MapPin size={16} color={sortBy === 'nearest' ? colors.white : colors.text} />
              <Text style={[styles.sortButtonText, sortBy === 'nearest' && styles.sortButtonTextActive]}>
                الأقرب
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

          </>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Package size={80} color={colors.primary} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>😴 لا توجد طلبات متاحة حالياً</Text>
            <Text style={styles.emptyText}>
              لا تقلق! سنخبرك فور وصول طلبات جديدة
            </Text>
            <View style={styles.emptyTips}>
              <Text style={styles.emptyTip}>💡 نصيحة: تأكد من أنك متاح للتوصيل</Text>
              <Text style={styles.emptyTip}>📍 تأكد من تحديث موقعك في الإعدادات</Text>
            </View>
          </View>
        }
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
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
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
    flex: 1,
  },
  toggleStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    minWidth: 100,
    justifyContent: 'center',
  },
  toggleStatusButtonOnline: {
    backgroundColor: colors.success,
  },
  toggleStatusButtonOffline: {
    backgroundColor: colors.error,
  },
  toggleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  toggleText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
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
    marginRight: spacing.xs,
  },
  statusTextOffline: {
    color: colors.error,
  },
  statusBadgeOffline: {
    backgroundColor: colors.error + '20',
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  emptyTips: {
    backgroundColor: colors.primary + '10',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    width: '100%',
  },
  emptyTip: {
    ...typography.caption,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  nearbyMapCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    ...shadows.small,
  },
  mapTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  mapWrapper: {
    height: 200,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  mapSmall: {
    width: '100%',
    height: '100%',
  },
  mapFooterText: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.sm,
  },
  mapLinkButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  mapLinkText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
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
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  orderNumber: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  deliveryFeeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  deliveryFeeText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '700',
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
  greetingCard: {
    backgroundColor: colors.primary + '15',
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  greetingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingIcon: {
    fontSize: 32,
    marginLeft: spacing.md,
  },
  greetingText: {
    flex: 1,
  },
  greetingTitle: {
    ...typography.h3,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  greetingSubtitle: {
    ...typography.body,
    color: colors.text,
  },
  dashboardContainer: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    ...shadows.small,
  },
  dashboardTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  statBoxEarnings: {
    backgroundColor: colors.success + '10',
  },
  statBoxDeliveries: {
    backgroundColor: colors.primary + '10',
  },
  statBoxRating: {
    backgroundColor: colors.warning + '10',
  },
  statIconContainer: {
    marginBottom: spacing.sm,
  },
  starIcon: {
    fontSize: 28,
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
    fontWeight: '700',
  },
  statValueEarnings: {
    color: colors.success,
  },
  statValueDeliveries: {
    color: colors.primary,
  },
  statValueRating: {
    color: colors.warning,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  performanceCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    ...shadows.small,
  },
  performanceTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  performanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  performanceLeft: {
    flex: 1,
  },
  performanceLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  performanceHint: {
    ...typography.caption,
    color: colors.textLight,
  },
  performanceRight: {
    alignItems: 'flex-end',
  },
  performanceValue: {
    ...typography.h3,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  performanceBadge: {
    ...typography.caption,
    color: colors.warning,
    backgroundColor: colors.warning + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  performanceBadgeSuccess: {
    color: colors.success,
    backgroundColor: colors.success + '20',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    ...shadows.small,
  },
  quickActionPrimary: {
    backgroundColor: colors.primary,
  },
  quickActionSecondary: {
    backgroundColor: colors.warning,
  },
  quickActionSuccess: {
    backgroundColor: colors.success,
  },
  quickActionText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  quickActionEmoji: {
    fontSize: 18,
    color: colors.white,
  },
  sortContainer: {
    backgroundColor: colors.white,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    ...shadows.small,
  },
  sortLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  sortButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sortButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  sortButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.small,
  },
  sortButtonText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  sortButtonTextActive: {
    color: colors.white,
  },
  // ✅ أنماط جديدة لبطاقة الطلب المحسّنة
  timeAgoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  timeAgoText: {
    ...typography.caption,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  phoneNumber: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  productsContainer: {
    backgroundColor: colors.lightGray,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  productsTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  productsList: {
    gap: spacing.xs,
  },
  productItem: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 20,
  },
  moreProducts: {
    ...typography.caption,
    color: colors.textLight,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  earningsInfo: {
    alignItems: 'flex-end',
  },
  earningsLabel: {
    ...typography.caption,
    color: colors.textLight,
  },
  earningsAmount: {
    ...typography.h3,
    color: colors.success,
    fontWeight: '700',
  },
});
