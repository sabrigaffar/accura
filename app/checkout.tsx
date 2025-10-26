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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
  const params = useLocalSearchParams<{ items?: string; merchantId?: string }>();
  const merchantIdParam = typeof params.merchantId === 'string' ? params.merchantId : undefined;
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'wallet'>('cash');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserAddresses();
    }
  }, [user]);

  useEffect(() => {
    // Initialize cart items from route params if provided
    if (params.items && typeof params.items === 'string') {
      try {
        const parsed = JSON.parse(params.items) as Array<{ id: string; name: string; price: number; quantity: number }>; 
        setCartItems(parsed.map(p => ({ id: p.id, name: p.name, price: p.price, quantity: p.quantity, image_url: '' })));
      } catch (e) {
        // If parsing fails, keep cart empty and user can navigate back
      }
    } else {
      // fallback sample data if user came from cart screen
      setCartItems([
        {
          id: '1',
          name: 'برجر كلاسيك',
          price: 25.0,
          quantity: 2,
          image_url: 'https://images.pexels.com/photos/1633578/pexels-photo-1633578.jpeg',
        },
        {
          id: '2',
          name: 'بطاطس مقلية',
          price: 12.0,
          quantity: 1,
          image_url: 'https://images.pexels.com/photos/1596888/pexels-photo-1596888.jpeg',
        },
      ]);
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
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل العناوين');
    }
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
    if (!selectedAddress) {
      Alert.alert('خطأ', 'الرجاء اختيار عنوان التوصيل');
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
      const orderData = {
        order_number: `ORD-${Date.now()}`,
        customer_id: user?.id,
        merchant_id: merchantIdToUse, // تم تمريره أو اختيار بديل
        status: 'pending',
        delivery_address_id: selectedAddress.id,
        subtotal: getTotalPrice(),
        delivery_fee: 10.00,
        service_fee: 2.50,
        tax: 1.50,
        discount: 0.00,
        total: getTotalPrice() + 14.00,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'cash' ? 'pending' : 'paid',
        delivery_notes: deliveryNotes,
      };

      const { data, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;

      // إنشاء عناصر الطلب فقط إذا جاءت من صفحة المتجر (params.items موجودة)
      if (params.items && typeof params.items === 'string') {
        const orderItems = cartItems.map(item => ({
          order_id: data.id,
          product_id: item.id,
          product_name_ar: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          special_instructions: '',
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      // تفريغ السلة وإعادة توجيه المستخدم
      Alert.alert('نجاح', 'تم إنشاء الطلب بنجاح', [
        {
          text: 'موافق',
          onPress: () => router.replace(`/order/${data.id}`)
        }
      ]);
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
          
          {addresses.length === 0 ? (
            <TouchableOpacity 
              style={styles.addAddressButton}
              onPress={() => router.push('/profile/addresses')}
            >
              <Text style={styles.addAddressText}>إضافة عنوان جديد</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.addressList}>
              {addresses.map(address => (
                <TouchableOpacity
                  key={address.id}
                  style={[
                    styles.addressCard,
                    selectedAddress?.id === address.id && styles.selectedAddress
                  ]}
                  onPress={() => setSelectedAddress(address)}
                >
                  <View style={styles.addressHeader}>
                    <Text style={styles.addressTitle}>{address.title}</Text>
                    {address.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultText}>افتراضي</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.addressDetails}>
                    {address.street_address}, {address.city}
                    {address.district && `, ${address.district}`}
                    {address.building_number && `, بناية ${address.building_number}`}
                    {address.floor_number && `, دور ${address.floor_number}`}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity 
                style={styles.addNewAddressButton}
                onPress={() => router.push('/profile/addresses')}
              >
                <Text style={styles.addNewAddressText}>إضافة عنوان جديد</Text>
              </TouchableOpacity>
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
                <Text style={styles.itemPrice}>{item.price} ريال</Text>
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
              <Text style={styles.itemTotal}>{(item.price * item.quantity).toFixed(2)} ريال</Text>
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
            <Text style={styles.summaryValue}>{getTotalPrice().toFixed(2)} ريال</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>سعر التوصيل</Text>
            <Text style={styles.summaryValue}>10.00 ريال</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>رسوم الخدمة</Text>
            <Text style={styles.summaryValue}>2.50 ريال</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>الضريبة</Text>
            <Text style={styles.summaryValue}>1.50 ريال</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>المجموع الإجمالي</Text>
            <Text style={styles.totalValue}>{(getTotalPrice() + 14.00).toFixed(2)} ريال</Text>
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
});