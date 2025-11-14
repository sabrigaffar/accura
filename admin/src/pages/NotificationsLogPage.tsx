import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface NotificationRow {
  id: string;
  user_id: string;
  user_name: string | null;
  title: string;
  body: string;
  type: string;
  data: Record<string, any> | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsLogPage() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // server paging
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  // filters
  const [userId, setUserId] = useState('');
  const [type, setType] = useState<'all' | 'order' | 'message' | 'system' | 'promotion' | 'review' | 'status_update'>('all');
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState(''); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState('');

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await (supabase as any).rpc('admin_list_notifications', {
        p_limit: limit,
        p_offset: offset,
        p_user: userId ? userId : null,
      });
      if (error) throw error;
      setRows((data as NotificationRow[]) || []);
    } catch (e: any) {
      console.error('admin_list_notifications error', e);
      setError(e.message || 'حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, offset]);

  const filtered = useMemo(() => {
    let r = rows;
    if (type !== 'all') {
      r = r.filter((x) => (x.type || '').toLowerCase() === type);
    }
    if (q.trim()) {
      const QQ = q.trim().toLowerCase();
      r = r.filter((x) =>
        (x.title || '').toLowerCase().includes(QQ) || (x.body || '').toLowerCase().includes(QQ) || (x.user_name || '').toLowerCase().includes(QQ)
      );
    }
    if (dateFrom) {
      const fromTs = new Date(dateFrom + 'T00:00:00').getTime();
      r = r.filter((x) => new Date(x.created_at).getTime() >= fromTs);
    }
    if (dateTo) {
      const toTs = new Date(dateTo + 'T23:59:59').getTime();
      r = r.filter((x) => new Date(x.created_at).getTime() <= toTs);
    }
    return r;
  }, [rows, type, q, dateFrom, dateTo]);

  const canPrev = offset > 0;
  const canNext = rows.length === limit; // naive: if page full, maybe next exists

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">سجل الإشعارات</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchRows()}
            className="px-3 py-2 rounded bg-primary text-white hover:bg-primary/90"
          >
            تحديث
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-white p-4 rounded border">
        <div className="flex flex-col">
          <label className="text-sm text-gray-600 mb-1">معرّف المستخدم (اختياري)</label>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="UUID"
            className="border rounded px-3 py-2 focus:outline-none focus:ring w-full"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm text-gray-600 mb-1">النوع</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="border rounded px-3 py-2 focus:outline-none focus:ring w-full"
          >
            <option value="all">الكل</option>
            <option value="order">طلب</option>
            <option value="message">رسالة</option>
            <option value="system">نظام</option>
            <option value="promotion">عرض</option>
            <option value="review">تقييم</option>
            <option value="status_update">تحديث حالة</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-sm text-gray-600 mb-1">بحث</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث في العنوان/النص/الاسم"
            className="border rounded px-3 py-2 focus:outline-none focus:ring w-full"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm text-gray-600 mb-1">من تاريخ</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded px-3 py-2 focus:outline-none focus:ring w-full"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm text-gray-600 mb-1">إلى تاريخ</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded px-3 py-2 focus:outline-none focus:ring w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التاريخ</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المستخدم</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">العنوان</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">النص</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">النوع</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td className="px-4 py-3" colSpan={6}>
                    <div className="text-center text-gray-500">جاري التحميل...</div>
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td className="px-4 py-3" colSpan={6}>
                    <div className="text-center text-red-600">{error}</div>
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-3" colSpan={6}>
                    <div className="text-center text-gray-500">لا توجد نتائج</div>
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.map((n) => (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {new Date(n.created_at).toLocaleString('ar-EG')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="text-gray-900 font-medium">{n.user_name || '—'}</div>
                      <div className="text-xs text-gray-500 ltr:ml-2 rtl:mr-2">{n.user_id}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-[16rem] truncate" title={n.title}>{n.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-[24rem] truncate" title={n.body}>{n.body}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className="px-2 py-1 rounded text-white bg-indigo-500 text-xs">{n.type || 'system'}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {n.is_read ? (
                      <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs">مقروء</span>
                    ) : (
                      <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs">غير مقروء</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between p-3 border-t bg-gray-50">
          <div className="text-sm text-gray-500">عدد النتائج المعروضة: {filtered.length}</div>
          <div className="flex items-center gap-2">
            <button
              disabled={!canPrev}
              onClick={() => setOffset((o) => Math.max(o - limit, 0))}
              className={`px-3 py-1.5 rounded border ${canPrev ? 'bg-white hover:bg-gray-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
            >
              السابق
            </button>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value, 10));
                setOffset(0);
              }}
              className="border rounded px-2 py-1"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <button
              disabled={!canNext}
              onClick={() => setOffset((o) => o + limit)}
              className={`px-3 py-1.5 rounded border ${canNext ? 'bg-white hover:bg-gray-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
            >
              التالي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
