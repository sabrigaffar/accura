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
import { Car, CreditCard, Calendar } from 'lucide-react-native';

// أنواع المركبات المتاحة
const VEHICLE_TYPES = [
  { key: 'car', label: 'سيارة' },
  { key: 'motorcycle', label: 'دراجة نارية' },
  { key: 'bicycle', label: 'دراجة' },
];

export default function SetupDriverScreen() {
  const { user, profile } = useAuth();
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [loading, setLoading] = useState(false);

  const createDriverProfile = async () => {
    // التحقق من صحة البيانات
    if (!vehicleType) {
      Alert.alert('خطأ', 'الرجاء اختيار نوع المركبة');
      return;
    }

    if (!vehicleModel.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال طراز المركبة');
      return;
    }

    if (!licensePlate.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال رقم اللوحة');
      return;
    }

    if (!licenseNumber.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال رقم الرخصة');
      return;
    }

    if (!licenseExpiry.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال تاريخ انتهاء الرخصة');
      return;
    }

    setLoading(true);

    try {
      // إنشاء سجل في جدول driver_profiles
      const { data, error } = await supabase
        .from('driver_profiles')
        .insert({
          id: user?.id,
          vehicle_type: vehicleType,
          vehicle_model: vehicleModel,
          vehicle_color: vehicleColor,
          license_plate: licensePlate,
          license_number: licenseNumber,
          license_expiry: licenseExpiry,
          is_verified: false, // سيتم التحقق لاحقاً
          is_online: false,
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
          user_type: 'driver',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      if (profileError) {
        throw profileError;
      }

      setLoading(false);
      Alert.alert(
        'تم بنجاح',
        'تم إنشاء ملف السائق بنجاح',
        [
          {
            text: 'متابعة',
            onPress: () => router.replace('/(tabs)/orders'),
          },
        ]
      );
    } catch (error: any) {
      setLoading(false);
      console.log('Driver Setup Error:', error);
      Alert.alert('خطأ', `حدث خطأ أثناء إنشاء ملف السائق: ${error.message || error}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Car size={48} color={colors.primary} />
        <Text style={styles.title}>إعداد ملف السائق</Text>
        <Text style={styles.subtitle}>أدخل معلومات المركبة والرخصة لبدء العمل</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>نوع المركبة</Text>
          <View style={styles.vehicleTypeContainer}>
            {VEHICLE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.vehicleTypeButton,
                  vehicleType === type.key && styles.selectedVehicleTypeButton,
                ]}
                onPress={() => setVehicleType(type.key)}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.vehicleTypeText,
                    vehicleType === type.key && styles.selectedVehicleTypeText,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>طراز المركبة</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="مثال: تويوتا كامري"
              value={vehicleModel}
              onChangeText={setVehicleModel}
              editable={!loading}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>لون المركبة</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="مثال: أبيض"
              value={vehicleColor}
              onChangeText={setVehicleColor}
              editable={!loading}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>رقم اللوحة</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="مثال: أ ب ج 1234"
              value={licensePlate}
              onChangeText={setLicensePlate}
              editable={!loading}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>رقم رخصة القيادة</Text>
          <View style={styles.inputWrapper}>
            <CreditCard size={20} color={colors.textLight} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="رقم رخصة القيادة"
              value={licenseNumber}
              onChangeText={setLicenseNumber}
              editable={!loading}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>تاريخ انتهاء الرخصة</Text>
          <View style={styles.inputWrapper}>
            <Calendar size={20} color={colors.textLight} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={licenseExpiry}
              onChangeText={setLicenseExpiry}
              editable={!loading}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={createDriverProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>إنشاء ملف السائق</Text>
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
  vehicleTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  vehicleTypeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lightGray,
  },
  selectedVehicleTypeButton: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  vehicleTypeText: {
    ...typography.bodyMedium,
    color: colors.textLight,
  },
  selectedVehicleTypeText: {
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