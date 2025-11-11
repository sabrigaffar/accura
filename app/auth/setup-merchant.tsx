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
import { router, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { ShoppingBag, MapPin, Clock, Upload, Image as ImageIcon, Phone, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadSingleImage, uploadToKyc, uploadToBucket } from '@/lib/imageUpload';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
// @ts-ignore - added dynamically, ensure to install: expo install react-native-webview
import { WebView } from 'react-native-webview';

// أنواع الفئات المتاحة للتاجر
const MERCHANT_CATEGORIES = [
  { key: 'restaurant', label: 'مطعم' },
  { key: 'grocery', label: 'بقالة' },
  { key: 'pharmacy', label: 'صيدلية' },
  { key: 'gifts', label: 'هدايا' },
  { key: 'other', label: 'أخرى' },
];

export default function SetupMerchantScreen() {
  const { user, profile, updateUserType } = useAuth();
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
  const [menuImageUris, setMenuImageUris] = useState<string[]>([]);
  const [menuPdfUri, setMenuPdfUri] = useState<string | null>(null);
  const [menuLinkInput, setMenuLinkInput] = useState<string>('');
  const [uploadingMenu, setUploadingMenu] = useState(false);
  // KYC أصبح في خطوة منفصلة أثناء التسجيل (auth/kyc-merchant)
  const [idDocumentUri, setIdDocumentUri] = useState<string | null>(null);
  const [commercialRecordUri, setCommercialRecordUri] = useState<string | null>(null);
  const [uploadingKyc, setUploadingKyc] = useState(false);
  // إعداد نسبة الضريبة للمتجر
  const [taxRatePercent, setTaxRatePercent] = useState<string>('0');

  // Backward/forward compatible mediaTypes for expo-image-picker
  const getMediaTypesImages = () => {
    const anyPicker: any = ImagePicker as any;
    const images = anyPicker.MediaType?.Images ?? anyPicker.MediaTypeOptions?.Images;
    return anyPicker.MediaType ? [images] : images;
  };

  const pickImage = async (type: 'logo' | 'banner') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: getMediaTypesImages(),
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

  const pickMenuPdf = async () => {
    try {
      // @ts-ignore - dynamic import until package installed: expo install expo-document-picker
      const DocumentPicker = await import('expo-document-picker');
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: false });
      if (!res.canceled && res.assets && res.assets[0]?.uri) {
        setMenuPdfUri(res.assets[0].uri);
      }
    } catch (e) {
      console.error('pickMenuPdf error:', e);
      Alert.alert('تنبيه', 'يرجى تثبيت expo-document-picker لاختيار ملفات PDF');
    }
  };

  const pickMenu = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: getMediaTypesImages(),
        allowsMultipleSelection: true,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        const newUris = result.assets.map(a => a.uri).filter(Boolean) as string[];
        setMenuImageUris(prev => [...prev, ...newUris]);
      }
    } catch (error) {
      console.error('Error picking menu:', error);
      Alert.alert('خطأ', 'فشل في اختيار ملف المنيو');
    }
  };

  const removeMenuImage = (idx: number) => {
    setMenuImageUris(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddMenuLink = () => {
    const url = (menuLinkInput || '').trim();
    if (!url) return;
    if (/^https?:\/\//i.test(url)) {
      if (/\.pdf($|\?)/i.test(url)) {
        setMenuPdfUri(url);
      } else if (/\.(png|jpe?g|webp|gif)$/i.test(url)) {
        setMenuImageUris(prev => [...prev, url]);
      } else {
        Alert.alert('تنبيه', 'الرابط ليس صورة أو PDF معروف');
        return;
      }
      setMenuLinkInput('');
    } else {
      Alert.alert('تنبيه', 'الرجاء إدخال رابط يبدأ بـ http أو https');
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

    // تحقق من نسبة الضريبة [0..100]
    const taxNum = Number(taxRatePercent);
    if (Number.isNaN(taxNum) || taxNum < 0 || taxNum > 100) {
      Alert.alert('تنبيه', 'الرجاء إدخال نسبة ضريبة بين 0 و 100');
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
      let menuUrl: string | null = null;

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

      // رفع ملفات المنيو (PDF وصور متعددة) إلى bucket عام merchant-menus
      let uploadedMenuImageUrls: string[] = [];
      try {
        setUploadingMenu(true);
        const prefix = user?.id ? `merchants/${user.id}` : 'merchants/unknown';
        // PDF
        if (menuPdfUri) {
          if (/^https?:\/\//i.test(menuPdfUri)) {
            menuUrl = menuPdfUri;
          } else {
            menuUrl = await uploadToBucket(menuPdfUri, 'merchant-menus', prefix, { forceExt: 'pdf', contentTypeOverride: 'application/pdf' });
          }
        }
        // صور متعددة
        if (menuImageUris.length > 0) {
          for (const uri of menuImageUris) {
            if (/^https?:\/\//i.test(uri)) {
              uploadedMenuImageUrls.push(uri);
            } else {
              const url = await uploadToBucket(uri, 'merchant-menus', prefix);
              if (url) uploadedMenuImageUrls.push(url);
            }
          }
        }
      } finally {
        setUploadingMenu(false);
      }

      // محاولة التقاط إحداثيات الموقع الحالي تلقائياً
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === Location.PermissionStatus.GRANTED) {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      } catch (e) {
        console.log('Skip auto location on setup-merchant:', e);
      }

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
          is_active: true, // مفعّل مباشرةً كما هو مطلوب
          approval_status: 'approved', // لا يحتاج موافقة مدير للمتجر
          latitude: lat,
          longitude: lng,
          menu_url: menuUrl,
          tax_rate_percent: Math.max(0, Math.min(100, Number(taxRatePercent) || 0)),
          // لا ترسل حقول KYC هنا
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // إدراج صور المنيو في جدول merchant_menu_images (إن وجدت)
      if (data?.id && uploadedMenuImageUrls.length > 0) {
        const rows = uploadedMenuImageUrls.map((url, i) => ({ merchant_id: data.id, image_url: url, sort_order: i }));
        const { error: miErr } = await supabase.from('merchant_menu_images').insert(rows);
        if (miErr) {
          console.warn('Failed to insert menu images:', miErr);
        }
      }

      // عكس نوع المستخدم فوراً في الحالة المحلية قبل الانتقال
      const { error: utErr } = await updateUserType('merchant');
      if (utErr) {
        console.log('updateUserType error (non-fatal):', utErr);
      }
      // لا داعي لإعادة جلب الملف الآن لتجنب شاشات تحميل إضافية؛ سيتم تحميل البيانات عند فتح لوحة التاجر

      setLoading(false);
      try { await AsyncStorage.setItem('merchant_just_created', 'true'); } catch {}
      router.replace('/(merchant-tabs)' as any);
    } catch (error: any) {
      setLoading(false);
      console.log('Merchant Setup Error:', error);
      Alert.alert('خطأ', `حدث خطأ أثناء إنشاء ملف المتجر: ${error.message || error}`);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'إنشاء متجر', headerBackTitle: 'رجوع' }} />
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

        {/* نسبة الضريبة للمتجر */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>نسبة الضريبة (%)</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="0 - 100"
              value={taxRatePercent}
              onChangeText={setTaxRatePercent}
              keyboardType="numeric"
              editable={!loading}
            />
          </View>
          <Text style={[styles.subtitle, { fontSize: 12, color: colors.textLight }]}>
            تُطبّق الضريبة على المجموع الفرعي قبل الخصومات. أدخل 0 إذا لا توجد ضريبة.
          </Text>
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

        {/* المنيو (اختياري) */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>📄 المنيو (اختياري)</Text>

          {/* أزرار اختيار */}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              style={[styles.imageUploadButton, { flex: 1 }]}
              onPress={pickMenu}
              disabled={loading || uploadingMenu}
            >
              <View style={styles.imageUploadPlaceholder}>
                <Upload size={28} color={colors.textLight} />
                <Text style={styles.imageUploadText}>اختيار صور متعددة</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.imageUploadButton, { flex: 1 }]}
              onPress={pickMenuPdf}
              disabled={loading || uploadingMenu}
            >
              <View style={styles.imageUploadPlaceholder}>
                <Upload size={28} color={colors.textLight} />
                <Text style={styles.imageUploadText}>اختيار PDF للمنيو</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* صور المنيو المختارة */}
          {menuImageUris.length > 0 && (
            <View style={{ marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {menuImageUris.map((uri, idx) => (
                <View key={uri + idx} style={{ width: 90, height: 90, borderRadius: borderRadius.sm, overflow: 'hidden' }}>
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                  <TouchableOpacity onPress={() => removeMenuImage(idx)} style={{ position: 'absolute', top: 4, right: 4, backgroundColor: colors.black + '60', borderRadius: 10, padding: 2 }}>
                    <X size={14} color={colors.white} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* PDF Preview card */}
          {menuPdfUri && (
            <View style={{ marginTop: spacing.sm }}>
              {/^https?:\/\//i.test(menuPdfUri) ? (
                <View style={{ height: 180, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, overflow: 'hidden' }}>
                  <WebView
                    source={{ uri: `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(menuPdfUri)}` }}
                    style={{ flex: 1, backgroundColor: colors.lightGray }}
                  />
                </View>
              ) : (
                <View style={{ alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.md, backgroundColor: colors.lightGray }}>
                  <Text style={{ ...typography.bodyMedium, color: colors.text }}>ملف PDF محدد</Text>
                  <Text style={{ ...typography.caption, color: colors.textLight, marginTop: 4 }}>ستظهر المعاينة بعد الحفظ (يجب أن يكون رابطاً عاماً)</Text>
                </View>
              )}
            </View>
          )}

          {/* إضافة رابط صورة أو PDF */}
          <View style={[styles.inputWrapper, { marginTop: spacing.sm, alignItems: 'center' }]}> 
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="أدخل رابط صورة أو PDF"
              value={menuLinkInput}
              onChangeText={setMenuLinkInput}
              editable={!loading}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={handleAddMenuLink} style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
              <Text style={{ ...typography.bodyMedium, color: colors.primary }}>إضافة</Text>
            </TouchableOpacity>
          </View>
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
    </>
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