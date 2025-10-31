import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

export default function CustomerWalletScreen() {
  const { user } = useAuth();
  const [balance, setBalance] = React.useState<number>(0);
  const [currency, setCurrency] = React.useState<string>('EGP');
  const [txs, setTxs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);

  const fetchWallet = async () => {
    try {
      if (!user?.id) return;
      await supabase.rpc('create_wallet_if_missing', { p_owner: user.id, p_type: 'customer', p_trial_days: 0 });
      const { data: w } = await supabase
        .from('wallets')
        .select('id, balance, currency')
        .eq('owner_id', user.id)
        .eq('owner_type', 'customer')
        .maybeSingle();
      if (w) { setBalance(w.balance || 0); setCurrency(w.currency || 'EGP'); }
      const { data: t } = await supabase
        .from('wallet_transactions')
        .select('id, type, amount, memo, related_order_id, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      setTxs(t || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  React.useEffect(() => { fetchWallet(); }, [user?.id]);
  const onRefresh = () => { setRefreshing(true); fetchWallet(); };

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.card}>
        <Text style={styles.title}>المحفظة</Text>
        <Text style={styles.balance}>{balance.toFixed(2)} {currency}</Text>
        <Text style={styles.note}>يمكنك استخدام المحفظة للدفع والحصول على عروض خاصة.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => Alert.alert('معلومة','سيتم تفعيل بوابات الدفع قريباً، يمكنك الشحن من هنا.')}> 
          <Text style={styles.btnText}>شحن المحفظة</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>المعاملات</Text>
        {loading ? (
          <Text style={styles.muted}>جاري التحميل...</Text>
        ) : txs.length === 0 ? (
          <Text style={styles.muted}>لا توجد معاملات</Text>
        ) : (
          txs.map(tx => (
            <View key={tx.id} style={styles.txRow}>
              <Text style={styles.txLeft}>{new Date(tx.created_at).toLocaleString('ar-EG')}</Text>
              <View style={{flex:1}} />
              <Text style={styles.txType}>{tx.type}</Text>
              <Text style={styles.txAmount}>{Number(tx.amount).toFixed(2)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { backgroundColor: colors.white, padding: spacing.lg, margin: spacing.md, borderRadius: borderRadius.lg },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  balance: { ...typography.h1, color: colors.primary, marginVertical: spacing.sm },
  note: { ...typography.caption, color: colors.textLight, marginBottom: spacing.sm },
  muted: { ...typography.body, color: colors.textLight },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  txLeft: { ...typography.caption, color: colors.textLight },
  txType: { ...typography.caption, color: colors.text, marginHorizontal: spacing.sm },
  txAmount: { ...typography.bodyMedium, color: colors.text },
  btn: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', marginTop: spacing.md },
  btnText: { ...typography.bodyMedium, color: colors.white },
});
