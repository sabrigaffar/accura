import React, { useState } from 'react';
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
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { Package } from 'lucide-react-native';
import CountryPicker from '@/components/CountryPicker';

// دالة للتحقق من صحة رقم الهاتف حسب رمز البلد
const validatePhoneNumber = (phone: string, countryCode: string): boolean => {
  const cleanPhone = phone.replace(/\D/g, '');
  
  // قواعد التحقق حسب رمز البلد
  const validationRules: { [key: string]: { minLength: number; maxLength: number; pattern?: RegExp } } = {
    '+966': { minLength: 9, maxLength: 9, pattern: /^[5][0-9]{8}$/ }, // السعودية
    '+971': { minLength: 9, maxLength: 9, pattern: /^[5][0-9]{8}$/ }, // الإمارات
    '+965': { minLength: 8, maxLength: 8, pattern: /^[569][0-9]{7}$/ }, // الكويت
    '+974': { minLength: 8, maxLength: 8, pattern: /^[3567][0-9]{7}$/ }, // قطر
    '+968': { minLength: 8, maxLength: 8, pattern: /^[79][0-9]{7}$/ }, // عمان
    '+973': { minLength: 8, maxLength: 8, pattern: /^[36789][0-9]{7}$/ }, // البحرين
    '+962': { minLength: 9, maxLength: 9, pattern: /^[7][0-9]{8}$/ }, // الأردن
    '+964': { minLength: 10, maxLength: 10, pattern: /^[7][0-9]{9}$/ }, // العراق
    '+961': { minLength: 8, maxLength: 8, pattern: /^[3789][0-9]{7}$/ }, // لبنان
    '+20': { minLength: 10, maxLength: 10, pattern: /^[1][0-9]{9}$/ }, // مصر
    '+963': { minLength: 10, maxLength: 10, pattern: /^[9][0-9]{9}$/ }, // سوريا
    '+967': { minLength: 9, maxLength: 9, pattern: /^[7][0-9]{8}$/ }, // اليمن
    '+212': { minLength: 9, maxLength: 9, pattern: /^[67][0-9]{8}$/ }, // المغرب
    '+216': { minLength: 8, maxLength: 8, pattern: /^[259][0-9]{7}$/ }, // تونس
    '+218': { minLength: 9, maxLength: 9, pattern: /^[9][0-9]{8}$/ }, // ليبيا
    '+970': { minLength: 9, maxLength: 9, pattern: /^[5][0-9]{8}$/ }, // فلسطين
  };

  // للبلدان الأخرى، نستخدم قواعد عامة
  const defaultRule = { minLength: 7, maxLength: 15 };

  const rule = validationRules[countryCode] || defaultRule;

  // التحقق من الطول
  if (cleanPhone.length < rule.minLength || cleanPhone.length > rule.maxLength) {
    return false;
  }

  // التحقق من النمط إن وُجد
  if (rule.pattern && !rule.pattern.test(cleanPhone)) {
    return false;
  }

  return true;
};

export default function AuthScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState({
    code: '+20',
    name: 'مصر',
    flag: 'EG'
  });
  const [rememberMe, setRememberMe] = useState(true);

  const sendOTP = async () => {
    // التحقق من صحة رقم الهاتف
    if (!validatePhoneNumber(phone, selectedCountry.code)) {
      Alert.alert('خطأ', 'رقم الجوال غير صحيح للبلد المحدد');
      return;
    }

    setLoading(true);
    // تحسين تنسيق رقم الهاتف
    const cleanPhone = phone.replace(/\D/g, ''); // إزالة جميع الرموز غير الرقمية
    const formattedPhone = `${selectedCountry.code}${cleanPhone.replace(/^0+/, '')}`;
    
    // عرض رقم الهاتف المنسق للتصحيح
    console.log('Formatted Phone:', formattedPhone);
    console.log('Selected Country:', selectedCountry);

    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
    });

    setLoading(false);

    if (error) {
      // عرض تفاصيل الخطأ لتحسين عملية التصحيح
      console.log('Supabase Auth Error:', error);
      console.log('Phone used:', formattedPhone);
      Alert.alert('خطأ', `حدث خطأ في إرسال رمز التحقق: ${error.message}`);
    } else {
      setOtpSent(true);
      // عرض رسالة مؤقتة بدلاً من التنبيه
      setTimeout(() => {
        Alert.alert('تم الإرسال', 'تم إرسال رمز التحقق إلى جوالك');
      }, 100);
    }
  };

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('خطأ', 'الرجاء إدخال رمز التحقق المكون من 6 أرقام');
      return;
    }

    setLoading(true);
    // تحسين تنسيق رقم الهاتف
    const cleanPhone = phone.replace(/\D/g, ''); // إزالة جميع الرموز غير الرقمية
    const formattedPhone = `${selectedCountry.code}${cleanPhone.replace(/^0+/, '')}`;

    const { error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: otp,
      type: 'sms',
    });

    setLoading(false);

    if (error) {
      // عرض تفاصيل الخطأ لتحسين عملية التصحيح
      console.log('OTP Verification Error:', error);
      console.log('Phone used:', formattedPhone);
      console.log('OTP used:', otp);
      Alert.alert('خطأ', `رمز التحقق غير صحيح: ${error.message}`);
    } else {
      if (rememberMe) {
        await AsyncStorage.setItem('logout_on_next_launch', 'false');
      } else {
        await AsyncStorage.setItem('logout_on_next_launch', 'true');
      }
      router.replace('/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Package size={48} color={colors.white} strokeWidth={2} />
          </View>
          <Text style={styles.logoText}>مسافة السكة</Text>
          <Text style={styles.tagline}>الدقة في كل مسافة</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.title}>
            {otpSent ? 'أدخل رمز التحقق' : 'تسجيل الدخول'}
          </Text>
          <Text style={styles.subtitle}>
            {otpSent
              ? `تم إرسال رمز التحقق إلى ${selectedCountry.code}${phone}`
              : 'أدخل رقم جوالك لتسجيل الدخول'}
          </Text>

          {!otpSent ? (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>رقم الجوال</Text>
              <View style={styles.phoneInputWrapper}>
                <CountryPicker
                  selectedCountry={selectedCountry}
                  onCountrySelect={(country) => {
                    setSelectedCountry(country);
                    // إعادة تعيين رقم الهاتف عند تغيير البلد
                    setPhone('');
                  }}
                />
                <TextInput
                  style={styles.phoneInput}
                  placeholder="رقم الجوال"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  editable={!loading}
                />
              </View>
              <Text style={styles.helperText}>
                مثال: {selectedCountry.code === '+20' ? '120092344' : 'أدخل رقمك بدون رمز البلد'}
              </Text>
            </View>
          ) : (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>رمز التحقق</Text>
              <TextInput
                style={styles.input}
                placeholder="000000"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                editable={!loading}
                textAlign="center"
              />
              <TouchableOpacity onPress={() => setOtpSent(false)}>
                <Text style={styles.linkText}>تغيير رقم الجوال</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.rememberMeContainer}>
            <Text style={styles.rememberMeLabel}>تذكرني</Text>
            <Switch value={rememberMe} onValueChange={setRememberMe} />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={otpSent ? verifyOTP : sendOTP}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>
                {otpSent ? 'تحقق' : 'إرسال رمز التحقق'}
              </Text>
            )}
          </TouchableOpacity>

          {otpSent && (
            <TouchableOpacity
              style={styles.resendButton}
              onPress={sendOTP}
              disabled={loading}
            >
              <Text style={styles.resendText}>إعادة إرسال الرمز</Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>ليس لديك حساب؟</Text>
            <TouchableOpacity onPress={() => router.push('/auth/signup')}>
              <Text style={styles.footerLink}>إنشاء حساب</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.white + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoText: {
    ...typography.h1,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  tagline: {
    ...typography.body,
    color: colors.white + 'CC',
  },
  formContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
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
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lightGray,
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
  input: {
    ...typography.h3,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.lightGray,
    letterSpacing: 8,
  },
  linkText: {
    ...typography.caption,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  resendButton: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  resendText: {
    ...typography.body,
    color: colors.textLight,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  rememberMeLabel: {
    ...typography.body,
    color: colors.text,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    ...typography.body,
    color: colors.textLight,
    marginLeft: spacing.xs,
  },
  footerLink: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
});
