import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

// Simple inline SVG icons
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
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

interface Promotion {
  id: string;
  name: string;
  audience: 'customer' | 'merchant' | 'driver' | 'all';
  target_id: string | null;
  discount_type: 'flat' | 'percent';
  discount_amount: number;
  start_at: string; // ISO
  end_at: string | null; // ISO
  is_active: boolean;
  created_at: string;
}

const PromotionsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [promos, setPromos] = useState<Promotion[]>([]);

  const [form, setForm] = useState({
    name: '',
    audience: 'all' as Promotion['audience'],
    target_id: '' as string,
    discount_type: 'flat' as Promotion['discount_type'],
    discount_amount: 0,
    start_at: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm
    end_at: '' as string,
    is_active: true,
  });

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPromos((data || []) as any);
    } catch (e) {
      alert('تعذر جلب العروض');
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const handleCreate = async () => {
    try {
      setLoading(true);
      const payload: any = {
        name: form.name.trim(),
        audience: form.audience,
        target_id: form.target_id ? form.target_id : null,
        discount_type: form.discount_type,
        discount_amount: Number(form.discount_amount),
        start_at: new Date(form.start_at).toISOString(),
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
        is_active: form.is_active,
      };
      if (!payload.name) {
        alert('يرجى إدخال اسم العرض');
        return;
      }
      const { error } = await supabase.from('promotions').insert(payload);
      if (error) throw error;
      await fetchPromotions();
      setForm({
        name: '',
        audience: 'all',
        target_id: '',
        discount_type: 'flat',
        discount_amount: 0,
        start_at: new Date().toISOString().slice(0, 16),
        end_at: '',
        is_active: true,
      });
      alert('تم إنشاء العرض');
    } catch (e: any) {
      alert(e.message || 'تعذر إنشاء العرض');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (p: Promotion) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('promotions')
        .update({ is_active: !p.is_active })
        .eq('id', p.id);
      if (error) throw error;
      await fetchPromotions();
    } catch (e) {
      alert('تعذر تعديل حالة العرض');
    } finally {
      setLoading(false);
    }
  };

  const removePromotion = async (p: Promotion) => {
    if (!window.confirm('حذف هذا العرض؟')) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', p.id);
      if (error) throw error;
      await fetchPromotions();
    } catch (e) {
      alert('تعذر حذف العرض');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">العروض</h1>
          <p className="mt-2 text-gray-600">إدارة عروض العملاء والتجار والسائقين</p>
        </div>
        <button
          onClick={fetchPromotions}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 flex items-center gap-2"
          disabled={loading}
        >
          <RefreshIcon />
          تحديث القائمة
        </button>
      </div>

      {/* Create form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">إنشاء عرض جديد</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">اسم العرض</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">الفئة المستهدفة</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value as any })}
            >
              <option value="all">الكل</option>
              <option value="customer">العملاء</option>
              <option value="merchant">التجار</option>
              <option value="driver">السائقون</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Target ID (اختياري)</label>
            <input
              type="text"
              placeholder="UUID إن أردت تخصيص العرض لمعرف محدد"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              value={form.target_id}
              onChange={(e) => setForm({ ...form, target_id: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">نوع الخصم</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              value={form.discount_type}
              onChange={(e) => setForm({ ...form, discount_type: e.target.value as any })}
            >
              <option value="flat">مبلغ ثابت</option>
              <option value="percent">نسبة مئوية</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">قيمة الخصم</label>
            <input
              type="number"
              step="0.5"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              value={form.discount_amount}
              onChange={(e) => setForm({ ...form, discount_amount: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">تاريخ البداية</label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              value={form.start_at}
              onChange={(e) => setForm({ ...form, start_at: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">تاريخ النهاية (اختياري)</label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              value={form.end_at}
              onChange={(e) => setForm({ ...form, end_at: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="is_active"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">مفعل</label>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleCreate}
            className="px-4 py-2 rounded-md text-white bg-primary hover:bg-primary-dark flex items-center gap-2"
            disabled={loading}
          >
            <PlusIcon />
            إنشاء عرض
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">العروض الحالية</h2>
        {promos.length === 0 ? (
          <p className="text-gray-500">لا توجد عروض.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الاسم</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الفئة</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">النوع</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">القيمة</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">بداية</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">نهاية</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {promos.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{p.name}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{p.audience}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{p.discount_type}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{p.discount_amount}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{p.is_active ? 'مفعل' : 'متوقف'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{new Date(p.start_at).toLocaleString()}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{p.end_at ? new Date(p.end_at).toLocaleString() : '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(p)}
                          className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                          title="تبديل الحالة"
                          disabled={loading}
                        >
                          <ToggleIcon />
                        </button>
                        <button
                          onClick={() => removePromotion(p)}
                          className="px-2 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50"
                          title="حذف"
                          disabled={loading}
                        >
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

export default PromotionsPage;
