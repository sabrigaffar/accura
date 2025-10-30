/**
 * شاشة استرجاع كلمة المرور - Forgot Password
 */

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
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { ArrowLeft, Mail, Phone, Key } from 'lucide-react-native';

export default function ForgotPasswordScreen() {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetType, setResetType] = useState<'email' | 'phone'>('email');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isValidPhone = (phone: string) => {
    const cleanPhone = phone.replace(/\s/g, '');
    return /^(\+?\d{10,15}|0\d{9,10})$/.test(cleanPhone);
  };

  const handleSendResetLink = async () => {
    if (!identifier.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال البريد الإلكتروني أو رقم الهاتف');
      return;
    }

    const isEmail = isValidEmail(identifier);
    const isPhone = isValidPhone(identifier);

    if (!isEmail && !isPhone) {
      Alert.alert('خطأ', 'الرجاء إدخال بريد إلكتروني أو رقم هاتف صحيح');
      return;
    }

    setLoading(true);

    try {
      if (isEmail) {
        // إرسال رابط استعادة كلمة المرور عبر البريد
        const { error } = await supabase.auth.resetPasswordForEmail(
          identifier.trim(),
          {
            redirectTo: 'accura://reset-password',
          }
        );

        if (error) throw error;

        Alert.alert(
          'تم الإرسال',
          'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني',
          [
            {
              text: 'حسناً',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        // إرسال OTP عبر الهاتف
        let formattedPhone = identifier.trim();
        if (formattedPhone.startsWith('05')) {
          formattedPhone = '+966' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('+')) {
          formattedPhone = '+' + formattedPhone;
        }

        const { error } = await supabase.auth.signInWithOtp({
          phone: formattedPhone,
        });

        if (error) throw error;

        setOtpSent(true);
        Alert.alert(
          'تم الإرسال',
          'تم إرسال رمز التحقق إلى رقم هاتفك'
        );
      }
    } catch (error: any) {
      console.error('Reset password error:', error);
      Alert.alert(
        'خطأ',
        error.message || 'حدث خطأ أثناء إرسال رابط الاستعادة'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetWithOtp = async () => {
    if (!otp.trim() || otp.length !== 6) {
      Alert.alert('خطأ', 'الرجاء إدخال رمز التحقق المكون من 6 أرقام');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      Alert.alert('خطأ', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('خطأ', 'كلمة المرور وتأكيد كلمة المرور غير متطابقين');
      return;
    }

    setLoading(true);

    try {
      let formattedPhone = identifier.trim();
      if (formattedPhone.startsWith('05')) {
        formattedPhone = '+966' + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      // التحقق من OTP وتسجيل الدخول
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms',
      });

      if (verifyError) throw verifyError;

      // تحديث كلمة المرور
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      Alert.alert(
        'نجح',
        'تم تحديث كلمة المرور بنجاح',
        [
          {
            text: 'تسجيل الدخول',
            onPress: () => {
              setTimeout(() => {
                router.replace('/auth/login' as any);
              }, 100);
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Reset with OTP error:', error);
      Alert.alert(
        'خطأ',
        error.message || 'حدث خطأ أثناء تحديث كلمة المرور'
      );
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
        {/* Header */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={colors.white} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>استعادة كلمة المرور</Text>
          <Text style={styles.headerSubtitle}>
            {otpSent
              ? 'أدخل رمز التحقق وكلمة المرور الجديدة'
              : 'سنرسل لك رابط أو رمز لاستعادة كلمة المرور'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          {!otpSent ? (
            <>
              {/* Reset Type Switcher */}
              <View style={styles.switcherContainer}>
                <TouchableOpacity
                  style={[
                    styles.switcherButton,
                    resetType === 'email' && styles.switcherButtonActive,
                  ]}
                  onPress={() => setResetType('email')}
                >
                  <Mail
                    size={20}
                    color={resetType === 'email' ? colors.white : colors.textLight}
                  />
                  <Text
                    style={[
                      styles.switcherText,
                      resetType === 'email' && styles.switcherTextActive,
                    ]}
                  >
                    البريد
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.switcherButton,
                    resetType === 'phone' && styles.switcherButtonActive,
                  ]}
                  onPress={() => setResetType('phone')}
                >
                  <Phone
                    size={20}
                    color={resetType === 'phone' ? colors.white : colors.textLight}
                  />
                  <Text
                    style={[
                      styles.switcherText,
                      resetType === 'phone' && styles.switcherTextActive,
                    ]}
                  >
                    الهاتف
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Email/Phone Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>
                  {resetType === 'email' ? 'البريد الإلكتروني' : 'رقم الهاتف'}
                </Text>
                <View style={styles.inputWrapper}>
                  {resetType === 'email' ? (
                    <Mail size={20} color={colors.textLight} style={styles.inputIcon} />
                  ) : (
                    <Phone size={20} color={colors.textLight} style={styles.inputIcon} />
                  )}
                  <TextInput
                    style={styles.input}
                    placeholder={
                      resetType === 'email'
                        ? 'example@email.com'
                        : '+966xxxxxxxxx'
                    }
                    placeholderTextColor={colors.textLight}
                    value={identifier}
                    onChangeText={setIdentifier}
                    keyboardType={resetType === 'email' ? 'email-address' : 'phone-pad'}
                    autoCapitalize="none"
                    textAlign="right"
                  />
                </View>
                <Text style={styles.helperText}>
                  {resetType === 'email'
                    ? 'سيتم إرسال رابط الاستعادة إلى بريدك'
                    : 'سيتم إرسال رمز التحقق إلى هاتفك'}
                </Text>
              </View>

              {/* Send Button */}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendResetLink}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>
                    {resetType === 'email' ? 'إرسال الرابط' : 'إرسال الرمز'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* OTP Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>رمز التحقق</Text>
                <View style={styles.inputWrapper}>
                  <Key size={20} color={colors.textLight} style={styles.inputIcon} />
                  <TextInput
                    style={styles.otpInput}
                    placeholder="000000"
                    placeholderTextColor={colors.textLight}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    textAlign="center"
                  />
                </View>
              </View>

              {/* New Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>كلمة المرور الجديدة</Text>
                <View style={styles.inputWrapper}>
                  <Key size={20} color={colors.textLight} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textLight}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    textAlign="right"
                  />
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>تأكيد كلمة المرور</Text>
                <View style={styles.inputWrapper}>
                  <Key size={20} color={colors.textLight} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textLight}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    textAlign="right"
                  />
                </View>
              </View>

              {/* Reset Button */}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleResetWithOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>تحديث كلمة المرور</Text>
                )}
              </TouchableOpacity>

              {/* Resend OTP */}
              <TouchableOpacity
                style={styles.resendButton}
                onPress={handleSendResetLink}
                disabled={loading}
              >
                <Text style={styles.resendText}>إعادة إرسال الرمز</Text>
              </TouchableOpacity>
            </>
          )}
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
    padding: spacing.lg,
    paddingTop: spacing.xxl * 2,
  },
  backButton: {
    marginBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.white + 'CC',
  },
  formContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
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
    paddingHorizontal: spacing.md,
  },
  otpInput: {
    flex: 1,
    ...typography.h3,
    height: 50,
    letterSpacing: 8,
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
    color: colors.primary,
  },
});
