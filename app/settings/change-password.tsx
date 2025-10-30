/**
 * شاشة تغيير كلمة المرور - Change Password Screen
 * متاحة لجميع المستخدمين (Customer, Merchant, Driver)
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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { ArrowLeft, Lock, Check } from 'lucide-react-native';

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const validatePassword = (password: string): string | null => {
    if (password.length < 6) {
      return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    }
    if (!/[A-Za-z]/.test(password)) {
      return 'كلمة المرور يجب أن تحتوي على حرف واحد على الأقل';
    }
    if (!/[0-9]/.test(password)) {
      return 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل';
    }
    return null;
  };

  const handleChangePassword = async () => {
    // التحقق من البيانات
    if (!currentPassword.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال كلمة المرور الحالية');
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال كلمة المرور الجديدة');
      return;
    }

    if (!confirmPassword.trim()) {
      Alert.alert('خطأ', 'الرجاء تأكيد كلمة المرور الجديدة');
      return;
    }

    // التحقق من قوة كلمة المرور
    const validationError = validatePassword(newPassword);
    if (validationError) {
      Alert.alert('كلمة مرور ضعيفة', validationError);
      return;
    }

    // التحقق من تطابق كلمتي المرور
    if (newPassword !== confirmPassword) {
      Alert.alert('خطأ', 'كلمة المرور الجديدة وتأكيدها غير متطابقين');
      return;
    }

    // التحقق من أن كلمة المرور الجديدة مختلفة عن الحالية
    if (currentPassword === newPassword) {
      Alert.alert('خطأ', 'كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية');
      return;
    }

    setLoading(true);

    try {
      // أولاً: التحقق من كلمة المرور الحالية بمحاولة تسجيل الدخول
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) {
        throw new Error('لم يتم العثور على معلومات المستخدم');
      }

      // محاولة تسجيل الدخول بكلمة المرور الحالية للتحقق منها
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        Alert.alert('خطأ', 'كلمة المرور الحالية غير صحيحة');
        setLoading(false);
        return;
      }

      // تحديث كلمة المرور
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // نجح التحديث
      Alert.alert(
        'تم التحديث بنجاح',
        'تم تغيير كلمة المرور بنجاح',
        [
          {
            text: 'حسناً',
            onPress: () => router.back(),
          },
        ]
      );

      // مسح الحقول
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Change password error:', error);
      
      let errorMessage = 'حدث خطأ أثناء تغيير كلمة المرور';
      
      if (error.message?.includes('New password should be different')) {
        errorMessage = 'كلمة المرور الجديدة يجب أن تكون مختلفة';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('خطأ', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <ArrowLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>تغيير كلمة المرور</Text>
            <View style={styles.backButton} />
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {/* Info Card */}
            <View style={styles.infoCard}>
              <Lock size={40} color={colors.primary} />
              <Text style={styles.infoTitle}>تأمين حسابك</Text>
              <Text style={styles.infoText}>
                اختر كلمة مرور قوية ولا تشاركها مع أحد
              </Text>
            </View>

            {/* Current Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>كلمة المرور الحالية</Text>
              <View style={styles.inputWrapper}>
                <Lock size={20} color={colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="أدخل كلمة المرور الحالية"
                  placeholderTextColor={colors.textLight}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  textAlign="right"
                  editable={!loading}
                />
              </View>
            </View>

            {/* New Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>كلمة المرور الجديدة</Text>
              <View style={styles.inputWrapper}>
                <Lock size={20} color={colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="أدخل كلمة المرور الجديدة"
                  placeholderTextColor={colors.textLight}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  textAlign="right"
                  editable={!loading}
                />
              </View>
              
              {/* Password Requirements */}
              <View style={styles.requirementsContainer}>
                <Text style={styles.requirementsTitle}>متطلبات كلمة المرور:</Text>
                <View style={styles.requirementItem}>
                  <Check
                    size={16}
                    color={newPassword.length >= 6 ? colors.success : colors.textLight}
                  />
                  <Text style={[
                    styles.requirementText,
                    newPassword.length >= 6 && styles.requirementMet
                  ]}>
                    6 أحرف على الأقل
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Check
                    size={16}
                    color={/[A-Za-z]/.test(newPassword) ? colors.success : colors.textLight}
                  />
                  <Text style={[
                    styles.requirementText,
                    /[A-Za-z]/.test(newPassword) && styles.requirementMet
                  ]}>
                    حرف واحد على الأقل
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Check
                    size={16}
                    color={/[0-9]/.test(newPassword) ? colors.success : colors.textLight}
                  />
                  <Text style={[
                    styles.requirementText,
                    /[0-9]/.test(newPassword) && styles.requirementMet
                  ]}>
                    رقم واحد على الأقل
                  </Text>
                </View>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>تأكيد كلمة المرور الجديدة</Text>
              <View style={styles.inputWrapper}>
                <Lock size={20} color={colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="أعد إدخال كلمة المرور الجديدة"
                  placeholderTextColor={colors.textLight}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  textAlign="right"
                  editable={!loading}
                />
              </View>
              {confirmPassword.length > 0 && (
                <View style={styles.matchIndicator}>
                  {newPassword === confirmPassword ? (
                    <View style={styles.matchSuccess}>
                      <Check size={16} color={colors.success} />
                      <Text style={styles.matchSuccessText}>كلمة المرور متطابقة</Text>
                    </View>
                  ) : (
                    <Text style={styles.matchError}>كلمة المرور غير متطابقة</Text>
                  )}
                </View>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleChangePassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>تحديث كلمة المرور</Text>
              )}
            </TouchableOpacity>

            {/* Security Tips */}
            <View style={styles.tipsContainer}>
              <Text style={styles.tipsTitle}>💡 نصائح الأمان:</Text>
              <Text style={styles.tipText}>• استخدم كلمة مرور فريدة لهذا التطبيق</Text>
              <Text style={styles.tipText}>• لا تشارك كلمة مرورك مع أحد</Text>
              <Text style={styles.tipText}>• غيّر كلمة المرور بشكل دوري</Text>
              <Text style={styles.tipText}>• استخدم مزيجاً من الأحرف والأرقام والرموز</Text>
            </View>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  formContainer: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  infoTitle: {
    ...typography.h3,
    color: colors.primary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  infoText: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
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
  requirementsContainer: {
    marginTop: spacing.sm,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
  },
  requirementsTitle: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  requirementText: {
    ...typography.caption,
    color: colors.textLight,
  },
  requirementMet: {
    color: colors.success,
  },
  matchIndicator: {
    marginTop: spacing.xs,
  },
  matchSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  matchSuccessText: {
    ...typography.caption,
    color: colors.success,
  },
  matchError: {
    ...typography.caption,
    color: colors.error,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  tipsContainer: {
    marginTop: spacing.xl,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  tipsTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  tipText: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
});
