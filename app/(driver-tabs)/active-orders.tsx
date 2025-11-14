import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
  TextInput,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, Polyline, UrlTile, Region } from 'react-native-maps';
import { Package, MapPin, Phone, Navigation, CheckCircle, MessageCircle } from 'lucide-react-native';
import { spacing, typography, borderRadius, shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency, DEFAULT_CURRENCY } from '@/constants/currencies';

interface ActiveOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  merchant_name: string;
  merchant_address: string;
  delivery_address: string;
  total: number;
  delivery_fee: number;
  status: string;
  items_count: number;
  picked_up_at?: string;
  heading_to_merchant_at?: string;
  heading_to_customer_at?: string;
}

enum DeliveryStep {
  ACCEPTED = 'accepted',
  HEADING_TO_MERCHANT = 'heading_to_merchant',
  PICKED_UP = 'picked_up',
  HEADING_TO_CUSTOMER = 'heading_to_customer',
  DELIVERED = 'delivered',
}

export default function DriverActiveOrders() {
  const params = useLocalSearchParams<{ orderId?: string; navTarget?: 'merchant' | 'customer' }>();
  const initialOrderId = typeof params.orderId === 'string' ? params.orderId : undefined;
  const initialNavTarget = params.navTarget === 'merchant' || params.navTarget === 'customer' ? params.navTarget : undefined;
  const { user } = useAuth();
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const { theme } = useTheme();
  const colors = theme;
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const locationTrackingInterval = useRef<any>(null);
  
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [merchantLocation, setMerchantLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [customerLocation, setCustomerLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const trackingStartedRef = useRef(false);
  const lastTrackedOrderIdRef = useRef<string | null>(null);
  const convoAttemptedForOrderRef = useRef<Record<string, boolean>>({});
  const autoNavigatedRef = useRef<boolean>(false);
  const fetchingActiveRef = React.useRef(false);
  // Press-and-hold confirm state for delivery completion
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<any>(null);

  const startHoldConfirm = () => {
    if (completing || getCurrentStep() !== DeliveryStep.HEADING_TO_CUSTOMER) return;
    if (holdTimerRef.current) return;
    setHoldProgress(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const start = Date.now();
    holdTimerRef.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 1200);
      setHoldProgress(p);
      if (p >= 1) {
        clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        handleCompleteDelivery();
      }
    }, 50);
  };

  const stopHoldConfirm = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldProgress(0);
  };

  // نافذة تأكيد قبل فتح الخرائط
  const promptNavigate = (target: 'merchant' | 'customer') => {
    const label = target === 'merchant' ? 'للمتجر' : 'للعميل';
    Alert.alert(
      'فتح تطبيق الخرائط',
      `هل تريد فتح الخرائط الآن للتوجيه ${label}؟`,
      [
        { text: 'لاحقاً', style: 'cancel' },
        { text: 'افتح الآن', onPress: () => handleNavigate(target) },
      ]
    );
  };

  // ملاحظة: دالة handleNavigate معرفة لاحقاً في الملف بإصدار أكثر تفصيلاً مع مسارات بديلة

  useEffect(() => {
    fetchActiveOrder();
    fetchCurrency();
  }, []);

  // ✅ إذا تم تمرير navTarget من الشاشة السابقة، ابدأ الملاحة تلقائياً عند توفر البيانات
  useEffect(() => {
    if (!autoNavigatedRef.current && activeOrder && initialNavTarget) {
      autoNavigatedRef.current = true;
      promptNavigate(initialNavTarget);
    }
  }, [activeOrder, initialNavTarget]);

  // إعادة الجلب عند تركيز الشاشة
  useFocusEffect(
    useCallback(() => {
      fetchActiveOrder();
      return () => {
        // إيقاف التتبع عند مغادرة الشاشة
        stopLocationTracking();
      };
    }, [user?.id, initialOrderId])
  );

  const ensureConversation = async (orderId: string, customerId?: string, driverId?: string) => {
    try {
      // ابحث عن محادثة موجودة
      const { data: existing, error: findErr } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();

      if (findErr && findErr.code !== 'PGRST116') {
        console.warn('find conversation error:', findErr);
      }

      if (existing?.id) {
        setConversationId(existing.id);
        return existing.id;
      }

      // أنشئ محادثة جديدة عبر RPC آمن (يستمد customer_id من orders)
      const { data: rpcData, error: createErr } = await supabase
        .rpc('create_chat_conversation', { p_order_id: orderId });

      if (createErr) {
        console.warn('create conversation error:', createErr);
        return null;
      }
      let cid: string | undefined;
      if (Array.isArray(rpcData)) {
        cid = rpcData[0]?.id as string | undefined;
      } else if (rpcData && typeof rpcData === 'object' && 'id' in rpcData) {
        cid = (rpcData as any).id as string;
      }
      if (cid) {
        setConversationId(cid);
        return cid;
      }
      return null;
    } catch (e) {
      console.error('ensureConversation error:', e);
      return null;
    }
  };

  const fetchCurrency = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('preferred_currency')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      if (data?.preferred_currency) {
        setCurrency(data.preferred_currency);
      }
    } catch (error) {
      console.error('Error fetching currency:', error);
    }
  };

  // بدء تتبع الموقع عندما يكون هناك طلب نشط (مرة واحدة لكل طلب)
  useEffect(() => {
    if (activeOrder) {
      if (!trackingStartedRef.current || lastTrackedOrderIdRef.current !== activeOrder.id) {
        startLocationTracking();
        trackingStartedRef.current = true;
        lastTrackedOrderIdRef.current = activeOrder.id;
      }
    }
    // لا نوقف التتبع هنا على كل تغيير لتفادي التكرار؛ نوقفه فقط عند الخروج من الشاشة
    return () => {
      stopLocationTracking();
      trackingStartedRef.current = false;
      lastTrackedOrderIdRef.current = null;
    };
  }, [activeOrder?.id]);

  const startLocationTracking = async () => {
    try {
      // طلب إذن الموقع (أثناء الاستخدام)
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== Location.PermissionStatus.GRANTED) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
          Alert.alert(
            'تتبع الموقع',
            'تم رفض إذن الموقع. يرجى تفعيله من إعدادات الجهاز لتتبع التوصيل مباشرًة.',
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

      // إيقاف أي تتبع سابق
      stopLocationTracking();

      // بدء تحديث الموقع كل 20 ثانية
      const updateLocation = async () => {
        try {
          // على أندرويد: تفعيل مزود الشبكة قد يساعد في الأماكن الداخلية
          if (Platform.OS === 'android' && (Location as any).enableNetworkProviderAsync) {
            try { await (Location as any).enableNetworkProviderAsync(); } catch {}
          }

          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 10000,
            mayShowUserSettingsDialog: true as any,
          } as any);

          // تحديث موقع السائق في الـ state
          setDriverLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });

          // حفظ الموقع في قاعدة البيانات
          if (user?.id) {
            await supabase
              .from('driver_profiles')
              .update({
                current_lat: location.coords.latitude,
                current_lng: location.coords.longitude,
                updated_at: new Date().toISOString(),
              })
              .eq('id', user.id);
          }
        } catch (error) {
          console.warn('⚠️ Error updating driver location (primary); trying last known...', error);
          try {
            const last = await Location.getLastKnownPositionAsync();
            if (last?.coords) {
              setDriverLocation({ latitude: last.coords.latitude, longitude: last.coords.longitude });
              if (user?.id) {
                await supabase
                  .from('driver_profiles')
                  .update({
                    current_lat: last.coords.latitude,
                    current_lng: last.coords.longitude,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', user.id);
              }
              return;
            }
          } catch (fallbackErr) {
            console.warn('⚠️ getLastKnownPositionAsync failed:', fallbackErr);
          }
          // لا يوجد موقع متاح
          // لا نظهر Alert في كل مرة لتفادي الإزعاج، فقط نسجل الخطأ
        }
      };

      // تحديث فوري
      updateLocation();

      // تحديث دوري كل 20 ثانية
      locationTrackingInterval.current = setInterval(updateLocation, 20000);

      console.log('✅ تم بدء تتبع الموقع للسائق');
    } catch (error) {
      console.error('Error starting location tracking:', error);
    }
  };

  const stopLocationTracking = () => {
    if (locationTrackingInterval.current) {
      clearInterval(locationTrackingInterval.current);
      locationTrackingInterval.current = null;
      console.log('⏹️ تم إيقاف تتبع الموقع');
    }
  };

  const fetchActiveOrder = async () => {
    try {
      if (fetchingActiveRef.current) return;
      fetchingActiveRef.current = true;
      setLoading(true);
      if (!user) {
        setLoading(false);
        return;
      }
      if (initialOrderId) {
        // محاولة أولى: جلب الطلب مباشرة بالـ id المعطى
        const { data: byIdData, error: byIdError } = await supabase
          .from('orders')
          .select(`
            id,
            customer_id,
            order_number,
            total,
            delivery_fee,
            status,
            picked_up_at,
            heading_to_merchant_at,
            heading_to_customer_at,
            customer_latitude,
            customer_longitude,
            merchant_id,
            customer:profiles!orders_customer_id_fkey (
              full_name,
              phone_number
            ),
            merchant:merchants!orders_merchant_id_fkey (
              name_ar,
              address,
              latitude,
              longitude
            )
          `)
          .eq('id', initialOrderId)
          .eq('driver_id', user.id)
          .limit(1);
        if (!byIdError && byIdData && byIdData.length > 0) {
          const o = byIdData[0];
          const customer = Array.isArray(o.customer) ? o.customer[0] : o.customer;
          const merchant = Array.isArray(o.merchant) ? o.merchant[0] : o.merchant;
          const customerLat = o.customer_latitude;
          const customerLng = o.customer_longitude;

          // ✅ احسب عدد الأصناف عبر RPC حتى في مسار initialOrderId
          let itemsCountById = 0;
          try {
            const { data: cdata } = await supabase.rpc('get_orders_items_count', { p_order_ids: [o.id] });
            if (Array.isArray(cdata) && cdata[0] && cdata[0].order_id === o.id) {
              itemsCountById = cdata[0].items_count || 0;
            }
          } catch (e) {
            console.warn('get_orders_items_count RPC error (by id):', e);
          }

          const active: ActiveOrder = {
            id: o.id,
            order_number: o.order_number,
            customer_name: customer?.full_name || 'عميل',
            customer_phone: customer?.phone_number || '',
            merchant_name: merchant?.name_ar || 'متجر',
            merchant_address: merchant?.address || 'غير محدد',
            delivery_address: customerLat && customerLng
              ? `موقع محدد: ${Number(customerLat).toFixed(4)}, ${Number(customerLng).toFixed(4)}`
              : 'غير محدد',
            total: o.total,
            delivery_fee: o.delivery_fee,
            status: o.status,
            items_count: itemsCountById,
            picked_up_at: o.picked_up_at || undefined,
            heading_to_merchant_at: o.heading_to_merchant_at || undefined,
            heading_to_customer_at: o.heading_to_customer_at || undefined,
          };
          setActiveOrder(active);

          // تأكد من وجود محادثة بين السائق والعميل لهذا الطلب (محاولة مرة واحدة لكل طلب)
          if (o.customer_id && o.id && !convoAttemptedForOrderRef.current[o.id]) {
            convoAttemptedForOrderRef.current[o.id] = true;
            try {
              await ensureConversation(o.id, o.customer_id, user.id);
            } catch (e) {
              console.warn('ensureConversation attempt failed (will not retry immediately)');
            }
          }

          if (merchant?.latitude && merchant?.longitude) {
            setMerchantLocation({ latitude: parseFloat(merchant.latitude), longitude: parseFloat(merchant.longitude) });
          }
          if (customerLat && customerLng) {
            setCustomerLocation({ latitude: parseFloat(String(customerLat)), longitude: parseFloat(String(customerLng)) });
          }

          return; // نجح الجلب بالمعرف
        }
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total,
          product_total,
          delivery_fee,
          service_fee,
          tax_amount,
          customer_total,
          payment_method,
          status,
          picked_up_at,
          heading_to_merchant_at,
          heading_to_customer_at,
          customer_latitude,
          customer_longitude,
          customer:profiles!orders_customer_id_fkey (
            id,
            full_name,
            phone_number
          ),
          merchant:merchants!orders_merchant_id_fkey (
            name_ar,
            address,
            latitude,
            longitude
          )
        `)
        .eq('driver_id', user.id)
        .in('status', ['on_the_way', 'picked_up', 'heading_to_customer', 'heading_to_merchant'])
        .order('updated_at', { ascending: false });

      if (orderError || !orderData || orderData.length === 0) {
        if (orderError) console.error('❌ [Active Orders] Error:', orderError);

        // استعلام احتياطي بدون أي تضمينات لتجنب تأثير RLS على الجداول المرتبطة
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('orders')
          .select('id, order_number, total, product_total, delivery_fee, service_fee, tax_amount, customer_total, payment_method, status, picked_up_at, heading_to_merchant_at, heading_to_customer_at, customer_latitude, customer_longitude, merchant_id')
          .eq('driver_id', user.id)
          .eq('status', 'out_for_delivery')
          .order('updated_at', { ascending: false })
          .limit(1);
        if (!fallbackError && fallbackData && fallbackData.length > 0) {
          const base = fallbackData[0];
          // جلب بيانات التاجر بشكل منفصل
          const { data: merchantData } = await supabase
            .from('merchants')
            .select('name_ar, address, latitude, longitude')
            .eq('id', base.merchant_id)
            .limit(1);

          const merchant = merchantData && merchantData.length > 0 ? merchantData[0] : null;

          setActiveOrder({
            id: base.id,
            order_number: base.order_number,
            customer_name: 'عميل',
            customer_phone: '',
            merchant_name: merchant?.name_ar || 'متجر',
            merchant_address: merchant?.address || 'غير محدد',
            delivery_address:
              base.customer_latitude && base.customer_longitude
                ? `موقع محدد: ${Number(base.customer_latitude).toFixed(4)}, ${Number(base.customer_longitude).toFixed(4)}`
                : 'غير محدد',
            total: base.total,
            delivery_fee: base.delivery_fee || 0,
            status: base.status,
            items_count: 0,
            picked_up_at: base.picked_up_at,
            heading_to_merchant_at: base.heading_to_merchant_at,
            heading_to_customer_at: base.heading_to_customer_at,
          });
          return;
        }

        // لا يوجد طلب نشط حتى بعد الاستعلام الاحتياطي
        setActiveOrder(null);
      } else if (orderData && orderData.length > 0) {
        const firstOrder = orderData[0];
        console.log('✅ [Active Orders] Found active order:', firstOrder.order_number);
        // جلب عدد الأصناف عبر RPC (يتجاوز تعقيدات RLS)
        let itemsCount = 0;
        try {
          const { data: cdata } = await supabase.rpc('get_orders_items_count', { p_order_ids: [firstOrder.id] });
          if (Array.isArray(cdata) && cdata[0] && cdata[0].order_id === firstOrder.id) {
            itemsCount = cdata[0].items_count || 0;
          }
        } catch (e) {
          console.warn('get_orders_items_count RPC error (active):', e);
        }

        const customer = Array.isArray(firstOrder.customer) ? firstOrder.customer[0] : firstOrder.customer;
        const merchant = Array.isArray(firstOrder.merchant) ? firstOrder.merchant[0] : firstOrder.merchant;

        // ✅ استخدام موقع العميل التلقائي
        const customerLat = firstOrder.customer_latitude;
        const customerLng = firstOrder.customer_longitude;

        setActiveOrder({
          id: firstOrder.id,
          order_number: firstOrder.order_number,
          customer_name: customer?.full_name || 'عميل',
          customer_phone: customer?.phone_number || '',
          merchant_name: merchant?.name_ar || 'متجر',
          merchant_address: merchant?.address || 'غير محدد',
          delivery_address: customerLat && customerLng
            ? `موقع محدد: ${customerLat.toFixed(4)}, ${customerLng.toFixed(4)}`
            : 'غير محدد',
          total: firstOrder.total,
          delivery_fee: firstOrder.delivery_fee || 0,
          status: firstOrder.status,
          items_count: itemsCount,
          picked_up_at: firstOrder.picked_up_at,
          heading_to_merchant_at: firstOrder.heading_to_merchant_at,
          heading_to_customer_at: firstOrder.heading_to_customer_at,
        });

        // تحديث مواقع التاجر والعميل للخريطة
        if (merchant?.latitude && merchant?.longitude) {
          setMerchantLocation({
            latitude: parseFloat(merchant.latitude),
            longitude: parseFloat(merchant.longitude),
          });
        }
        if (customerLat && customerLng) {
          setCustomerLocation({
            latitude: parseFloat(customerLat),
            longitude: parseFloat(customerLng),
          });
        }
      }
    } catch (error) {
      console.error('Error fetching active order:', error);
      Alert.alert('❌ خطأ', 'لم نتمكن من تحميل الطلب. تحقق من الاتصال بالإنترنت.', [{ text: 'حسناً' }]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchingActiveRef.current = false;
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchActiveOrder();
  };

  const getCurrentStep = (): DeliveryStep => {
    if (!activeOrder) return DeliveryStep.ACCEPTED;
    if (activeOrder.heading_to_customer_at) return DeliveryStep.HEADING_TO_CUSTOMER;
    if (activeOrder.picked_up_at) return DeliveryStep.PICKED_UP;
    if (activeOrder.heading_to_merchant_at) return DeliveryStep.HEADING_TO_MERCHANT;
    return DeliveryStep.ACCEPTED;
  };

  const handleHeadingToMerchant = async () => {
    if (!activeOrder) return;

    try {
      setCompleting(true);
      const { error } = await supabase
        .from('orders')
        .update({
          heading_to_merchant_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeOrder.id);

      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('✅ تم التحديث', 'أنت الآن في الطريق إلى المتجر', [{ text: 'حسناً' }]);
      fetchActiveOrder();
    } catch (error) {
      console.error('Error updating order:', error);
      Alert.alert('❌ خطأ', 'لم يتم تحديث الحالة. حاول مرة أخرى.', [{ text: 'حسناً' }]);
    } finally {
      setCompleting(false);
    }
  };

  const handlePickedUp = async () => {
    if (!activeOrder) return;

    Alert.alert(
      '📦 تأكيد الاستلام',
      'هل استلمت الطلب من المتجر؟',
      [
        { text: 'ليس بعد', style: 'cancel' },
        {
          text: '✓ نعم، استلمت الطلب',
          onPress: async () => {
            try {
              setCompleting(true);
              const { error } = await supabase
                .from('orders')
                .update({
                  picked_up_at: new Date().toISOString(),
                  status: 'picked_up',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', activeOrder.id);

              if (error) throw error;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

              Alert.alert('تم الاستلام', 'الآن يمكنك التوجه للعميل');
              fetchActiveOrder();
            } catch (error) {
              console.error('Error updating order:', error);
              Alert.alert('❌ خطأ', 'لم يتم تأكيد الاستلام. حاول مرة أخرى.', [{ text: 'حسناً' }]);
            } finally {
              setCompleting(false);
            }
          },
        },
      ]
    );
  };

  const handleHeadingToCustomer = async () => {
    if (!activeOrder) return;

    try {
      setCompleting(true);
      const { error } = await supabase
        .from('orders')
        .update({
          heading_to_customer_at: new Date().toISOString(),
          status: 'on_the_way',
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeOrder.id);

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('تم', 'تم تحديث حالة الطلب');
      fetchActiveOrder();
      // ❗ عرض تأكيد فتح الخرائط فقط عند بدء التوجه للعميل
      promptNavigate('customer');
    } catch (error) {
      console.error('Error updating order:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحديث الحالة');
    } finally {
      setCompleting(false);
    }
  };

  const handleCancelOrder = () => {
    setShowCancelModal(true);
  };

  const confirmCancelOrder = async () => {
    if (!activeOrder) return;

    if (!cancelReason.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال سبب الإلغاء');
      return;
    }

    try {
      setCompleting(true);

      // استدعاء دالة آمنة على الخادم لتسجيل الإلغاء وتحديث الطلب معاً
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('driver_cancel_order_safe', {
          p_order_id: activeOrder.id,
          p_reason: cancelReason,
        });

      if (rpcError) {
        console.error('❌ driver_cancel_order_safe error:', rpcError);
        throw rpcError;
      }

      const ok = rpcData?.[0]?.ok ?? false;
      const message = rpcData?.[0]?.message || 'تم إلغاء الطلب بنجاح';
      if (!ok) {
        Alert.alert('تنبيه', message);
        return;
      }

      setShowCancelModal(false);
      setCancelReason('');
      Alert.alert(
        'تم الإلغاء',
        'تم إلغاء الطلب وإعادته للطلبات المتاحة',
        [
          {
            text: 'موافق',
            onPress: () => {
              setActiveOrder(null);
              router.push('/(driver-tabs)');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error cancelling order:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إلغاء الطلب');
    } finally {
      setCompleting(false);
    }
  };

  const handleCompleteDelivery = async () => {
    if (!activeOrder) return;

    Alert.alert(
      '🎉 تأكيد التوصيل',
      'هل سلّمت الطلب للعميل؟\nسيتم تسوية أرباحك وخصم رسوم المنصة (1 جنيه لكل كم) وإذا كان الدفع نقداً سيتم خصم 2.5 إضافية.',
      [
        { text: 'ليس بعد', style: 'cancel' },
        {
          text: '✓ نعم، تم التسليم',
          onPress: async () => {
            try {
              setCompleting(true);
              // تحقق سريع من الحالة الحالية من الخادم لتجنّب التكرار
              const { data: latest, error: latestErr } = await supabase
                .from('orders')
                .select('id, status')
                .eq('id', activeOrder.id)
                .maybeSingle();
              if (latestErr) {
                console.warn('check latest status error', latestErr);
              }
              if (latest?.status === 'delivered') {
                Alert.alert('تنبيه', 'هذا الطلب مُسجّل كمسلَّم بالفعل.');
                setActiveOrder(null);
                return;
              }
              // إنهاء التسليم مع التسوية المحاسبية عبر RPC
              const { data: fx, error: fxErr } = await supabase
                .rpc('finalize_delivery_tx', { p_order_id: activeOrder.id });
              if (fxErr) {
                console.error('❌ finalize_delivery_tx error', fxErr);
                throw fxErr;
              }
              const ok = fx?.[0]?.ok;
              const msg = fx?.[0]?.message || 'تم إنهاء التسليم وتسوية الرسوم';
              if (!ok) {
                Alert.alert('تنبيه', msg);
                return;
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              // دفاع إضافي: عدّل الحالة إلى delivered إذا لم يقم الRPC بذلك
              const { error: setDeliveredErr } = await supabase
                .from('orders')
                .update({ status: 'delivered', updated_at: new Date().toISOString() })
                .eq('id', activeOrder.id)
                .neq('status', 'delivered');
              if (setDeliveredErr) {
                console.warn('set delivered fallback error', setDeliveredErr);
              }

              // حفظ معلومات الطلب قبل مسحها
              const completedOrderInfo = {
                orderId: activeOrder.id,
                orderNumber: activeOrder.order_number,
                customerName: activeOrder.customer_name,
                merchantName: activeOrder.merchant_name,
              };

              Alert.alert('🎉 تم التوصيل بنجاح!', `تم تسليم الطلب ${completedOrderInfo.orderNumber} بنجاح\nتم إضافة ${activeOrder.delivery_fee} ${currency} كأرباح التوصيل\nوتم خصم رسوم المنصة حسب السياسة.`, [
                {
                  text: '💰 عرض أرباحي',
                  onPress: () => {
                    setActiveOrder(null); // إزالة الطلب من النشطة لمنع تكرار التأكيد
                    router.push('/(driver-tabs)/earnings');
                  },
                },
                {
                  text: 'تم',
                  onPress: () => {
                    setActiveOrder(null);
                  }
                }
              ]);
              // حتى لو لم يضغط المستخدم على زر الأرباح، نظف الحالة محلياً
              setActiveOrder(null);
              // إعادة تحميل الطلبات النشطة للتأكد من الإخفاء
              fetchActiveOrder();
            } catch (error) {
              console.error('Error completing delivery:', error);
              Alert.alert('❌ خطأ', 'لم يتم تسجيل التوصيل. حاول مرة أخرى.', [{ text: 'حسناً' }]);
            } finally {
              setCompleting(false);
            }
          },
        },
      ]
    );
  };

  const handleCallCustomer = () => {
    if (activeOrder?.customer_phone) {
      const phoneNumber = activeOrder.customer_phone.replace(/[^0-9+]/g, ''); // تنظيف الرقم
      const phoneUrl = `tel:${phoneNumber}`;
      
      Linking.canOpenURL(phoneUrl)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(phoneUrl);
          } else {
            Alert.alert('خطأ', 'لا يمكن إجراء المكالمات على هذا الجهاز');
          }
        })
        .catch((err) => {
          console.error('Error opening phone:', err);
          Alert.alert('خطأ', 'حدث خطأ أثناء محاولة الاتصال');
        });
    } else {
      Alert.alert('خطأ', 'رقم هاتف العميل غير متوفر');
    }
  };

  const handleCallMerchant = () => {
    // في حالة إضافة رقم هاتف التاجر لاحقاً
    Alert.alert('الاتصال بالتاجر', 'سيتم إضافة هذه الميزة قريباً');
  };

  const handleNavigate = (target?: 'merchant' | 'customer') => {
    // نستخدم الإحداثيات الدقيقة لمسار ملاحة صحيح
    // الوجهة: إلى المتجر قبل الاستلام، وإلى العميل بعد الاستلام
    const step = getCurrentStep();
    // إذا تم تمرير هدف صريح (merchant/customer) استخدمه بدل الاستدلال من الخطوة
    const destination = target
      ? (target === 'merchant' ? merchantLocation : customerLocation)
      : (step <= DeliveryStep.PICKED_UP ? merchantLocation : customerLocation);
    const origin = driverLocation; // يفضّل استخدام موقع السائق الحالي

    if (!destination?.latitude || !destination?.longitude) {
      // ⚠️ لا توجد إحداثيات: جرّب العنوان كنص بحث في الخرائط بدل إظهار التنبيه مباشرة
      const addressText = target
        ? (target === 'merchant' ? activeOrder?.merchant_address : activeOrder?.delivery_address)
        : (step <= DeliveryStep.PICKED_UP ? activeOrder?.merchant_address : activeOrder?.delivery_address);

      if (addressText && typeof addressText === 'string' && addressText.trim().length > 0) {
        const query = encodeURIComponent(addressText);
        const appleUrlQ = `http://maps.apple.com/?q=${query}`;
        const googleUrlQ = `https://www.google.com/maps/search/?api=1&query=${query}`;
        (async () => {
          try {
            if (Platform.OS === 'ios') {
              const canAppleQ = await Linking.canOpenURL(appleUrlQ);
              if (canAppleQ) { await Linking.openURL(appleUrlQ); return; }
            }
            const canGoogleQ = await Linking.canOpenURL(googleUrlQ);
            if (canGoogleQ) { await Linking.openURL(googleUrlQ); return; }
            await Linking.openURL(`https://maps.google.com/?q=${query}`);
          } catch (err) {
            console.error('Error opening maps with address query:', err);
            Alert.alert('تنبيه', 'إحداثيات الوجهة غير متوفرة بعد. افتح الخريطة الداخلية أولاً للتحديث أو انتظر ثوانٍ.');
          }
        })();
        return;
      } else {
        Alert.alert('تنبيه', 'إحداثيات الوجهة غير متوفرة بعد. افتح الخريطة الداخلية أولاً للتحديث أو انتظر ثوانٍ.');
        return;
      }
    }

    const destParam = `${destination.latitude},${destination.longitude}`;
    const originParam = origin?.latitude && origin?.longitude ? `${origin.latitude},${origin.longitude}` : undefined;

    // iOS: Apple Maps أولاً، ثم Google Maps كبديل
    const appleUrl = originParam
      ? `http://maps.apple.com/?saddr=${encodeURIComponent(originParam)}&daddr=${encodeURIComponent(destParam)}&dirflg=d`
      : `http://maps.apple.com/?daddr=${encodeURIComponent(destParam)}&dirflg=d`;

    const googleUrl = originParam
      ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destParam)}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destParam)}&travelmode=driving`;

    const tryOpen = async () => {
      try {
        // جرّب Apple Maps على iOS أولاً
        if (Platform.OS === 'ios') {
          const canApple = await Linking.canOpenURL(appleUrl);
          if (canApple) {
            await Linking.openURL(appleUrl);
            return;
          }
        }
        // جرّب Google Maps URL (يعمل على أندرويد وiOS إذا متوفر)
        const canGoogle = await Linking.canOpenURL(googleUrl);
        if (canGoogle) {
          await Linking.openURL(googleUrl);
          return;
        }
        // fallback: افتح نتيجة بحث بسيطة
        const fallback = `https://maps.google.com/?q=${encodeURIComponent(destParam)}`;
        await Linking.openURL(fallback);
      } catch (err) {
        console.error('Error opening maps:', err);
        Alert.alert('خطأ', 'حدث خطأ أثناء فتح تطبيق الخرائط');
      }
    };

    tryOpen();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>طلباتي النشطة</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!activeOrder) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>طلباتي النشطة</Text>
        </View>
        <View style={styles.emptyState}>
          <Package size={64} color={colors.textLight} />
          <Text style={styles.emptyTitle}>لا توجد طلبات نشطة</Text>
          <Text style={styles.emptyText}>اقبل طلباً من الطلبات المتاحة لتظهر هنا</Text>
          <TouchableOpacity
            style={styles.goToAvailableButton}
            onPress={() => router.push('/(driver-tabs)')}
          >
            <Text style={styles.goToAvailableText}>عرض الطلبات المتاحة</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>طلباتي النشطة</Text>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>جاري التوصيل</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.orderCard}>
          {/* Delivery Steps Progress */}
          <View style={styles.stepsContainer}>
            <Text style={styles.stepsTitle}>خطوات التوصيل</Text>
            <View style={styles.stepsProgress}>
              {/* Step 1: Accepted */}
              <View style={styles.stepItem}>
                <View style={[styles.stepCircle, styles.stepCompleted]}>
                  <CheckCircle size={16} color={colors.white} />
                </View>
                <Text style={styles.stepLabel}>تم القبول</Text>
              </View>

              <View style={[styles.stepLine, activeOrder.heading_to_merchant_at && styles.stepLineCompleted]} />

              {/* Step 2: Heading to Merchant */}
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  activeOrder.heading_to_merchant_at && styles.stepCompleted,
                  getCurrentStep() === DeliveryStep.HEADING_TO_MERCHANT && styles.stepCurrent,
                ]}>
                  {activeOrder.heading_to_merchant_at ? (
                    <CheckCircle size={16} color={colors.white} />
                  ) : (
                    <Text style={styles.stepNumber}>2</Text>
                  )}
                </View>
                <Text style={styles.stepLabel}>في الطريق للمتجر</Text>
              </View>

              <View style={[styles.stepLine, activeOrder.picked_up_at && styles.stepLineCompleted]} />

              {/* Step 3: Picked Up */}
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  activeOrder.picked_up_at && styles.stepCompleted,
                  getCurrentStep() === DeliveryStep.PICKED_UP && styles.stepCurrent,
                ]}>
                  {activeOrder.picked_up_at ? (
                    <CheckCircle size={16} color={colors.white} />
                  ) : (
                    <Text style={styles.stepNumber}>3</Text>
                  )}
                </View>
                <Text style={styles.stepLabel}>تم الاستلام</Text>
              </View>

              <View style={[styles.stepLine, activeOrder.heading_to_customer_at && styles.stepLineCompleted]} />

              {/* Step 4: Heading to Customer */}
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  activeOrder.heading_to_customer_at && styles.stepCompleted,
                  getCurrentStep() === DeliveryStep.HEADING_TO_CUSTOMER && styles.stepCurrent,
                ]}>
                  {activeOrder.heading_to_customer_at ? (
                    <CheckCircle size={16} color={colors.white} />
                  ) : (
                    <Text style={styles.stepNumber}>4</Text>
                  )}
                </View>
                <Text style={styles.stepLabel}>في الطريق للعميل</Text>
              </View>
            </View>
          </View>

          {/* Order Header */}
          <View style={styles.orderHeader}>
            <View style={styles.orderNumberSection}>
              <Package size={20} color={colors.primary} />
              <Text style={styles.orderNumber}>#{activeOrder.order_number}</Text>
            </View>
            <View style={styles.deliveryFeeBadge}>
              <Text style={styles.deliveryFeeText}>أجرة التوصيل: {formatCurrency(activeOrder.delivery_fee, currency)}</Text>
            </View>
          </View>

          {/* Merchant Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 استلام من المتجر</Text>
            <View style={styles.infoCard}>
              <Text style={styles.merchantName}>{activeOrder.merchant_name}</Text>
              <View style={styles.addressRow}>
                <MapPin size={16} color={colors.textLight} />
                <Text style={styles.addressText}>{activeOrder.merchant_address}</Text>
              </View>
            </View>
          </View>

          {/* Customer Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🚗 التوصيل للعميل</Text>
            <View style={styles.infoCard}>
              <View style={styles.customerHeader}>
                <Text style={styles.customerName}>{activeOrder.customer_name}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {conversationId && (
                    <TouchableOpacity
                      style={[styles.callButton, { backgroundColor: colors.primary }]}
                      onPress={() => router.push({ pathname: `/chat/${conversationId}`, params: { customerPhone: activeOrder.customer_phone } } as any)}
                    >
                      <MessageCircle size={18} color={colors.white} />
                      <Text style={styles.callButtonText}>دردشة</Text>
                    </TouchableOpacity>
                  )}
                  {activeOrder.customer_phone && (
                    <TouchableOpacity style={styles.callButton} onPress={handleCallCustomer}>
                      <Phone size={18} color={colors.white} />
                      <Text style={styles.callButtonText}>اتصال</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <View style={styles.addressRow}>
                <MapPin size={16} color={colors.textLight} />
                <Text style={styles.addressText}>{activeOrder.delivery_address}</Text>
              </View>
            </View>
          </View>

          {/* Order Details */}
          <View style={styles.orderDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>عدد الأصناف:</Text>
              <Text style={styles.detailValue}>{activeOrder.items_count}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>إجمالي الطلب:</Text>
              <Text style={styles.detailValue}>{formatCurrency(activeOrder.total, currency)}</Text>
            </View>
          </View>

          {/* Step Action Buttons */}
          <View style={styles.stepActionsContainer}>
            {getCurrentStep() === DeliveryStep.ACCEPTED && (
              <TouchableOpacity
                style={styles.stepActionButton}
                onPress={handleHeadingToMerchant}
                disabled={completing}
              >
                <Text style={styles.stepActionButtonText}>🚗 بدء التوجه للمتجر</Text>
              </TouchableOpacity>
            )}

            {getCurrentStep() === DeliveryStep.HEADING_TO_MERCHANT && (
              <TouchableOpacity
                style={styles.stepActionButton}
                onPress={handlePickedUp}
                disabled={completing}
              >
                <Text style={styles.stepActionButtonText}>✅ تم الاستلام من المتجر</Text>
              </TouchableOpacity>
            )}

            {getCurrentStep() === DeliveryStep.PICKED_UP && (
              <TouchableOpacity
                style={styles.stepActionButton}
                onPress={handleHeadingToCustomer}
                disabled={completing}
              >
                <Text style={styles.stepActionButtonText}>🚗 بدء التوجه للعميل</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Map View */}
          {showMap && driverLocation && (merchantLocation || customerLocation) && (
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: driverLocation.latitude,
                  longitude: driverLocation.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
              >
                {/* Thunderforest Cycle Map Tiles */}
                <UrlTile
                  urlTemplate="https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=5fa1378c665246bf84d40a5909a01c7f"
                  maximumZ={19}
                  flipY={false}
                />

                {/* Driver Marker */}
                <Marker
                  coordinate={driverLocation}
                  title="موقعي"
                  description="موقع السائق"
                >
                  <View style={[styles.markerDot, { backgroundColor: colors.success }]} />
                </Marker>

                {/* Merchant Marker (if not picked up yet) */}
                {merchantLocation && getCurrentStep() <= DeliveryStep.PICKED_UP && (
                  <Marker
                    coordinate={merchantLocation}
                    title="المتجر"
                    description={activeOrder.merchant_name}
                    pinColor="orange"
                  />
                )}

                {/* Customer Marker */}
                {customerLocation && (
                  <Marker
                    coordinate={customerLocation}
                    title="العميل"
                    description={activeOrder.customer_name}
                    pinColor="red"
                  />
                )}

                {/* Route Polyline */}
                {getCurrentStep() <= DeliveryStep.PICKED_UP && merchantLocation ? (
                  // مسار إلى المتجر
                  <Polyline
                    coordinates={[driverLocation, merchantLocation]}
                    strokeColor={colors.primary}
                    strokeWidth={4}
                  />
                ) : customerLocation ? (
                  // مسار إلى العميل
                  <Polyline
                    coordinates={[driverLocation, customerLocation]}
                    strokeColor={colors.success}
                    strokeWidth={4}
                  />
                ) : null}
              </MapView>

              {/* Map Toggle Button */}
              <TouchableOpacity
                style={styles.mapToggleButton}
                onPress={() => setShowMap(false)}
              >
                <Text style={styles.mapToggleText}>إخفاء الخريطة</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Show Map Button */}
          {!showMap && (driverLocation && (merchantLocation || customerLocation)) && (
            <TouchableOpacity
              style={styles.showMapButton}
              onPress={() => setShowMap(true)}
            >
              <MapPin size={20} color={colors.primary} />
              <Text style={styles.showMapButtonText}>عرض الخريطة والمسار</Text>
            </TouchableOpacity>
          )}

          {/* Cancel Order Button */}
          <TouchableOpacity
            style={styles.cancelOrderButton}
            onPress={handleCancelOrder}
            disabled={completing}
          >
            <Text style={styles.cancelOrderButtonText}>إلغاء الطلب (طارئ)</Text>
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.navigateButton} onPress={() => handleNavigate()}>
              <Navigation size={20} color={colors.white} />
              <Text style={styles.navigateButtonText}>التنقل</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.completeButton,
                { position: 'relative' },
                completing && styles.completeButtonDisabled,
                getCurrentStep() !== DeliveryStep.HEADING_TO_CUSTOMER && styles.completeButtonDisabled,
              ]}
              onPressIn={startHoldConfirm}
              onPressOut={stopHoldConfirm}
              disabled={completing || getCurrentStep() !== DeliveryStep.HEADING_TO_CUSTOMER}
              activeOpacity={0.9}
            >
              {/* Progress overlay */}
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${Math.round(holdProgress * 100)}%`,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  borderTopLeftRadius: 12,
                  borderBottomLeftRadius: 12,
                }}
              />
              {completing ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <CheckCircle size={18} color={colors.white} />
                  <Text style={styles.completeButtonText} numberOfLines={1} ellipsizeMode="tail">
                    {holdProgress > 0 ? 'استمر بالضغط...' : 'اضغط مطوّلاً للتسليم'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Cancel Order Modal */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>إلغاء الطلب</Text>
            <Text style={styles.modalDescription}>
              يرجى إدخال سبب إلغاء الطلب. سيتم إعادة الطلب للطلبات المتاحة.
            </Text>
            
            <TextInput
              style={styles.cancelReasonInput}
              placeholder="مثال: عطل في السيارة، حالة طارئة، إلخ..."
              placeholderTextColor={colors.textLight}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={confirmCancelOrder}
                disabled={completing}
              >
                {completing ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>تأكيد الإلغاء</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
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
    backgroundColor: colors.secondary,
    marginRight: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    color: colors.secondary,
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
    padding: spacing.xxl,
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
  goToAvailableButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  goToAvailableText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  orderCard: {
    backgroundColor: colors.white,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  orderNumberSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  orderNumber: {
    ...typography.h3,
    color: colors.text,
  },
  deliveryFeeBadge: {
    backgroundColor: colors.success + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  deliveryFeeText: {
    ...typography.bodyMedium,
    color: colors.success,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  infoCard: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  merchantName: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  customerName: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  callButtonText: {
    ...typography.caption,
    color: colors.white,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  addressText: {
    ...typography.body,
    color: colors.textLight,
    flex: 1,
    lineHeight: 20,
  },
  orderDetails: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    ...typography.body,
    color: colors.textLight,
  },
  detailValue: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  navigateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  navigateButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    ...typography.bodyMedium,
    fontSize: 13,
    color: colors.white,
  },
  stepsContainer: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepsTitle: {
    ...typography.h3,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  stepsProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.lightGray,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  stepCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepCurrent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepNumber: {
    ...typography.caption,
    color: colors.textLight,
    fontWeight: 'bold',
  },
  stepLabel: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    fontSize: 10,
  },
  stepLine: {
    height: 2,
    flex: 0.5,
    backgroundColor: colors.border,
    marginHorizontal: -spacing.sm,
  },
  stepLineCompleted: {
    backgroundColor: colors.success,
  },
  stepActionsContainer: {
    marginBottom: spacing.md,
  },
  stepActionButton: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  stepActionButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  cancelOrderButton: {
    backgroundColor: colors.error + '20',
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cancelOrderButtonText: {
    ...typography.body,
    color: colors.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  modalDescription: {
    ...typography.body,
    color: colors.textLight,
    marginBottom: spacing.md,
    textAlign: 'center',
    lineHeight: 20,
  },
  cancelReasonInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 100,
    marginBottom: spacing.md,
    textAlign: 'right',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelButtonText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  modalConfirmButton: {
    backgroundColor: colors.error,
  },
  modalConfirmButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  // Map styles
  mapContainer: {
    height: 300,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: colors.white,
  },
  mapToggleButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    ...shadows.small,
  },
  mapToggleText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  showMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  showMapButtonText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
});
