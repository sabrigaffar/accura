import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Row {
  id: string;
  merchant_id: string;
  monthly_fee: number;
  status: 'active'|'grace'|'expired';
  trial_end_at: string | null;
  last_paid_at: string | null;
  next_due_at: string | null;
  merchant?: { id: string; name_ar?: string|null } | null;
}

export default function MerchantSubscriptionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all'|'active'|'grace'|'expired'>('all');

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('merchant_subscriptions')
        .select('id, merchant_id, monthly_fee, status, trial_end_at, last_paid_at, next_due_at, merchant:merchants(id, name_ar)')
        .order('next_due_at', { ascending: true });
      if (error) throw error;
      setRows((data as any) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = rows.filter(r => filter === 'all' ? true : r.status === filter);

  const chargeNow = async (r: Row) => {
    try {
      const { data, error } = await supabase.rpc('charge_merchant_subscription', { p_merchant_id: r.merchant_id });
      if (error) throw error;
      const ok = data?.[0]?.ok as boolean | undefined;
      const message = (data?.[0]?.message as string | undefined) || 'تم التحصيل';
      alert(message);
      if (ok) await fetchData();
    } catch (e) {
      alert('تعذر التحصيل الآن');
      console.error(e);
    }
  };

  const toggleVisibility = async (r: Row) => {
    try {
      // Placeholder: flip status active/expired
      const newStatus = r.status === 'expired' ? 'active' : 'expired';
      const { error } = await supabase
        .from('merchant_subscriptions')
        .update({ status: newStatus })
        .eq('id', r.id);
      if (error) throw error;
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">اشتراكات المتاجر</h1>

      <div className="mb-3 flex items-center gap-2">
        <span>تصفية:</span>
        <select value={filter} onChange={e=>setFilter(e.target.value as any)} className="border rounded px-2 py-1">
          <option value="all">الكل</option>
          <option value="active">نشط</option>
          <option value="grace">مهلة</option>
          <option value="expired">منتهي</option>
        </select>
        <button className="ml-auto px-3 py-1 bg-primary text-white rounded" onClick={fetchData}>تحديث</button>
      </div>

      <div className="bg-white rounded shadow overflow-auto">
        <table className="min-w-full text-right">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2">المتجر</th>
              <th className="px-3 py-2">الرسوم</th>
              <th className="px-3 py-2">الحالة</th>
              <th className="px-3 py-2">نهاية التجربة</th>
              <th className="px-3 py-2">آخر سداد</th>
              <th className="px-3 py-2">الاستحقاق القادم</th>
              <th className="px-3 py-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-4" colSpan={7}>جاري التحميل...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-3 py-4" colSpan={7}>لا توجد بيانات</td></tr>
            ) : (
              filtered.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.merchant?.name_ar || r.merchant_id.slice(0,8)}</td>
                  <td className="px-3 py-2">{(r.monthly_fee || 100).toFixed(2)} EGP</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{r.trial_end_at ? new Date(r.trial_end_at).toLocaleDateString('ar-EG') : '-'}</td>
                  <td className="px-3 py-2">{r.last_paid_at ? new Date(r.last_paid_at).toLocaleString('ar-EG') : '-'}</td>
                  <td className="px-3 py-2">{r.next_due_at ? new Date(r.next_due_at).toLocaleDateString('ar-EG') : '-'}</td>
                  <td className="px-3 py-2 flex gap-2 justify-end">
                    <button className="px-3 py-1 bg-primary text-white rounded" onClick={()=>chargeNow(r)}>تحصيل 100 الآن</button>
                    <button className="px-3 py-1 bg-gray-200 rounded" onClick={()=>toggleVisibility(r)}>
                      {r.status === 'expired' ? 'تفعيل الظهور' : 'إيقاف الظهور'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-500 mt-3">سيتم لاحقاً ربط التحصيل بتحويل مباشر لمحفظة المنصة وتحديث رصيد التاجر تلقائياً.</p>
    </div>
  );
}
