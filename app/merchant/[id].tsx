import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { ArrowLeft, Star, Clock, ShoppingCart, X } from 'lucide-react-native';
// @ts-ignore ensure to install: expo install react-native-webview
import { WebView } from 'react-native-webview';

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
  menu_url?: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  discount_price?: number;
  quantity: number;
  has_quantity?: boolean;
  category?: string;
  images?: string[];
  is_active: boolean;
}

export default function MerchantDetailScreen() {
  const params = useLocalSearchParams<{ id?: string; highlightProductId?: string }>();
  const id = params.id;
  const merchantId = Array.isArray(id) ? id[0] : id;
  const highlightFromParam = params.highlightProductId && !Array.isArray(params.highlightProductId)
    ? params.highlightProductId
    : undefined;
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem, updateQuantity, removeItem, items, storeId, getTotalItems, getTotalPrice, clearCart, canAddToStore } = useCart();
  const listRef = useRef<any>(null);
  const [highlightId, setHighlightId] = useState<string | undefined>(highlightFromParam);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [note, setNote] = useState<string>('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuImages, setMenuImages] = useState<string[]>([]);
  const [menuImageIndex, setMenuImageIndex] = useState(0);

  useEffect(() => {
    if (merchantId) {
      fetchMerchantData();
      // fetchMerchantProducts سيتم استدعاؤها من داخل fetchMerchantData
    }
  }, [merchantId]);

  const fetchMerchantData = async () => {
    try {
      if (!merchantId) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', merchantId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        // قد يكون المتجر غير نشط أو غير موجود أو محجوب بسياسات RLS
        setMerchant(null);
        setLoading(false);
        return;
      }
      setMerchant(data);
      // Fetch menu images (multiple)
      try {
        const { data: imgs, error: imgsErr } = await supabase
          .from('merchant_menu_images')
          .select('image_url, sort_order')
          .eq('merchant_id', data.id)
          .order('sort_order', { ascending: true });
        if (!imgsErr) {
          setMenuImages((imgs || []).map((r: any) => r.image_url));
        }
      } catch {}
      
      // جلب المنتجات باستخدام store_id (معرف المتجر الفعلي)
      if (data?.id) {
        fetchMerchantProducts(data.id);
      }
    } catch (error) {
      console.error('Error fetching merchant:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل بيانات المتجر');
    }
  };

  const openMenu = async (startIndex: number = 0) => {
    // افتح المودال دائماً: PDF عبر WebView، الصور عبر WebView قابل للتكبير
    if (menuImages.length > 0) {
      setMenuImageIndex(Math.max(0, Math.min(startIndex, menuImages.length - 1)));
      setMenuVisible(true);
      return;
    }
    // لا يوجد صور متعددة، جرّب menu_url كصورة
    if (merchant?.menu_url) {
      if (/\.pdf($|\?)/i.test(merchant.menu_url)) {
        setMenuVisible(true);
      } else {
        setMenuImages([merchant.menu_url]);
        setMenuImageIndex(0);
        setMenuVisible(true);
      }
    }
  };

  const fetchMerchantProducts = async (storeId: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)  // استخدام store_id لجلب منتجات المتجر المحدد فقط
        .eq('is_active', true);

      if (error) {
        if ((error as any).code === 'PGRST205') {
          // الجدول products غير موجود -> استخدم الجدول القديم merchant_products
          const { data: legacyData, error: legacyErr } = await supabase
            .from('merchant_products')
            .select('*')
            .eq('merchant_id', storeId)
            .eq('is_available', true);
          if (legacyErr) throw legacyErr;
          setProducts((legacyData || []).map((r: any) => {
            const qtyKeys = [
              'stock',
              'available_quantity',
              'available_qty',
              'qty_available',
              'quantity_available',
              'quantity',
              'qty',
              'in_stock',
              'inventory',
              'inventory_count',
              'count'
            ];
            let rawQty: any = null;
            for (const k of qtyKeys) {
              if (r[k] !== undefined && r[k] !== null) { rawQty = r[k]; break; }
            }
            const qtyVal = rawQty !== null ? Number(rawQty) : 0;
            const normalizedHasQty = rawQty !== null && !Number.isNaN(qtyVal) && qtyVal !== 999;
            return {
              id: r.id,
              name: r.name_ar || r.name_en || 'منتج',
              description: r.description_ar || r.description_en || '',
              price: Number(r.price || 0),
              discount_price: undefined,
              quantity: normalizedHasQty ? qtyVal : 0,
              has_quantity: normalizedHasQty,
              category: r.category || '',
              images: r.image_url ? [r.image_url] : [],
              is_active: r.is_available !== false,
            } as Product;
          }));
        } else {
          throw error;
        }
      } else {
        // products schema: عيّن has_quantity وحقول الصور بشكل صريح مع التعرّف على مفاتيح متعددة للكمية
        setProducts((data || []).map((r: any) => {
          const qtyKeys = [
            'quantity',
            'stock',
            'available_quantity',
            'available_qty',
            'qty_available',
            'quantity_available'
          ];
          let rawQty: any = null;
          for (const k of qtyKeys) {
            if (r[k] !== undefined && r[k] !== null) { rawQty = r[k]; break; }
          }
          const qtyVal = rawQty !== null ? Number(rawQty) : 0;
          const normalizedHasQty = rawQty !== null && !Number.isNaN(qtyVal) && qtyVal !== 999;
          return {
            id: r.id,
            name: r.name || r.name_ar || r.name_en || 'منتج',
            description: r.description || r.description_ar || r.description_en || '',
            price: Number(r.price || 0),
            discount_price: r.discount_price ?? undefined,
            quantity: normalizedHasQty ? qtyVal : 0,
            has_quantity: normalizedHasQty,
            category: r.category || '',
            images: Array.isArray(r.images) ? r.images : (r.image_url ? [r.image_url] : []),
            is_active: r.is_active !== false,
          } as Product;
        }));
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching products:', error);
      setLoading(false);
    }
  };

  // إبراز المنتج عند فتح الصفحة من نتيجة البحث
  useEffect(() => {
    if (!highlightId) return;
    // إزالة الإبراز بعد 4 ثوانٍ
    const t = setTimeout(() => setHighlightId(undefined), 4000);
    return () => clearTimeout(t);
  }, [highlightId]);

  const openOptions = (productId: string) => {
    const p = products.find(pp => pp.id === productId);
    if (p && p.has_quantity && (Number(p.quantity) || 0) <= 0) {
      Alert.alert('نفذ المخزون', 'عذراً، هذا المنتج غير متوفر حالياً');
      return;
    }
    setSelectedProductId(productId);
    setSelectedQty(1);
    setNote('');
    setOptionsVisible(true);
  };

  const confirmAddWithOptions = async () => {
    if (!selectedProductId) return;
    const product = products.find(p => p.id === selectedProductId);
    if (!product) { setOptionsVisible(false); return; }
    const targetStore = String(merchantId);
    // تحقق من المخزون قبل الإضافة
    if (product.has_quantity) {
      const available = Number(product.quantity) || 0;
      if (available <= 0) {
        Alert.alert('نفذ المخزون', 'عذراً، هذا المنتج غير متوفر حالياً');
        return;
      }
      if (selectedQty > available) {
        Alert.alert('كمية غير متاحة', `الكمية المتاحة: ${available}`);
        return;
      }
    }
    const doAdd = () => {
      addItem({
        productId: product.id,
        storeId: targetStore,
        name: product.name, // ملاحظة يمكن ضم note للاسم مستقبلاً
        price: Number(product.discount_price ?? product.price ?? 0),
        imageUrl: Array.isArray(product.images) ? (product.images[0] || null) : undefined,
      }, selectedQty);
      setOptionsVisible(false);
    };
    if (!canAddToStore(targetStore) && getTotalItems() > 0) {
      Alert.alert(
        'تغيير المتجر',
        'لديك عناصر في السلة من متجر آخر. هل تريد مسح السلة والبدء بمتجر جديد؟',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'مسح السلة والمتابعة', style: 'destructive', onPress: () => { clearCart(); setTimeout(doAdd, 50); } },
        ]
      );
    } else {
      doAdd();
    }
  };

  const incQty = (productId: string) => {
    const current = items.find(i => i.productId === productId)?.quantity || 0;
    const product = products.find(p => p.id === productId);
    const next = current + 1;
    if (product && product.has_quantity) {
      const available = Number(product.quantity) || 0;
      if (next > available) {
        Alert.alert('كمية غير متاحة', `لا يمكن إضافة أكثر من ${available} من هذا المنتج`);
        return;
      }
    }
    updateQuantity(productId, next);
  };
  const decQty = (productId: string) => {
    const current = items.find(i => i.productId === productId)?.quantity || 0;
    if (current <= 1) {
      removeItem(productId);
    } else {
      updateQuantity(productId, current - 1);
    }
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

  // المنتج المحدد لواجهة الخيارات
  const selectedProduct = selectedProductId ? products.find(p => p.id === selectedProductId) : undefined;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
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
                ? `توصيل ${merchant.delivery_fee} جنيه` 
                : 'توصيل مجاني'}
              •  
              الحد الأدنى للطلب: {merchant.min_order_amount} جنيه
            </Text>
          </View>

          {(merchant.menu_url || menuImages.length > 0) ? (
            <TouchableOpacity style={styles.menuButton} onPress={() => openMenu(0)}>
              <Text style={styles.menuButtonText}>عرض المنيو</Text>
            </TouchableOpacity>
          ) : null}
          {/* معاينة مصغرة لأول صفحة من PDF (رابط عام) */}
          {merchant.menu_url && /\.pdf($|\?)/i.test(merchant.menu_url) && /^https?:\/\//i.test(merchant.menu_url) && (
            <View style={{ height: 180, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, overflow: 'hidden', marginTop: spacing.sm, alignSelf: 'stretch' }}>
              <WebView
                source={{ uri: `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(merchant.menu_url)}` }}
                style={{ flex: 1, backgroundColor: colors.lightGray }}
              />
            </View>
          )}
          
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
              ref={listRef}
              data={products}
              renderItem={({ item }) => (
                <View style={[
                  styles.productCard,
                  highlightId === item.id && styles.highlightProduct,
                  (item.has_quantity && (Number(item.quantity) || 0) <= 0) && styles.productCardDisabled
                ]}>
                  <View style={styles.productImageWrapper}>
                    {item.images && item.images.length > 0 ? (
                      <Image source={{ uri: item.images[0] }} style={styles.productImage} />
                    ) : (
                      <View style={[styles.productImage, styles.placeholderImage]} />
                    )}
                    {(item.has_quantity && (Number(item.quantity) || 0) <= 0) && (
                      <View style={styles.stockBadge}>
                        <Text style={styles.stockBadgeText}>نفذ المخزون</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{item.name}</Text>
                    <Text style={styles.productDescription} numberOfLines={2}>
                      {item.description || 'لا يوجد وصف'}
                    </Text>
                    <Text style={styles.productPrice}>
                      {item.discount_price ? (
                        <>
                          <Text style={styles.discountPrice}>{item.discount_price} جنيه</Text>
                          {' '}
                          <Text style={styles.originalPrice}>{item.price} جنيه</Text>
                        </>
                      ) : (
                        `${item.price} جنيه`
                      )}
                    </Text>
                    {item.has_quantity ? (
                      <Text style={styles.stockText}>
                        متوفر: {item.quantity} قطعة
                      </Text>
                    ) : (
                      <Text style={styles.stockText}>
                        {item.is_active ? 'متوفر' : 'غير متوفر'}
                      </Text>
                    )}
                    
                    <View style={styles.productActions}>
                      {items.find(i => i.productId === item.id) ? (
                        <View style={styles.quantityContainer}>
                          <TouchableOpacity 
                            style={styles.quantityButton}
                            onPress={() => decQty(item.id)}
                          >
                            <Text style={styles.quantityButtonText}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.quantityText}>{items.find(i => i.productId === item.id)?.quantity || 0}</Text>
                          <TouchableOpacity 
                            style={[styles.quantityButton]}
                            onPress={() => incQty(item.id)}
                            disabled={item.has_quantity && (items.find(i => i.productId === item.id)?.quantity || 0) >= (Number(item.quantity) || 0)}
                          >
                            <Text style={styles.quantityButtonText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity 
                          style={[
                            styles.addButton,
                            (item.has_quantity && (Number(item.quantity) || 0) <= 0) && styles.addButtonDisabled
                          ]}
                          onPress={() => openOptions(item.id)}
                          disabled={!merchant.is_open || (item.has_quantity && (Number(item.quantity) || 0) <= 0)}
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

      {/* Floating Cart Button */}
      {getTotalItems() > 0 && storeId === String(merchantId) && (
        <TouchableOpacity
          style={styles.fabCart}
          onPress={() => router.push('/cart')}
          activeOpacity={0.85}
        >
          <ShoppingCart size={20} color={'#FFFFFF'} />
          <Text style={styles.fabCartText}>السلة</Text>
          <View style={styles.fabBadge}>
            <Text style={styles.fabBadgeText}>{getTotalItems() > 99 ? '99+' : String(getTotalItems())}</Text>
          </View>
        </TouchableOpacity>
      )}
      {/* Options Modal */}
      <Modal visible={optionsVisible} transparent animationType="fade" onRequestClose={() => setOptionsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تحديد الكمية</Text>
            <View style={styles.modalQtyRow}>
              <TouchableOpacity style={styles.modalQtyBtn} onPress={() => setSelectedQty(q => Math.max(1, q - 1))}>
                <Text style={styles.modalQtyBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.modalQtyText}>{selectedQty}</Text>
              <TouchableOpacity style={styles.modalQtyBtn} onPress={() => setSelectedQty(q => {
                const available = (selectedProduct && selectedProduct.has_quantity) ? (Number(selectedProduct.quantity) || 0) : Number.MAX_SAFE_INTEGER;
                return Math.min(available, q + 1);
              })}>
                <Text style={styles.modalQtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            {selectedProduct?.has_quantity && (
              <Text style={[styles.modalLabel, { color: colors.textLight }]}>
                المتاح: {Number(selectedProduct.quantity) || 0}
              </Text>
            )}
            <Text style={styles.modalLabel}>ملاحظات (اختياري)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="مثال: بدون بصل..."
              value={note}
              onChangeText={setNote}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setOptionsVisible(false)}>
                <Text style={styles.modalBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalConfirm]} onPress={confirmAddWithOptions}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>إضافة للسلة</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Menu Modal (image/PDF) */}
      <Modal visible={menuVisible} animationType="fade" transparent onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.menuModalContainer}>
          <TouchableOpacity style={styles.menuClose} onPress={() => setMenuVisible(false)}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          {merchant?.menu_url && /\.pdf($|\?)/i.test(merchant.menu_url) && menuImages.length === 0 ? (
            <WebView
              source={{ uri: `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(merchant.menu_url)}` }}
              style={{ width: '100%', height: '85%', backgroundColor: colors.lightGray }}
            />
          ) : (
            <>
              {/* عرض الصور مع قابلية التكبير عبر WebView */}
              {menuImages.length > 0 ? (
                <View style={{ width: '100%', height: '85%' }}>
                  <WebView
                    originWhitelist={["*"]}
                    source={{ html: `<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, user-scalable=yes, maximum-scale=5\"></head><body style=\"margin:0;background:#111;display:flex;align-items:center;justify-content:center;height:100vh;\"><img src=\"${menuImages[menuImageIndex]}\" style=\"max-width:100%;max-height:100%\" /></body></html>` }}
                    style={{ flex: 1, backgroundColor: '#111' }}
                  />
                  {menuImages.length > 1 && (
                    <>
                      <TouchableOpacity style={styles.navLeft} onPress={() => setMenuImageIndex(i => (i - 1 + menuImages.length) % menuImages.length)} />
                      <TouchableOpacity style={styles.navRight} onPress={() => setMenuImageIndex(i => (i + 1) % menuImages.length)} />
                      <View style={styles.pagerDots}>
                        {menuImages.map((_, i) => (
                          <View key={i} style={[styles.dot, i === menuImageIndex && styles.dotActive]} />
                        ))}
                      </View>
                    </>
                  )}
                </View>
              ) : merchant?.menu_url ? (
                <WebView
                  originWhitelist={["*"]}
                  source={{ html: `<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, user-scalable=yes, maximum-scale=5\"></head><body style=\"margin:0;background:#111;display:flex;align-items:center;justify-content:center;height:100vh;\"><img src=\"${merchant.menu_url}\" style=\"max-width:100%;max-height:100%\" /></body></html>` }}
                  style={{ width: '100%', height: '85%', backgroundColor: '#111' }}
                />
              ) : null}
            </>
          )}
        </View>
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
    backgroundColor: colors.error + '10',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  closedText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
  },
  menuButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    alignSelf: 'center',
  },
  menuButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
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
  productCardDisabled: {
    opacity: 0.55,
  },
  productImageWrapper: {
    position: 'relative',
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.sm,
  },
  placeholderImage: {
    backgroundColor: colors.lightGray,
  },
  stockBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  stockBadgeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
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
    marginBottom: spacing.xs,
  },
  stockText: {
    ...typography.small,
    color: colors.textLight,
    marginBottom: spacing.sm,
  },
  discountPrice: {
    ...typography.bodyMedium,
    color: colors.error,
    fontWeight: 'bold',
  },
  originalPrice: {
    ...typography.small,
    color: colors.textLight,
    textDecorationLine: 'line-through',
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
  addButtonDisabled: {
    backgroundColor: colors.textLight + '40',
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
  highlightProduct: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: '#FFF8E1',
  },
  fabCart: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    ...shadows.small,
  },
  fabCartText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginHorizontal: spacing.sm,
  },
  fabBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  fabBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  modalQtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalQtyBtnText: {
    ...typography.h3,
    color: colors.text,
  },
  modalQtyText: {
    ...typography.h3,
    color: colors.text,
  },
  modalLabel: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  modalInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalCancel: {
    backgroundColor: colors.lightGray,
  },
  modalConfirm: {
    backgroundColor: colors.primary,
  },
  modalBtnText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  menuModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  navLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '25%',
  },
  navRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '25%',
  },
  pagerDots: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#fff',
  },
  menuImage: {
    width: '100%',
    height: '80%',
    borderRadius: borderRadius.md,
  },
  menuClose: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.xl,
    padding: spacing.sm,
  },
  backButtonText: {
    ...typography.body,
    color: colors.primary,
  },
});