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
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { ArrowLeft, MapPin, CreditCard, Wallet, Plus, Minus } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

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
  const [calculatedDeliveryFee, setCalculatedDeliveryFee] = useState<number>(10);
  const [calculatingFee, setCalculatingFee] = useState(false);
  
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
        const parsed = JSON.parse(params.items) as Array<{ id: string; name: string; price: number; quantity: number }>; 
        setCartItems(parsed.map(p => ({ id: p.id, name: p.name, price: p.price, quantity: p.quantity, image_url: '' })));
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
        // تقريب المسافة لأعلى (أي كسر من الكيلو = كيلو كامل)
        const roundedDistance = Math.ceil(distance);
        console.log('🔼 Rounded distance:', roundedDistance, 'km');
        // 10 جنيه لكل كيلومتر (حد أدنى 10 جنيه)
        const fee = Math.max(roundedDistance * 10, 10);
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
        
        // حساب الرسوم: 10 جنيه/كم، حد أدنى 10 جنيه
        const fee = Math.max(roundedDistance * 10, 10);
        setCalculatedDeliveryFee(fee);
      } else {
        // إذا لم تتوفر المواقع، استخدم رسوم افتراضية
        setCalculatedDeliveryFee(10);
      }
    } catch (error) {
      console.error('Error calculating delivery fee:', error);
      setCalculatedDeliveryFee(10); // رسوم افتراضية عند الخطأ
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
      // إنشاء طلب جديد
      const orderData: any = {
        order_number: `ORD-${Date.now()}`,
        customer_id: user?.id,
        merchant_id: merchantIdToUse,  // معرف المتجر (يتطابق مع FK)
        store_id: merchantIdToUse,      // نفس القيمة (للتوافق مع النظام)
        status: 'pending',
        subtotal: getTotalPrice(),
        delivery_fee: calculatedDeliveryFee,
        service_fee: 2.50,
        tax: 1.50,
        discount: 0.00,
        total: getTotalPrice() + calculatedDeliveryFee + 4.00,
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
        const orderItems = cartItems.map(item => ({
          order_id: data.id,
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) {
          console.error('Order items error:', itemsError);
          throw itemsError;
        }
        
        console.log('✅ Order items created successfully');
      }

      // حفظ معلومات الطلب قبل التوجيه
      const orderNumber = data.order_number;
      const orderId = data.id;
      
      console.log('🚀 Navigating to orders page...');

      // التوجيه الفوري بدون Alert
      router.replace('/(tabs)/orders');
      
      // عرض Toast notification بعد التوجيه
      setTimeout(() => {
        Alert.alert(
          '✅ تم إنشاء الطلب بنجاح!', 
          `رقم الطلب: ${orderNumber}\n\nحالة الطلب: قيد الانتظار`,
          [{ text: 'حسناً' }]
        );
      }, 500);
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إنشاء الطلب');
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
            <Text style={styles.summaryValue}>{getTotalPrice().toFixed(2)} جنيه</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>سعر التوصيل</Text>
            {calculatingFee ? (
              <Text style={styles.summaryValue}>جاري الحساب...</Text>
            ) : (
              <Text style={styles.summaryValue}>{calculatedDeliveryFee.toFixed(2)} جنيه</Text>
            )}
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>رسوم الخدمة</Text>
            <Text style={styles.summaryValue}>2.50 جنيه</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>الضريبة</Text>
            <Text style={styles.summaryValue}>1.50 جنيه</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>المجموع الإجمالي</Text>
            <Text style={styles.totalValue}>{(getTotalPrice() + calculatedDeliveryFee + 4.00).toFixed(2)} جنيه</Text>
          </View>
        </View>
      </ScrollView>

      {/* Place Order Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.placeOrderButton, loading && styles.disabledButton]}
          onPress={handlePlaceOrder}
          disabled={loading}
        >
          {loading ? (
            <Text style={styles.placeOrderText}>جاري إنشاء الطلب...</Text>
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