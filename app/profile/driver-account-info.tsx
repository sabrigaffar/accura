import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, User, Phone, Mail, Edit2, Save, X } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function DriverAccountInfo() {
  const { user, profile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone_number: profile.phone_number || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone_number: formData.phone_number,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      if (error) throw error;

      Alert.alert('نجح', 'تم تحديث معلومات الحساب بنجاح');
      setEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحديث المعلومات');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: profile?.full_name || '',
      phone_number: profile?.phone_number || '',
    });
    setEditing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>معلومات الحساب</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <User size={40} color={colors.white} />
          </View>
          <Text style={styles.userId}>معرف المستخدم: {user?.id?.slice(0, 8)}...</Text>
        </View>

        {/* Account Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>معلومات شخصية</Text>
            {!editing && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setEditing(true)}
              >
                <Edit2 size={18} color={colors.primary} />
                <Text style={styles.editButtonText}>تعديل</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.card}>
            {/* Full Name */}
            <View style={styles.field}>
              <View style={styles.fieldIcon}>
                <User size={20} color={colors.textLight} />
              </View>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>الاسم الكامل</Text>
                {editing ? (
                  <TextInput
                    style={styles.fieldInput}
                    value={formData.full_name}
                    onChangeText={(text) => setFormData({ ...formData, full_name: text })}
                    placeholder="أدخل الاسم الكامل"
                    placeholderTextColor={colors.textLight}
                  />
                ) : (
                  <Text style={styles.fieldValue}>{profile?.full_name || 'غير محدد'}</Text>
                )}
              </View>
            </View>

            {/* Phone Number */}
            <View style={styles.field}>
              <View style={styles.fieldIcon}>
                <Phone size={20} color={colors.textLight} />
              </View>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>رقم الهاتف</Text>
                {editing ? (
                  <TextInput
                    style={styles.fieldInput}
                    value={formData.phone_number}
                    onChangeText={(text) => setFormData({ ...formData, phone_number: text })}
                    placeholder="أدخل رقم الهاتف"
                    placeholderTextColor={colors.textLight}
                    keyboardType="phone-pad"
                  />
                ) : (
                  <Text style={styles.fieldValue}>{profile?.phone_number || 'غير محدد'}</Text>
                )}
              </View>
            </View>

            {/* Email (Read-only) */}
            <View style={styles.field}>
              <View style={styles.fieldIcon}>
                <Mail size={20} color={colors.textLight} />
              </View>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>البريد الإلكتروني</Text>
                <Text style={styles.fieldValue}>{user?.email || 'غير محدد'}</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          {editing && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={loading}
              >
                <X size={20} color={colors.text} />
                <Text style={styles.cancelButtonText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Save size={20} color={colors.white} />
                    <Text style={styles.saveButtonText}>حفظ</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Account Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>حالة الحساب</Text>
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>نوع الحساب:</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>سائق</Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>الحالة:</Text>
              <View style={[styles.statusBadge, styles.activeBadge]}>
                <Text style={[styles.statusBadgeText, styles.activeText]}>نشط</Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>تاريخ الانضمام:</Text>
              <Text style={styles.statusValue}>
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('ar-SA')
                  : 'غير محدد'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    ...typography.h3,
    color: colors.text,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  userId: {
    ...typography.caption,
    color: colors.textLight,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 16,
    color: colors.text,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  editButtonText: {
    ...typography.body,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  fieldValue: {
    ...typography.body,
    color: colors.text,
  },
  fieldInput: {
    ...typography.body,
    color: colors.text,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingBottom: spacing.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  saveButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusLabel: {
    ...typography.body,
    color: colors.textLight,
  },
  statusValue: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  statusBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  statusBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  activeBadge: {
    backgroundColor: colors.success + '20',
  },
  activeText: {
    color: colors.success,
  },
});
