import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreditCard, Plus } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PaymentMethodsScreen() {
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; number: string; expiry: string; isDefault: boolean }>>([]);
  const [showModal, setShowModal] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('payment_methods');
        if (saved) {
          setPaymentMethods(JSON.parse(saved));
        }
      } catch {}
    })();
  }, []);

  const saveMethods = async (methods: Array<{ id: string; number: string; expiry: string; isDefault: boolean }>) => {
    setPaymentMethods(methods);
    try {
      await AsyncStorage.setItem('payment_methods', JSON.stringify(methods));
    } catch {}
  };

  const maskNumber = (num: string) => {
    const clean = num.replace(/\s+/g, '');
    if (clean.length < 4) return '****';
    return `**** **** **** ${clean.slice(-4)}`;
  };

  const addCard = async () => {
    const cleanNumber = cardNumber.replace(/\D/g, '');
    if (cleanNumber.length < 12 || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
      Alert.alert('خطأ', 'الرجاء إدخال رقم بطاقة صحيح وتاريخ انتهاء بالشكل MM/YY');
      return;
    }
    const newCard = {
      id: String(Date.now()),
      number: maskNumber(cleanNumber),
      expiry,
      isDefault: paymentMethods.length === 0,
    };
    await saveMethods([newCard, ...paymentMethods.map(m => ({ ...m, isDefault: m.isDefault }))]);
    setShowModal(false);
    setCardNumber('');
    setExpiry('');
  };

  const removeCard = async (id: string) => {
    const next = paymentMethods.filter(m => m.id !== id);
    if (next.length > 0 && !next.some(m => m.isDefault)) {
      next[0].isDefault = true;
    }
    await saveMethods(next);
  };

  const setDefault = async (id: string) => {
    await saveMethods(paymentMethods.map(m => ({ ...m, isDefault: m.id === id })));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>طرق الدفع</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>البطاقات المحفوظة</Text>
          {paymentMethods.length === 0 ? (
            <View style={styles.emptyContainer}>
              <CreditCard size={64} color={colors.textLight} />
              <Text style={styles.emptyTitle}>لا توجد بطاقات محفوظة</Text>
              <Text style={styles.emptyText}>قم بإضافة بطاقة دفع لبدء الطلب</Text>
            </View>
          ) : (
            paymentMethods.map((method) => (
              <View key={method.id} style={styles.paymentCard}>
                <View style={styles.cardHeader}>
                  <CreditCard size={24} color={colors.primary} />
                  <Text style={styles.cardNumber}>{method.number}</Text>
                  {method.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultText}>افتراضي</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardExpiry}>ينتهي في: {method.expiry}</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    {!method.isDefault && (
                      <TouchableOpacity onPress={() => setDefault(method.id)}>
                        <Text style={styles.makeDefaultText}>تعيين كافتراضي</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => removeCard(method.id)}>
                      <Text style={styles.removeText}>إزالة</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => setShowModal(true)}
      >
        <Plus size={24} color={colors.white} />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.cancelText}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>إضافة بطاقة</Text>
            <TouchableOpacity onPress={addCard}>
              <Text style={styles.saveText}>حفظ</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>رقم البطاقة</Text>
              <TextInput
                style={styles.input}
                placeholder="1234 5678 9012 3456"
                keyboardType="number-pad"
                value={cardNumber}
                onChangeText={setCardNumber}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>تاريخ الانتهاء (MM/YY)</Text>
              <TextInput
                style={styles.input}
                placeholder="MM/YY"
                value={expiry}
                onChangeText={setExpiry}
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>
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
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
  },
  paymentCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardNumber: {
    ...typography.body,
    color: colors.text,
    marginHorizontal: spacing.sm,
    flex: 1,
  },
  defaultBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  defaultText: {
    ...typography.caption,
    color: colors.primary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardExpiry: {
    ...typography.caption,
    color: colors.textLight,
  },
  removeText: {
    ...typography.caption,
    color: colors.error,
  },
  makeDefaultText: {
    ...typography.caption,
    color: colors.primary,
  },
  addButton: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  cancelText: {
    ...typography.body,
    color: colors.textLight,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  saveText: {
    ...typography.body,
    color: colors.primary,
  },
  modalContent: {
    padding: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.lightGray,
  },
});