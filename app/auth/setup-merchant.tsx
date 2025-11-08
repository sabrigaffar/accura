import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { ShoppingBag, MapPin, Clock, Upload, Image as ImageIcon, Phone } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadSingleImage, uploadToKyc } from '@/lib/imageUpload';

// أنواع الفئات المتاحة للتاجر
const MERCHANT_CATEGORIES = [
  { key: 'restaurant', label: 'مطعم' },
  { key: 'grocery', label: 'بقالة' },
  { key: 'pharmacy', label: 'صيدلية' },
  { key: 'gifts', label: 'هدايا' },
  { key: 'other', label: 'أخرى' },
];

export default function SetupMerchantScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [merchantName, setMerchantName] = useState('');
  const [merchantDescription, setMerchantDescription] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  // KYC أصبح في خطوة منفصلة أثناء التسجيل (auth/kyc-merchant)
  const [idDocumentUri, setIdDocumentUri] = useState<string | null>(null);
  const [commercialRecordUri, setCommercialRecordUri] = useState<string | null>(null);
  const [uploadingKyc, setUploadingKyc] = useState(false);

  const pickImage = async (type: 'logo' | 'banner') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'logo' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        if (type === 'logo') {
          setLogoUri(result.assets[0].uri);
        } else {
          setBannerUri(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('خطأ', 'فشل في اختيار الصورة');
    }
  };

  const createMerchantProfile = async () => {
    // التحقق من صحة البيانات
    if (!merchantName.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال اسم المتجر');
      return;
    }

    if (!category) {
      Alert.alert('خطأ', 'الرجاء اختيار فئة المتجر');
      return;
    }

    if (!address.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال عنوان المتجر');
      return;
    }

    if (!phoneNumber.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال رقم هاتف المتجر');
      return;
    }

    // KYC يُطلب عند التسجيل فقط، لا تشترط مستندات هنا

    setLoading(true);

    try {
      // رفع الصور إذا كانت موجودة
      let logoUrl = null;
      let bannerUrl = null;
      let idDocPath: string | null = null;
      let crDocPath: string | null = null;

      if (logoUri) {
        setUploadingLogo(true);
        logoUrl = await uploadSingleImage(logoUri, 'merchant-logos');
        setUploadingLogo(false);
      }

      if (bannerUri) {
        setUploadingBanner(true);
        bannerUrl = await uploadSingleImage(bannerUri, 'merchant-banners');
        setUploadingBanner(false);
      }

      // لا ترفع مستندات KYC هنا؛ تمت معالجتها في auth/kyc-merchant

      // إنشاء سجل في جدول merchants
      const { data, error } = await supabase
        .from('merchants')
        .insert({
          owner_id: user?.id,
          name_ar: merchantName,
          description_ar: merchantDescription,
          category: category,
          address: address,
          phone_number: phoneNumber,
          logo_url: logoUrl,
          banner_url: bannerUrl,
          is_active: false, // يفعّل بعد موافقة الإدارة
          // لا ترسل حقول KYC هنا
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // تحديث نوع المستخدم في ملف التعريف
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          user_type: 'merchant',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      if (profileError) {
        throw profileError;
      }

      // تحديث AuthContext ليعكس user_type الجديد
      await refreshProfile();

      setLoading(false);
      Alert.alert(
        'تم استلام طلبك',
        'تم إرسال مستندات المتجر لمراجعة الإدارة. سنخبرك فور الموافقة.',
        [
          {
            text: 'متابعة',
            onPress: () => {
              setTimeout(() => {
                router.replace('/auth/waiting-approval' as any);
              }, 100);
            },
          },
        ]
      );
    } catch (error: any) {
      setLoading(false);
      console.log('Merchant Setup Error:', error);
      Alert.alert('خطأ', `حدث خطأ أثناء إنشاء ملف المتجر: ${error.message || error}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ShoppingBag size={48} color={colors.primary} />
        <Text style={styles.title}>إعداد ملف المتجر</Text>
        <Text style={styles.subtitle}>أدخل معلومات متجرك لبدء البيع</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>اسم المتجر</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="اسم المتجر باللغة العربية"
              value={merchantName}
              onChangeText={setMerchantName}
              editable={!loading}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>وصف المتجر</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="وصف مختصر لمتجرك"
              value={merchantDescription}
              onChangeText={setMerchantDescription}
              multiline
              numberOfLines={3}
              editable={!loading}
            />
          </View>
        </View>

        {/* رفع شعار المتجر (Logo) */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>🎨 شعار المتجر (Logo)</Text>
          <TouchableOpacity
            style={styles.imageUploadButton}
            onPress={() => pickImage('logo')}
            disabled={loading || uploadingLogo}
          >
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoPreview} />
            ) : (
              <View style={styles.imageUploadPlaceholder}>
                <Upload size={32} color={colors.textLight} />
                <Text style={styles.imageUploadText}>اضغط لرفع شعار المتجر</Text>
                <Text style={styles.imageUploadHint}>(مربع 1:1 - اختياري)</Text>
              </View>
            )}
            {uploadingLogo && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color={colors.white} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* رفع غلاف المتجر (Banner) */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>🖼️ غلاف المتجر (Banner)</Text>
          <TouchableOpacity
            style={styles.imageUploadButton}
            onPress={() => pickImage('banner')}
            disabled={loading || uploadingBanner}
          >
            {bannerUri ? (
              <Image source={{ uri: bannerUri }} style={styles.bannerPreview} />
            ) : (
              <View style={styles.imageUploadPlaceholder}>
                <ImageIcon size={32} color={colors.textLight} />
                <Text style={styles.imageUploadText}>اضغط لرفع غلاف المتجر</Text>
                <Text style={styles.imageUploadHint}>(16:9 - اختياري)</Text>
              </View>
            )}
            {uploadingBanner && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color={colors.white} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>📍 عنوان المتجر</Text>
          <View style={styles.inputWrapper}>
            <MapPin size={20} color={colors.textLight} />
            <TextInput
              style={styles.input}
              placeholder="عنوان المتجر بالتفصيل"
              value={address}
              onChangeText={setAddress}
              editable={!loading}
            />
          </View>
        </View>

        {/* تمت إزالة قسم مستندات KYC هنا لأن التوثيق يتم أثناء التسجيل في /auth/kyc-merchant */}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>📞 رقم هاتف المتجر</Text>
          <View style={styles.inputWrapper}>
            <Phone size={20} color={colors.textLight} />
            <TextInput
              style={styles.input}
              placeholder="مثال: 0453462333"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              editable={!loading}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>فئة المتجر</Text>
          <View style={styles.categoryContainer}>
            {MERCHANT_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.categoryButton,
                  category === cat.key && styles.selectedCategoryButton,
                ]}
                onPress={() => setCategory(cat.key)}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.categoryText,
                    category === cat.key && styles.selectedCategoryText,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>عنوان المتجر</Text>
          <View style={styles.inputWrapper}>
            <MapPin size={20} color={colors.textLight} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="عنوان المتجر الكامل"
              value={address}
              onChangeText={setAddress}
              editable={!loading}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={createMerchantProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>إنشاء ملف المتجر</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    paddingTop: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lightGray,
  },
  inputIcon: {
    marginLeft: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body,
    height: 50,
    textAlign: 'right',
    paddingHorizontal: spacing.md,
  },
  textArea: {
    height: 100,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lightGray,
  },
  selectedCategoryButton: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  categoryText: {
    ...typography.body,
    color: colors.textLight,
  },
  selectedCategoryText: {
    color: colors.primary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  helperText: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  imageUploadButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lightGray,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    position: 'relative',
    overflow: 'hidden',
  },
  imageUploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageUploadText: {
    ...typography.body,
    color: colors.textLight,
    marginTop: spacing.sm,
  },
  imageUploadHint: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  logoPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  bannerPreview: {
    width: '100%',
    height: 120,
    borderRadius: borderRadius.md,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});