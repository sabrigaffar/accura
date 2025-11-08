import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Package, Edit, Trash2, ToggleLeft, ToggleRight, Search } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useActiveStore } from '@/contexts/ActiveStoreContext';
import { StoreButton } from '@/components/StoreSelector';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  discount_price?: number;
  quantity: number;
  category: string;
  images: string[];
  is_active: boolean;
}

export default function MerchantProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { activeStore, stores, isAllStoresSelected } = useActiveStore();
  const [usingLegacyProducts, setUsingLegacyProducts] = useState(false);

  useEffect(() => {
    if (activeStore || isAllStoresSelected) {
      fetchProducts();
    }
  }, [activeStore, isAllStoresSelected]);

  const fetchProducts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (!activeStore && !isAllStoresSelected) return;

      let query = supabase
        .from('products')
        .select('*')
        .eq('merchant_id', user.id);

      if (isAllStoresSelected && stores.length > 0) {
        // جلب منتجات جميع المتاجر
        const storeIds = stores.map(s => s.id);
        const { data, error } = await query.in('store_id', storeIds).order('created_at', { ascending: false });
        if (error) {
          if ((error as any).code === 'PGRST205') {
            // الجدول products غير موجود -> استخدم الجدول القديم merchant_products
            const { data: legacyData, error: legacyErr } = await supabase
              .from('merchant_products')
              .select('*')
              .in('merchant_id', storeIds)
              .order('created_at', { ascending: false });
            if (legacyErr) throw legacyErr;
            setUsingLegacyProducts(true);
            setProducts(normalizeLegacyProducts(legacyData || []));
          } else {
            throw error;
          }
        } else {
          setUsingLegacyProducts(false);
          setProducts(data || []);
        }
      } else if (activeStore) {
        // تصفية حسب المتجر النشط
        const { data, error } = await query.eq('store_id', activeStore.id).order('created_at', { ascending: false });

        if (error && error.code === '42703') {
          // العمود store_id غير موجود
          const fallback = await supabase
            .from('products')
            .select('*')
            .eq('merchant_id', user.id)
            .order('created_at', { ascending: false });
          setProducts(fallback.data || []);
        } else if (error) {
          if ((error as any).code === 'PGRST205') {
            // الجدول products غير موجود -> استخدم الجدول القديم merchant_products
            const { data: legacyData, error: legacyErr } = await supabase
              .from('merchant_products')
              .select('*')
              .eq('merchant_id', activeStore.id)
              .order('created_at', { ascending: false });
            if (legacyErr) throw legacyErr;
            setUsingLegacyProducts(true);
            setProducts(normalizeLegacyProducts(legacyData || []));
          } else {
            throw error;
          }
        } else {
          setProducts(data || []);
        }
      }
    } catch (error: any) {
      console.error('Error fetching products:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل المنتجات');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  const toggleProductStatus = async (productId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !currentStatus })
        .eq('id', productId);

      if (error) {
        if ((error as any).code === 'PGRST205') {
          const { error: legacyErr } = await supabase
            .from('merchant_products')
            .update({ is_available: !currentStatus })
            .eq('id', productId);
          if (legacyErr) throw legacyErr;
        } else {
          throw error;
        }
      }
      
      fetchProducts();
      Alert.alert('تم', `تم ${!currentStatus ? 'تفعيل' : 'تعطيل'} المنتج بنجاح`);
    } catch (error: any) {
      Alert.alert('خطأ', 'حدث خطأ أثناء تحديث حالة المنتج');
    }
  };

  const deleteProduct = async (productId: string, productName: string) => {
    Alert.alert(
      'تأكيد الحذف',
      `هل أنت متأكد من حذف "${productName}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', productId);

              if (error) {
                if ((error as any).code === 'PGRST205') {
                  const { error: legacyErr } = await supabase
                    .from('merchant_products')
                    .delete()
                    .eq('id', productId);
                  if (legacyErr) throw legacyErr;
                } else {
                  throw error;
                }
              }
              
              fetchProducts();
              Alert.alert('تم', 'تم حذف المنتج بنجاح');
            } catch (error: any) {
              Alert.alert('خطأ', 'حدث خطأ أثناء حذف المنتج');
            }
          }
        }
      ]
    );
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderProduct = (product: Product) => (
    <View key={product.id} style={styles.productCard}>
      <View style={styles.productHeader}>
        <View style={styles.productInfo}>
          {product.images && product.images.length > 0 ? (
            <Image source={{ uri: product.images[0] }} style={styles.productImage} />
          ) : (
            <View style={[styles.productImage, styles.placeholderImage]}>
              <Package size={32} color={colors.textLight} />
            </View>
          )}
          <View style={styles.productDetails}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productCategory}>{product.category || 'غير مصنف'}</Text>
            <View style={styles.priceContainer}>
              {product.discount_price ? (
                <>
                  <Text style={styles.discountPrice}>{product.discount_price} جنيه</Text>
                  <Text style={styles.originalPrice}>{product.price} جنيه</Text>
                </>
              ) : (
                <Text style={styles.price}>{product.price} جنيه</Text>
              )}
            </View>
            <Text style={styles.quantity}>الكمية: {product.quantity}</Text>
          </View>
        </View>
        <View style={styles.productActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => toggleProductStatus(product.id, product.is_active)}
          >
            {product.is_active ? (
              <ToggleRight size={24} color={colors.success} />
            ) : (
              <ToggleLeft size={24} color={colors.textLight} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/merchant/edit-product/${product.id}` as any)}
          >
            <Edit size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => deleteProduct(product.id, product.name)}
          >
            <Trash2 size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
      {!product.is_active && (
        <View style={styles.inactiveBadge}>
          <Text style={styles.inactiveBadgeText}>معطل</Text>
        </View>
      )}
    </View>
  );

  // تحويل بيانات legacy merchant_products إلى الشكل القياسي لواجهة المستخدم
  function normalizeLegacyProducts(rows: any[]): Product[] {
    return (rows || []).map((r: any) => ({
      id: r.id,
      name: r.name_ar || r.name_en || 'منتج',
      description: r.description_ar || r.description_en || '',
      price: Number(r.price || 0),
      discount_price: undefined,
      quantity: Number(r.stock ?? r.available_quantity ?? r.quantity ?? r.qty ?? 0),
      category: r.category || '',
      images: r.image_url ? [r.image_url] : [],
      is_active: r.is_available !== false,
    }));
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>منتجاتي ({products.length})</Text>
          <StoreButton />
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => router.push('/merchant/add-product' as any)}
        >
          <Plus size={20} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color={colors.textLight} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="ابحث عن منتج..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Package size={64} color={colors.textLight} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'لا توجد نتائج' : 'لا توجد منتجات بعد'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery ? 'جرب كلمات بحث أخرى' : 'ابدأ بإضافة منتجاتك الأولى'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => router.push('/merchant/add-product' as any)}
              >
                <Text style={styles.emptyButtonText}>إضافة منتج</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredProducts.map(renderProduct)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  productCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
  },
  placeholderImage: {
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  productCategory: {
    ...typography.caption,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  price: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
  discountPrice: {
    ...typography.bodyMedium,
    color: colors.error,
    fontWeight: '600',
    marginRight: spacing.sm,
  },
  originalPrice: {
    ...typography.caption,
    color: colors.textLight,
    textDecorationLine: 'line-through',
  },
  quantity: {
    ...typography.caption,
    color: colors.textLight,
  },
  productActions: {
    justifyContent: 'space-around',
    marginLeft: spacing.sm,
  },
  actionButton: {
    padding: spacing.sm,
  },
  inactiveBadge: {
    backgroundColor: colors.error + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  inactiveBadgeText: {
    ...typography.caption,
    color: colors.error,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
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
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.lg,
  },
  emptyButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
});
