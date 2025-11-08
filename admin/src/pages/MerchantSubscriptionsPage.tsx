import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';

interface Row {
  id: string;
  merchant_id: string;
  monthly_fee: number;
  status: 'active'|'grace'|'expired';
  trial_end_at: string | null;
  last_paid_at: string | null;
  next_due_at: string | null;
  merchant?: { id: string; name_ar?: string|null; is_active?: boolean|null } | null;
  has_subscription?: boolean;
  owner_id?: string | null;
  owner_name?: string | null;
  phone_number?: string | null;
  owner_wallet_balance?: number | null;
}

export default function MerchantSubscriptionsPage() {
  const { currency } = useSettings();
  const location = useLocation();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all'|'active'|'grace'|'expired'|'visible_unpaid'>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .rpc('get_admin_merchant_subscriptions', {
          p_include_inactive: true,
          p_owner_id: ownerFilter && ownerFilter.trim().length > 0 ? ownerFilter.trim() : null,
        });
      let mapped: Row[] = ((data as any[]) || []).map((r: any) => ({
        id: r.subscription_id || r.merchant_id,
        merchant_id: r.merchant_id,
        monthly_fee: r.monthly_fee ?? 100,
        status: (r.status as 'active'|'grace'|'expired') ?? 'grace',
        trial_end_at: r.trial_end_at ?? null,
        last_paid_at: r.last_paid_at ?? null,
        next_due_at: r.next_due_at ?? null,
        merchant: { id: r.merchant_id, name_ar: r.merchant_name, is_active: r.is_active },
        has_subscription: !!r.has_subscription,
        owner_id: r.owner_id ?? null,
        owner_name: r.owner_name ?? null,
        phone_number: r.phone_number ?? null,
        owner_wallet_balance: null,
      }));
      // Fallback: if RPC missing or returned empty and ownerFilter is specified, query directly
      if ((error || mapped.length === 0) && ownerFilter && ownerFilter.trim().length > 0) {
        const fb = await supabase
          .from('merchants')
          .select('id, name_ar, is_active, owner_id, phone_number, owner:profiles!merchants_owner_id_fkey(full_name), subscription:merchant_subscriptions!left(id, merchant_id, monthly_fee, status, trial_end_at, last_paid_at, next_due_at)')
          .eq('owner_id', ownerFilter.trim())
          .order('name_ar', { ascending: true });
        if (!fb.error) {
          mapped = ((fb.data as any[]) || []).map((m: any) => ({
            id: m.subscription?.id || m.id,
            merchant_id: m.id,
            monthly_fee: m.subscription?.monthly_fee ?? 100,
            status: (m.subscription?.status as 'active'|'grace'|'expired') ?? 'grace',
            trial_end_at: m.subscription?.trial_end_at ?? null,
            last_paid_at: m.subscription?.last_paid_at ?? null,
            next_due_at: m.subscription?.next_due_at ?? null,
            merchant: { id: m.id, name_ar: m.name_ar, is_active: m.is_active },
            has_subscription: !!m.subscription,
            owner_id: m.owner_id ?? null,
            owner_name: (Array.isArray(m.owner) ? m.owner[0]?.full_name : m.owner?.full_name) ?? null,
            phone_number: m.phone_number ?? null,
            owner_wallet_balance: null,
          }));
        }
      }

      // Fetch owner wallet balances (owner_type='merchant')
      const ownerIds = Array.from(new Set(mapped.map(r => r.owner_id).filter(Boolean))) as string[];
      if (ownerIds.length > 0) {
        const wb = await supabase
          .from('wallets')
          .select('owner_id, balance, owner_type')
          .in('owner_id', ownerIds)
          .eq('owner_type', 'merchant');
        if (!wb.error && wb.data) {
          const balMap = new Map<string, number>();
          (wb.data as any[]).forEach(w => {
            balMap.set(w.owner_id, Number(w.balance) || 0);
          });
          mapped = mapped.map(r => ({ ...r, owner_wallet_balance: r.owner_id ? (balMap.get(r.owner_id) ?? 0) : null }));
        }
      }
      setRows(mapped);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Prefill owner from ?owner= query parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const owner = params.get('owner');
    if (owner) setOwnerFilter(owner);
  }, [location.search]);

  useEffect(() => { fetchData(); }, []);

  // Visible to customers = merchant.is_active AND ((status='active' AND next_due_at in future) OR within trial)
  const isVisible = (r: Row) => {
    const now = Date.now();
    const inTrial = r.trial_end_at ? new Date(r.trial_end_at).getTime() > now : false;
    const merchantActive = r.merchant?.is_active !== false; // default true if missing
    const activeAndNotDue = r.status === 'active' && (r.next_due_at ? new Date(r.next_due_at).getTime() > now : false);
    return merchantActive && (activeAndNotDue || inTrial);
  };

  // Unpaid now: in grace OR (in trial and never paid)
  const isUnpaid = (r: Row) => {
    const inTrial = r.trial_end_at ? new Date(r.trial_end_at) > new Date() : false;
    const neverPaid = !r.last_paid_at;
    const missingSub = r.has_subscription === false;
    return (r.status === 'grace') || (inTrial && neverPaid) || missingSub;
  };

  // Due now: trial ended AND next_due_at <= now
  const isDue = (r: Row) => {
    const now = Date.now();
    const inTrial = r.trial_end_at ? new Date(r.trial_end_at).getTime() > now : false;
    if (inTrial) return false;
    const nextDue = r.next_due_at ? new Date(r.next_due_at).getTime() : 0;
    return nextDue > 0 && nextDue <= now;
  };

  const filtered = rows.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'active') return isVisible(r);
    if (filter === 'visible_unpaid') return isVisible(r) && isUnpaid(r);
    return r.status === filter;
  });

  // KPIs & helpers
  const kpis = useMemo(() => {
    const total = rows.length;
    const active = rows.filter(isVisible).length; // matches customer-visible merchants
    const grace = rows.filter(r => r.status === 'grace').length;
    const expired = rows.filter(r => r.status === 'expired').length;
    const visibleUnpaid = rows.filter(r => isVisible(r) && isUnpaid(r)).length;
    const lastMonth = (() => {
      const now = new Date();
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const inRange = rows.filter(r => {
        const paid = r.last_paid_at ? new Date(r.last_paid_at) : null;
        return paid && paid >= monthAgo && paid < nextMonth;
      });
      const paidCount = inRange.length;
      const ratio = total > 0 ? (paidCount / total) * 100 : 0;
      return { paidCount, ratio };
    })();
    return { total, active, grace, expired, visibleUnpaid, lastMonth };
  }, [rows]);

  const daysLeft = (r: Row) => {
    if (!r.next_due_at) return '-';
    const diff = (new Date(r.next_due_at).getTime() - Date.now()) / (1000*60*60*24);
    const d = Math.ceil(diff);
    if (Number.isNaN(d)) return '-';
    return d >= 0 ? `${d} يوم` : `متأخر ${Math.abs(d)} يوم`;
  };

  

  const toggleVisibility = async (r: Row) => {
    try {
      const current = r.merchant?.is_active !== false;
      const admin = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase.rpc('admin_toggle_merchant_visibility', {
        p_merchant_id: r.merchant_id,
        p_is_active: !current,
        p_admin_id: admin?.id || null,
      });
      if (error) throw error;
      await fetchData();
    } catch (e) {
      pushToast('تعذر تحديث حالة الظهور', 'error');
      console.error(e);
    }
  };

  const createSubscription = async (r: Row) => {
    try {
      const { error } = await supabase.rpc('ensure_merchant_subscription', {
        p_merchant_id: r.merchant_id,
        p_monthly_fee: 100,
        p_trial_days: 0,
      });
      if (error) throw error;
      pushToast('تم إنشاء الاشتراك (100 ج)', 'success');
      await fetchData();
    } catch (e) {
      pushToast('تعذر إنشاء الاشتراك', 'error');
      console.error(e);
    }
  };

  // Toasts
  type Toast = { id: number; type: 'success'|'error'|'info'; message: string };
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);
  const pushToast = (message: string, type: 'success'|'error'|'info' = 'info') => {
    const id = toastId.current++;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const chargeNow = async (r: Row) => {
    try {
      if (!isDue(r)) {
        pushToast('الاشتراك غير مستحق الآن', 'error');
        return;
      }
      const admin = (await supabase.auth.getUser()).data.user;
      const { data, error } = await supabase.rpc('charge_merchant_subscription', {
        p_merchant_id: r.merchant_id,
        p_admin_id: admin?.id || null,
      });
      if (error) throw error;
      const ok = Array.isArray(data) ? Boolean(data[0]?.ok) : false;
      const message = Array.isArray(data) && data[0]?.message ? String(data[0].message) : (ok ? 'تم التحصيل' : 'تعذر التحصيل الآن');
      pushToast(message, ok ? 'success' : 'error');
      if (ok) await fetchData();
    } catch (e) {
      pushToast('تعذر التحصيل الآن', 'error');
      console.error(e);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">اشتراكات المتاجر</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div className="bg-white rounded shadow p-3 text-center">
          <div className="text-xs text-gray-500">الإجمالي</div>
          <div className="text-lg font-semibold">{kpis.total}</div>
        </div>
        <div className="bg-white rounded shadow p-3 text-center">
          <div className="text-xs text-gray-500">نشط</div>
          <div className="text-lg font-semibold text-green-700">{kpis.active}</div>
        </div>
        <div className="bg-white rounded shadow p-3 text-center">
          <div className="text-xs text-gray-500">مهلة</div>
          <div className="text-lg font-semibold text-yellow-700">{kpis.grace}</div>
        </div>
        <div className="bg-white rounded shadow p-3 text-center">
          <div className="text-xs text-gray-500">منتهي</div>
          <div className="text-lg font-semibold text-red-700">{kpis.expired}</div>
        </div>
        <div className="bg-white rounded shadow p-3 text-center">
          <div className="text-xs text-gray-500">نشط ولم يسدد</div>
          <div className="text-lg font-semibold text-orange-700">{kpis.visibleUnpaid}</div>
        </div>
        <div className="bg-white rounded shadow p-3 text-center">
          <div className="text-xs text-gray-500">تحصيل الشهر الماضي</div>
          <div className="text-lg font-semibold">{kpis.lastMonth.paidCount} ({kpis.lastMonth.ratio.toFixed(1)}%)</div>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span>تصفية:</span>
        <input
          value={ownerFilter}
          onChange={(e)=>setOwnerFilter(e.target.value)}
          className="border rounded px-2 py-1 w-72"
          placeholder="Owner ID (اختياري)"
        />
        <select value={filter} onChange={e=>setFilter(e.target.value as any)} className="border rounded px-2 py-1">
          <option value="all">الكل</option>
          <option value="active">نشط</option>
          <option value="grace">مهلة</option>
          <option value="visible_unpaid">نشط ولم يسدد</option>
          <option value="expired">منتهي</option>
        </select>
        <button className="ml-auto px-3 py-1 bg-primary text-white rounded" onClick={fetchData}>تحديث</button>
      </div>

      <div className="bg-white rounded shadow overflow-auto relative">
        <table className="min-w-full text-right">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2">المتجر</th>
              <th className="px-3 py-2">المالك</th>
              <th className="px-3 py-2">الهاتف</th>
              <th className="px-3 py-2">الرسوم</th>
              <th className="px-3 py-2">الحالة</th>
              <th className="px-3 py-2">نهاية التجربة</th>
              <th className="px-3 py-2">آخر سداد</th>
              <th className="px-3 py-2">الاستحقاق القادم</th>
              <th className="px-3 py-2">متبقي</th>
              <th className="px-3 py-2">رصيد محفظة المالك</th>
              <th className="px-3 py-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-4" colSpan={11}>جاري التحميل...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-3 py-4" colSpan={11}>لا توجد بيانات</td></tr>
            ) : (
              filtered.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.merchant?.name_ar || r.merchant_id.slice(0,8)}</td>
                  <td className="px-3 py-2">{r.owner_name || '-'}</td>
                  <td className="px-3 py-2">{r.phone_number || '-'}</td>
                  <td className="px-3 py-2">{(r.monthly_fee || 100).toFixed(2)} {currency}</td>
                  <td className="px-3 py-2">{
                    r.status === 'active' ? <span className="text-green-700">نشط</span>
                    : r.status === 'grace' ? <span className="text-yellow-700">مهلة</span>
                    : <span className="text-red-700">منتهي</span>
                  }</td>
                  <td className="px-3 py-2">{r.trial_end_at ? new Date(r.trial_end_at).toLocaleDateString('ar-EG') : '-'}</td>
                  <td className="px-3 py-2">{r.last_paid_at ? new Date(r.last_paid_at).toLocaleDateString('ar-EG') : '-'}</td>
                  <td className="px-3 py-2">{r.next_due_at ? new Date(r.next_due_at).toLocaleDateString('ar-EG') : '-'}</td>
                  <td className="px-3 py-2">{daysLeft(r)}</td>
                  <td className="px-3 py-2">{typeof r.owner_wallet_balance === 'number' ? `${r.owner_wallet_balance.toFixed(2)} ${currency}` : '-'}</td>
                  <td className="px-3 py-2 flex gap-2 justify-end">
                    {r.has_subscription ? (
                      <button className="px-3 py-1 bg-primary text-white rounded disabled:opacity-50" onClick={()=>chargeNow(r)} disabled={!isDue(r)}>تحصيل الآن</button>
                    ) : (
                      <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={()=>createSubscription(r)}>إنشاء اشتراك (100 ج)</button>
                    )}
                    <button className="px-3 py-1 bg-gray-200 rounded" onClick={()=>toggleVisibility(r)}>
                      {(r.merchant?.is_active !== false) ? 'إيقاف الظهور' : 'تفعيل الظهور'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {/* Toasts */}
        <div className="fixed top-4 right-4 space-y-2 z-50">
          {toasts.map(t => (
            <div key={t.id} className={`px-4 py-2 rounded shadow text-white ${t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>
              {t.message}
            </div>
          ))}
        </div>
      </div>

      {/* تم ربط التحصيل فعلياً بمحافظ المنصة/المالك */}
    </div>
  );
}
