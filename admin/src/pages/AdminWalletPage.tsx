import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';

interface Wallet { id: string; owner_id: string | null; owner_type: string; balance: number; currency: string; }
interface Tx { id: string; type: string; amount: number; memo: string | null; related_order_id: string | null; created_at: string; }

export default function AdminWalletPage() {
  const { currency: settingsCurrency } = useSettings();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'ads' | 'summary'>('all');

  const fetchData = async () => {
    try {
      setLoading(true);
      // Prefer RPC with SECURITY DEFINER to avoid RLS blockers and auto-create wallet if missing
      const { data: overview, error } = await supabase.rpc('get_admin_wallet_overview', { p_limit: 200 });
      if (!error && overview) {
        const o: any = overview;
        const w: any = o.wallet || null;
        const t: any[] = Array.isArray(o.transactions) ? o.transactions : [];
        setWallet(w ? { id: w.id, owner_id: w.owner_id, owner_type: w.owner_type, balance: w.balance, currency: w.currency } : null);
        // Also fetch any missing types (e.g., 'subscription','commission') and merge
        if (w?.id) {
          const { data: extra } = await supabase
            .from('wallet_transactions')
            .select('id, type, amount, memo, related_order_id, created_at')
            .eq('wallet_id', w.id)
            .in('type', ['subscription','commission','ad_spend']);
          const base = t.map((row: any) => ({ id: row.id, type: row.type, amount: row.amount, memo: row.memo, related_order_id: row.related_order_id, created_at: row.created_at }));
          const byId: Record<string, any> = {};
          base.forEach(r => { byId[r.id] = r; });
          (extra || []).forEach((r: any) => { byId[r.id] = r; });
          setTxs(Object.values(byId) as any);
        } else {
          setTxs(t.map((row: any) => ({ id: row.id, type: row.type, amount: row.amount, memo: row.memo, related_order_id: row.related_order_id, created_at: row.created_at })));
        }
        return;
      }
      // Fallback (legacy): direct queries (may be blocked by RLS)
      const { data: existing } = await supabase
        .from('wallets')
        .select('*')
        .eq('owner_type', 'admin')
        .limit(1)
        .maybeSingle();
      const finalWallet: Wallet | null = (existing as any) || null;
      setWallet(finalWallet);
      if (!finalWallet) { setTxs([]); return; }
      const { data: adminTxs } = await supabase
        .from('wallet_transactions')
        .select('id, type, amount, memo, related_order_id, created_at, wallet_id')
        .eq('wallet_id', finalWallet.id)
        .in('type', ['deposit','withdraw','hold','release','capture','transfer_in','transfer_out','adjust','ad_payment','ad_refund','subscription','commission','ad_spend'])
        .order('created_at', { ascending: false })
        .limit(200);
      setTxs(((adminTxs as any) || []).map(({ wallet_id, ...rest }: any) => rest));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const adTxs = useMemo(() => txs.filter(t => t.type === 'ad_payment' || t.type === 'ad_refund' || t.type === 'ad_spend'), [txs]);
  const baseList = activeTab === 'ads' ? adTxs : txs;
  const filtered = baseList.filter(t => filterType === 'all' || t.type === filterType);
  const walletCurrency = wallet?.currency || settingsCurrency || 'EGP';

  // Aggregation for Summary tab
  const summary = useMemo(() => {
    const payments = adTxs.filter(t => t.type === 'ad_payment').reduce((s, t) => s + (t.amount || 0), 0);
    const refunds = adTxs.filter(t => t.type === 'ad_refund').reduce((s, t) => s + (t.amount || 0), 0);
    const net = payments - refunds;
    const dailyMap: Record<string, { payment: number; refund: number; net: number }> = {};
    adTxs.forEach(t => {
      const day = t.created_at.slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { payment: 0, refund: 0, net: 0 };
      if (t.type === 'ad_payment') dailyMap[day].payment += t.amount || 0;
      if (t.type === 'ad_refund') dailyMap[day].refund += t.amount || 0;
      dailyMap[day].net = dailyMap[day].payment - dailyMap[day].refund;
    });
    const daily = Object.entries(dailyMap)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return { payments, refunds, net, daily };
  }, [adTxs]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">محفظة المنصة</h1>
      {loading ? (
        <div>جاري التحميل...</div>
      ) : (
        <>
          <div className="mb-4 p-4 bg-white rounded shadow">
            <div className="text-gray-600">الرصيد الحالي</div>
            <div className="text-3xl font-bold">{(wallet?.balance ?? 0).toFixed(2)} {walletCurrency}</div>
          </div>

          {/* Tabs */}
          <div className="mb-3 flex gap-2">
            <button onClick={() => { setActiveTab('all'); setFilterType('all'); }} className={`px-3 py-1 rounded ${activeTab==='all' ? 'bg-primary text-white' : 'bg-white border'}`}>الكل</button>
            <button onClick={() => { setActiveTab('ads'); setFilterType('all'); }} className={`px-3 py-1 rounded ${activeTab==='ads' ? 'bg-primary text-white' : 'bg-white border'}`}>معاملات الإعلانات</button>
            <button onClick={() => setActiveTab('summary')} className={`px-3 py-1 rounded ${activeTab==='summary' ? 'bg-primary text-white' : 'bg-white border'}`}>ملخص الإعلانات</button>
            <button onClick={fetchData} className="ml-auto px-3 py-1 rounded bg-gray-100 border">تحديث</button>
          </div>

          {/* Filters (contextual) */}
          {activeTab !== 'summary' && (
            <div className="mb-2 flex gap-2 items-center">
              <span className="text-sm">تصفية حسب النوع:</span>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border rounded px-2 py-1">
                <option value="all">الكل</option>
                {activeTab === 'all' && (
                  <>
                    <option value="transfer_in">تحويل داخلي (داخل)</option>
                    <option value="transfer_out">تحويل داخلي (خارج)</option>
                    <option value="deposit">إيداع</option>
                    <option value="withdraw">سحب</option>
                    <option value="capture">تحصيل</option>
                    <option value="hold">حجز</option>
                    <option value="release">إرجاع حجز</option>
                    <option value="adjust">تسوية</option>
                    <option value="subscription">اشتراك</option>
                    <option value="commission">عمولة</option>
                  </>
                )}
                <option value="ad_payment">دفعة إعلان</option>
                <option value="ad_refund">استرجاع إعلان</option>
                <option value="ad_spend">تحصيل إنفاق إعلان</option>
              </select>
            </div>
          )}

          {activeTab === 'summary' ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-white rounded shadow p-3 text-center">
                  <div className="text-xs text-gray-500">إجمالي دفعات الإعلانات</div>
                  <div className="text-lg font-semibold">{summary.payments.toFixed(2)} {walletCurrency}</div>
                </div>
                <div className="bg-white rounded shadow p-3 text-center">
                  <div className="text-xs text-gray-500">إجمالي الاسترجاعات</div>
                  <div className="text-lg font-semibold">{summary.refunds.toFixed(2)} {walletCurrency}</div>
                </div>
                <div className="bg-white rounded shadow p-3 text-center">
                  <div className="text-xs text-gray-500">الصافي</div>
                  <div className="text-lg font-semibold">{summary.net.toFixed(2)} {walletCurrency}</div>
                </div>
              </div>
              <div className="bg-white rounded shadow overflow-auto">
                <table className="min-w-full text-right">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-3 py-2">اليوم</th>
                      <th className="px-3 py-2">دفعات إعلانات</th>
                      <th className="px-3 py-2">استرجاعات</th>
                      <th className="px-3 py-2">صافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.daily.map(row => (
                      <tr key={row.date} className="border-t">
                        <td className="px-3 py-2">{row.date}</td>
                        <td className="px-3 py-2">{row.payment.toFixed(2)} {walletCurrency}</td>
                        <td className="px-3 py-2">{row.refund.toFixed(2)} {walletCurrency}</td>
                        <td className="px-3 py-2">{row.net.toFixed(2)} {walletCurrency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
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
                      <td className="px-3 py-2">{t.amount.toFixed(2)} {walletCurrency}</td>
                      <td className="px-3 py-2">{t.memo || '-'}</td>
                      <td className="px-3 py-2">{t.related_order_id?.slice(0,8) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
