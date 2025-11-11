import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Upload, X, Clock, Calendar, ChevronUp, ChevronDown } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { uploadToBucket } from '@/lib/imageUpload';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore ensure to install: expo install react-native-webview
import { WebView } from 'react-native-webview';

const CATEGORIES = [
  { value: 'restaurant', label: 'مطعم', icon: '🍽️' },
  { value: 'grocery', label: 'بقالة', icon: '🛒' },
  { value: 'pharmacy', label: 'صيدلية', icon: '💊' },
  { value: 'gifts', label: 'هدايا', icon: '🎁' },
  { value: 'other', label: 'أخرى', icon: '📦' },
];

const DAYS = [
  { key: 'sunday', label: 'الأحد' },
  { key: 'monday', label: 'الإثنين' },
  { key: 'tuesday', label: 'الثلاثاء' },
  { key: 'wednesday', label: 'الأربعاء' },
  { key: 'thursday', label: 'الخميس' },
  { key: 'friday', label: 'الجمعة' },
  { key: 'saturday', label: 'السبت' },
];

type DaySchedule = { isOpen: boolean; openTime: string; closeTime: string };
type WeekSchedule = { [key: string]: DaySchedule };

export default function EditStoreScreen() {
  const { id } = useLocalSearchParams();
  const [nameAr, setNameAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [bannerUrl, setBannerUrl] = useState<string>('');
  const [workingHours, setWorkingHours] = useState<WeekSchedule>({
    sunday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
    monday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
    tuesday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
    wednesday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
    thursday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
    friday: { isOpen: false, openTime: '09:00', closeTime: '22:00' },
    saturday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [menuImageUris, setMenuImageUris] = useState<string[]>([]);
  const [menuPdfUrl, setMenuPdfUrl] = useState<string>('');
  const [menuLinkInput, setMenuLinkInput] = useState<string>('');
  const [uploadingMenu, setUploadingMenu] = useState(false);
  const [taxRatePercent, setTaxRatePercent] = useState<string>('0');

  // Backward/forward compatible mediaTypes for expo-image-picker
  const getMediaTypesImages = () => {
    const anyPicker: any = ImagePicker as any;
    const images = anyPicker.MediaType?.Images ?? anyPicker.MediaTypeOptions?.Images;
    return anyPicker.MediaType ? [images] : images;
  };

  const handleRemovePdf = async () => {
    try {
      const url = (menuPdfUrl || '').trim();
      if (!url) return;
      // حاول حذف الملف من التخزين إن كان داخل bucket الخاص بنا
      try {
        const marker = '/storage/v1/object/public/merchant-menus/';
        const idx = url.indexOf(marker);
        if (idx !== -1) {
          const path = url.substring(idx + marker.length);
          if (path) {
            await supabase.storage.from('merchant-menus').remove([path]);
          }
        }
      } catch (_) {
        // تجاهل أي خطأ بالحذف، يكفي مسح الحقل من الواجهة ثم من قاعدة البيانات عند الحفظ
      }
      setMenuPdfUrl('');
      Alert.alert('تم', 'سيتم حفظ إزالة ملف المنيو (PDF) عند الضغط على حفظ');
    } catch (e) {
      Alert.alert('خطأ', 'تعذر إزالة ملف الـ PDF');
    }
  };

  const moveMenuImage = (from: number, to: number) => {
    setMenuImageUris(prev => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };
  const moveImageUp = (idx: number) => moveMenuImage(idx, idx - 1);
  const moveImageDown = (idx: number) => moveMenuImage(idx, idx + 1);

  useEffect(() => {
    fetchStore();
  }, [id]);

  const fetchStore = async () => {
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setNameAr(data.name_ar || '');
        setDescriptionAr(data.description_ar || '');
        setCategory(data.category || CATEGORIES[0].value);
        setAddress(data.address || '');
        setLogoUrl(data.logo_url || '');
        setBannerUrl(data.banner_url || '');
        setMenuPdfUrl(data.menu_url || '');
        setTaxRatePercent(String((data as any).tax_rate_percent ?? 0));
        if (data.working_hours) {
          setWorkingHours(data.working_hours);
        }
        // Fetch existing menu images
        try {
          const { data: imgs, error: imgsErr } = await supabase
            .from('merchant_menu_images')
            .select('image_url, sort_order')
            .eq('merchant_id', id)
            .order('sort_order', { ascending: true });
          if (!imgsErr) {
            setMenuImageUris((imgs || []).map((r: any) => r.image_url));
          }
        } catch {}
      }
    } catch (error: any) {
      console.error('Error fetching store:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل بيانات المتجر');
      router.back();
    } finally {
      setFetching(false);
    }
  };

  const pickMenuPdf = async () => {
    try {
      // @ts-ignore dynamic import until installed: expo install expo-document-picker
      const DocumentPicker = await import('expo-document-picker');
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: false });
      if (!res.canceled && res.assets && res.assets[0]?.uri) {
        setMenuPdfUrl(res.assets[0].uri);
      }
    } catch (e) {
      console.error('pickMenuPdf error:', e);
      Alert.alert('تنبيه', 'يرجى تثبيت expo-document-picker لاختيار ملفات PDF');
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
        setMenuPdfUrl(url);
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

  const pickMenu = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: getMediaTypesImages(),
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length) {
        const uris = result.assets.map(a => a.uri).filter(Boolean) as string[];
        setMenuImageUris(prev => [...prev, ...uris]);
      }
    } catch (error) {
      console.error('Error picking menu:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء اختيار المنيو');
    }
  };

  const pickLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: getMediaTypesImages(),
        allowsMultipleSelection: false,
        quality: 0.8,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setLogoUrl(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking logo:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء اختيار الشعار');
    }
  };

  const pickBanner = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: getMediaTypesImages(),
        allowsMultipleSelection: false,
        quality: 0.8,
        aspect: [16, 9],
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setBannerUrl(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking banner:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء اختيار صورة الغلاف');
    }
  };

  const removeBannerImage = () => {
    setBannerUrl('');
  };

  const toggleDayOpen = (day: string) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], isOpen: !prev[day].isOpen }
    }));
  };

  const updateWorkingTime = (day: string, field: 'openTime' | 'closeTime', value: string) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const validateForm = () => {
    if (!nameAr.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال اسم المتجر');
      return false;
    }

    if (!address.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال عنوان المتجر');
      return false;
    }

    return true;
  };

  const updateStore = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      // رفع PDF إن كان محلياً
      let finalPdfUrl = menuPdfUrl;
      if (finalPdfUrl && !/^https?:\/\//i.test(finalPdfUrl)) {
        try {
          setUploadingMenu(true);
          const prefix = id ? `merchants/${id}` : 'merchants/unknown';
          const uploaded = await uploadToBucket(finalPdfUrl, 'merchant-menus', prefix, { forceExt: 'pdf', contentTypeOverride: 'application/pdf' });
          if (uploaded) finalPdfUrl = uploaded;
        } finally {
          setUploadingMenu(false);
        }
      }

      // رفع صور المنيو (محلية) والحصول على روابط عامة
      const prefixImages = id ? `merchants/${id}` : 'merchants/unknown';
      const resolvedImageUrls: string[] = [];
      for (const uri of menuImageUris) {
        if (/^https?:\/\//i.test(uri)) {
          resolvedImageUrls.push(uri);
        } else {
          const up = await uploadToBucket(uri, 'merchant-menus', prefixImages);
          if (up) resolvedImageUrls.push(up);
        }
      }

      const { error } = await supabase
        .from('merchants')
        .update({
          name_ar: nameAr,
          description_ar: descriptionAr,
          category,
          address,
          logo_url: logoUrl,
          banner_url: bannerUrl,
          menu_url: finalPdfUrl ? finalPdfUrl : null,
          tax_rate_percent: Math.max(0, Math.min(100, Number(taxRatePercent) || 0)),
          working_hours: workingHours,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // استبدال صور المنيو كلها وفق الترتيب الحالي
      await supabase.from('merchant_menu_images').delete().eq('merchant_id', id);
      if (resolvedImageUrls.length > 0) {
        const rows = resolvedImageUrls.map((url, i) => ({ merchant_id: id, image_url: url, sort_order: i }));
        const { error: insErr } = await supabase.from('merchant_menu_images').insert(rows);
        if (insErr) throw insErr;
      }

      setLoading(false);
      Alert.alert(
        'تم بنجاح',
        'تم تحديث معلومات المتجر بنجاح',
        [
          {
            text: 'حسناً',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error: any) {
      setLoading(false);
      console.error('Error updating store:', error);
      Alert.alert('خطأ', `حدث خطأ أثناء تحديث المتجر: ${error.message || ''}`);
    }
  };

  if (fetching) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تعديل معلومات المتجر</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Banner Image */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>صورة الغلاف (Banner)</Text>
          <View style={styles.bannerContainer}>
            {bannerUrl ? (
              <View style={styles.bannerWrapper}>
                <Image source={{ uri: bannerUrl }} style={styles.bannerImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={removeBannerImage}
                >
                  <X size={16} color={colors.white} />
                </TouchableOpacity>
              </View>
            ) : null}
            <TouchableOpacity style={styles.addBannerButton} onPress={pickBanner}>
              <Upload size={32} color={colors.textLight} />
              <Text style={styles.addImageText}>
                {bannerUrl ? 'تغيير صورة الغلاف' : 'إضافة صورة الغلاف'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu (optional) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>المنيو (اختياري)</Text>
          <View style={styles.logoContainer}>
            <TouchableOpacity style={styles.addLogoButton} onPress={pickMenu}>
              <Upload size={32} color={colors.textLight} />
              <Text style={styles.addImageText}>اختيار صور متعددة</Text>
            </TouchableOpacity>
          </View>
          {menuImageUris.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
              {menuImageUris.map((uri, idx) => (
                <View key={uri + idx} style={{ width: 100, height: 120, alignItems: 'center' }}>
                  <View style={{ width: 100, height: 90, borderRadius: borderRadius.sm, overflow: 'hidden' }}>
                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                    <TouchableOpacity onPress={() => removeMenuImage(idx)} style={{ position: 'absolute', top: 4, right: 4, backgroundColor: colors.black + '60', borderRadius: 10, padding: 2 }}>
                      <X size={14} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <TouchableOpacity onPress={() => moveImageUp(idx)} disabled={idx === 0} style={{ opacity: idx === 0 ? 0.4 : 1 }}>
                      <ChevronUp size={18} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveImageDown(idx)} disabled={idx === menuImageUris.length - 1} style={{ opacity: idx === menuImageUris.length - 1 ? 0.4 : 1 }}>
                      <ChevronDown size={18} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity style={[styles.addSmallButton, { marginTop: spacing.sm }]} onPress={pickMenuPdf}>
            <Upload size={24} color={colors.textLight} />
            <Text style={styles.smallButtonText}>اختيار PDF للمنيو</Text>
          </TouchableOpacity>
          <Text style={styles.label}>أو أدخل رابط المنيو (صورة أو PDF)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="https://.../menu.jpg أو https://.../menu.pdf"
              value={menuLinkInput}
              onChangeText={setMenuLinkInput}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={handleAddMenuLink} style={styles.addSmallButton}>
              <Text style={styles.smallButtonText}>إضافة</Text>
            </TouchableOpacity>
          </View>
          {menuPdfUrl && /^https?:\/\//i.test(menuPdfUrl) && /\.pdf($|\?)/i.test(menuPdfUrl) && (
            <View style={{ height: 180, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, overflow: 'hidden', marginTop: spacing.sm }}>
              <WebView
                source={{ uri: `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(menuPdfUrl)}` }}
                style={{ flex: 1, backgroundColor: colors.lightGray }}
              />
            </View>
          )}
          {menuPdfUrl ? (
            <TouchableOpacity onPress={handleRemovePdf} style={styles.removePdfButton}>
              <Text style={styles.removePdfButtonText}>حذف ملف PDF</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Logo Image */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>شعار المتجر (Logo)</Text>
          <View style={styles.logoContainer}>
            {logoUrl ? (
              <View style={styles.logoWrapper}>
                <Image source={{ uri: logoUrl }} style={styles.logoImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setLogoUrl('')}
                >
                  <X size={16} color={colors.white} />
                </TouchableOpacity>
              </View>
            ) : null}
            <TouchableOpacity style={styles.addLogoButton} onPress={pickLogo}>
              <Upload size={32} color={colors.textLight} />
              <Text style={styles.addImageText}>
                {logoUrl ? 'تغيير الشعار' : 'إضافة شعار'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Store Name */}
        <View style={styles.section}>
          <Text style={styles.label}>اسم المتجر *</Text>
          <TextInput
            style={styles.input}
            placeholder="اسم المتجر"
            value={nameAr}
            onChangeText={setNameAr}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>الوصف</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="وصف المتجر"
            value={descriptionAr}
            onChangeText={setDescriptionAr}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Tax rate percent */}
        <View style={styles.section}>
          <Text style={styles.label}>نسبة الضريبة (%)</Text>
          <TextInput
            style={styles.input}
            placeholder="0 - 100"
            value={taxRatePercent}
            onChangeText={setTaxRatePercent}
            keyboardType="numeric"
          />
          <Text style={{ color: colors.textLight, marginTop: 4 }}>
            تُطبّق الضريبة على المجموع الفرعي قبل الخصومات. أدخل 0 إذا لا توجد ضريبة.
          </Text>
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.label}>الفئة *</Text>
          <View style={styles.categoryContainer}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[
                  styles.categoryButton,
                  category === cat.value && styles.categoryButtonActive
                ]}
                onPress={() => setCategory(cat.value)}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text style={[
                  styles.categoryButtonText,
                  category === cat.value && styles.categoryButtonTextActive
                ]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.label}>العنوان *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="عنوان المتجر"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Working Hours */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Clock size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>ساعات العمل</Text>
          </View>
          <View style={styles.workingHoursCard}>
            {DAYS.map((day, index) => (
              <View
                key={day.key}
                style={[
                  styles.dayRow,
                  index !== DAYS.length - 1 && styles.dayRowBorder
                ]}
              >
                <View style={styles.dayHeader}>
                  <Text style={styles.dayLabel}>{day.label}</Text>
                  <TouchableOpacity
                    style={[
                      styles.dayToggle,
                      workingHours[day.key].isOpen && styles.dayToggleActive
                    ]}
                    onPress={() => toggleDayOpen(day.key)}
                  >
                    <Text style={[
                      styles.dayToggleText,
                      workingHours[day.key].isOpen && styles.dayToggleTextActive
                    ]}>
                      {workingHours[day.key].isOpen ? 'مفتوح' : 'مغلق'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {workingHours[day.key].isOpen && (
                  <View style={styles.timeInputsRow}>
                    <View style={styles.timeInputGroup}>
                      <Text style={styles.timeInputLabel}>من</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={workingHours[day.key].openTime}
                        onChangeText={(value) => updateWorkingTime(day.key, 'openTime', value)}
                        placeholder="09:00"
                      />
                    </View>
                    <Text style={styles.timeSeparator}>—</Text>
                    <View style={styles.timeInputGroup}>
                      <Text style={styles.timeInputLabel}>إلى</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={workingHours[day.key].closeTime}
                        onChangeText={(value) => updateWorkingTime(day.key, 'closeTime', value)}
                        placeholder="22:00"
                      />
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
          <Text style={styles.workingHoursHint}>
            💡 سيتم عرض متجرك للعملاء فقط خلال ساعات العمل
          </Text>
        </View>

        {/* Buttons */}
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
            onPress={updateStore}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>حفظ التغييرات</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textLight,
    marginTop: spacing.md,
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
  bannerContainer: {
    marginBottom: spacing.sm,
  },
  bannerWrapper: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  bannerImage: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.lg,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  logoWrapper: {
    position: 'relative',
    marginRight: spacing.md,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
  addBannerButton: {
    width: '100%',
    height: 120,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  addLogoButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  addSmallButton: {
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: spacing.xs,
  },
  addImageText: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  smallButtonText: {
    ...typography.body,
    color: colors.textLight,
  },
  removePdfButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.error + '10',
    marginTop: spacing.sm,
  },
  removePdfButtonText: {
    ...typography.body,
    color: colors.error,
    fontWeight: '600',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  categoryButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryButtonText: {
    ...typography.body,
    color: colors.text,
  },
  categoryButtonTextActive: {
    color: colors.white,
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
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  workingHoursCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayRow: {
    paddingVertical: spacing.sm,
  },
  dayRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '50',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dayLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '600',
  },
  dayToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.error + '20',
  },
  dayToggleActive: {
    backgroundColor: colors.success + '20',
  },
  dayToggleText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '600',
  },
  dayToggleTextActive: {
    color: colors.success,
  },
  timeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  timeInputGroup: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  timeInputLabel: {
    ...typography.caption,
    color: colors.textLight,
  },
  timeInput: {
    ...typography.bodyMedium,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlign: 'center',
    minWidth: 70,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeSeparator: {
    ...typography.h3,
    color: colors.textLight,
  },
  workingHoursHint: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.md,
    textAlign: 'center',
    backgroundColor: colors.primary + '10',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
});
