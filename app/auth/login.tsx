/**
 * شاشة تسجيل الدخول - Login with Email/Phone + Password
 */

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
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { Package, Mail, Lock, Phone } from 'lucide-react-native';

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState(''); // Email أو Phone
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginType, setLoginType] = useState<'email' | 'phone'>('email');

  // تحميل البيانات المحفوظة عند فتح الصفحة
  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const savedRememberMe = await AsyncStorage.getItem('rememberMe');
      const savedIdentifier = await AsyncStorage.getItem('savedIdentifier');
      const savedLoginType = await AsyncStorage.getItem('savedLoginType');

      if (savedRememberMe === 'true' && savedIdentifier) {
        setRememberMe(true);
        setIdentifier(savedIdentifier);
        if (savedLoginType === 'phone') {
          setLoginType('phone');
        }
      }
    } catch (error) {
      console.error('Error loading saved credentials:', error);
    }
  };

  const handleRememberMeChange = async (value: boolean) => {
    setRememberMe(value);
    
    // إذا تم إلغاء "تذكرني"، احذف البيانات المحفوظة فوراً
    if (!value) {
      try {
        await AsyncStorage.removeItem('savedIdentifier');
        await AsyncStorage.removeItem('savedLoginType');
      } catch (error) {
        console.error('Error clearing saved credentials:', error);
      }
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isValidPhone = (phone: string) => {
    // يقبل أرقام بصيغة +966xxxxxxxxx أو 05xxxxxxxx
    const cleanPhone = phone.replace(/\s/g, '');
    return /^(\+?\d{10,15}|0\d{9,10})$/.test(cleanPhone);
  };

  const handleLogin = async () => {
    // التحقق من البيانات
    if (!identifier.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال البريد الإلكتروني أو رقم الهاتف');
      return;
    }

    if (!password.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال كلمة المرور');
      return;
    }

    // تحديد نوع تسجيل الدخول
    const isEmail = isValidEmail(identifier);
    const isPhone = isValidPhone(identifier);

    if (!isEmail && !isPhone) {
      Alert.alert('خطأ', 'الرجاء إدخال بريد إلكتروني أو رقم هاتف صحيح');
      return;
    }

    setLoading(true);

    try {
      let signInData;

      if (isEmail) {
        // تسجيل الدخول بالبريد الإلكتروني
        const { data, error } = await supabase.auth.signInWithPassword({
          email: identifier.trim(),
          password: password,
        });
        
        if (error) throw error;
        signInData = data;
      } else {
        // تسجيل الدخول برقم الهاتف
        // تنسيق رقم الهاتف
        let formattedPhone = identifier.trim();
        if (formattedPhone.startsWith('05')) {
          formattedPhone = '+966' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('+')) {
          formattedPhone = '+' + formattedPhone;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          phone: formattedPhone,
          password: password,
        });
        
        if (error) throw error;
        signInData = data;
      }

      // حفظ تفضيلات "تذكرني"
      if (rememberMe) {
        await AsyncStorage.setItem('rememberMe', 'true');
        // حفظ الإيميل/رقم الهاتف
        await AsyncStorage.setItem('savedIdentifier', identifier.trim());
        await AsyncStorage.setItem('savedLoginType', loginType);
      } else {
        await AsyncStorage.setItem('rememberMe', 'false');
        // حذف البيانات المحفوظة
        await AsyncStorage.removeItem('savedIdentifier');
        await AsyncStorage.removeItem('savedLoginType');
      }

      // التوجيه إلى الجذر ليقوم index.tsx / RoleNavigator بتحديد الواجهة حسب نوع المستخدم
      router.replace('/');
      
    } catch (error: any) {
      console.error('Login error:', error);
      
      let errorMessage = 'حدث خطأ أثناء تسجيل الدخول';
      
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = 'البريد الإلكتروني أو رقم الهاتف أو كلمة المرور غير صحيحة';
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = 'الرجاء تأكيد بريدك الإلكتروني أولاً';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('خطأ في تسجيل الدخول', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Package size={48} color={colors.white} />
          </View>
          <Text style={styles.logoText}>Accura</Text>
          <Text style={styles.tagline}>توصيل سريع وآمن</Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          <Text style={styles.title}>تسجيل الدخول</Text>
          <Text style={styles.subtitle}>مرحباً بك مجدداً!</Text>

          {/* Login Type Switcher */}
          <View style={styles.switcherContainer}>
            <TouchableOpacity
              style={[
                styles.switcherButton,
                loginType === 'email' && styles.switcherButtonActive,
              ]}
              onPress={() => setLoginType('email')}
            >
              <Mail
                size={20}
                color={loginType === 'email' ? colors.white : colors.textLight}
              />
              <Text
                style={[
                  styles.switcherText,
                  loginType === 'email' && styles.switcherTextActive,
                ]}
              >
                البريد الإلكتروني
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.switcherButton,
                loginType === 'phone' && styles.switcherButtonActive,
              ]}
              onPress={() => setLoginType('phone')}
            >
              <Phone
                size={20}
                color={loginType === 'phone' ? colors.white : colors.textLight}
              />
              <Text
                style={[
                  styles.switcherText,
                  loginType === 'phone' && styles.switcherTextActive,
                ]}
              >
                رقم الهاتف
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email/Phone Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {loginType === 'email' ? 'البريد الإلكتروني' : 'رقم الهاتف'}
            </Text>
            <View style={styles.inputWrapper}>
              {loginType === 'email' ? (
                <Mail size={20} color={colors.textLight} style={styles.inputIcon} />
              ) : (
                <Phone size={20} color={colors.textLight} style={styles.inputIcon} />
              )}
              <TextInput
                style={styles.input}
                placeholder={
                  loginType === 'email'
                    ? 'example@email.com'
                    : '+966xxxxxxxxx أو 05xxxxxxxx'
                }
                placeholderTextColor={colors.textLight}
                value={identifier}
                onChangeText={setIdentifier}
                keyboardType={loginType === 'email' ? 'email-address' : 'phone-pad'}
                autoCapitalize="none"
                textAlign="right"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>كلمة المرور</Text>
            <View style={styles.inputWrapper}>
              <Lock size={20} color={colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textAlign="right"
              />
            </View>
          </View>

          {/* Remember Me */}
          <View style={styles.rememberMeContainer}>
            <Text style={styles.rememberMeLabel}>تذكرني</Text>
            <Switch
              value={rememberMe}
              onValueChange={handleRememberMeChange}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            onPress={() => router.push('/auth/forgot-password' as any)}
            style={styles.forgotPasswordButton}
          >
            <Text style={styles.forgotPasswordText}>نسيت كلمة المرور؟</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>تسجيل الدخول</Text>
            )}
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>ليس لديك حساب؟</Text>
            <TouchableOpacity onPress={() => router.push('/auth/signup' as any)}>
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
  switcherContainer: {
    flexDirection: 'row',
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  switcherButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  switcherButtonActive: {
    backgroundColor: colors.primary,
  },
  switcherText: {
    ...typography.body,
    color: colors.textLight,
  },
  switcherTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: spacing.md,
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
    paddingHorizontal: spacing.md,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  rememberMeLabel: {
    ...typography.body,
    color: colors.text,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
  },
  forgotPasswordText: {
    ...typography.body,
    color: colors.primary,
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
