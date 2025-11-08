import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Image as ImageIcon, Calendar } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useActiveStore } from '@/contexts/ActiveStoreContext';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { uploadSingleImage } from '@/lib/imageUpload';

interface ProductLite {
  id: string;
  name?: string;
  name_ar?: string;
  name_en?: string;
}

const AD_TYPES = [
  { id: 'banner', label: 'بانر كبير', description: 'يظهر في أعلى الصفحة الرئيسية', icon: '🎯', color: '#FF6B6B' },
  { id: 'story', label: 'قصة', description: 'دائرة ملونة بين القصص', icon: '⭕', color: '#4ECDC4' },
  { id: 'featured', label: 'مميز', description: 'في قسم المتاجر المميزة', icon: '⭐', color: '#FFD700' },
];

export default function CreateAdScreen() {
  const { activeStore } = useActiveStore();
  const { user } = useAuth();
  const [adType, setAdType] = useState<'banner' | 'story' | 'featured'>('banner');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [budget, setBudget] = useState('1000');
  const [duration, setDuration] = useState('30');
  const [priority, setPriority] = useState('5');
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  // Offer fields
  const [offerEnabled, setOfferEnabled] = useState(true);
  const [offerType, setOfferType] = useState<'percent' | 'flat'>('percent');
  const [applyOn, setApplyOn] = useState<'subtotal' | 'delivery_fee' | 'service_fee' | 'product'>('subtotal');
  const [discountValue, setDiscountValue] = useState('20');
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Fetch wallet balance
  useEffect(() => {
    if (activeStore && user) {
      fetchWalletBalance();
    }
  }, [activeStore, user]);

  // Fetch products for this store for product-targeted offers
  useEffect(() => {
    const load = async () => {
      if (!activeStore) return;
      try {
        setLoadingProducts(true);
        const { data, error } = await supabase
          .from('products')
          .select('id, name, name_ar, name_en')
          .eq('store_id', activeStore.id)
          .eq('is_active', true);
        if (error) {
          if ((error as any).code === 'PGRST205') {
            const { data: legacyData, error: legacyErr } = await supabase
              .from('merchant_products')
              .select('id, name_ar, name_en')
              .eq('merchant_id', activeStore.id)
              .eq('is_available', true);
            if (legacyErr) throw legacyErr;
            setProducts((legacyData || []) as any);
          } else {
            throw error;
          }
        } else {
          setProducts((data || []) as any);
        }
      } catch (e) {
        console.error('Error loading products for offers', e);
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };
    load();
  }, [activeStore]);

  const fetchWalletBalance = async () => {
    if (!activeStore || !user) return;
    
    try {
      setLoadingBalance(true);
      console.log('💳 [Create Ad] Fetching wallet for user:', user.id);
      
      // Fetch USER wallet (shared across all stores)
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('owner_id', user.id)
        .eq('owner_type', 'merchant')
        .single();

      if (error) {
        console.log('💳 [Create Ad] Wallet error:', error);
        throw error;
      }
      
      console.log('💳 [Create Ad] User wallet balance:', data?.balance || 0);
      setWalletBalance(data?.balance || 0);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      setWalletBalance(0);
    } finally {
      setLoadingBalance(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('خطأ', 'نحتاج إلى إذن للوصول إلى الصور');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: adType === 'banner' ? [16, 9] : [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        try {
          const uploadedUrl = await uploadSingleImage(result.assets[0].uri, 'sponsored-ads');
          if (uploadedUrl) {
            setImageUrl(uploadedUrl);
            Alert.alert('✅ تم', 'تم رفع الصورة بنجاح');
          } else {
            Alert.alert('خطأ', 'فشل رفع الصورة');
          }
        } catch (error) {
          Alert.alert('خطأ', 'فشل رفع الصورة');
        } finally {
          setUploading(false);
        }
      }
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء اختيار الصورة');
      setUploading(false);
    }
  };

  const validateForm = () => {
    if (!title.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال عنوان الإعلان');
      return false;
    }
    if (!imageUrl) {
      Alert.alert('خطأ', 'الرجاء رفع صورة الإعلان');
      return false;
    }
    if (!budget || parseFloat(budget) <= 0) {
      Alert.alert('خطأ', 'الرجاء إدخال ميزانية صحيحة');
      return false;
    }
    if (!duration || parseInt(duration) <= 0) {
      Alert.alert('خطأ', 'الرجاء إدخال مدة صحيحة');
      return false;
    }
    if (offerEnabled) {
      if (!discountValue || isNaN(Number(discountValue)) || Number(discountValue) <= 0) {
        Alert.alert('خطأ', 'الرجاء إدخال قيمة خصم صحيحة');
        return false;
      }
      if (offerType === 'percent' && Number(discountValue) > 100) {
        Alert.alert('خطأ', 'أقصى نسبة خصم 100%');
        return false;
      }
      if (applyOn === 'product' && !selectedProductId) {
        Alert.alert('خطأ', 'الرجاء اختيار منتج لتطبيق العرض');
        return false;
      }
    }
    return true;
  };

  const createAd = async () => {
    if (!activeStore) {
      Alert.alert('خطأ', 'الرجاء اختيار متجر');
      return;
    }

    if (!validateForm()) return;

    const budgetAmount = parseFloat(budget);

    // Check wallet balance
    if (walletBalance < budgetAmount) {
      Alert.alert(
        'رصيد غير كافٍ',
        `رصيدك الحالي: ${walletBalance.toFixed(2)} ج\nالمطلوب: ${budgetAmount.toFixed(2)} ج\n\nالرجاء شحن محفظتك أولاً`,
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'شحن المحفظة', onPress: () => router.push('/(merchant-tabs)/wallet' as any) },
        ]
      );
      return;
    }

    // Confirm payment
    Alert.alert(
      'تأكيد الدفع',
      `سيتم خصم ${budgetAmount.toFixed(2)} ج من محفظتك\nالرصيد بعد الخصم: ${(walletBalance - budgetAmount).toFixed(2)} ج\n\nسيتم مراجعة الإعلان من قبل الإدارة قبل التفعيل`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تأكيد الدفع',
          onPress: async () => {
            try {
              setCreating(true);

              const endDate = new Date();
              endDate.setDate(endDate.getDate() + parseInt(duration));

              const { data, error } = await supabase.rpc('create_ad_with_payment', {
                p_merchant_id: activeStore.id,
                p_ad_type: adType,
                p_title: title.trim(),
                p_description: description.trim() || null,
                p_image_url: imageUrl,
                p_priority: parseInt(priority),
                p_start_date: new Date().toISOString(),
                p_end_date: endDate.toISOString(),
                p_budget_amount: budgetAmount,
                // Offer params
                p_discount_type: offerEnabled ? offerType : null,
                p_discount_amount: offerEnabled ? Number(discountValue) : null,
                p_apply_on: offerEnabled ? applyOn : 'subtotal',
                p_target_product_id: offerEnabled && applyOn === 'product' ? selectedProductId : null,
              });

              if (error) throw error;

              if (!data.success) {
                throw new Error(data.error || 'فشل إنشاء الإعلان');
              }

              Alert.alert(
                '✅ تم بنجاح',
                'تم خصم المبلغ وإنشاء الإعلان\nسيتم تفعيله بعد موافقة الإدارة',
                [{ text: 'حسناً', onPress: () => router.push('/merchant/sponsored-ads' as any) }]
              );
            } catch (error: any) {
              console.error('Error creating ad:', error);
              Alert.alert('خطأ', error.message || 'فشل إنشاء الإعلان');
            } finally {
              setCreating(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/merchant/sponsored-ads' as any)} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إنشاء إعلان جديد</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Wallet Balance */}
        <View style={styles.walletCard}>
          <View style={styles.walletHeader}>
            <Text style={styles.walletTitle}>رصيد المحفظة</Text>
            {loadingBalance ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.walletBalance}>{walletBalance.toFixed(2)} ج</Text>
            )}
          </View>
          <Text style={styles.walletHint}>سيتم خصم الميزانية من محفظتك عند إنشاء الإعلان</Text>
        </View>

        {/* Ad Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>نوع الإعلان</Text>
          <View style={styles.typeGrid}>
            {AD_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  adType === type.id && styles.typeCardActive,
                  { borderColor: adType === type.id ? type.color : colors.border },
                ]}
                onPress={() => setAdType(type.id as any)}
              >
                <Text style={styles.typeIcon}>{type.icon}</Text>
                <Text style={styles.typeLabel}>{type.label}</Text>
                <Text style={styles.typeDescription}>{type.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Image Upload */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>صورة الإعلان *</Text>
          <Text style={styles.hint}>
            {adType === 'banner' ? 'الأبعاد المثالية: 800x450 بكسل (16:9)' : 'الأبعاد المثالية: 400x400 بكسل (مربع)'}
          </Text>
          <TouchableOpacity style={styles.imageUploadButton} onPress={pickImage} disabled={uploading}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <ImageIcon size={48} color={colors.textLight} />
                <Text style={styles.imagePlaceholderText}>اضغط لرفع صورة</Text>
              </View>
            )}
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color={colors.white} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>عنوان الإعلان *</Text>
          <TextInput
            style={styles.input}
            placeholder="مثال: خصم 30% على كل الطلبات"
            value={title}
            onChangeText={setTitle}
            maxLength={50}
          />
          <Text style={styles.charCount}>{title.length}/50</Text>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الوصف (اختياري)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="وصف تفصيلي للعرض..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={200}
          />
          <Text style={styles.charCount}>{description.length}/200</Text>
        </View>

        {/* Offer Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>العرض (اختياري)</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
            <TouchableOpacity onPress={() => setOfferEnabled(!offerEnabled)} style={[styles.toggle, offerEnabled && styles.toggleOn]}>
              <Text style={[styles.toggleText, offerEnabled && styles.toggleTextOn]}>{offerEnabled ? 'مفعل' : 'معطل'}</Text>
            </TouchableOpacity>
            {activeStore && (
              <Text style={styles.hint}>المتجر: {activeStore.name_ar || 'المتجر الحالي'}</Text>
            )}
          </View>

          {offerEnabled && (
            <>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity onPress={() => setOfferType('percent')} style={[styles.pill, offerType === 'percent' && styles.pillActive]}>
                  <Text style={[styles.pillText, offerType === 'percent' && styles.pillTextActive]}>نسبة %</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setOfferType('flat')} style={[styles.pill, offerType === 'flat' && styles.pillActive]}>
                  <Text style={[styles.pillText, offerType === 'flat' && styles.pillTextActive]}>مبلغ ثابت</Text>
                </TouchableOpacity>
              </View>

              {/* Discount value input + unit */}
              <View style={{ marginTop: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder={offerType === 'percent' ? 'مثال: 20' : 'مثال: 30'}
                    value={discountValue}
                    onChangeText={setDiscountValue}
                    keyboardType="numeric"
                  />
                  <View style={styles.unitBadge}>
                    <Text style={styles.unitBadgeText}>{offerType === 'percent' ? '%' : 'ج'}</Text>
                  </View>
                </View>

                {/* Apply on pills (wrap into new line) */}
                <View style={styles.pillsWrap}>
                  <TouchableOpacity onPress={() => setApplyOn('subtotal')} style={[styles.pill, applyOn === 'subtotal' && styles.pillActive]}>
                    <Text style={[styles.pillText, applyOn === 'subtotal' && styles.pillTextActive]}>إجمالي السلة</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setApplyOn('delivery_fee')} style={[styles.pill, applyOn === 'delivery_fee' && styles.pillActive]}>
                    <Text style={[styles.pillText, applyOn === 'delivery_fee' && styles.pillTextActive]}>التوصيل</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setApplyOn('service_fee')} style={[styles.pill, applyOn === 'service_fee' && styles.pillActive]}>
                    <Text style={[styles.pillText, applyOn === 'service_fee' && styles.pillTextActive]}>رسوم الخدمة</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setApplyOn('product')} style={[styles.pill, applyOn === 'product' && styles.pillActive]}>
                    <Text style={[styles.pillText, applyOn === 'product' && styles.pillTextActive]}>منتج محدد</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {applyOn === 'product' && (
                <View style={{ marginTop: spacing.sm }}>
                  <Text style={styles.hint}>اختر المنتج</Text>
                  <View style={styles.productPicker}>
                    {loadingProducts ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : products.length === 0 ? (
                      <Text style={styles.hint}>لا توجد منتجات نشطة</Text>
                    ) : (
                      products.slice(0, 50).map((p) => (
                        <TouchableOpacity key={p.id} style={[styles.productOption, selectedProductId === p.id && styles.productOptionActive]} onPress={() => setSelectedProductId(p.id)}>
                          <Text style={[styles.productOptionText, selectedProductId === p.id && styles.productOptionTextActive]}>
                            {p.name || p.name_ar || p.name_en || 'منتج'}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        {/* Budget & Duration */}
        <View style={styles.row}>
          <View style={[styles.section, { flex: 1, marginRight: spacing.sm }]}>
            <Text style={styles.sectionTitle}>الميزانية (ج) *</Text>
            <TextInput
              style={styles.input}
              placeholder="1000"
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
            />
            <Text style={styles.hint}>تكلفة النقرة: 0.5 ج</Text>
          </View>
          <View style={[styles.section, { flex: 1, marginLeft: spacing.sm }]}>
            <Text style={styles.sectionTitle}>المدة (يوم) *</Text>
            <TextInput
              style={styles.input}
              placeholder="30"
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Priority */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الأولوية (1-10)</Text>
          <Text style={styles.hint}>الأولوية الأعلى تظهر أولاً في القائمة</Text>
          <View style={styles.priorityButtons}>
            {[1, 3, 5, 7, 10].map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.priorityButton,
                  priority === String(p) && styles.priorityButtonActive,
                ]}
                onPress={() => setPriority(String(p))}
              >
                <Text
                  style={[
                    styles.priorityButtonText,
                    priority === String(p) && styles.priorityButtonTextActive,
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>معاينة</Text>
          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>سيظهر الإعلان بهذا الشكل:</Text>
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>{AD_TYPES.find(t => t.id === adType)?.icon} {AD_TYPES.find(t => t.id === adType)?.label}</Text>
            </View>
            {imageUrl && <Image source={{ uri: imageUrl }} style={styles.previewImage} />}
            {title && <Text style={styles.previewTitle}>{title}</Text>}
            {description && <Text style={styles.previewDescription}>{description}</Text>}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>💰 ملخص التكلفة</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>الميزانية الكلية:</Text>
            <Text style={styles.summaryValue}>{budget} ج</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>المدة:</Text>
            <Text style={styles.summaryValue}>{duration} يوم</Text>
          </View>
          {offerEnabled && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>العرض:</Text>
              <Text style={styles.summaryValue}>
                {offerType === 'percent' ? `خصم ${discountValue}%` : `خصم ${discountValue} ج`} 
                {applyOn === 'product' ? ' على منتج محدد' : applyOn === 'delivery_fee' ? ' على التوصيل' : applyOn === 'service_fee' ? ' على رسوم الخدمة' : ' على إجمالي السلة'}
              </Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>عدد النقرات المتوقعة:</Text>
            <Text style={styles.summaryValue}>~{Math.floor(parseFloat(budget || '0') / 0.5)}</Text>
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, creating && styles.createButtonDisabled]}
          onPress={createAd}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.createButtonText}>إنشاء الإعلان</Text>
          )}
        </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.caption,
    color: colors.textLight,
    marginBottom: spacing.sm,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    alignItems: 'center',
  },
  typeCardActive: {
    backgroundColor: colors.primary + '10',
  },
  typeIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  typeLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  typeDescription: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
  },
  imageUploadButton: {
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  imagePlaceholderText: {
    ...typography.body,
    color: colors.textLight,
    marginTop: spacing.sm,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  priorityButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  priorityButtonText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  priorityButtonTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  previewCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginBottom: spacing.sm,
  },
  previewBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  previewBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  previewTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  previewDescription: {
    ...typography.body,
    color: colors.textLight,
  },
  summaryCard: {
    backgroundColor: colors.success + '10',
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  summaryTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.textLight,
  },
  summaryValue: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: colors.primary,
    margin: spacing.lg,
    marginTop: 0,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    ...typography.h3,
    color: colors.white,
    fontWeight: '700',
  },
  unitBadge: {
    marginLeft: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitBadgeText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  pillsWrap: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  walletCard: {
    backgroundColor: colors.success + '10',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.success + '30',
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  walletTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  walletBalance: {
    ...typography.h2,
    color: colors.success,
    fontWeight: '700',
  },
  walletHint: {
    ...typography.caption,
    color: colors.textLight,
  },
  // New styles for offer toggles/pills/product picker
  toggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  toggleOn: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  toggleText: {
    ...typography.body,
    color: colors.text,
  },
  toggleTextOn: {
    color: colors.primary,
    fontWeight: '600',
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    ...typography.caption,
    color: colors.text,
  },
  pillTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  productPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  productOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  productOptionActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  productOptionText: {
    ...typography.caption,
    color: colors.text,
  },
  productOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
