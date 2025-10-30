import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { User, MapPin, Phone } from 'lucide-react-native';
import CountryPicker from '@/components/CountryPicker';

export default function CompleteProfileScreen() {
  const [phone, setPhone] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [buildingNumber, setBuildingNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState({
    code: '+20',
    name: 'مصر',
    flag: 'EG'
  });

  // تحميل رقم الهاتف من profile
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('id', user.id)
        .single();

      if (profile?.phone_number) {
        // إذا كان الرقم موجود، نعرضه
        const phoneWithoutCode = profile.phone_number.replace(/^\+\d{1,4}/, '');
        setPhone(phoneWithoutCode);
        // استخراج رمز البلد
        const countryCode = profile.phone_number.match(/^\+\d{1,4}/)?.[0] || '+966';
        // TODO: يمكن تحديث selectedCountry بناءً على countryCode
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const completeProfile = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('المستخدم غير مسجل الدخول');
      }

      // تنسيق رقم الهاتف إذا تم إدخاله
      let formattedPhone = null;
      if (phone.trim()) {
        const cleanPhone = phone.replace(/\D/g, '');
        formattedPhone = `${selectedCountry.code}${cleanPhone.replace(/^0+/, '')}`;
      }

      // تحديث الملف الشخصي
      const { error } = await supabase
        .from('profiles')
        .update({
          phone_number: formattedPhone,
          // يمكن إضافة العنوان في جدول addresses لاحقاً
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // إذا كان هناك عنوان، نحفظه في جدول addresses
      if (city.trim() || streetAddress.trim()) {
        const fullAddress = [governorate, city, district, streetAddress]
          .filter(Boolean)
          .join(', ');

        const { error: addressError } = await supabase
          .from('addresses')
          .insert({
            user_id: user.id,
            title: 'المنزل',
            street_address: streetAddress.trim() || fullAddress,
            city: city.trim() || governorate.trim(),
            district: district.trim(),
            building_number: buildingNumber.trim() || null,
            is_default: true,
            created_at: new Date().toISOString(),
          });

        if (addressError) {
          console.error('Address error:', addressError);
          Alert.alert('تنبيه', 'تم حفظ رقم الهاتف لكن حدث خطأ في حفظ العنوان. يمكنك إضافته لاحقاً.');
        }
      }

      Alert.alert(
        'تم بنجاح! 🎉',
        'تم إكمال ملفك الشخصي. يمكنك الآن البدء في استخدام التطبيق.',
        [
          {
            text: 'ابدأ الآن',
            onPress: () => {
              setTimeout(() => {
                router.replace('/(tabs)');
              }, 100);
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Complete profile error:', error);
      Alert.alert('خطأ', error.message || 'حدث خطأ أثناء إكمال الملف الشخصي');
    } finally {
      setLoading(false);
    }
  };

  const skipForNow = () => {
    Alert.alert(
      'تخطي؟',
      'يمكنك إكمال ملفك الشخصي لاحقاً من صفحة الحساب',
      [
        {
          text: 'إلغاء',
          style: 'cancel',
        },
        {
          text: 'تخطي',
          onPress: () => {
            setTimeout(() => {
              router.replace('/(tabs)');
            }, 100);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <User size={32} color={colors.primary} />
            </View>
            <Text style={styles.title}>أكمل ملفك الشخصي</Text>
            <Text style={styles.subtitle}>
              ساعدنا في تقديم تجربة أفضل لك بإضافة بعض المعلومات
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {/* رقم الهاتف */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>رقم الهاتف  (اختياري)</Text>
              <View style={styles.phoneInputWrapper}>
                <CountryPicker
                  selectedCountry={selectedCountry}
                  onCountrySelect={(country) => {
                    setSelectedCountry(country);
                    setPhone('');
                  }}
                />
                <TextInput
                  style={styles.phoneInput}
                  placeholder="1002345678"
                  placeholderTextColor={colors.textLight}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </View>
              <Text style={styles.helperText}>
                رقم الهاتف يساعدنا في التواصل معك بخصوص الطلبات
              </Text>
            </View>

            {/* العنوان */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>عنوان التوصيل (اختياري)</Text>
              
              {/* المحافظة */}
              <View style={styles.inputWrapper}>
                <MapPin size={20} color={colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="المحافظة (مثلاً:البحيرة)"
                  placeholderTextColor={colors.textLight}
                  value={governorate}
                  onChangeText={setGovernorate}
                />
              </View>
              
              {/* المدينة */}
              <View style={[styles.inputWrapper, { marginTop: spacing.sm }]}>
                <MapPin size={20} color={colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="المدينة (مثلا:بدر)"
                  placeholderTextColor={colors.textLight}
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              
              {/* الحي/القرية/المنطقة */}
              <View style={[styles.inputWrapper, { marginTop: spacing.sm }]}>
                <MapPin size={20} color={colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="الحي/القرية/المنطقة"
                  placeholderTextColor={colors.textLight}
                  value={district}
                  onChangeText={setDistrict}
                />
              </View>
              
              {/* اسم الشارع */}
              <View style={[styles.inputWrapper, { marginTop: spacing.sm }]}>
                <MapPin size={20} color={colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="اسم الشارع"
                  placeholderTextColor={colors.textLight}
                  value={streetAddress}
                  onChangeText={setStreetAddress}
                  multiline
                  numberOfLines={2}
                />
              </View>
              
              {/* رقم المبنى */}
              <View style={[styles.inputWrapper, { marginTop: spacing.sm }]}>
                <MapPin size={20} color={colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="رقم المبنى (اختياري)"
                  placeholderTextColor={colors.textLight}
                  value={buildingNumber}
                  onChangeText={setBuildingNumber}
                  keyboardType="numeric"
                />
              </View>
              
              <Text style={styles.helperText}>
                يمكنك إضافة عناوين متعددة لاحقاً من صفحة الحساب
              </Text>
            </View>

            {/* أزرار الإجراءات */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={completeProfile}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>حفظ واستمرار</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={skipForNow}
              disabled={loading}
            >
              <Text style={styles.skipButtonText}>تخطي الآن</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    padding: spacing.lg,
    marginTop: spacing.lg,
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
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginLeft: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    minHeight: 50,
    textAlign: 'right',
    paddingVertical: spacing.sm,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
  },
  phoneInput: {
    flex: 1,
    ...typography.body,
    height: 50,
    textAlign: 'right',
    paddingHorizontal: spacing.md,
  },
  helperText: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  skipButtonText: {
    ...typography.body,
    color: colors.textLight,
    textDecorationLine: 'underline',
  },
});
