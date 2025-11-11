import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, borderRadius, typography } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('app_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          setDarkMode(!!parsed.darkMode);
          setMarketing(!!parsed.marketing);
        }
      } catch {}
    })();
  }, []);

  const save = async (next: { darkMode: boolean; marketing: boolean }) => {
    try { await AsyncStorage.setItem('app_settings', JSON.stringify(next)); } catch {}
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الإعدادات</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>التفضيلات</Text>
          <View style={styles.item}>
            <Text style={styles.itemText}>المظهر الداكن</Text>
            <Switch
              value={darkMode}
              onValueChange={(v) => { setDarkMode(v); save({ darkMode: v, marketing }); }}
            />
          </View>
          <View style={styles.item}>
            <Text style={styles.itemText}>استقبال رسائل تسويقية</Text>
            <Switch
              value={marketing}
              onValueChange={(v) => { setMarketing(v); save({ darkMode, marketing: v }); }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الدعم</Text>
          <TouchableOpacity style={styles.item} onPress={() => router.push('/profile/complaints' as any)}>
            <Text style={styles.itemText}>الشكاوى</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    backgroundColor: theme.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: { ...typography.h2, color: theme.text, textAlign: 'center' },
  content: { flex: 1 },
  section: { backgroundColor: theme.white, marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: theme.text, padding: spacing.md, paddingBottom: spacing.sm },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: theme.border },
  itemText: { ...typography.body, color: theme.text },
});
