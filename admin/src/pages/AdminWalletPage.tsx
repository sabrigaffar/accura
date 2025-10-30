import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Wallet { id: string; owner_id: string | null; owner_type: string; balance: number; currency: string; }
interface Tx { id: string; type: string; amount: number; memo: string | null; related_order_id: string | null; created_at: string; }

export default function AdminWalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: existing } = await supabase
        .from('wallets')
        .select('*')
        .eq('owner_type', 'admin')
        .limit(1)
        .maybeSingle();

      let finalWallet: Wallet | null = (existing as any) || null;

      if (!finalWallet) {
        // Try to create a default admin wallet (RLS: only admin users can create)
        const { data: created, error: createErr } = await supabase
          .from('wallets')
          .insert({ owner_id: crypto.randomUUID(), owner_type: 'admin', balance: 0, currency: 'EGP' })
          .select('*')
          .maybeSingle();
        if (createErr) console.warn('Cannot auto create admin wallet', createErr);
        finalWallet = (created as any) || null;
      }

      setWallet(finalWallet);

      if (finalWallet?.id) {
        const { data: adminTxs } = await supabase
          .from('wallet_transactions')
          .select('id, type, amount, memo, related_order_id, created_at, wallet_id')
          .eq('wallet_id', finalWallet.id)
          .in('type', ['deposit','withdraw','hold','release','capture','transfer_in','transfer_out','adjust'])
          .order('created_at', { ascending: false })
          .limit(200);
        setTxs(((adminTxs as any) || []).map(({ wallet_id, ...rest }: any) => rest));
      } else {
        setTxs([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = txs.filter(t => filterType === 'all' || t.type === filterType);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">محفظة المنصة</h1>
      {loading ? (
        <div>جاري التحميل...</div>
      ) : (
        <>
          <div className="mb-4 p-4 bg-white rounded shadow">
            <div className="text-gray-600">الرصيد الحالي</div>
            <div className="text-3xl font-bold">{(wallet?.balance ?? 0).toFixed(2)} {wallet?.currency || 'EGP'}</div>
          </div>

          <div className="mb-2 flex gap-2 items-center">
            <span className="text-sm">تصفية حسب النوع:</span>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border rounded px-2 py-1">
              <option value="all">الكل</option>
              <option value="transfer_in">تحويل داخلي (داخل)</option>
              <option value="transfer_out">تحويل داخلي (خارج)</option>
              <option value="deposit">إيداع</option>
              <option value="withdraw">سحب</option>
              <option value="capture">تحصيل</option>
              <option value="hold">حجز</option>
              <option value="release">إرجاع حجز</option>
              <option value="adjust">تسوية</option>
            </select>
          </div>

          <div className="bg-white rounded shadow overflow-auto">
            <table className="min-w-full text-right">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-2">التاريخ</th>
                  <th className="px-3 py-2">النوع</th>
                  <th className="px-3 py-2">القيمة</th>
                  <th className="px-3 py-2">ملاحظة</th>
                  <th className="px-3 py-2">الطلب</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-t">
                    <td className="px-3 py-2">{new Date(t.created_at).toLocaleString('ar-EG')}</td>
                    <td className="px-3 py-2">{t.type}</td>
                    <td className="px-3 py-2">{t.amount.toFixed(2)}</td>
                    <td className="px-3 py-2">{t.memo || '-'}</td>
                    <td className="px-3 py-2">{t.related_order_id?.slice(0,8) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
