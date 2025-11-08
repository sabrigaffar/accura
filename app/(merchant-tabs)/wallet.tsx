import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveStore } from '@/contexts/ActiveStoreContext';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

export default function MerchantWalletScreen() {
  const { user } = useAuth();
  const { activeStore, isAllStoresSelected, stores } = useActiveStore();
  const [balance, setBalance] = React.useState<number>(0);
  const [currency, setCurrency] = React.useState<string>('EGP');
  const [txs, setTxs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);

  const fetchWallet = async () => {
    try {
      if (!user?.id) {
        console.log('💰 [Wallet] No user ID');
        return;
      }
      console.log('💰 [Wallet] Fetching wallet for user:', user.id);
      
      // Ensure user wallet exists
      await supabase.rpc('create_wallet_if_missing', { 
        p_owner: user.id, 
        p_type: 'merchant', 
        p_trial_days: 30 
      });

      // Load USER wallet (shared across all stores)
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id, owner_id, balance, currency')
        .eq('owner_type', 'merchant')
        .eq('owner_id', user.id)
        .single();

      if (walletError) {
        console.error('💰 [Wallet] Error loading wallet:', walletError);
        setBalance(0); setTxs([]); setCurrency('EGP');
        return;
      }

      console.log('💰 [Wallet] User wallet:', wallet);
      console.log('💰 [Wallet] Balance:', wallet?.balance || 0);
      
      setBalance(Number(wallet?.balance) || 0);
      setCurrency(wallet?.currency || 'EGP');

      // Load transactions for user wallet
      if (wallet) {
        const { data: t } = await supabase
          .from('wallet_transactions')
          .select('id, type, amount, memo, related_order_id, created_at')
          .eq('wallet_id', wallet.id)
          .order('created_at', { ascending: false })
          .limit(100);
        setTxs(t || []);
      } else {
        setTxs([]);
      }
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
        <Text style={styles.title}>محنفظتي</Text>
        <Text style={styles.balance}>{balance.toFixed(2)} {currency}</Text>
        <Text style={styles.note}>محفظتك موحدة لجميع متاجرك. يمكنك استخدام الرصيد للإعلانات المموّلة والاشتراكات.</Text>
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

      <View style={styles.card}>
        <Text style={styles.subtitle}>سداد الاشتراك</Text>
        <Text style={styles.muted}>سدد 100 جنيه لكل متجر نشط لضمان استمرار ظهور متجرك. سيتم توفير بوابات دفع، حالياً تواصل مع الدعم لاستلام بيانات التحويل.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => Alert.alert('سداد','سيتم توفير الدفع الآلي قريباً.')}> 
          <Text style={styles.btnText}>سداد الاشتراك</Text>
        </TouchableOpacity>
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
  note: { ...typography.caption, color: colors.textLight },
  muted: { ...typography.body, color: colors.textLight },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  txLeft: { ...typography.caption, color: colors.textLight },
  txType: { ...typography.caption, color: colors.text, marginHorizontal: spacing.sm },
  txAmount: { ...typography.bodyMedium, color: colors.text },
  btn: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', marginTop: spacing.md },
  btnText: { ...typography.bodyMedium, color: colors.white },
});
