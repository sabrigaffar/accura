import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Complaint {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'in_review' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  target_type: 'order' | 'merchant' | 'driver' | 'other' | null;
  target_id: string | null;
  created_by: string;
  created_at: string;
  assigned_admin: string | null;
}

interface Attachment { id: string; object_path: string; }

const ComplaintsPage: React.FC = () => {
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    let rows = items;
    if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter);
    if (q.trim()) rows = rows.filter(r => r.title.toLowerCase().includes(q.toLowerCase()));
    return rows;
  }, [items, statusFilter, q]);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setItems((data as any) || []);
    } catch (e) {
      console.error('fetch complaints error', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchComplaints(); }, []);

  const loadAttachments = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('complaint_attachments')
        .select('id, object_path')
        .eq('complaint_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setAttachments((data as any) || []);
      const urlMap: Record<string,string> = {};
      for (const a of data || []) {
        const { data: signed } = await supabase.storage
          .from('complaint-images')
          .createSignedUrl(a.object_path, 3600);
        if (signed?.signedUrl) urlMap[a.id] = signed.signedUrl;
      }
      setThumbs(urlMap);
    } catch (e) {
      console.error('load attachments error', e);
      setAttachments([]);
      setThumbs({});
    }
  };

  const updateStatus = async (id: string, status: Complaint['status']) => {
    try {
      const { error } = await supabase.from('complaints').update({ status }).eq('id', id);
      if (error) throw error;
      await fetchComplaints();
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : prev);
    } catch (e) {
      console.error('update status error', e);
    }
  };

  const assignMe = async (id: string) => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      const { error } = await supabase.from('complaints').update({ assigned_admin: user.id }).eq('id', id);
      if (error) throw error;
      await fetchComplaints();
    } catch (e) {
      console.error('assign error', e);
    }
  };

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">الشكاوى</h2>
        <div className="flex items-center gap-2">
          <input
            className="border border-gray-300 rounded px-2 py-1"
            placeholder="بحث بالعنوان"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <select className="border border-gray-300 rounded px-2 py-1" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">الكل</option>
            <option value="open">مفتوحة</option>
            <option value="in_review">قيد المراجعة</option>
            <option value="resolved">تم الحل</option>
            <option value="closed">مغلقة</option>
          </select>
          <button className="bg-primary text-white px-3 py-1 rounded" onClick={fetchComplaints}>تحديث</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* List */}
        <div className="bg-white border border-gray-200 rounded p-3">
          {loading ? (
            <div className="p-6 text-center text-gray-500">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-gray-500">لا توجد نتائج</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map(c => (
                <li key={c.id} className={`py-3 cursor-pointer ${selected?.id === c.id ? 'bg-primary/5' : ''}`} onClick={() => { setSelected(c); loadAttachments(c.id); }}>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{c.title}</div>
                    <div className="text-sm text-gray-500">{new Date(c.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600 mt-1">
                    <div>الحالة: {c.status === 'open' ? 'مفتوحة' : c.status === 'in_review' ? 'قيد المراجعة' : c.status === 'resolved' ? 'تم الحل' : 'مغلقة'}</div>
                    <div>الأولوية: {c.priority === 'high' ? 'عالية' : c.priority === 'low' ? 'منخفضة' : 'متوسطة'}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Details */}
        <div className="bg-white border border-gray-200 rounded p-4">
          {!selected ? (
            <div className="p-6 text-center text-gray-500">اختر شكوى لعرض التفاصيل</div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">{selected.title}</h3>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => updateStatus(selected.id, 'in_review')}>قيد المراجعة</button>
                  <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => updateStatus(selected.id, 'resolved')}>تم الحل</button>
                  <button className="px-3 py-1 bg-gray-600 text-white rounded" onClick={() => updateStatus(selected.id, 'closed')}>إغلاق</button>
                  <button className="px-3 py-1 bg-primary text-white rounded" onClick={() => assignMe(selected.id)}>إسناد لي</button>
                </div>
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{selected.description || '—'}</div>
              <div className="text-sm text-gray-600 mb-2">المعرف: {selected.id}</div>
              <div className="text-sm text-gray-600 mb-2">الهدف: {selected.target_type || '—'}</div>
              {/* Attachments */}
              <div>
                <div className="font-medium mb-2">المرفقات</div>
                {attachments.length === 0 ? (
                  <div className="text-gray-500 text-sm">لا توجد مرفقات</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {attachments.map(a => (
                      <a key={a.id} href={thumbs[a.id]} target="_blank" rel="noreferrer" className="border rounded overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumbs[a.id]} alt="attachment" className="w-full h-24 object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplaintsPage;
