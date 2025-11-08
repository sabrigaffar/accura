import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  TextInput,
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { ArrowLeft, MapPin, Clock, Phone, MessageCircle, Star, Check, User, Car, AlertTriangle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  status: string;
  total: number;
  subtotal?: number | null;
  product_total?: number | null;
  delivery_fee?: number | null;
  service_fee?: number | null;
  tax?: number | null;
  tax_amount?: number | null;
  discount?: number | null;
  customer_total?: number | null;
  payment_method?: 'online' | 'cod' | 'cash' | 'card' | 'wallet' | string;
  created_at: string;
  estimated_delivery_time?: string;
  actual_delivery_time?: string;
  rating?: number;
  review_text?: string;
  delivery_address?: {
    street_address?: string;
    city?: string;
  };

  merchant?: {
    name_ar?: string;
    logo_url?: string;
    phone_number?: string;
  };
  driver?: {
    id?: string;
    full_name?: string;
    phone_number?: string;
    rating?: number;
    vehicle_type?: string;
    avatar_url?: string | null;
    photo_url?: string | null;
  };
  customer?: {
    full_name?: string;
    phone_number?: string;
  };
}

interface OrderItem {
  id: string;
  product_name_ar: string;
  quantity: number;
  price: number;
  total: number;
}

// تكوين حالات الطلب مع التسلسل الزمني
const ORDER_STATUS_SEQUENCE = [
  { key: 'pending', label: 'قيد الانتظار', description: 'طلبك قيد المراجعة' },
  { key: 'accepted', label: 'تم قبول الطلب', description: 'تم قبول طلبك من المتجر' },
  { key: 'preparing', label: 'قيد التحضير', description: 'طلبك قيد التحضير' },
  { key: 'ready', label: 'جاهز للتسليم', description: 'طلبك جاهز للتسليم' },
  { key: 'out_for_delivery', label: 'بدأ التوصيل', description: 'السائق في طريقه للمتجر' },
  { key: 'picked_up', label: 'تم استلام الطلب', description: 'تم استلام طلبك من قبل السائق' },
  { key: 'on_the_way', label: 'في الطريق', description: 'طلبك في الطريق إليك' },
  { key: 'delivered', label: 'تم التوصيل', description: 'تم توصيل طلبك بنجاح' },
  { key: 'cancelled', label: 'ملغى', description: 'تم إلغاء الطلب' },
];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user, profile } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [orderDiscounts, setOrderDiscounts] = useState<{ id: string; amount: number; details: any; promotion_id: string | null }[]>([]);
  const [complaintModalVisible, setComplaintModalVisible] = useState(false);
  const [complaintTitle, setComplaintTitle] = useState('');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [complaintImages, setComplaintImages] = useState<string[]>([]);

  // Complaint helpers (inside component to access state)
  const pickComplaintImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('إذن الصور', 'يرجى السماح للتطبيق بالوصول إلى الصور لإرفاق لقطات.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setComplaintImages((prev: string[]) => [...prev, result.assets[0].uri]);
      }
    } catch (e) {
      console.error('pick complaint image error', e);
      Alert.alert('خطأ', 'تعذر اختيار الصورة');
    }
  };

  const removeComplaintImage = (idx: number) => {
    setComplaintImages((prev: string[]) => prev.filter((_: string, i: number) => i !== idx));
  };

  const submitComplaint = async () => {
    try {
      if (!user || !order || !profile) {
        Alert.alert('خطأ', 'المستخدم غير معرف');
        return;
      }
      if (!complaintTitle.trim()) {
        Alert.alert('تنبيه', 'يرجى إدخال عنوان الشكوى');
        return;
      }
      // 1) Create complaint
      const { data: compId, error: compErr } = await supabase.rpc('submit_complaint', {
        p_user_role: profile.user_type,
        p_target_type: 'order',
        p_target_id: order.id,
        p_title: complaintTitle.trim(),
        p_description: complaintDescription.trim(),
        p_priority: 'medium',
      });
      if (compErr) throw compErr;
      const complaintId: string = compId as unknown as string;

      // 2) Upload attachments (if any)
      for (const uri of complaintImages) {
        try {
          const resp = await fetch(uri);
          const arrayBuffer = await resp.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
          const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
          const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const objectPath = `${user.id}/complaints/${complaintId}/${fileName}`;
          const { error: upErr } = await supabase.storage
            .from('complaint-images')
            .upload(objectPath, bytes, { contentType, cacheControl: '3600', upsert: false });
          if (upErr) throw upErr;
          // record attachment row
          const { error: attErr } = await supabase
            .from('complaint_attachments')
            .insert({ complaint_id: complaintId, object_path: objectPath, created_by: user.id });
          if (attErr) throw attErr;
        } catch (e) {
          console.error('upload attachment error', e);
        }
      }

      Alert.alert('تم الإرسال', 'تم إرسال الشكوى وسيتم مراجعتها.');
      setComplaintModalVisible(false);
      setComplaintTitle('');
      setComplaintDescription('');
      setComplaintImages([]);
    } catch (e: any) {
      console.error('submit complaint error', e);
      Alert.alert('خطأ', e?.message || 'تعذر إرسال الشكوى');
    }
  };

  useEffect(() => {
    // Validate that id exists and is a string
    if (id && typeof id === 'string') {
      fetchOrderDetails();
      // الاشتراك في تحديثات الطلب في الوقت الفعلي
      subscribeToOrderUpdates();
    } else {
      console.error('Invalid order ID:', id);
      setLoading(false);
    }
    
    // تنظيف الاشتراك عند فك المكون
    return () => {
      const channels = supabase.getChannels();
      channels.forEach(channel => {
        if (channel.topic.includes('realtime:public:orders') || channel.topic.includes('order-updates')) {
          supabase.removeChannel(channel);
        }
      });
    };
  }, [id]);

  useEffect(() => {
    if (order && user) {
      // التحقق من وجود محادثة للطلب
      checkConversation();
    }
  }, [order, user]);
  
  // تحقق من إنشاء محادثة عند تعيين السائق
  useEffect(() => {
    if (order && user && order.driver?.id && !conversationId) {
      checkConversation();
    }
  }, [order?.driver?.id]);
  
  const checkConversation = async () => {
    if (!order || !user) return;
    
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('order_id', order.id)
        .single();
        
      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
        console.error('Error checking conversation:', error);
        return;
      }
      
      if (data) {
        setConversationId(data.id);
      } else {
        // إنشاء محادثة جديدة إذا لم توجد ولمحاولة إنشائها فقط إذا كان هناك سائق محدد
        if (order.driver?.id) {
          createConversation();
        }
      }
    } catch (error) {
      console.error('Error checking conversation:', error);
    }
  };
  
  const createConversation = async () => {
    if (!order || !user) return;
    
    try {
      // التحقق من أن الطلب مرتبط بسائق قبل إنشاء المحادثة
      if (!order.driver?.id) {
        // We no longer log a warning here since we check before calling this function
        return;
      }

      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          order_id: order.id,
          customer_id: user.id,
          driver_id: order.driver.id, // استخدام معرف السائق مباشرة
        })
        .select()
        .single();
        
      if (error) {
        console.error('Error creating conversation:', error);
        // Don't throw the error, just log it and continue
        return;
      }
      
      setConversationId(data.id);
    } catch (error) {
      console.error('Error creating conversation:', error);
      // Don't throw the error, just log it and continue
    }
  };

  const subscribeToOrderUpdates = () => {
    if (!id) return;
    
    const channel = supabase
      .channel('order-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          // تحديث حالة الطلب عند تلقي التحديث
          if (payload.new) {
            fetchOrderDetails(); // إعادة تحميل التفاصيل للحصول على معلومات السائق المحدثة
          }
        }
      )
      .subscribe();
  };

  const fetchOrderDetails = async () => {
    // Validate that id exists and is a string
    if (!id || typeof id !== 'string') {
      console.error('Invalid order ID:', id);
      Alert.alert('خطأ', 'معرف الطلب غير صحيح');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch order details with driver information (include images)
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          merchant:merchants!orders_merchant_id_fkey(name_ar, logo_url, phone_number),
          driver:profiles!orders_driver_id_fkey(
            id,
            full_name,
            phone_number,
            avatar_url,
            driver_profiles(average_rating, vehicle_type, photo_url)
          )
        `)
        .eq('id', id)
        .single();

    if (orderError) throw orderError;
    if (!orderData) throw new Error('Order not found');

    // Format driver data if exists
    let driverInfo = undefined;
    const driver = Array.isArray(orderData.driver) ? orderData.driver[0] : orderData.driver;
    if (driver) {
      const driverProfile = driver.driver_profiles && driver.driver_profiles.length > 0 
        ? driver.driver_profiles[0] 
        : null;
      driverInfo = {
        id: driver.id,
        full_name: driver.full_name || 'السائق',
        phone_number: driver.phone_number || '',
        rating: driverProfile?.average_rating,
        vehicle_type: driverProfile?.vehicle_type,
        avatar_url: driver.avatar_url ?? null,
        photo_url: driverProfile?.photo_url ?? null,
      };
    }

    // Ensure the data structure matches our interface
    const formattedOrder: Order = {
      id: orderData.id,
      order_number: orderData.order_number,
      customer_id: orderData.customer_id,
      status: orderData.status,
      total: orderData.total,
      subtotal: orderData.subtotal ?? orderData.product_total ?? null,
      delivery_fee: orderData.delivery_fee ?? null,
      service_fee: orderData.service_fee ?? null,
      tax: orderData.tax ?? orderData.tax_amount ?? null,
      tax_amount: orderData.tax_amount ?? orderData.tax ?? null,
      discount: orderData.discount ?? null,
      customer_total: orderData.customer_total ?? null,
      created_at: orderData.created_at,
      estimated_delivery_time: orderData.estimated_delivery_time,
      actual_delivery_time: orderData.actual_delivery_time,
      rating: orderData.rating,
      review_text: orderData.review_text,
      delivery_address: orderData.customer_latitude && orderData.customer_longitude
        ? {
            street_address: `موقع التوصيل: ${Number(orderData.customer_latitude).toFixed(4)}, ${Number(orderData.customer_longitude).toFixed(4)}`,
            city: ''
          }
        : undefined,
      merchant: orderData.merchant || undefined,
      driver: driverInfo,
    };

    setOrder(formattedOrder);

    // Fetch order items with product names (support merchant_products schema and legacy/new columns)
    let itemsData: any[] | null = null;
    let itemsError: any = null;

    const trySelect = async (selectStr: string) => {
      return await supabase
        .from('order_items')
        .select(selectStr)
        .eq('order_id', id as string);
    };

    // 1) Try new schema columns with primary FK name (name_ar only)
    let resp = await trySelect('id, product_id, quantity, price, total, product:merchant_products!order_items_product_id_fkey(name_ar)');

    // 2) If error, try new schema with alternate FK name
    if (resp.error) {
      const msg = resp.error.message || '';
      const code = resp.error.code || '';
      const unknownCol = code === '42703' || /column .* does not exist/i.test(msg);
      if (!unknownCol) {
        resp = await trySelect('id, product_id, quantity, price, total, product:merchant_products!order_items_product_fk(name_ar)');
      }
    }

    // 3) If still error (or unknown columns), try legacy columns with primary FK
    if (resp.error) {
      resp = await trySelect('id, product_id, quantity, price:unit_price, total:total_price, product:merchant_products!order_items_product_id_fkey(name_ar)');
      // 4) If still error, try legacy columns with alternate FK
      if (resp.error) {
        resp = await trySelect('id, product_id, quantity, price:unit_price, total:total_price, product:merchant_products!order_items_product_fk(name_ar)');
      }
    }

    if (resp.error) {
      itemsError = resp.error;
      throw itemsError;
    }
    itemsData = resp.data as any[] | null;
    
    // Format items with product names
    const formattedItems = (itemsData || []).map(item => {
      const p = Array.isArray(item.product) ? item.product[0] : item.product;
      return {
        id: item.id,
        product_name_ar: p?.name_ar || p?.name || 'منتج',
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      };
    });
    
    setOrderItems(formattedItems);

    // Fetch detailed discount breakdowns (if any)
    try {
      const { data: discountsData, error: discountsError } = await supabase
        .from('order_discounts')
        .select('id, amount, details, promotion_id')
        .eq('order_id', id as string);
      if (discountsError) {
        console.warn('Warning loading order_discounts:', discountsError.message);
      } else {
        setOrderDiscounts(discountsData || []);
      }
    } catch (e) {
      console.warn('Warning loading order_discounts (exception):', (e as any)?.message);
    }
  } catch (error) {
    console.error('Error fetching order details:', error);
    Alert.alert('خطأ', 'حدث خطأ أثناء تحميل تفاصيل الطلب');
  } finally {
    setLoading(false);
  }
};

  const getStatusText = (status: string) => {
    const statusConfig = ORDER_STATUS_SEQUENCE.find(s => s.key === status);
    return statusConfig ? statusConfig.label : status;
  };

  const getStatusDescription = (status: string) => {
    const statusConfig = ORDER_STATUS_SEQUENCE.find(s => s.key === status);
    return statusConfig ? statusConfig.description : '';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return colors.warning;
      case 'accepted': return colors.primary;
      case 'preparing': return colors.primary;
      case 'ready': return colors.secondary;
      case 'picked_up': return colors.secondary;
      case 'on_the_way': return colors.secondary;
      case 'delivered': return colors.success;
      case 'cancelled': return colors.error;
      default: return colors.textLight;
    }
  };

  const getCurrentStatusIndex = (status: string) => {
    return ORDER_STATUS_SEQUENCE.findIndex(s => s.key === status);
  };

  const getTotalItems = () => {
    return orderItems.reduce((total, item) => total + item.quantity, 0);
  };

  const getVehicleTypeText = (vehicleType?: string) => {
    switch (vehicleType) {
      case 'car': return 'سيارة';
      case 'motorcycle': return 'دراجة نارية';
      case 'bicycle': return 'دراجة';
      default: return vehicleType || 'غير محدد';
    }
  };

  const handleCancelOrder = () => {
    Alert.alert(
      'تأكيد الإلغاء',
      'هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟',
      [
        {
          text: 'لا',
          style: 'cancel',
        },
        {
          text: 'نعم',
          style: 'destructive',
          onPress: cancelOrder,
        },
      ]
    );
  };

  const cancelOrder = async () => {
    if (!order) return;
    
    try {
      // تحديث حالة الطلب إلى ملغى
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      // تحديث حالة الطلب محلياً
      setOrder(prev => prev ? { ...prev, status: 'cancelled' } : null);
      
      Alert.alert('نجاح', 'تم إلغاء الطلب بنجاح');
      
      // تحديث قائمة الطلبات في الخلفية
      // يمكن إضافة منطق إشعار للمتجر هنا
    } catch (error) {
      console.error('Error cancelling order:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إلغاء الطلب');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>جاري تحميل تفاصيل الطلب...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>الطلب غير موجود</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStatusIndex = getCurrentStatusIndex(order.status);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>طلب #{order.order_number}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Status Tracking */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>تتبع الطلب</Text>
          </View>
          
          <View style={styles.statusTimeline}>
            {ORDER_STATUS_SEQUENCE.map((status, index) => {
              const isCompleted = index <= currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const isCancelled = order.status === 'cancelled' && status.key === 'cancelled';
              
              return (
                <View key={status.key} style={styles.statusStep}>
                  <View style={styles.statusIndicatorContainer}>
                    <View 
                      style={[
                        styles.statusIndicator,
                        isCompleted && styles.statusIndicatorCompleted,
                        isCurrent && styles.statusIndicatorCurrent,
                        isCancelled && styles.statusIndicatorCancelled,
                        { backgroundColor: isCompleted || isCurrent || isCancelled ? getStatusColor(status.key) : colors.border }
                      ]}
                    >
                      {isCompleted && <Check size={16} color={colors.white} />}
                    </View>
                    
                    {index < ORDER_STATUS_SEQUENCE.length - 1 && (
                      <View 
                        style={[
                          styles.statusLine,
                          (isCompleted || isCurrent) && styles.statusLineCompleted,
                          { backgroundColor: isCompleted || isCurrent ? getStatusColor(status.key) : colors.border }
                        ]}
                      />
                    )}
                  </View>
                  
                  <View style={styles.statusInfo}>
                    <Text 
                      style={[
                        styles.statusText,
                        isCurrent && styles.statusTextCurrent,
                        isCancelled && styles.statusTextCancelled
                      ]}
                    >
                      {status.label}
                    </Text>
                    <Text style={styles.statusDescription}>
                      {status.description}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
          
          {order.estimated_delivery_time && (
            <View style={styles.estimatedTimeContainer}>
              <Clock size={20} color={colors.textLight} />
              <Text style={styles.estimatedTimeText}>
                الوقت المتوقع للتوصيل: {new Date(order.estimated_delivery_time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
        </View>

        {/* Driver Info - Only show if driver is assigned and order is not cancelled */}
        {order.driver && order.status !== 'cancelled' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>معلومات السائق</Text>
            </View>
            <View style={styles.driverInfo}>
              {(() => {
              const src = order.driver?.photo_url || order.driver?.avatar_url || order.merchant?.logo_url || undefined;
              return src ? (
                <Image source={{ uri: src }} style={styles.driverAvatarImage} resizeMode="cover" />
              ) : (
                <View style={styles.driverAvatar} />
              );
            })()}
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>{order.driver.full_name}</Text>
                <View style={styles.driverStats}>
                  <View style={styles.statItem}>
                    <Star size={16} color={colors.warning} fill={colors.warning} />
                    <Text style={styles.statText}>
                      {order.driver.rating ? order.driver.rating.toFixed(1) : 'لا تقييم'}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Car size={16} color={colors.textLight} />
                    <Text style={styles.statText}>
                      {getVehicleTypeText(order.driver.vehicle_type)}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.driverActions}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => {
                    if (order?.driver?.phone_number) {
                      Linking.openURL(`tel:${order.driver.phone_number}`);
                    } else {
                      Alert.alert('❌ خطأ', 'رقم السائق غير متوفر', [{ text: 'حسناً' }]);
                    }
                  }}
                >
                  <Phone size={20} color={colors.primary} />
                </TouchableOpacity>
                
                {conversationId && (
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => router.push(`/chat/${conversationId}`)}
                  >
                    <MessageCircle size={20} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Track Driver Button - Show when order is being delivered */}
            {(order.status === 'out_for_delivery' || order.status === 'on_the_way' || order.status === 'picked_up') && (
              <TouchableOpacity
                style={styles.trackDriverButton}
                onPress={() => router.push(`/order/${order.id}/track-driver`)}
              >
                <MapPin size={20} color={colors.white} />
                <Text style={styles.trackDriverButtonText}>🗺️ تتبع موقع السائق مباشرة</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Assign Driver Button - Only show for merchant/admin users when no driver is assigned */}
        {!order.driver && profile && (profile.user_type === 'merchant' || profile.user_type === 'admin') && 
         order.status !== 'cancelled' && order.status !== 'delivered' && (
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.assignDriverButton}
              onPress={() => router.push(`/order/${id}/assign-driver`)}
            >
              <Text style={styles.assignDriverText}>تعيين سائق للطلب</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Merchant Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>المتجر</Text>
          </View>
          <View style={styles.merchantInfo}>
            {order.merchant?.logo_url ? (
              <Image source={{ uri: order.merchant.logo_url }} style={styles.merchantLogoImage} resizeMode="cover" />
            ) : (
              <View style={styles.merchantLogo} />
            )}
            <View style={styles.merchantDetails}>
              <Text style={styles.merchantName}>{order.merchant?.name_ar || 'متجر'}</Text>
              <TouchableOpacity 
                style={styles.contactButton}
                onPress={() => {
                  if (order?.merchant?.phone_number) {
                    Linking.openURL(`tel:${order.merchant.phone_number}`);
                  } else {
                    Alert.alert('❌ خطأ', 'رقم هاتف المتجر غير متوفر', [{ text: 'حسناً' }]);
                  }
                }}
              >
                <Phone size={16} color={colors.primary} />
                <Text style={styles.contactText}>اتصال</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Delivery Address */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MapPin size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>عنوان التوصيل</Text>
          </View>
          <Text style={styles.addressText}>
            {order.delivery_address?.street_address ? `${order.delivery_address.street_address}, ${order.delivery_address.city || ''}` : 'لم يتم تحديد عنوان'}
          </Text>
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>المنتجات</Text>
            <Text style={styles.sectionCount}>({getTotalItems()})</Text>
          </View>
          
          {orderItems.map(item => (
            <View key={item.id} style={styles.orderItem}>
              <Text style={styles.itemName}>{item.product_name_ar}</Text>
              <View style={styles.itemDetails}>
                <Text style={styles.itemQuantity}>{item.quantity} ×</Text>
                <Text style={styles.itemPrice}>{(item.price || 0).toFixed(2)} جنيه</Text>
                <Text style={styles.itemTotal}>{(item.total || 0).toFixed(2)} جنيه</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ملخص الطلب</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>عدد العناصر</Text>
            <Text style={styles.summaryValue}>{getTotalItems()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>سعر المنتجات</Text>
            <Text style={styles.summaryValue}>
              {(() => {
                // إذا كان subtotal موجود ولا يساوي 0، استخدمه
                if (order.subtotal && order.subtotal > 0) {
                  return order.subtotal.toFixed(2);
                }
                // وإلا احسبه من order_items
                const itemsTotal = orderItems.reduce((sum, item) => sum + (item.total || 0), 0);
                return itemsTotal > 0 ? itemsTotal.toFixed(2) : '0.00';
              })()} جنيه
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>سعر التوصيل</Text>
            <Text style={styles.summaryValue}>
              {(() => {
                // إذا كانت الرسوم موجودة، استخدمها
                if (order.delivery_fee && order.delivery_fee > 0) {
                  return order.delivery_fee.toFixed(2);
                }
                // للطلبات القديمة: افترض 10 جنيه (القيمة الافتراضية)
                const itemsTotal = orderItems.reduce((sum, item) => sum + (item.total || 0), 0);
                const feesTotal = order.total - itemsTotal;
                return feesTotal > 0 ? '10.00' : '0.00';
              })()} جنيه
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>رسوم الخدمة</Text>
            <Text style={styles.summaryValue}>
              {(() => {
                if (order.service_fee && order.service_fee > 0) {
                  return order.service_fee.toFixed(2);
                }
                // للطلبات القديمة: افترض 2.5 جنيه
                const itemsTotal = orderItems.reduce((sum, item) => sum + (item.total || 0), 0);
                const feesTotal = order.total - itemsTotal;
                return feesTotal > 0 ? '2.50' : '0.00';
              })()} جنيه
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>الضريبة</Text>
            <Text style={styles.summaryValue}>
              {(() => {
                const tax = order.tax ?? order.tax_amount ?? 0;
                if (tax > 0) {
                  return tax.toFixed(2);
                }
                // للطلبات القديمة: افترض 1.5 جنيه
                const itemsTotal = orderItems.reduce((sum, item) => sum + (item.total || 0), 0);
                const feesTotal = order.total - itemsTotal;
                return feesTotal > 0 ? '1.50' : '0.00';
              })()} جنيه
            </Text>
          </View>
          {(order.discount ?? 0) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.success }]}>الخصم</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>-{(order.discount ?? 0).toFixed(2)} جنيه</Text>
            </View>
          )}
          {orderDiscounts.length > 0 && (
            <View style={{ marginTop: 4 }}>
              {orderDiscounts.map((d) => {
                const details = d?.details || {};
                const applyOn = details.apply_on || details.applyOn || 'order_total';
                const isAd = details.source === 'apply_ad_discount_if_eligible' || (details.source === 'apply_quote_v3_to_order' && !!details.ad_id);
                const source = isAd ? 'خصم إعلان ممول' : 'عرض ترويجي';
                const applyOnLabel =
                  applyOn === 'delivery_fee' ? 'رسوم التوصيل' :
                  applyOn === 'service_fee' ? 'رسوم الخدمة' :
                  applyOn === 'merchant_commission' ? 'عمولة التاجر' : 'قيمة الطلب';
                return (
                  <View key={d.id} style={[styles.summaryRow, { paddingVertical: 2 }]}>
                    <Text style={[styles.summaryLabel, { color: colors.textLight }]}>{source} • {applyOnLabel}</Text>
                    <Text style={[styles.summaryValue, { color: colors.success }]}>-{Number(d.amount || 0).toFixed(2)} جنيه</Text>
                  </View>
                );
              })}
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>المجموع الإجمالي</Text>
            <Text style={styles.totalValue}>{(order.customer_total ?? order.total).toFixed(2)} جنيه</Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        {/* زر تقييم الطلب - يظهر فقط بعد التوصيل */}
        {order?.status === 'delivered' && !order?.rating && (
          <TouchableOpacity 
            style={styles.rateButton}
            onPress={() => router.push(`/order/${order.id}/rate`)}
          >
            <Star size={20} color={colors.white} />
            <Text style={styles.rateText}>تقييم الطلب</Text>
          </TouchableOpacity>
        )}
        
        {/* زر إلغاء الطلب - يظهر فقط للعميل وعندما يكون الطلب قابلاً للإلغاء */}
        {user?.id === order?.customer_id && 
         order?.status !== 'cancelled' && 
         order?.status !== 'delivered' && 
         order?.status !== 'on_the_way' && (
          <TouchableOpacity 
            style={[styles.footerButton, styles.cancelButton]}
            onPress={handleCancelOrder}
          >
            <Text style={[styles.footerButtonText, styles.cancelButtonText]}>إلغاء الطلب</Text>
          </TouchableOpacity>
        )}
        
        {conversationId && (
          <TouchableOpacity 
            style={styles.chatButton}
            onPress={() => router.push({
              pathname: `/chat/${conversationId}`,
              params: { driverPhone: order?.driver?.phone_number || '' },
            } as any)}
          >
            <MessageCircle size={20} color={colors.primary} />
            <Text style={styles.chatText}>الدردشة مع السائق</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Floating Complaint FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setComplaintModalVisible(true)}>
        <AlertTriangle size={20} color={colors.white} />
        <Text style={styles.fabText}>إبلاغ عن مشكلة</Text>
      </TouchableOpacity>

      {/* Complaint Modal */}
      <Modal
        visible={complaintModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setComplaintModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>إبلاغ عن مشكلة في الطلب #{order?.order_number}</Text>
                  <TouchableOpacity onPress={() => setComplaintModalVisible(false)}>
                    <Text style={styles.secondaryButtonText}>إغلاق</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="عنوان الشكوى"
                  placeholderTextColor={colors.textLight}
                  value={complaintTitle}
                  onChangeText={setComplaintTitle}
                />
                <TextInput
                  style={styles.textarea}
                  placeholder="وصف المشكلة (اختياري)"
                  placeholderTextColor={colors.textLight}
                  multiline
                  numberOfLines={4}
                  value={complaintDescription}
                  onChangeText={setComplaintDescription}
                />

                {/* Images row */}
                <View style={styles.imagesRow}>
                  {complaintImages.map((uri, idx) => (
                    <View key={idx} style={{ position: 'relative' }}>
                      <Image source={{ uri }} style={styles.imageThumb} />
                      <TouchableOpacity style={styles.removeImg} onPress={() => removeComplaintImage(idx)}>
                        <Text style={{ color: colors.white }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={[styles.imageThumb, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.lightGray }]} onPress={pickComplaintImage}>
                    <Text style={{ color: colors.textLight }}>+</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.secondaryButton]} onPress={() => setComplaintModalVisible(false)}>
                    <Text style={styles.secondaryButtonText}>إلغاء</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryButton]} onPress={submitComplaint}>
                    <Text style={styles.primaryButtonText}>إرسال الشكوى</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textLight,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
    marginRight: 40,
  },
  backButtonText: {
    ...typography.body,
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.white,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginRight: spacing.sm,
  },
  sectionCount: {
    ...typography.body,
    color: colors.textLight,
  },
  statusTimeline: {
    marginVertical: spacing.md,
  },
  statusStep: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  statusIndicatorContainer: {
    alignItems: 'center',
    marginRight: spacing.md,
  },
  statusIndicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.border,
  },
  statusIndicatorCompleted: {
    backgroundColor: colors.success,
  },
  statusIndicatorCurrent: {
    backgroundColor: colors.primary,
  },
  statusIndicatorCancelled: {
    backgroundColor: colors.error,
  },
  statusLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
  statusLineCompleted: {
    backgroundColor: colors.success,
  },
  statusInfo: {
    flex: 1,
  },
  statusText: {
    ...typography.bodyMedium,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  statusTextCurrent: {
    color: colors.primary,
    ...typography.bodyMedium,
  },
  statusTextCancelled: {
    color: colors.error,
  },
  statusDescription: {
    ...typography.caption,
    color: colors.textLight,
  },
  estimatedTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  estimatedTimeText: {
    ...typography.body,
    color: colors.textLight,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  driverAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  driverName: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  driverDetails: {
    flex: 1,
  },
  driverStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  statText: {
    ...typography.caption,
    color: colors.textLight,
    marginLeft: spacing.xs,
  },
  trackDriverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    gap: spacing.sm,
    ...shadows.small,
  },
  trackDriverButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  assignDriverButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  assignDriverText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  // ...
  merchantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  merchantLogo: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.background,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  merchantLogoImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  merchantDetails: {
    flex: 1,
  },
  merchantName: {
    // ...
    color: colors.text,
    marginBottom: spacing.sm,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  contactText: {
    ...typography.body,
    color: colors.primary,
  },
  driverActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  addressText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 20,
  },
  orderItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemQuantity: {
    ...typography.body,
    color: colors.textLight,
  },
  itemPrice: {
    ...typography.body,
    color: colors.textLight,
  },
  itemTotal: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.text,
  },
  summaryValue: {
    ...typography.body,
    color: colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  totalLabel: {
    ...typography.h3,
    color: colors.text,
  },
  totalValue: {
    ...typography.h3,
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cancelButton: {
    backgroundColor: colors.error,
  },
  footerButtonText: {
    ...typography.bodyMedium,
  },
  cancelButtonText: {
    color: colors.white,
  },
  rateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rateText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  chatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  chatText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.xxl,
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    ...shadows.small,
  },
  fabText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  textarea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },
  imagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  imageThumb: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeImg: {
    position: 'absolute',
    top: -6,
    left: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  secondaryButtonText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
});
