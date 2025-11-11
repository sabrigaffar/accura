import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { getLastAdId, clearLastAdId } from '@/lib/adAttribution';
import { calculateDeliveryFeeAsync } from '@/lib/deliveryFeeCalculator';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { ArrowLeft, MapPin, CreditCard, Wallet, Plus, Minus } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
}

interface Address {
  id: string;
  title: string;
  street_address: string;
  city: string;
  district?: string;
  building_number?: string;
  floor_number?: string;
  is_default: boolean;
}

export default function CheckoutScreen() {
  const { user } = useAuth();
  const { clearCart } = useCart();
  const { success: showToastSuccess, error: showToastError, info: showToastInfo } = useToast();
  const params = useLocalSearchParams<{ 
    items?: string; 
    merchantId?: string;
    selectedLat?: string;
    selectedLon?: string;
    selectedAddress?: string;
  }>();
  const merchantIdParam = typeof params.merchantId === 'string' ? params.merchantId : undefined;
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'wallet'>('cash');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [calculatedDeliveryFee, setCalculatedDeliveryFee] = useState<number | null>(null);
  const [calculatingFee, setCalculatingFee] = useState(false);
  // Quote breakdown (server-calculated) to show accurate discount before confirmation
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<{
    subtotal: number;
    delivery_fee: number;
    service_fee: number;
    tax: number;
    discount: number;
    total: number;
    apply_on?: string | null;
    applied_rule?: string | null;
    applied_promotion?: string | null;
    applied_ad?: string | null;
  } | null>(null);
  
  // موقع مزقت من pick-location
  const [temporaryLocation, setTemporaryLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  
  // موقع العميل الحالي (تلقائي حتى عند استخدام عنوان محفوظ)
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  useEffect(() => {
    if (user) {
      captureCurrentLocation(); // ✅ فقط التقاط الموقع - لا حاجة للعناوين
    }
  }, [user]);

  // دالة التقاط الموقع الحالي
  const captureCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('⚠️ Location permission denied');
        setLocationPermissionDenied(true);
        
        // ✅ توجيه المستخدم لفتح GPS
        Alert.alert(
          'فتح تحديد الموقع',
          'لحساب رسوم التوصيل بدقة، يجب تفعيل GPS من إعدادات الهاتف.\n\nاذهب إلى: الإعدادات > الموقع > تفعيل',
          [
            { text: 'إلغاء', style: 'cancel', onPress: () => router.back() },
            {
              text: 'فتح الإعدادات',
              onPress: async () => {
                if (Platform.OS === 'ios') {
                  await Linking.openURL('app-settings:');
                } else {
                  await Linking.openURL('app-settings:');
                }
              }
            }
          ]
        );
        return;
      }
      
      setLocationPermissionDenied(false);

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      console.log('✅ Current location captured:', {
        lat: location.coords.latitude,
        lon: location.coords.longitude,
      });
      
      // ✅ حساب رسوم التوصيل تلقائياً
      if (merchantIdParam) {
        calculateDeliveryFeeForLocation(
          merchantIdParam,
          location.coords.latitude,
          location.coords.longitude
        );
      }
    } catch (error) {
      console.error('Error capturing current location:', error);
      Alert.alert('تنبيه', 'لم يتمكن من تحديد موقعك تلقائياً. الرجاء تحديده يدوياً.');
    }
  };

  // معالجة الموقع المؤقت من pick-location
  useEffect(() => {
    if (params.selectedLat && params.selectedLon) {
      const lat = parseFloat(params.selectedLat as string);
      const lon = parseFloat(params.selectedLon as string);
      
      setTemporaryLocation({
        latitude: lat,
        longitude: lon,
        address: params.selectedAddress as string || 'موقع محدد',
      });
      
      // حساب رسوم التوصيل بناءً على الموقع المؤقت
      if (merchantIdParam) {
        calculateDeliveryFeeForLocation(merchantIdParam, lat, lon);
      }
    }
  }, [params.selectedLat, params.selectedLon, params.selectedAddress]);

  useEffect(() => {
    // Initialize cart items from route params if provided
    if (params.items && typeof params.items === 'string') {
      try {
        console.log('📦 Raw params.items:', params.items);
        const parsed = JSON.parse(params.items) as Array<{ id: string; name: string; price: number; quantity: number }>;
        console.log('✅ Parsed items:', parsed);
        
        // تحويل وتنظيف البيانات فوراً
        const cleanedItems = parsed.map(p => {
          const price = typeof p.price === 'number' ? p.price : parseFloat(String(p.price || 0));
          const quantity = typeof p.quantity === 'number' ? p.quantity : parseInt(String(p.quantity || 1), 10);
          
          console.log(`Item ${p.name}: price=${price}, quantity=${quantity}`);
          
          return {
            id: p.id,
            name: p.name,
            price: !isNaN(price) && price > 0 ? price : 0,
            quantity: !isNaN(quantity) && quantity > 0 ? quantity : 1,
            image_url: ''
          };
        });
        
        console.log('🛒 Final cart items:', cleanedItems);
        setCartItems(cleanedItems);
      } catch (e) {
        console.error('Error parsing cart items:', e);
        Alert.alert(
          'خطأ',
          'حدث خطأ في تحميل منتجات السلة. الرجاء المحاولة مرة أخرى.',
          [{ text: 'حسناً', onPress: () => router.back() }]
        );
      }
    } else {
      // لا توجد منتجات - عرض رسالة والعودة
      Alert.alert(
        'سلة فارغة',
        'لم يتم اختيار أي منتجات. الرجاء إضافة منتجات للسلة أولاً.',
        [{ text: 'حسناً', onPress: () => router.back() }]
      );
    }
  }, [params.items]);

  // Build items JSON for quote RPC
  const buildItemsJson = () => {
    try {
      const arr = cartItems.map(ci => ({
        product_id: ci.id,
        price: ci.price,
        quantity: ci.quantity,
      }));
      return JSON.parse(JSON.stringify(arr));
    } catch {
      return [] as any[];
    }
  };

  // Refresh server quote whenever inputs change (only after delivery fee is known)
  useEffect(() => {
    const run = async () => {
      if (!merchantIdParam || cartItems.length === 0 || calculatedDeliveryFee == null) {
        setQuote(null);
        return;
      }
      try {
        setQuoteLoading(true);
        const itemsJson = buildItemsJson();
        const adId = await getLastAdId();
        const { data, error } = await supabase.rpc('quote_order_v3', {
          p_customer_id: user?.id ?? null,
          p_store_id: merchantIdParam,
          p_items: itemsJson,
          p_payment_method: paymentMethod,
          p_delivery_fee: calculatedDeliveryFee,
          p_tax: 0, // الضريبة تُحتسب داخل قاعدة البيانات من إعداد المتجر
          p_ad_id: adId,
        });
        if (error) throw error;
        const row = Array.isArray(data) && data[0] ? data[0] : null;
        if (row) {
          setQuote({
            subtotal: Number(row.subtotal) || 0,
            delivery_fee: Number(row.delivery_fee) || 0,
            service_fee: Number(row.service_fee) || 0,
            tax: Number(row.tax) || 0,
            discount: Number(row.discount) || 0,
            total: Number(row.total) || 0,
            apply_on: row.apply_on || null,
            applied_rule: row.applied_rule || null,
            applied_promotion: row.applied_promotion || null,
            applied_ad: row.applied_ad || null,
          });
        } else {
          setQuote(null);
        }
      } catch (e) {
        console.warn('quote_order_v3 error:', (e as any)?.message || e);
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    };
    run();
  }, [merchantIdParam, cartItems, paymentMethod, calculatedDeliveryFee]);

  const fetchUserAddresses = async () => {
    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user?.id)
        .order('is_default', { ascending: false });

      if (error) throw error;
      
      setAddresses(data || []);
      if (data && data.length > 0) {
        const defaultAddress = data.find(addr => addr.is_default) || data[0];
        setSelectedAddress(defaultAddress);
        // ✅ لن نحسب رسوم التوصيل من العنوان - سنعتمد على الموقع الحالي
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل العناوين');
    }
  };

  // دالة حساب رسوم التوصيل بناءً على إحداثيات
  const calculateDeliveryFeeForLocation = async (merchantId: string, lat: number, lon: number) => {
    setCalculatingFee(true);
    try {
      const { data: merchant } = await supabase
        .from('merchants')
        .select('latitude, longitude')
        .eq('id', merchantId)
        .single();

      if (merchant?.latitude && merchant?.longitude) {
        const distance = calculateDistance(
          merchant.latitude,
          merchant.longitude,
          lat,
          lon
        );
        console.log('📏 Distance calculated:', distance.toFixed(2), 'km');
        // استخدم السعر الأساسي الديناميكي لكل كم من إعدادات المنصة
        const fee = await calculateDeliveryFeeAsync(distance);
        console.log('💰 Calculated delivery fee:', fee, 'EGP');
        setCalculatedDeliveryFee(fee);
      }
    } catch (error) {
      console.error('Error calculating delivery fee:', error);
    } finally {
      setCalculatingFee(false);
    }
  };

  // دالة حساب رسوم التوصيل
  const calculateDeliveryFee = async (merchantId: string, addressId: string) => {
    setCalculatingFee(true);
    try {
      // جلب موقع المتجر
      const { data: merchant } = await supabase
        .from('merchants')
        .select('latitude, longitude')
        .eq('id', merchantId)
        .single();

      // جلب موقع العميل
      const { data: address } = await supabase
        .from('addresses')
        .select('latitude, longitude')
        .eq('id', addressId)
        .single();

      if (merchant?.latitude && merchant?.longitude && address?.latitude && address?.longitude) {
        // حساب المسافة (Haversine formula)
        const distance = calculateDistance(
          merchant.latitude,
          merchant.longitude,
          address.latitude,
          address.longitude
        );
        
        // تقريب المسافة لأعلى (أي كسر من الكيلو = كيلو كامل)
        const roundedDistance = Math.ceil(distance);
        
        // حساب الرسوم: استخدم السعر الأساسي الديناميكي لكل كم من إعدادات المنصة
        const fee = await calculateDeliveryFeeAsync(roundedDistance);
        setCalculatedDeliveryFee(fee);
      } else {
        // إذا لم تتوفر المواقع، لا تؤكد الطلب قبل حساب الرسوم
        setCalculatedDeliveryFee(null);
      }
    } catch (error) {
      console.error('Error calculating delivery fee:', error);
      setCalculatedDeliveryFee(null); // لا تعتمد على قيمة افتراضية
    } finally {
      setCalculatingFee(false);
    }
  };

  // دالة حساب المسافة (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // نصف قطر الأرض بالكيلومتر
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const updateQuantity = (id: string, change: number) => {
    setCartItems(prevItems => 
      prevItems.map(item => 
        item.id === id 
          ? { ...item, quantity: Math.max(1, item.quantity + change) }
          : item
      )
    );
  };

  const removeItem = (id: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== id));
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  const handlePlaceOrder = async () => {
    // لا تسمح بإنشاء طلب قبل حساب رسوم التوصيل بدقة
    if (calculatingFee || calculatedDeliveryFee == null) {
      Alert.alert('انتظار حساب الرسوم', 'يتم الآن حساب رسوم التوصيل من إعدادات المنصة. برجاء الانتظار لحظات قبل تأكيد الطلب.');
      return;
    }
    // ✅ التحقق من وجود موقع (تلقائي أو يدوي)
    if (!temporaryLocation && !currentLocation) {
      Alert.alert('خطأ', 'الرجاء السماح بالوصول للموقع أو تحديده يدوياً');
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert('خطأ', 'السلة فارغة');
      return;
    }

    let merchantIdToUse = merchantIdParam;
    if (!merchantIdToUse) {
      // محاولة اختيار أي متجر نشط كحل بديل للنسخة التجريبية
      try {
        const { data: fallbackMerchant } = await supabase
          .from('merchants')
          .select('id')
          .eq('is_active', true)
          .limit(1)
          .single();
        if (fallbackMerchant?.id) {
          merchantIdToUse = fallbackMerchant.id as string;
        } else {
          Alert.alert('خطأ', 'لا يوجد متجر نشط متاح لإتمام الطلب.');
          return;
        }
      } catch {
        Alert.alert('خطأ', 'تعذر تحديد متجر لإتمام الطلب.');
        return;
      }
    }

    setLoading(true);
    
    try {
      // ✅ فحص المخزون قبل إنشاء الطلب
      if (params.items && typeof params.items === 'string') {
        for (const item of cartItems) {
          const { data: stockCheck } = await supabase.rpc('check_product_stock', {
            p_product_id: item.id,
            p_requested_quantity: item.quantity || 1
          });
          
          if (stockCheck && stockCheck.length > 0 && !stockCheck[0].available) {
            Alert.alert(
              'مخزون غير كافٍ',
              `${item.name}: ${stockCheck[0].message}`,
              [{ text: 'حسناً' }]
            );
            setLoading(false);
            return;
          }
        }
      }

      // إنشاء طلب جديد
      const orderData: any = {
        order_number: `ORD-${Date.now()}`,
        customer_id: user?.id,
        merchant_id: merchantIdToUse,  // معرف المتجر (يتطابق مع FK)
        store_id: merchantIdToUse,      // نفس القيمة (للتوافق مع النظام)
        status: 'pending',
        subtotal: quote?.subtotal ?? getTotalPrice(),
        delivery_fee: quote?.delivery_fee ?? calculatedDeliveryFee,
        service_fee: quote?.service_fee ?? 2.50,
        tax: quote?.tax ?? 1.50,
        discount: quote?.discount ?? 0.00,
        total: quote ? quote.total : (getTotalPrice() + (calculatedDeliveryFee ?? 0) + 4.00),
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'cash' ? 'pending' : 'paid',
        delivery_notes: deliveryNotes,
      };

      // ✅ حفظ الموقع فقط (تلقائي أو يدوي)
      const locationToUse = temporaryLocation || currentLocation;
      if (locationToUse) {
        orderData.customer_latitude = locationToUse.latitude;
        orderData.customer_longitude = locationToUse.longitude;
        orderData.delivery_address_id = null; // ✅ لا نستخدم عناوين محفوظة
        console.log('✅ Location added to order:', locationToUse);
      }

      const { data, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) {
        console.error('Order creation error:', error);
        throw error;
      }

      console.log('✅ Order created successfully:', data);

      // إنشاء عناصر الطلب فقط إذا جاءت من صفحة المتجر (params.items موجودة)
      if (params.items && typeof params.items === 'string') {
        // التحقق من صحة بيانات السلة
        console.log('🛒 Cart items before insertion:', JSON.stringify(cartItems, null, 2));
        
        // تنظيف وتحويل البيانات
        const validatedItems = cartItems.map(item => {
          const price = typeof item.price === 'number' ? item.price : parseFloat(String(item.price || 0));
          const quantity = typeof item.quantity === 'number' ? item.quantity : parseInt(String(item.quantity || 1), 10);
          
          if (isNaN(price) || price <= 0) {
            console.error('⚠️ Invalid price for item:', item);
          }
          if (isNaN(quantity) || quantity <= 0) {
            console.error('⚠️ Invalid quantity for item:', item);
          }
          
          return {
            ...item,
            price: price > 0 ? price : 0,
            quantity: quantity > 0 ? quantity : 1,
          };
        });
        
        // إدراج جميع الأعمدة (القديمة + الجديدة) معاً لضمان التوافق الكامل
        const allColumnsItems = validatedItems.map(item => ({
          order_id: data.id,
          product_id: item.id,
          quantity: item.quantity,  // ← الكمية (مهم جداً!)
          // أعمدة قديمة
          product_name_ar: item.name,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          // أعمدة جديدة
          product_name: item.name,
          price: item.price,
          total: item.price * item.quantity,
        }));
        
        console.log('📦 Items to insert (all columns):', JSON.stringify(allColumnsItems, null, 2));

        // جرب الإدراج بجميع الأعمدة
        const insertResult = await supabase
          .from('order_items')
          .insert(allColumnsItems);

        if (insertResult.error) {
          console.error('❌ Insert failed:', insertResult.error);
          throw insertResult.error;
        }
        
        console.log('✅ Order items inserted successfully');
        
        console.log('✅ Order items created successfully');

        // Persist the same quote breakdown to the order and record discount details
        try {
          const { data: applyData, error: applyErr } = await supabase.rpc('apply_quote_v3_to_order', {
            p_order_id: data.id,
            p_ad_id: quote?.applied_ad ?? null,
          });
          if (applyErr) {
            console.warn('⚠️ apply_quote_v3_to_order warning:', applyErr.message || applyErr);
          } else {
            console.log('✅ apply_quote_v3_to_order:', applyData);
            if (quote?.applied_ad) {
              try { await clearLastAdId(); } catch {}
            }
          }
        } catch (e) {
          console.warn('⚠️ Failed to apply quote to order:', e);
        }
      }

      // No separate ad application needed; persisted via apply_quote_v3_to_order

      // حفظ معلومات الطلب قبل التوجيه
      const orderNumber = data.order_number;
      const orderId = data.id;
      
      console.log('🧹 Clearing cart after successful order...');
      try { clearCart(); } catch {}
      console.log('🚀 Navigating to orders page...');

      // التوجيه الفوري
      router.replace('/(tabs)/orders');

      // عرض Toast + Haptics بعد التوجيه
      setTimeout(() => {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        showToastSuccess(`تم إنشاء الطلب بنجاح • رقم الطلب: ${orderNumber}`);
      }, 400);
    } catch (error) {
      console.error('Error placing order:', error);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      showToastError('حدث خطأ أثناء إنشاء الطلب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إتمام الطلب</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Delivery Address */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MapPin size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>عنوان التوصيل</Text>
          </View>
          
          {/* ✅ فقط عرض حالة الموقع التلقائي */}
          {currentLocation ? (
            <View style={[styles.addressCard, styles.temporaryLocationCard]}>
              <View style={styles.addressHeader}>
                <Text style={styles.addressTitle}>✅ تم تحديد موقعك تلقائياً</Text>
                <View style={[styles.defaultBadge, { backgroundColor: colors.success }]}>
                  <Text style={styles.defaultText}>جاهز</Text>
                </View>
              </View>
              <Text style={styles.coordsText}>
                📍 {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              </Text>
            </View>
          ) : (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>📍 جاري تحديد موقعك...</Text>
              <Text style={styles.warningText}>
                يرجى الانتظار بينما نحدد موقعك لحساب رسوم التوصيل
              </Text>
            </View>
          )}
        </View>

        {/* Cart Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>المنتجات</Text>
            <Text style={styles.sectionCount}>({getTotalItems()})</Text>
          </View>
          
          {cartItems.map(item => (
            <View key={item.id} style={styles.cartItem}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>{item.price} جنيه</Text>
              </View>
              <View style={styles.quantityContainer}>
                <TouchableOpacity 
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(item.id, -1)}
                >
                  <Minus size={16} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{item.quantity}</Text>
                <TouchableOpacity 
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(item.id, 1)}
                >
                  <Plus size={16} color={colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={styles.itemTotal}>{(item.price * item.quantity).toFixed(2)} جنيه</Text>
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => removeItem(item.id)}
              >
                <Text style={styles.removeText}>حذف</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <CreditCard size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>طريقة الدفع</Text>
          </View>
          
          <View style={styles.paymentMethods}>
            <TouchableOpacity
              style={[
                styles.paymentMethod,
                paymentMethod === 'cash' && styles.selectedPaymentMethod
              ]}
              onPress={() => setPaymentMethod('cash')}
            >
              <Wallet size={24} color={paymentMethod === 'cash' ? colors.primary : colors.textLight} />
              <Text style={[
                styles.paymentMethodText,
                paymentMethod === 'cash' && styles.selectedPaymentMethodText
              ]}>
                الدفع عند الاستلام
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.paymentMethod,
                paymentMethod === 'card' && styles.selectedPaymentMethod
              ]}
              onPress={() => setPaymentMethod('card')}
            >
              <CreditCard size={24} color={paymentMethod === 'card' ? colors.primary : colors.textLight} />
              <Text style={[
                styles.paymentMethodText,
                paymentMethod === 'card' && styles.selectedPaymentMethodText
              ]}>
                البطاقة الائتمانية
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery Notes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ملاحظات التوصيل</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            placeholder="أضف ملاحظات خاصة بالطلب..."
            value={deliveryNotes}
            onChangeText={setDeliveryNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
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
            <Text style={styles.summaryValue}>{(quote?.subtotal ?? getTotalPrice()).toFixed(2)} جنيه</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>سعر التوصيل</Text>
            {calculatingFee ? (
              <Text style={styles.summaryValue}>جاري الحساب...</Text>
            ) : calculatedDeliveryFee == null && !quote ? (
              <Text style={styles.summaryValue}>—</Text>
            ) : (
              <Text style={styles.summaryValue}>{(quote?.delivery_fee ?? calculatedDeliveryFee ?? 0).toFixed(2)} جنيه</Text>
            )}
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>رسوم الخدمة</Text>
            <Text style={styles.summaryValue}>{(quote?.service_fee ?? 2.5).toFixed(2)} جنيه</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>الضريبة</Text>
            <Text style={styles.summaryValue}>{(quote?.tax ?? 1.5).toFixed(2)} جنيه</Text>
          </View>
          {(quote?.discount ?? 0) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.success }]}>الخصم {quote?.apply_on ? `• ${quote?.apply_on === 'delivery_fee' ? 'رسوم التوصيل' : quote?.apply_on === 'service_fee' ? 'رسوم الخدمة' : quote?.apply_on === 'product' ? 'على منتج' : 'قيمة الطلب'}` : ''}</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>- {(quote?.discount ?? 0).toFixed(2)} جنيه</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>المجموع الإجمالي</Text>
            {calculatingFee || calculatedDeliveryFee == null ? (
              <Text style={styles.totalValue}>—</Text>
            ) : (
              <Text style={styles.totalValue}>{(
                quote ? quote.total : (getTotalPrice() + (calculatedDeliveryFee ?? 0) + 4.00)
              ).toFixed(2)} جنيه</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Place Order Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.placeOrderButton, (loading || calculatingFee || calculatedDeliveryFee == null) && styles.disabledButton]}
          onPress={handlePlaceOrder}
          disabled={loading || calculatingFee || calculatedDeliveryFee == null}
        >
          {loading ? (
            <Text style={styles.placeOrderText}>جاري إنشاء الطلب...</Text>
          ) : calculatingFee ? (
            <Text style={styles.placeOrderText}>جاري حساب رسوم التوصيل...</Text>
          ) : calculatedDeliveryFee == null ? (
            <Text style={styles.placeOrderText}>انتظار حساب الرسوم...</Text>
          ) : (
            <Text style={styles.placeOrderText}>تأكيد الطلب</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  addAddressButton: {
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  addAddressText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  addressList: {
    gap: spacing.sm,
  },
  addressCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  selectedAddress: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  addressTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  defaultBadge: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  defaultText: {
    ...typography.small,
    color: colors.white,
  },
  addressDetails: {
    ...typography.body,
    color: colors.textLight,
    lineHeight: 20,
  },
  addNewAddressButton: {
    marginTop: spacing.sm,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  addNewAddressText: {
    ...typography.body,
    color: colors.primary,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  itemPrice: {
    ...typography.body,
    color: colors.textLight,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },
  quantityButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.sm,
  },
  quantityText: {
    ...typography.body,
    color: colors.text,
    marginHorizontal: spacing.sm,
    minWidth: 20,
    textAlign: 'center',
  },
  itemTotal: {
    ...typography.bodyMedium,
    color: colors.text,
    marginHorizontal: spacing.md,
    minWidth: 60,
  },
  removeButton: {
    padding: spacing.sm,
  },
  removeText: {
    ...typography.body,
    color: colors.error,
  },
  paymentMethods: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  paymentMethod: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  selectedPaymentMethod: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  paymentMethodText: {
    ...typography.body,
    color: colors.textLight,
  },
  selectedPaymentMethodText: {
    color: colors.primary,
  },
  notesInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 80,
    textAlign: 'right',
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
    backgroundColor: colors.white,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  placeOrderButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  placeOrderText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  mapPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  mapPickerButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  warningCard: {
    backgroundColor: colors.warning + '20',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    marginBottom: spacing.md,
  },
  warningTitle: {
    ...typography.bodyMedium,
    color: colors.warning,
    marginBottom: spacing.xs,
    fontWeight: 'bold',
  },
  warningText: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.md,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  permissionButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: 'bold',
  },
  temporaryLocationCard: {
    borderColor: colors.success,
    borderWidth: 2,
    backgroundColor: colors.success + '10',
  },
  coordsText: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.xs,
    fontFamily: 'monospace',
  },
  changeLocationButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  changeLocationText: {
    ...typography.small,
    color: colors.white,
    fontWeight: '600',
  },
  switchToAddressesButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  switchToAddressesText: {
    ...typography.body,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});