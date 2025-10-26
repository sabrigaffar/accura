import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [marketing, setMarketing] = useState(false);

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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  content: { flex: 1 },
  section: { backgroundColor: colors.white, marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, padding: spacing.md, paddingBottom: spacing.sm },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemText: { ...typography.body, color: colors.text },
});
