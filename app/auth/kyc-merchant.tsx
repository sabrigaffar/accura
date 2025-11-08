import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, ScrollView } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Upload, Image as ImageIcon, FileText } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { uploadToKyc } from '@/lib/imageUpload';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MerchantKycScreen() {
  const { user } = useAuth();
  const [idDocumentUri, setIdDocumentUri] = useState<string | null>(null);
  const [commercialRecordUri, setCommercialRecordUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        router.replace('/auth/login' as any);
        return;
      }
      const { data: mp } = await supabase
        .from('merchant_profiles')
        .select('approval_status')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (cancelled) return;

      // إذا كان موافقاً عليه انتقل مباشرة للتبويبات
      if (mp?.approval_status === 'approved') {
        router.replace('/(merchant-tabs)' as any);
        return;
      }

      // اسمح بدخول هذه الشاشة فقط مباشرة بعد التسجيل
      let allowed = false;
      try {
        const flag = await AsyncStorage.getItem('kyc_merchant_from_signup');
        allowed = flag === 'true';
      } catch {}
      if (!allowed) {
        // إن لم يأت من التسجيل، رجّعه لتسجيل الدخول أو شاشة الانتظار بحسب الحالة
        if (mp) {
          router.replace('/auth/waiting-approval' as any);
        } else {
          router.replace('/auth/login' as any);
        }
        return;
      }

      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const pickImage = async (setter: (uri: string) => void) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 2],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setter(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('خطأ', 'تعذر اختيار الصورة');
    }
  };

  const submitKyc = async () => {
    if (!user?.id) return;
    if (!idDocumentUri && !commercialRecordUri) {
      Alert.alert('مطلوب', 'يرجى رفع صورة الهوية أو السجل التجاري (واحد على الأقل)');
      return;
    }

    setUploading(true);
    try {
      let idDocPath: string | null = null;
      let crDocPath: string | null = null;

      if (idDocumentUri) {
        idDocPath = await uploadToKyc(idDocumentUri, user.id, 'merchants');
        if (!idDocPath) throw new Error('فشل رفع صورة الهوية');
      }
      if (commercialRecordUri) {
        crDocPath = await uploadToKyc(commercialRecordUri, user.id, 'merchants');
        if (!crDocPath) throw new Error('فشل رفع السجل التجاري');
      }

      const { error } = await supabase
        .from('merchant_profiles')
        .upsert({
          owner_id: user.id,
          id_document_url: idDocPath,
          commercial_record_url: crDocPath,
          approval_status: 'pending',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'owner_id' });
      if (error) throw error;

      // إلغاء العلم بعد الإرسال الناجح
      try { await AsyncStorage.setItem('kyc_merchant_from_signup', 'false'); } catch {}

      Alert.alert(
        'تم استلام طلبك',
        'تم إرسال مستنداتك لمراجعة الإدارة. سنخبرك فور الموافقة.',
        [{
          text: 'متابعة',
          onPress: () => router.replace('/auth/waiting-approval' as any)
        }]
      );
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'فشل إرسال مستنداتك، حاول مرة أخرى');
    } finally {
      setUploading(false);
    }
  };

  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <FileText size={48} color={colors.primary} />
        <Text style={styles.title}>توثيق حساب التاجر</Text>
        <Text style={styles.subtitle}>يرجى رفع هوية شخصية أو سجل تجاري للتوثيق قبل إنشاء المتجر</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>📄 صورة الهوية (اختياري لكن مطلوب أحد المستندين)</Text>
          <TouchableOpacity style={styles.imageUploadButton} onPress={() => pickImage((uri) => setIdDocumentUri(uri))} disabled={uploading}>
            {idDocumentUri ? (
              <Image source={{ uri: idDocumentUri }} style={styles.preview} />
            ) : (
              <View style={styles.imageUploadPlaceholder}>
                <Upload size={32} color={colors.textLight} />
                <Text style={styles.imageUploadText}>اضغط لرفع صورة الهوية</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>🧾 السجل التجاري (اختياري لكن مطلوب أحد المستندين)</Text>
          <TouchableOpacity style={styles.imageUploadButton} onPress={() => pickImage((uri) => setCommercialRecordUri(uri))} disabled={uploading}>
            {commercialRecordUri ? (
              <Image source={{ uri: commercialRecordUri }} style={styles.preview} />
            ) : (
              <View style={styles.imageUploadPlaceholder}>
                <ImageIcon size={32} color={colors.textLight} />
                <Text style={styles.imageUploadText}>اضغط لرفع السجل التجاري</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.button, uploading && styles.buttonDisabled]} onPress={submitKyc} disabled={uploading}>
          {uploading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>إرسال للمراجعة</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  title: { ...typography.h2, color: colors.text, marginTop: spacing.sm },
  subtitle: { ...typography.body, color: colors.textLight, textAlign: 'center', marginTop: spacing.xs },
  formContainer: { backgroundColor: colors.white, padding: spacing.lg, borderRadius: borderRadius.lg },
  inputContainer: { marginBottom: spacing.lg },
  label: { ...typography.bodyMedium, color: colors.text, marginBottom: spacing.sm },
  imageUploadButton: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, backgroundColor: colors.lightGray, alignItems: 'center', justifyContent: 'center', height: 180 },
  imageUploadPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imageUploadText: { ...typography.body, color: colors.textLight, marginTop: spacing.xs },
  preview: { width: '100%', height: 178, borderRadius: borderRadius.md },
  button: { backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...typography.bodyMedium, color: colors.white, fontWeight: '600' },
});
