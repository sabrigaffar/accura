import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { ArrowLeft, Plus, Minus, Trash2 } from 'lucide-react-native';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
}

export default function CartScreen() {
  // Sample cart data - in a real app, this would come from context or state management
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      id: '1',
      name: 'برجر كلاسيك',
      price: 25.00,
      quantity: 2,
      image_url: 'https://images.pexels.com/photos/1633578/pexels-photo-1633578.jpeg',
    },
    {
      id: '2',
      name: 'بطاطس مقلية',
      price: 12.00,
      quantity: 1,
      image_url: 'https://images.pexels.com/photos/1596888/pexels-photo-1596888.jpeg',
    },
  ]);

  const updateQuantity = (id: string, change: number) => {
    setCartItems(prevItems => 
      prevItems.map(item => 
        item.id === id 
          ? { ...item, quantity: Math.max(0, item.quantity + change) }
          : item
      ).filter(item => item.quantity > 0)
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

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert('السلة فارغة', 'الرجاء إضافة منتجات إلى السلة قبل إتمام الطلب');
      return;
    }
    
    // Navigate to checkout screen
    router.push('/checkout');
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemImage} />
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
              <Text style={styles.summaryLabel}>سعر التوصيل</Text>
              <Text style={styles.summaryValue}>10.00 ريال</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>الضريبة</Text>
              <Text style={styles.summaryValue}>2.50 ريال</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>المجموع الإجمالي</Text>
              <Text style={styles.totalValue}>{(getTotalPrice() + 12.50).toFixed(2)} ريال</Text>
            </View>
            
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