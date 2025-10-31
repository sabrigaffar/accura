import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

const ToggleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="5" width="22" height="14" rx="7" ry="7"></rect>
    <circle cx="8" cy="12" r="3"></circle>
  </svg>
);

interface Rule {
  id: string;
  name: string;
  audience: 'customer' | 'merchant' | 'driver' | 'all';
  store_id: string | null;
  merchant_category: string | null;
  discount_type: 'flat' | 'percent';
  discount_amount: number;
  apply_on: 'subtotal' | 'delivery_fee' | 'service_fee' | 'merchant_commission';
  payment_filter: 'any' | 'card' | 'cash';
  min_subtotal: number | null;
  stackable: boolean;
  priority: number;
  is_active: boolean;
  start_at: string;
  end_at: string | null;
}

const PromotionRulesPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);

  const [form, setForm] = useState({
    name: '',
    audience: 'all' as Rule['audience'],
    store_id: '',
    merchant_category: '',
    discount_type: 'flat' as Rule['discount_type'],
    discount_amount: 0,
    apply_on: 'subtotal' as Rule['apply_on'],
    payment_filter: 'any' as Rule['payment_filter'],
    min_subtotal: '',
    stackable: false,
    priority: 100,
    start_at: new Date().toISOString().slice(0,16),
    end_at: '',
    is_active: true,
  });

  const fetchRules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('promotion_rules')
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRules((data || []) as any);
    } catch (e) {
      alert('تعذر جلب القواعد');
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleCreate = async () => {
    try {
      setLoading(true);
      const payload: any = {
        name: form.name.trim(),
        audience: form.audience,
        store_id: form.store_id || null,
        merchant_category: form.merchant_category || null,
        discount_type: form.discount_type,
        discount_amount: Number(form.discount_amount),
        apply_on: form.apply_on,
        payment_filter: form.payment_filter,
        min_subtotal: form.min_subtotal ? Number(form.min_subtotal) : null,
        stackable: form.stackable,
        priority: Number(form.priority),
        start_at: new Date(form.start_at).toISOString(),
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
        is_active: form.is_active,
      };
      if (!payload.name) {
        alert('أدخل اسم القاعدة');
        return;
      }
      const { error } = await supabase.from('promotion_rules').insert(payload);
      if (error) throw error;
      await fetchRules();
      setForm({
        name: '',
        audience: 'all',
        store_id: '',
        merchant_category: '',
        discount_type: 'flat',
        discount_amount: 0,
        apply_on: 'subtotal',
        payment_filter: 'any',
        min_subtotal: '',
        stackable: false,
        priority: 100,
        start_at: new Date().toISOString().slice(0,16),
        end_at: '',
        is_active: true,
      });
      alert('تم إنشاء القاعدة');
    } catch (e: any) {
      alert(e.message || 'تعذر إنشاء القاعدة');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (r: Rule) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('promotion_rules')
        .update({ is_active: !r.is_active })
        .eq('id', r.id);
      if (error) throw error;
      await fetchRules();
    } catch (e) {
      alert('تعذر تعديل الحالة');
    } finally {
      setLoading(false);
    }
  };

  const removeRule = async (r: Rule) => {
    if (!window.confirm('حذف هذه القاعدة؟')) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('promotion_rules')
        .delete()
        .eq('id', r.id);
      if (error) throw error;
      await fetchRules();
    } catch (e) {
      alert('تعذر حذف القاعدة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">قواعد العروض الافتراضية</h1>
          <p className="mt-2 text-gray-600">إنشاء وإدارة قواعد تطبيق العروض تلقائياً</p>
        </div>
        <button
          onClick={fetchRules}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 flex items-center gap-2"
          disabled={loading}
        >
          <RefreshIcon />
          تحديث القائمة
        </button>
      </div>

      {/* Create form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">إنشاء قاعدة جديدة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">الاسم</label>
            <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">الفئة المستهدفة</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary" value={form.audience} onChange={(e)=>setForm({...form, audience: e.target.value as any})}>
              <option value="all">الكل</option>
              <option value="customer">العملاء</option>
              <option value="merchant">التجار</option>
              <option value="driver">السائقون</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Store ID (اختياري)</label>
            <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary" value={form.store_id} onChange={(e)=>setForm({...form, store_id: e.target.value})} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">تصنيف المتجر (اختياري)</label>
            <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary" value={form.merchant_category} onChange={(e)=>setForm({...form, merchant_category: e.target.value})} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">نوع الخصم</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary" value={form.discount_type} onChange={(e)=>setForm({...form, discount_type: e.target.value as any})}>
              <option value="flat">مبلغ ثابت</option>
              <option value="percent">نسبة مئوية</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">قيمة الخصم</label>
            <input type="number" step="0.5" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary" value={form.discount_amount} onChange={(e)=>setForm({...form, discount_amount: Number(e.target.value)})} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">يطبق على</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary" value={form.apply_on} onChange={(e)=>setForm({...form, apply_on: e.target.value as any})}>
              <option value="subtotal">Subtotal</option>
              <option value="delivery_fee">Delivery Fee</option>
              <option value="service_fee">Service Fee</option>
              <option value="merchant_commission">Merchant Commission</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">تصفية الدفع</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary" value={form.payment_filter} onChange={(e)=>setForm({...form, payment_filter: e.target.value as any})}>
              <option value="any">الكل</option>
              <option value="card">بطاقة</option>
              <option value="cash">نقداً</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">حد أدنى للمجموع (اختياري)</label>
            <input type="number" step="0.5" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary" value={form.min_subtotal} onChange={(e)=>setForm({...form, min_subtotal: e.target.value})} />
          </div>

          <div className="flex items-center gap-2">
            <input id="stackable" type="checkbox" checked={form.stackable} onChange={(e)=>setForm({...form, stackable: e.target.checked})} />
            <label htmlFor="stackable" className="text-sm text-gray-700">السماح بالتراكم</label>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">الأولوية</label>
            <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary" value={form.priority} onChange={(e)=>setForm({...form, priority: Number(e.target.value)})} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">بداية</label>
            <input type="datetime-local" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary" value={form.start_at} onChange={(e)=>setForm({...form, start_at: e.target.value})} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">نهاية (اختياري)</label>
            <input type="datetime-local" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary" value={form.end_at} onChange={(e)=>setForm({...form, end_at: e.target.value})} />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={handleCreate} className="px-4 py-2 rounded-md text-white bg-primary hover:bg-primary-dark flex items-center gap-2" disabled={loading}>
            <PlusIcon />
            إنشاء قاعدة
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">القواعد الحالية</h2>
        {rules.length === 0 ? (
          <p className="text-gray-500">لا توجد قواعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الاسم</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الفئة</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">النوع</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">القيمة</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">يطبق على</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الدفع</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الأولوية</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{r.name}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{r.audience}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{r.discount_type}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{r.discount_amount}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{r.apply_on}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{r.payment_filter}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{r.priority}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{r.is_active ? 'مفعل' : 'متوقف'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleActive(r)} className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50" title="تبديل الحالة" disabled={loading}>
                          <ToggleIcon />
                        </button>
                        <button onClick={() => removeRule(r)} className="px-2 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50" title="حذف" disabled={loading}>
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromotionRulesPage;
