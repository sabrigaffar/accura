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
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { ShoppingBag, MapPin, Clock } from 'lucide-react-native';

// أنواع الفئات المتاحة للتاجر
const MERCHANT_CATEGORIES = [
  { key: 'restaurant', label: 'مطعم' },
  { key: 'grocery', label: 'بقالة' },
  { key: 'pharmacy', label: 'صيدلية' },
  { key: 'gifts', label: 'هدايا' },
  { key: 'other', label: 'أخرى' },
];

export default function SetupMerchantScreen() {
  const { user, profile } = useAuth();
  const [merchantName, setMerchantName] = useState('');
  const [merchantDescription, setMerchantDescription] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

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

    setLoading(true);

    try {
      // إنشاء سجل في جدول merchants
      const { data, error } = await supabase
        .from('merchants')
        .insert({
          owner_id: user?.id,
          name_ar: merchantName,
          description_ar: merchantDescription,
          category: category,
          address: address,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // تحديث نوع المستخدم في ملف التعريف
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          user_type: 'merchant',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      if (profileError) {
        throw profileError;
      }

      setLoading(false);
      Alert.alert(
        'تم بنجاح',
        'تم إنشاء ملف المتجر بنجاح',
        [
          {
            text: 'متابعة',
            onPress: () => router.replace('/(tabs)/merchants'),
          },
        ]
      );
    } catch (error: any) {
      setLoading(false);
      console.log('Merchant Setup Error:', error);
      Alert.alert('خطأ', `حدث خطأ أثناء إنشاء ملف المتجر: ${error.message || error}`);
    }
  };

  return (
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

        <View style={styles.inputContainer}>
          <Text style={styles.label}>فئة المتجر</Text>
          <View style={styles.categoryContainer}>
            {MERCHANT_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.categoryButton,
                  category === cat.key && styles.selectedCategoryButton,
                ]}
                onPress={() => setCategory(cat.key)}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.categoryText,
                    category === cat.key && styles.selectedCategoryText,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>عنوان المتجر</Text>
          <View style={styles.inputWrapper}>
            <MapPin size={20} color={colors.textLight} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="عنوان المتجر الكامل"
              value={address}
              onChangeText={setAddress}
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
});