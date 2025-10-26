import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Upload, X } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';

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

      // في الإصدار الحقيقي، يجب رفع الصور إلى Supabase Storage
      // الآن سنحفظ روابط الصور مباشرة (للتبسيط)
      
      const { data, error } = await supabase
        .from('products')
        .insert({
          merchant_id: user.id,
          name: name.trim(),
          description: description.trim(),
          price: parseFloat(price),
          discount_price: discountPrice ? parseFloat(discountPrice) : null,
          quantity: parseInt(quantity),
          category,
          images: images,
          is_active: true,
        })
        .select()
        .single();

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
});
