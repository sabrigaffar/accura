import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Image, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Upload, X, ChevronDown, Store, Check } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/theme';
import { useActiveStore } from '@/contexts/ActiveStoreContext';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { uploadMultipleImages } from '@/lib/imageUpload';

const CATEGORIES = [
  'إلكترونيات',
  'ملابس',
  'أغذية',
  'منزل ومطبخ',
  'رياضة',
  'كتب',
  'ألعاب',
  'أخرى'
];

export default function AddProductScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { activeStore, stores } = useActiveStore();
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [showStorePicker, setShowStorePicker] = useState(false);

  useEffect(() => {
    if (activeStore) {
      setSelectedStore(activeStore);
    } else if (stores.length > 0) {
      setSelectedStore(stores[0]);
    }
  }, [activeStore, stores]);

  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        setImages([...images, ...newImages].slice(0, 5)); // Max 5 images
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء اختيار الصور');
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال اسم المنتج');
      return false;
    }

    if (!price || parseFloat(price) <= 0) {
      Alert.alert('خطأ', 'الرجاء إدخال سعر صحيح');
      return false;
    }

    if (!quantity || parseInt(quantity) < 0) {
      Alert.alert('خطأ', 'الرجاء إدخال كمية صحيحة');
      return false;
    }

    if (discountPrice && parseFloat(discountPrice) >= parseFloat(price)) {
      Alert.alert('خطأ', 'سعر الخصم يجب أن يكون أقل من السعر الأصلي');
      return false;
    }

    return true;
  };

  const saveProduct = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('خطأ', 'يجب تسجيل الدخول أولاً');
        return;
      }

      if (!selectedStore) {
        Alert.alert('خطأ', 'الرجاء اختيار المتجر الذي تريد إضافة المنتج إليه');
        return;
      }

      // رفع الصور إلى Supabase Storage
      let uploadedImageUrls: string[] = [];
      if (images.length > 0) {
        console.log('Uploading images to Storage...');
        uploadedImageUrls = await uploadMultipleImages(images, user.id);
        console.log('Uploaded URLs:', uploadedImageUrls);
        
        if (uploadedImageUrls.length === 0 && images.length > 0) {
          Alert.alert('تحذير', 'حدث خطأ في رفع الصور. سيتم حفظ المنتج بدون صور.');
        } else if (uploadedImageUrls.length < images.length) {
          Alert.alert('تحذير', `تم رفع ${uploadedImageUrls.length} من ${images.length} صور فقط.`);
        }
      }
      
      // إنشاء بيانات المنتج مع الروابط العامة للصور
      let insertPayload: any = {
        merchant_id: user.id,
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price),
        discount_price: discountPrice ? parseFloat(discountPrice) : null,
        quantity: parseInt(quantity),
        category,
        images: uploadedImageUrls,  // استخدام الروابط العامة من Storage
        is_active: true,
      };

      // نضيف store_id من المتجر المختار
      insertPayload.store_id = selectedStore.id;

      let { data, error } = await supabase
        .from('products')
        .insert(insertPayload)
        .select()
        .single();

      // في حال فشل بسبب عدم وجود العمود، أعد المحاولة بدون store_id
      if (error && (error as any).code === '42703') {
        const fallbackPayload = { ...insertPayload };
        delete (fallbackPayload as any).store_id;
        const retry = await supabase
          .from('products')
          .insert(fallbackPayload)
          .select()
          .single();
        data = retry.data as any;
        error = retry.error as any;
      }

      if (error) throw error;

      setLoading(false);
      Alert.alert(
        'تم بنجاح',
        'تم إضافة المنتج بنجاح',
        [
          {
            text: 'حسناً',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error: any) {
      setLoading(false);
      console.error('Error saving product:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء حفظ المنتج: ' + error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إضافة منتج جديد</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* اختيار المتجر */}
        <View style={styles.section}>
          <Text style={styles.label}>اختر المتجر *</Text>
          <TouchableOpacity 
            style={styles.storeSelectorButton}
            onPress={() => setShowStorePicker(true)}
          >
            <Store size={20} color={colors.primary} />
            <Text style={styles.storeSelectorText}>
              {selectedStore ? selectedStore.name_ar : 'اختر المتجر'}
            </Text>
            <ChevronDown size={20} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* Store Picker Modal */}
        <Modal
          visible={showStorePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowStorePicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowStorePicker(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Store size={20} color={colors.primary} />
                <Text style={styles.modalTitle}>اختر المتجر</Text>
              </View>
              <ScrollView style={styles.storesList}>
                {stores.map((store) => (
                  <TouchableOpacity
                    key={store.id}
                    style={[
                      styles.storeItem,
                      selectedStore?.id === store.id && styles.activeStoreItem,
                    ]}
                    onPress={() => {
                      setSelectedStore(store);
                      setShowStorePicker(false);
                    }}
                  >
                    <View style={styles.storeInfo}>
                      <Text style={[
                        styles.storeName,
                        selectedStore?.id === store.id && styles.activeStoreName,
                      ]}>
                        {store.name_ar}
                      </Text>
                      <Text style={styles.storeCategory}>{store.category}</Text>
                    </View>
                    {selectedStore?.id === store.id && (
                      <Check size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
        {/* الصور */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>صور المنتج (اختياري)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesContainer}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.productImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeImage(index)}
                >
                  <X size={16} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 5 && (
              <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
                <Upload size={32} color={colors.textLight} />
                <Text style={styles.addImageText}>إضافة صورة</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
          <Text style={styles.helperText}>يمكنك إضافة حتى 5 صور</Text>
        </View>

        {/* اسم المنتج */}
        <View style={styles.section}>
          <Text style={styles.label}>اسم المنتج *</Text>
          <TextInput
            style={styles.input}
            placeholder="مثال: سماعات لاسلكية"
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* الوصف */}
        <View style={styles.section}>
          <Text style={styles.label}>الوصف</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="وصف المنتج وميزاته..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* الفئة */}
        <View style={styles.section}>
          <Text style={styles.label}>الفئة *</Text>
          <View style={styles.categoryContainer}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryButton,
                  category === cat && styles.categoryButtonActive
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[
                  styles.categoryButtonText,
                  category === cat && styles.categoryButtonTextActive
                ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* السعر */}
        <View style={styles.row}>
          <View style={[styles.section, { flex: 1, marginRight: spacing.md }]}>
            <Text style={styles.label}>السعر *</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.label}>سعر الخصم</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              value={discountPrice}
              onChangeText={setDiscountPrice}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* الكمية */}
        <View style={styles.section}>
          <Text style={styles.label}>الكمية المتوفرة *</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
          />
        </View>

        {/* أزرار الحفظ */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>إلغاء</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={saveProduct}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>حفظ المنتج</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.xxl }} />
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
    ...typography.h2,
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  activeStoreInfo: {
    backgroundColor: colors.primary + '10',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  activeStoreLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  activeStoreName: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  imagesContainer: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: spacing.md,
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.lg,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.error,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  addImageText: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  helperText: {
    ...typography.caption,
    color: colors.textLight,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  categoryButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryButtonText: {
    ...typography.body,
    color: colors.text,
  },
  categoryButtonTextActive: {
    color: colors.white,
  },
  row: {
    flexDirection: 'row',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  storeSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  storeSelectorText: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  storesList: {
    maxHeight: 400,
  },
  storeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activeStoreItem: {
    backgroundColor: colors.primary + '10',
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  storeCategory: {
    ...typography.caption,
    color: colors.textLight,
  },
});
