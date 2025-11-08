import { useState, useEffect } from 'react';
// import { useMerchants } from '../hooks/useSupabaseData';

// import { PERMISSIONS, usePermissions } from '../contexts/PermissionsContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
// import { useAuth } from '../contexts/AuthContext';

// صفحة التجار تعتمد على profiles (user_type='merchant')

const MerchantsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>(''); // فلتر المالك
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  // ترتيب القائمة: created_at تنازليًا

  const { t } = useLanguage();
  const navigate = useNavigate();
  // const { user: authUser } = useAuth();

  // قائمة الملاك (owners) لفلترة التجار
  const [owners, setOwners] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    const fetchOwners = async () => {
      try {
        // اجلب جميع owner_id المميزة من merchants مع اسم المالك من profiles
        const { data, error } = await supabase
          .from('merchants')
          .select('owner_id, profiles:profiles!merchants_owner_id_fkey(full_name)')
          .not('owner_id', 'is', null);
        if (error) throw error;
        const map: Record<string, string> = {};
        (data || []).forEach((row: any) => {
          const ownerId = row.owner_id as string;
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          const name = profile?.full_name || ownerId.slice(0, 8);
          if (ownerId && !map[ownerId]) map[ownerId] = name;
        });
        const list = Object.entries(map).map(([id, name]) => ({ id, name }));
        setOwners(list);
      } catch (e) {
        console.warn('fetchOwners error', e);
      }
    };
    fetchOwners();
  }, []);

  // Use the custom hook to fetch merchants
  // Traders (profiles where user_type='merchant')
  type TraderRow = { id: string; full_name: string; created_at: string; storeCount: number; phone?: string|null };
  const [traders, setTraders] = useState<TraderRow[]>([]);
  const [tradersLoading, setTradersLoading] = useState(true);
  const [tradersError, setTradersError] = useState<string|null>(null);
  const refresh = async () => fetchTraders();

  const fetchTraders = async () => {
    try {
      setTradersLoading(true);
      setTradersError(null);
      const { data: profs, error: e1 } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, created_at, user_type')
        .eq('user_type', 'merchant')
        .order('created_at', { ascending: false });
      if (e1) throw e1;
      const rows = (profs || []) as any[];
      const ownerIds = rows.map(r => r.id);
      let counts: Record<string, number> = {};
      let ownerPhone: Record<string, string|null> = {};
      if (ownerIds.length > 0) {
        const { data: m } = await supabase
          .from('merchants')
          .select('owner_id, phone_number')
          .in('owner_id', ownerIds);
        (m || []).forEach((row: any) => {
          const k = row.owner_id as string;
          counts[k] = (counts[k] || 0) + 1;
          if (ownerPhone[k] === undefined || ownerPhone[k] === null) ownerPhone[k] = row.phone_number ?? null;
        });
      }
      setTraders(rows.map(r => ({
        id: r.id,
        full_name: r.full_name || r.id.slice(0,8),
        created_at: r.created_at,
        storeCount: counts[r.id] || 0,
        phone: r.phone_number ?? ownerPhone[r.id] ?? null,
      })));
    } catch (e: any) {
      setTradersError(e.message || 'تعذر جلب قائمة التجار');
    } finally {
      setTradersLoading(false);
    }
  };

  useEffect(() => { fetchTraders(); }, []);

  // Filter and sort traders
  const filteredTraders = traders
    .filter(t => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (t.full_name || '').toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || (t.phone || '').includes(searchTerm);
      }
      if (ownerFilter && t.id !== ownerFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const aValue = a.created_at;
      const bValue = b.created_at;
      // sort by created_at descending
      if (aValue < bValue) return 1;
      if (aValue > bValue) return -1;
      return 0;
    });

  // Pagination
  const totalPages = Math.ceil(filteredTraders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTraders = filteredTraders.slice(startIndex, startIndex + itemsPerPage);

  // إزالة الأكواد غير المستخدمة من نسخة إدارة المتاجر القديمة

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, ownerFilter]);

  if (tradersLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (tradersError) {
    return (
      <div className="bg-red-50 p-4 rounded-lg">
        <div className="text-red-700">حدث خطأ: {tradersError}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t('merchantsManagement')}</h1>
        {/* زر الإضافة خاص بالمتاجر وليس التجار؛ مخفي هنا */}
      </div>

      {/* شريط فلترة المالك (Owner ID) */}
      <div className="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex flex-col">
          <label className="text-sm text-gray-600 mb-1">المالك (Owner)</label>
          <div className="flex gap-2">
            <select
              className="border rounded px-3 py-2 min-w-[260px]"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
            >
              <option value="">الكل</option>
              {owners.map(o => (
                <option key={o.id} value={o.id}>{o.name} ({o.id.slice(0,8)})</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="أو أدخل Owner ID يدوياً"
              className="border rounded px-3 py-2 min-w-[260px]"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value.trim())}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => refresh()}>تحديث</button>
          <button className="btn-light" onClick={() => setOwnerFilter('')}>مسح الفلتر</button>
        </div>
      </div>

      {/* فلاتر البحث */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              {t('search')}
            </label>
            <input
              type="text"
              id="search"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              placeholder="ابحث باسم التاجر أو رقم الهاتف أو المعرّف"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* لا توجد إجراءات مجمعة في صفحة التجار */}

      {/* جدول التجار (profiles.user_type = merchant) */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التاجر</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الهاتف</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">عدد المتاجر</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تاريخ الإنشاء</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedTraders.length > 0 ? (
                paginatedTraders.map((trader) => (
                  <tr key={trader.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{trader.full_name}</div>
                      <div className="text-xs text-gray-400">{trader.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trader.phone || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trader.storeCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(trader.created_at).toLocaleDateString('ar-SA')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button className="text-primary hover:text-primary-dark ml-4" onClick={() => navigate(`/subscriptions?owner=${trader.id}`)}>
                        عرض المتاجر
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    {t('noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* ترقيم الصفحات */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button 
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              السابق
            </button>
            <button 
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              التالي
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                عرض <span className="font-medium">{startIndex + 1}</span> إلى <span className="font-medium">{Math.min(startIndex + itemsPerPage, filteredTraders.length)}</span> من{' '}
                <span className="font-medium">{filteredTraders.length}</span> نتائج
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button 
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <span className="sr-only">السابق</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === pageNum
                          ? 'z-10 bg-primary border-primary text-white'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button 
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  <span className="sr-only">التالي</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
      
      {/* لا نعرض نوافذ تعديل/إضافة هنا لأنها تخص المتاجر وليس التجار */}
    </div>
  );
};

export default MerchantsPage;