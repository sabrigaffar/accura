import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Languages, Check } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

export default function LanguageScreen() {
  const [selectedLanguage, setSelectedLanguage] = useState('ar');

  const languages = [
    { code: 'ar', name: 'العربية', nativeName: 'العربية' },
    { code: 'en', name: 'الإنجليزية', nativeName: 'English' },
    { code: 'ur', name: 'الأوردية', nativeName: 'اردو' },
    { code: 'fa', name: 'الفارسية', nativeName: 'فارسی' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>اللغة</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>اختر اللغة</Text>
          {languages.map((language) => (
            <TouchableOpacity
              key={language.code}
              style={styles.languageItem}
              onPress={() => setSelectedLanguage(language.code)}
            >
              <View style={styles.languageInfo}>
                <Languages size={20} color={colors.primary} />
                <View style={styles.languageText}>
                  <Text style={styles.languageName}>{language.name}</Text>
                  <Text style={styles.languageNative}>{language.nativeName}</Text>
                </View>
              </View>
              {selectedLanguage === language.code && (
                <View style={styles.checkContainer}>
                  <Check size={20} color={colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            ملاحظة: سيتم تطبيق التغييرات بعد إعادة تشغيل التطبيق
          </Text>
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
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.white,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageText: {
    marginRight: spacing.md,
  },
  languageName: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  languageNative: {
    ...typography.caption,
    color: colors.textLight,
  },
  checkContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteContainer: {
    padding: spacing.md,
  },
  noteText: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
  },
});