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
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { Package, User, Phone, Lock, ShoppingBag, Car, Users, Mail } from 'lucide-react-native';
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

// أنواع المستخدمين المتاحة
type UserType = 'customer' | 'merchant' | 'driver';

export default function SignUpScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState<UserType>('customer'); // نوع المستخدم الافتراضي
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [selectedCountry, setSelectedCountry] = useState({
    code: '+20',
    name: 'مصر',
    flag: 'EG'
  });

  const signUp = async () => {
    // التحقق من صحة البيانات
    if (!fullName.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال الاسم الكامل');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      Alert.alert('خطأ', 'الرجاء إدخال بريد إلكتروني صحيح');
      return;
    }

    if (!validatePhoneNumber(phone, selectedCountry.code)) {
      Alert.alert('خطأ', 'رقم الجوال غير صحيح للبلد المحدد');
      return;
    }

    if (!password || password.length < 6) {
      Alert.alert('خطأ', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('خطأ', 'كلمة المرور وتأكيد كلمة المرور غير متطابقين');
      return;
    }

    setLoading(true);
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = `${selectedCountry.code}${cleanPhone.replace(/^0+/, '')}`;

    try {
      console.log('Sending OTP to email:', email);
      console.log('User data:', { fullName, formattedPhone, userType });
      
      // إرسال OTP إلى البريد الإلكتروني
      const { data, error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          data: {
            full_name: fullName.trim(),
            phone_number: formattedPhone,
            user_type: userType,
          },
          shouldCreateUser: true,
        }
      });

      if (error) {
        console.error('OTP Send Error:', error);
        throw error;
      }

      setLoading(false);
      setOtpSent(true);
      
      console.log('OTP sent successfully to:', email);
      Alert.alert(
        'تم إرسال رمز التأكيد',
        `تم إرسال رمز مكون من 6 أرقام إلى ${email}. يُرجى إدخال الرمز أدناه.`
      );
    } catch (error: any) {
      setLoading(false);
      console.error('Signup Error:', error);
      
      let errorMessage = 'حدث خطأ أثناء إرسال رمز التأكيد';
      if (error.message?.includes('already registered')) {
        errorMessage = 'هذا البريد الإلكتروني مستخدم بالفعل';
      }
      
      Alert.alert('خطأ', errorMessage + ': ' + (error.message || error));
    }
  };

  const verifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('خطأ', 'الرجاء إدخال رمز التأكيد بشكل صحيح (6 أرقام)');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp,
        type: 'email',
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        setLoading(false);
        console.log('User verified successfully!');
        console.log('User ID:', data.user?.id);
        console.log('User type:', userType);
        
        Alert.alert(
          'تم إنشاء الحساب بنجاح',
          `مرحباً ${fullName}! تم إنشاء حسابك كـ${userType === 'customer' ? 'عميل' : userType === 'merchant' ? 'تاجر' : 'سائق'} بنجاح!`,
          [
            {
              text: 'تابع',
              onPress: () => router.replace('/(tabs)' as any)
            }
          ]
        );
      }
    } catch (error: any) {
      setLoading(false);
      console.error('OTP Verification Error:', error);
      
      let errorMessage = 'حدث خطأ أثناء تأكيد الرمز';
      if (error.message?.includes('invalid') || error.message?.includes('expired')) {
        errorMessage = 'رمز التأكيد غير صحيج أو انتهت صلاحيته';
      }
      
      Alert.alert('خطأ', errorMessage + ': ' + (error.message || error));
    }
  };

  // دالة لتحديد ما إذا كان نوع المستخدم مختارًا
  const isSelected = (type: UserType) => userType === type;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Package size={48} color={colors.white} strokeWidth={2} />
          </View>
          <Text style={styles.logoText}>مسافة السكة</Text>
          <Text style={styles.tagline}>الدقة في كل مسافة</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.title}>إنشاء حساب جديد</Text>
          <Text style={styles.subtitle}>أدخل بياناتك لإنشاء حساب جديد</Text>

          {/* اختيار نوع المستخدم */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>نوع الحساب</Text>
            <View style={styles.userTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.userTypeButton,
                  isSelected('customer') && styles.selectedUserTypeButton
                ]}
                onPress={() => setUserType('customer')}
              >
                <Users size={24} color={isSelected('customer') ? colors.primary : colors.textLight} />
                <Text style={[
                  styles.userTypeText,
                  isSelected('customer') && styles.selectedUserTypeText
                ]}>
                  عميل
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.userTypeButton,
                  isSelected('merchant') && styles.selectedUserTypeButton
                ]}
                onPress={() => setUserType('merchant')}
              >
                <ShoppingBag size={24} color={isSelected('merchant') ? colors.primary : colors.textLight} />
                <Text style={[
                  styles.userTypeText,
                  isSelected('merchant') && styles.selectedUserTypeText
                ]}>
                  تاجر
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.userTypeButton,
                  isSelected('driver') && styles.selectedUserTypeButton
                ]}
                onPress={() => setUserType('driver')}
              >
                <Car size={24} color={isSelected('driver') ? colors.primary : colors.textLight} />
                <Text style={[
                  styles.userTypeText,
                  isSelected('driver') && styles.selectedUserTypeText
                ]}>
                  سائق
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>الاسم الكامل</Text>
            <View style={styles.inputWrapper}>
              <User size={20} color={colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="الاسم الكامل"
                value={fullName}
                onChangeText={setFullName}
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>البريد الإلكتروني</Text>
            <View style={styles.inputWrapper}>
              <Mail size={20} color={colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="example@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>رقم الجوال</Text>
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
                placeholder="رقم الجوال"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>
            <Text style={styles.helperText}>
              مثال: {selectedCountry.code === '+20' ? '1002229388' : 'أدخل رقمك بدون رمز البلد'}
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>كلمة المرور</Text>
            <View style={styles.inputWrapper}>
              <Lock size={20} color={colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="كلمة المرور"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>تأكيد كلمة المرور</Text>
            <View style={styles.inputWrapper}>
              <Lock size={20} color={colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="تأكيد كلمة المرور"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading && !otpSent}
              />
            </View>
          </View>

          {otpSent && (
            <View style={styles.otpContainer}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>رمز التأكيد (OTP)</Text>
                <View style={styles.inputWrapper}>
                  <Mail size={20} color={colors.textLight} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="أدخل الرمز المرسل إلى بريدك"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!loading}
                    autoFocus
                  />
                </View>
                <Text style={styles.helperText}>
                  تم إرسال رمز التأكيد إلى {email}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.signUpButton, loading && styles.signUpButtonDisabled]}
                onPress={verifyOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.signUpButtonText}>تأكيد وإنشاء الحساب</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendButton}
                onPress={() => {
                  setOtp('');
                  signUp();
                }}
                disabled={loading}
              >
                <Text style={styles.resendButtonText}>إعادة إرسال الرمز</Text>
              </TouchableOpacity>
            </View>
          )}

          {!otpSent && (
            <TouchableOpacity
              style={[styles.signUpButton, loading && styles.signUpButtonDisabled]}
              onPress={signUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.signUpButtonText}>إرسال رمز التأكيد</Text>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>لديك حساب بالفعل؟</Text>
            <TouchableOpacity onPress={() => router.replace('/auth')}>
              <Text style={styles.footerLink}>تسجيل الدخول</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  content: {
    flexGrow: 1,
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
  userTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  userTypeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lightGray,
  },
  selectedUserTypeButton: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  userTypeText: {
    ...typography.bodyMedium,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  selectedUserTypeText: {
    color: colors.primary,
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
  button: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  signUpButton: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  signUpButtonDisabled: {
    opacity: 0.6,
  },
  signUpButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  otpContainer: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resendButton: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  resendButtonText: {
    ...typography.body,
    color: colors.primary,
    textDecorationLine: 'underline',
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