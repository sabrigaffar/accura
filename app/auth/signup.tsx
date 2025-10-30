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
  const [phone, setPhone] = useState(''); // اختياري
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState<UserType>('customer');
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState({
    code: '+966',
    name: 'السعودية',
    flag: 'SA'
  });
  
  // حالة OTP
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [tempUserData, setTempUserData] = useState<any>(null);

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

    if (!phone.trim()) {
      Alert.alert('خطأ', 'رقم الجوال مطلوب');
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

    try {
      // تنسيق رقم الهاتف إذا تم إدخاله
      let formattedPhone = null;
      if (phone.trim()) {
        const cleanPhone = phone.replace(/\D/g, '');
        formattedPhone = `${selectedCountry.code}${cleanPhone.replace(/^0+/, '')}`;
        console.log('Phone formatted:', formattedPhone);
      } else {
        console.log('No phone number entered');
      }

      // إنشاء الحساب باستخدام Email + Password
      const signUpData: any = {
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: userType,
          },
        },
      };

      // إضافة رقم الهاتف إذا كان موجوداً
      if (formattedPhone) {
        signUpData.phone = formattedPhone;
        signUpData.options.data.phone = formattedPhone;
      }

      if (formattedPhone) {
        const { data: existing, error: existingError } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone_number', formattedPhone)
          .limit(1)
          .maybeSingle();
        if (!existingError && existing) {
          setLoading(false);
          Alert.alert('خطأ', 'رقم الهاتف مستخدم بالفعل. الرجاء استخدام رقم آخر.');
          return;
        }
      }

      const { data, error } = await supabase.auth.signUp(signUpData);

      // التحقق من الإيميل المسجل مسبقاً
      if (error) {
        if (error.message.includes('already registered') || error.message.includes('User already registered')) {
          setLoading(false);
          Alert.alert(
            'البريد مسجل مسبقاً',
            'هذا البريد الإلكتروني موجود بالفعل. \nهل تريد تسجيل الدخول؟',
            [
              { text: 'إلغاء', style: 'cancel' },
              { 
                text: 'تسجيل الدخول', 
                onPress: () => router.push('/auth/login' as any)
              },
            ]
          );
          return;
        }
        throw error;
      }

      // حفظ البيانات مؤقتاً لإنشاء profile بعد التحقق
      const tempData = {
        userId: data.user?.id,
        fullName: fullName.trim(),
        formattedPhone,
        userType,
      };
      console.log('Saving tempUserData:', tempData);
      setTempUserData(tempData);

      // إظهار مربع OTP
      setShowOtpInput(true);
      setLoading(false);
      
      Alert.alert(
        'تم إرسال رمز التحقق',
        'تم إرسال رمز مكون من 6 أرقام إلى بريدك الإلكتروني. يرجى إدخاله لإكمال التسجيل.'
      );
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      let errorMessage = 'حدث خطأ أثناء التسجيل';
      
      if (error.message?.includes('User already registered')) {
        errorMessage = 'هذا البريد الإلكتروني مسجل بالفعل';
      } else if (error.message?.includes('invalid email')) {
        errorMessage = 'البريد الإلكتروني غير صحيح';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('خطأ في التسجيل', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // دالة للتحقق من OTP
  const verifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      Alert.alert('خطأ', 'يرجى إدخال رمز التحقق المكون من 6 أرقام');
      return;
    }

    setLoading(true);

    try {
      // التحقق من OTP
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode,
        type: 'signup',
      });

      if (error) throw error;

      // الآن المستخدم مسجل دخول، يمكننا إنشاء profile
      if (data.user && tempUserData) {
        const phoneToSave = tempUserData.formattedPhone || null;
        if (!phoneToSave) {
          Alert.alert('خطأ', 'رقم الهاتف مفقود. الرجاء العودة وإدخال رقم هاتف صالح.');
          setLoading(false);
          return;
        }

        const { data: existing, error: existingError } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone_number', phoneToSave)
          .limit(1)
          .maybeSingle();
        if (!existingError && existing && existing.id !== data.user.id) {
          Alert.alert('خطأ', 'رقم الهاتف مستخدم بالفعل. الرجاء استخدام رقم آخر.');
          setLoading(false);
          return;
        }

        const profileData = {
          id: data.user.id,
          full_name: tempUserData.fullName,
          phone_number: phoneToSave,
          user_type: tempUserData.userType,
          is_active: true,
          created_at: new Date().toISOString(),
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(profileData, {
            onConflict: 'id',
          });

        if (profileError) {
          if ((profileError as any).code === '23505') {
            Alert.alert('خطأ', 'رقم الهاتف مستخدم بالفعل. الرجاء استخدام رقم آخر.');
          } else {
            Alert.alert('خطأ', 'حدث خطأ في إنشاء الملف الشخصي');
          }
          setLoading(false);
          return;
        }
      }

      // رسالة ترحيب
      const welcomeMessage = tempUserData?.userType === 'merchant' 
        ? 'مرحباً بك! يرجى إكمال معلومات متجرك لبدء البيع.'
        : tempUserData?.userType === 'driver'
        ? 'مرحباً بك! يرجى إكمال معلومات السائق لبدء استلام الطلبات.'
        : 'مرحباً بك! تم إنشاء حسابك بنجاح.';

      Alert.alert(
        'تم التحقق بنجاح! 🎉',
        welcomeMessage,
        [
          {
            text: 'متابعة',
            onPress: () => {
              // انتظر قليلاً قبل التوجيه للسماح للـ Alert بالإغلاق
              setTimeout(() => {
                // التوجيه حسب نوع المستخدم
                if (tempUserData?.userType === 'merchant') {
                  router.replace('/auth/setup-merchant' as any);
                } else if (tempUserData?.userType === 'driver') {
                  router.replace('/auth/setup-driver' as any);
                } else {
                  router.replace('/auth/complete-profile' as any);
                }
              }, 100);
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('OTP verification error:', error);
      Alert.alert(
        'خطأ في التحقق',
        error.message || 'رمز التحقق غير صحيح. يرجى المحاولة مرة أخرى.'
      );
    } finally {
      setLoading(false);
    }
  };

  // دالة لإعادة إرسال OTP
  const resendOtp = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });

      if (error) throw error;

      Alert.alert('تم الإرسال', 'تم إعادة إرسال رمز التحقق إلى بريدك الإلكتروني');
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'فشل إعادة إرسال الرمز');
    } finally {
      setLoading(false);
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
            <Text style={styles.label}>رقم الهاتف</Text>
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
                placeholder="رقم الهاتف"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>
            <Text style={styles.helperText}>
              يمكن استخدامه لاسترجاع كلمة المرور أو التحقق من الحساب
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
                editable={!loading}
              />
            </View>
          </View>

          {/* مربع OTP */}
          {showOtpInput && (
            <View style={styles.otpContainer}>
              <Text style={styles.otpTitle}>رمز التحقق</Text>
              <Text style={styles.otpSubtitle}>
                تم إرسال رمز مكون من 6 أرقام إلى {email}
              </Text>
              <View style={styles.inputWrapper}>
                <Mail size={20} color={colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="123456"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loading}
                  autoFocus
                />
              </View>
              
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={verifyOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>تحقق</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendButton}
                onPress={resendOtp}
                disabled={loading}
              >
                <Text style={styles.resendButtonText}>إعادة إرسال الرمز</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* زر إنشاء الحساب */}
          {!showOtpInput && (
            <TouchableOpacity
              style={[styles.signUpButton, loading && styles.signUpButtonDisabled]}
              onPress={signUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.signUpButtonText}>إنشاء حساب</Text>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>لديك حساب بالفعل؟</Text>
            <TouchableOpacity onPress={() => router.push('/auth/login' as any)}>
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
  otpTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  otpSubtitle: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing.md,
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