import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { ArrowLeft, Plus, Minus, Trash2 } from 'lucide-react-native';
import { useCart } from '@/contexts/CartContext';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getLastAdId } from '@/lib/adAttribution';

export default function CartScreen() {
  const { items, storeId, updateQuantity, removeItem, getTotalItems, getTotalPrice } = useCart();
  const { user } = useAuth();

  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number>(10);
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
  const [quoteLoading, setQuoteLoading] = useState(false);

  const displayDelivery = useMemo(() => (quote ? quote.delivery_fee : deliveryFee), [quote, deliveryFee]);
  const displayTax = useMemo(() => (quote ? quote.tax : 1.5), [quote]);
  const displayService = useMemo(() => (quote ? quote.service_fee : 0), [quote]);
  const displaySubtotal = useMemo(() => (quote ? quote.subtotal : getTotalPrice()), [quote, getTotalPrice]);
  const displayDiscount = useMemo(() => (quote ? quote.discount : 0), [quote]);
  const displayTotal = useMemo(() => (quote ? quote.total : (getTotalPrice() + displayDelivery + displayTax)), [quote, getTotalPrice, displayDelivery, displayTax]);

  const cartItems = items.map(i => ({
    id: i.productId,
    name: i.name,
    price: i.price,
    quantity: i.quantity,
    image_url: i.imageUrl || '',
  }));

  const handleIncrement = async (productId: string, currentQty: number) => {
    try {
      const { data, error } = await supabase.rpc('check_product_stock', {
        p_product_id: productId,
        p_requested_quantity: currentQty + 1,
      });
      if (!error && Array.isArray(data) && data[0] && data[0].available === false) {
        Alert.alert('مخزون غير كافٍ', data[0].message || 'لا يمكن زيادة الكمية');
        return;
      }
    } catch {
      // في حال عدم توفر الدالة أو اختلاف المخطط، سنسمح بالزيادة، وسيتم فحص المخزون في صفحة الدفع
    }
    updateQuantity(productId, currentQty + 1);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // كم
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // التقط موقع المستخدم وقدّر رسوم التوصيل مثل صفحة checkout
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return; // سنستخدم رسوم افتراضية
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {}
    })();
  }, []);

  // حساب رسوم التوصيل بناءً على المتجر والموقع
  useEffect(() => {
    (async () => {
      try {
        if (!storeId) return;
        const { data: merchant } = await supabase
          .from('merchants')
          .select('latitude, longitude')
          .eq('id', storeId)
          .single();
        if (merchant?.latitude && merchant?.longitude && currentLocation) {
          const distance = calculateDistance(merchant.latitude, merchant.longitude, currentLocation.latitude, currentLocation.longitude);
          const roundedKm = Math.ceil(distance);
          setDeliveryFee(Math.max(roundedKm * 10, 10));
        } else {
          setDeliveryFee(10);
        }
      } catch {
        setDeliveryFee(10);
      }
    })();
  }, [storeId, currentLocation]);

  // حساب عرض السعر (Quote) لإظهار الضريبة والخصم والمجموع الحقيقي
  useEffect(() => {
    (async () => {
      try {
        if (!storeId || cartItems.length === 0) { setQuote(null); return; }
        setQuoteLoading(true);
        const itemsPayload = cartItems.map(ci => ({ product_id: ci.id, price: ci.price, quantity: ci.quantity }));
        const adId = await getLastAdId();
        const { data, error } = await supabase.rpc('quote_order_v3', {
          p_customer_id: user?.id ?? null,
          p_store_id: storeId,
          p_items: itemsPayload,
          p_payment_method: 'cash',
          p_delivery_fee: deliveryFee,
          p_tax: 1.5,
          p_ad_id: adId,
        });
        if (error) throw error;
        const row = Array.isArray(data) && data[0] ? data[0] : null;
        if (row) {
          setQuote({
            subtotal: Number(row.subtotal) || 0,
            delivery_fee: Number(row.delivery_fee) || deliveryFee,
            service_fee: Number(row.service_fee) || 0,
            tax: Number(row.tax) || 0,
            discount: Number(row.discount) || 0,
            total: Number(row.total) || (getTotalPrice() + deliveryFee),
            apply_on: row.apply_on || null,
            applied_rule: row.applied_rule || null,
            applied_promotion: row.applied_promotion || null,
            applied_ad: row.applied_ad || null,
          });
        } else {
          setQuote(null);
        }
      } catch (e) {
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    })();
  }, [storeId, cartItems, deliveryFee, user?.id]);

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert('السلة فارغة', 'الرجاء إضافة منتجات إلى السلة قبل إتمام الطلب');
      return;
    }
    
    // Navigate to checkout screen
    router.push({
      pathname: '/checkout',
      params: {
        items: JSON.stringify(cartItems.map(ci => ({ id: ci.id, name: ci.name, price: ci.price, quantity: ci.quantity }))),
        merchantId: storeId || undefined,
      }
    });
  };

  const renderCartItem = ({ item }: { item: any }) => (
    <View style={styles.cartItem}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.itemImage} />
      ) : (
        <View style={[styles.itemImage, { backgroundColor: colors.lightGray }]} />
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemPrice}>{item.price} جنيه</Text>
      </View>
      <View style={styles.quantityContainer}>
        <TouchableOpacity 
          style={styles.quantityButton}
          onPress={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
        >
          <Minus size={16} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.quantityText}>{item.quantity}</Text>
        <TouchableOpacity 
          style={styles.quantityButton}
          onPress={() => handleIncrement(item.id, item.quantity)}
        >
          <Plus size={16} color={colors.text} />
        </TouchableOpacity>
      </View>
      <Text style={styles.itemTotal}>{(item.price * item.quantity).toFixed(2)} جنيه</Text>
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => removeItem(item.id)}
      >
        <Trash2 size={20} color={colors.error} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سلة التسوق</Text>
      </View>

      {/* Cart Items */}
      {cartItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>سلة التسوق فارغة</Text>
          <TouchableOpacity 
            style={styles.continueShoppingButton}
            onPress={() => router.push('/(tabs)/merchants')}
          >
            <Text style={styles.continueShoppingText}>متابعة التسوق</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cartItems}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.cartList}
            showsVerticalScrollIndicator={false}
          />

          {/* Order Summary */}
          <View style={styles.orderSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>عدد العناصر</Text>
              <Text style={styles.summaryValue}>{getTotalItems()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>المجموع الفرعي</Text>
              <Text style={styles.summaryValue}>{displaySubtotal.toFixed(2)} جنيه</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>سعر التوصيل</Text>
              <Text style={styles.summaryValue}>{displayDelivery.toFixed(2)} جنيه</Text>
            </View>
            {!!displayService && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>رسوم الخدمة</Text>
                <Text style={styles.summaryValue}>{displayService.toFixed(2)} جنيه</Text>
              </View>
            )}
            {!!quote && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>الضريبة</Text>
                <Text style={styles.summaryValue}>{displayTax.toFixed(2)} جنيه</Text>
              </View>
            )}
            {!!displayDiscount && displayDiscount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>الخصم</Text>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>{`- ${displayDiscount.toFixed(2)} جنيه`}</Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>المجموع الإجمالي</Text>
              <Text style={styles.totalValue}>{displayTotal.toFixed(2)} جنيه</Text>
            </View>
            {!!quote && !!(quote.applied_rule || quote.applied_promotion || quote.applied_ad) && (
              <Text style={styles.summaryCaption}>
                تم تطبيق عرض تلقائي لتحسين السعر
              </Text>
            )}
            
            <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
              <Text style={styles.checkoutText}>إتمام الطلب</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyText: {
    ...typography.h3,
    color: colors.textLight,
    marginBottom: spacing.lg,
  },
  continueShoppingButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  continueShoppingText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  cartList: {
    padding: spacing.md,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.lightGray,
    marginRight: spacing.md,
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
  orderSummary: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
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
    paddingTop: spacing.md,
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
  summaryCaption: {
    ...typography.small,
    color: colors.textLight,
    marginTop: spacing.xs,
    textAlign: 'left',
  },
  checkoutButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  checkoutText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
});