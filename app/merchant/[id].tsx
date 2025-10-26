import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { ArrowLeft, Star, Clock, ShoppingCart } from 'lucide-react-native';

interface Merchant {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  category: string;
  logo_url: string;
  banner_url: string;
  rating: number;
  total_reviews: number;
  avg_delivery_time: number;
  min_order_amount: number;
  delivery_fee: number;
  is_open: boolean;
  address: string;
  is_active: boolean;
}

interface Product {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  price: number;
  image_url: string;
  is_available: boolean;
  preparation_time: number;
}

export default function MerchantDetailScreen() {
  const { id } = useLocalSearchParams();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{[key: string]: number}>({});

  useEffect(() => {
    if (id) {
      fetchMerchantData();
      fetchMerchantProducts();
    }
  }, [id]);

  const fetchMerchantData = async () => {
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setMerchant(data);
    } catch (error) {
      console.error('Error fetching merchant:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل بيانات المتجر');
    }
  };

  const fetchMerchantProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('merchant_products')
        .select('*')
        .eq('merchant_id', id)
        .eq('is_available', true);

      if (error) throw error;
      setProducts(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching products:', error);
      setLoading(false);
    }
  };

  const addToCart = (productId: string) => {
    setCart(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[productId] > 1) {
        newCart[productId] -= 1;
      } else {
        delete newCart[productId];
      }
      return newCart;
    });
  };

  const getTotalItems = () => {
    return Object.values(cart).reduce((sum, count) => sum + count, 0);
  };

  const getTotalPrice = () => {
    return Object.entries(cart).reduce((sum, [productId, count]) => {
      const product = products.find(p => p.id === productId);
      return sum + (product ? product.price * count : 0);
    }, 0);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>جاري تحميل المتجر...</Text>
      </View>
    );
  }

  if (!merchant) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>المتجر غير موجود</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.headerOverlay} />
          {merchant.banner_url ? (
            <Image source={{ uri: merchant.banner_url }} style={styles.banner} />
          ) : (
            <View style={[styles.banner, styles.placeholderBanner]} />
          )}
        </View>

        {/* Merchant Info */}
        <View style={styles.merchantInfo}>
          <View style={styles.merchantLogoContainer}>
            {merchant.logo_url ? (
              <Image source={{ uri: merchant.logo_url }} style={styles.merchantLogo} />
            ) : (
              <View style={[styles.merchantLogo, styles.placeholderLogo]} />
            )}
          </View>
          
          <Text style={styles.merchantName}>{merchant.name_ar}</Text>
          <Text style={styles.merchantDescription}>{merchant.description_ar}</Text>
          
          <View style={styles.merchantStats}>
            <View style={styles.statItem}>
              <Star size={16} color={colors.textLight} />
              <Text style={styles.statText}>{merchant.rating} ({merchant.total_reviews})</Text>
            </View>
            <View style={styles.statItem}>
              <Clock size={16} color={colors.textLight} />
              <Text style={styles.statText}>{merchant.avg_delivery_time} دقيقة</Text>
            </View>
          </View>
          
          <View style={styles.deliveryInfo}>
            <Text style={styles.deliveryText}>
              {merchant.delivery_fee > 0 
                ? `توصيل ${merchant.delivery_fee} ريال` 
                : 'توصيل مجاني'}
            </Text>
            <Text style={styles.minOrderText}>
              الحد الأدنى للطلب: {merchant.min_order_amount} ريال
            </Text>
          </View>
          
          {!merchant.is_open && (
            <View style={styles.closedBadge}>
              <Text style={styles.closedText}>المتجر مغلق حالياً</Text>
            </View>
          )}
        </View>

        {/* Products Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>المنتجات</Text>
          {products.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>لا توجد منتجات متاحة حالياً</Text>
            </View>
          ) : (
            <FlatList
              data={products}
              renderItem={({ item }) => (
                <View style={styles.productCard}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.productImage} />
                  ) : (
                    <View style={[styles.productImage, styles.placeholderImage]} />
                  )}
                  
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{item.name_ar}</Text>
                    <Text style={styles.productDescription} numberOfLines={2}>
                      {item.description_ar}
                    </Text>
                    <Text style={styles.productPrice}>{item.price} ريال</Text>
                    
                    <View style={styles.productActions}>
                      {cart[item.id] ? (
                        <View style={styles.quantityContainer}>
                          <TouchableOpacity 
                            style={styles.quantityButton}
                            onPress={() => removeFromCart(item.id)}
                          >
                            <Text style={styles.quantityButtonText}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.quantityText}>{cart[item.id]}</Text>
                          <TouchableOpacity 
                            style={styles.quantityButton}
                            onPress={() => addToCart(item.id)}
                          >
                            <Text style={styles.quantityButtonText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity 
                          style={styles.addButton}
                          onPress={() => addToCart(item.id)}
                          disabled={!merchant.is_open}
                        >
                          <Text style={styles.addButtonText}>إضافة</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              )}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>

      {/* Cart Footer */}
      {getTotalItems() > 0 && (
        <View style={styles.cartFooter}>
          <View style={styles.cartInfo}>
            <Text style={styles.cartItems}>{getTotalItems()} عناصر</Text>
            <Text style={styles.cartTotal}>{getTotalPrice()} ريال</Text>
          </View>
          <TouchableOpacity 
            style={styles.checkoutButton}
            onPress={() => {
              const itemsForCheckout = Object.entries(cart).map(([productId, quantity]) => {
                const product = products.find(p => p.id === productId);
                return {
                  id: productId,
                  name: product?.name_ar || '',
                  price: product?.price || 0,
                  quantity,
                };
              });
              router.push({
                pathname: '/checkout',
                params: {
                  items: JSON.stringify(itemsForCheckout),
                  merchantId: String(id),
                },
              });
            }}
          >
            <ShoppingCart size={20} color={colors.white} />
            <Text style={styles.checkoutText}>إتمام الطلب</Text>
          </TouchableOpacity>
        </View>
      )}
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
  content: {
    flex: 1,
  },
  header: {
    height: 200,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
    backgroundColor: colors.black + '40',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.black,
    opacity: 0.3,
  },
  banner: {
    width: '100%',
    height: '100%',
  },
  placeholderBanner: {
    backgroundColor: colors.lightGray,
  },
  merchantInfo: {
    backgroundColor: colors.white,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.small,
    alignItems: 'center',
    marginTop: -60,
  },
  merchantLogoContainer: {
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
  },
  merchantLogo: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
  },
  placeholderLogo: {
    backgroundColor: colors.lightGray,
  },
  merchantName: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  merchantDescription: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
    marginVertical: spacing.sm,
    lineHeight: 20,
  },
  merchantStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginVertical: spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statText: {
    ...typography.body,
    color: colors.text,
  },
  deliveryInfo: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginVertical: spacing.sm,
  },
  deliveryText: {
    ...typography.body,
    color: colors.primary,
  },
  minOrderText: {
    ...typography.body,
    color: colors.textLight,
  },
  closedBadge: {
    backgroundColor: colors.error + '20',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  closedText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
  },
  section: {
    margin: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  productCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    ...shadows.small,
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.sm,
  },
  placeholderImage: {
    backgroundColor: colors.lightGray,
  },
  productInfo: {
    flex: 1,
    padding: spacing.md,
  },
  productName: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  productDescription: {
    ...typography.small,
    color: colors.textLight,
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  productPrice: {
    ...typography.bodyMedium,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  productActions: {
    alignItems: 'flex-start',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
  },
  quantityButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    ...typography.body,
    color: colors.primary,
  },
  quantityText: {
    ...typography.body,
    color: colors.text,
    marginHorizontal: spacing.sm,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  addButtonText: {
    ...typography.body,
    color: colors.white,
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textLight,
  },
  cartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.small,
  },
  cartInfo: {
    flex: 1,
  },
  cartItems: {
    ...typography.body,
    color: colors.textLight,
  },
  cartTotal: {
    ...typography.h3,
    color: colors.text,
  },
  checkoutButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  checkoutText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  backButtonText: {
    ...typography.body,
    color: colors.primary,
  },
});