import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

export default function DriverWalletScreen() {
  const { user } = useAuth();
  const [balance, setBalance] = React.useState<number>(0);
  const [currency, setCurrency] = React.useState<string>('EGP');
  const [txs, setTxs] = React.useState<any[]>([]);
  const [holds, setHolds] = React.useState<any[]>([]);
  const [totalHeld, setTotalHeld] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);

  const fetchWallet = async () => {
    try {
      if (!user?.id) return;
      setLoading(true);
      // Ensure wallet exists
      await supabase.rpc('create_wallet_if_missing', { p_owner: user.id, p_type: 'driver', p_trial_days: 30 });
      const { data: w } = await supabase
        .from('wallets')
        .select('id, balance, currency')
        .eq('owner_id', user.id)
        .eq('owner_type', 'driver')
        .maybeSingle();
      let walletId: string | null = null;
      if (w) { 
        setBalance(w.balance || 0); 
        setCurrency(w.currency || 'EGP'); 
        walletId = w.id as string;
      }
      const { data: t } = await supabase
        .from('wallet_transactions')
        .select('id, type, amount, memo, related_order_id, created_at')
        .in('type', ['deposit','withdraw','hold','release','capture','transfer_in','transfer_out','adjust'])
        .order('created_at', { ascending: false })
        .limit(100);
      setTxs(t || []);

      // Fetch active holds for this driver's wallet
      if (walletId) {
        const { data: h } = await supabase
          .from('wallet_holds')
          .select('id, amount, related_order_id, status, created_at')
          .eq('wallet_id', walletId)
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        const holdsList = h || [];
        setHolds(holdsList);
        const sum = holdsList.reduce((acc: number, it: any) => acc + Number(it.amount || 0), 0);
        setTotalHeld(sum);
      } else {
        setHolds([]);
        setTotalHeld(0);
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
        <Text style={styles.title}>محفظتي (السائق)</Text>
        <Text style={styles.balance}>{balance.toFixed(2)} {currency}</Text>
        <Text style={styles.note}>يجب أن لا يقل الرصيد عن 50 جنيه لقبول الطلبات بعد انتهاء الفترة التجريبية.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>المعاملات الأخيرة</Text>
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
        <Text style={styles.subtitle}>المبالغ المحجوزة</Text>
        {loading ? (
          <Text style={styles.muted}>جاري التحميل...</Text>
        ) : holds.length === 0 ? (
          <Text style={styles.muted}>لا توجد مبالغ محجوزة حالياً</Text>
        ) : (
          <>
            {holds.map(h => (
              <View key={h.id} style={styles.txRow}>
                <Text style={styles.txLeft}>{new Date(h.created_at).toLocaleString('ar-EG')}</Text>
                <View style={{flex:1}} />
                <Text style={styles.txType}>حجز</Text>
                <Text style={styles.txAmount}>{Number(h.amount).toFixed(2)}</Text>
              </View>
            ))}
            <View style={[styles.txRow, { borderBottomWidth: 0, marginTop: spacing.sm }] }>
              <Text style={styles.txType}>إجمالي المحجوز</Text>
              <View style={{flex:1}} />
              <Text style={styles.txAmount}>{totalHeld.toFixed(2)} {currency}</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>الشحن</Text>
        <Text style={styles.muted}>يمكنك شحن محفظتك عبر الطرق المتاحة (فودافون كاش/إنستا/تحويل بنكي). تواصل مع الدعم إن احتجت مساعدة.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => Alert.alert('معلومة','سيتم تفعيل بوابات الدفع قريباً.')}> 
          <Text style={styles.btnText}>شحن المحفظة</Text>
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
