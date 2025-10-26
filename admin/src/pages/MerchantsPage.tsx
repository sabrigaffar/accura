import React, { useState, useEffect } from 'react';
import { useMerchants } from '../hooks/useSupabaseData';
import EditMerchantModal from '../components/EditMerchantModal';
import AddMerchantModal from '../components/AddMerchantModal';

import { PERMISSIONS, usePermissions } from '../contexts/PermissionsContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// أنواع الفئات
const MERCHANT_CATEGORIES = [
  { key: 'all', label: 'الكل' },
  { key: 'restaurant', label: 'مطعم' },
  { key: 'grocery', label: 'بقالة' },
  { key: 'pharmacy', label: 'صيدلية' },
  { key: 'gifts', label: 'هدايا' },
  { key: 'other', label: 'أخرى' },
];

const MerchantsPage = () => {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [selectedMerchant, setSelectedMerchant] = useState<any>(null);
  const [selectedMerchants, setSelectedMerchants] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<keyof any>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { hasPermission } = usePermissions();
  const { t } = useLanguage();
  const { user: authUser } = useAuth();

  // Use the custom hook to fetch merchants
  const { merchants, loading, error, refresh } = useMerchants({
    category: categoryFilter,
    status: statusFilter,
    search: searchTerm
  });

  // Filter and sort merchants
  const filteredMerchants = merchants
    .filter(merchant => {
      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          merchant.name_ar.toLowerCase().includes(searchLower) ||
          merchant.owner_id.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .sort((a, b) => {
      // Apply sorting
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name_ar':
          aValue = a.name_ar;
          bValue = b.name_ar;
          break;
        case 'category':
          aValue = a.category;
          bValue = b.category;
          break;
        case 'rating':
          aValue = a.rating;
          bValue = b.rating;
          break;
        case 'is_active':
          aValue = a.is_active;
          bValue = b.is_active;
          break;
        case 'created_at':
        default:
          aValue = a.created_at;
          bValue = b.created_at;
          break;
      }
      
      if (aValue < bValue) {
        return sortOrder === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });

  // Pagination
  const totalPages = Math.ceil(filteredMerchants.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMerchants = filteredMerchants.slice(startIndex, startIndex + itemsPerPage);

  // الحصول على نص قابل للقراءة لفئة التاجر
  const getCategoryText = (category: string) => {
    const merchantCategory = MERCHANT_CATEGORIES.find(mc => mc.key === category);
    return merchantCategory ? merchantCategory.label : category;
  };

  // تحديد لون الحالة
  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  // تحديد نص الحالة
  const getStatusText = (isActive: boolean) => {
    return isActive ? 'نشط' : 'غير نشط';
  };

  const handleMerchantUpdated = () => {
    // تحديث قائمة التجار
    refresh();
  };

  const handleEditMerchant = (merchant: any) => {
    setSelectedMerchant(merchant);
    setIsEditModalOpen(true);
  };

  const handleSelectMerchant = (merchantId: string) => {
    setSelectedMerchants(prev => 
      prev.includes(merchantId) 
        ? prev.filter(id => id !== merchantId) 
        : [...prev, merchantId]
    );
  };

  const handleSelectAll = () => {
    if (selectedMerchants.length === paginatedMerchants.length) {
      setSelectedMerchants([]);
    } else {
      setSelectedMerchants(paginatedMerchants.map(merchant => merchant.id));
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedMerchants.length === 0) return;

    try {
      switch (action) {
        case 'activate':
          await supabase
            .from('merchants')
            .update({ is_active: true })
            .in('id', selectedMerchants);
          break;
        case 'deactivate':
          await supabase
            .from('merchants')
            .update({ is_active: false })
            .in('id', selectedMerchants);
          break;
      }
      refresh();
      setSelectedMerchants([]);
    } catch (error) {
      console.error('Error performing bulk action:', error);
    }
  };

  const handleSort = (field: keyof any) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleDeleteMerchant = async (merchantId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا التاجر؟ قد تفشل العملية إذا كانت هناك سجلات مرتبطة.')) return;
    try {
      // تحقق من وجود طلبات مرتبطة بالتاجر
      const { count: ordersCount, error: ordersCountErr } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchantId);
      if (ordersCountErr) throw ordersCountErr;
      if ((ordersCount || 0) > 0) {
        alert('لا يمكن حذف هذا التاجر لوجود طلبات مرتبطة به. يرجى إعادة إسناد/حذف هذه الطلبات أولاً أو إلغاء تفعيل التاجر.');
        return;
      }

      const { error } = await supabase.from('merchants').delete().eq('id', merchantId);
      if (error) throw error;

      try {
        await supabase.from('admin_activity_log').insert({
          admin_id: authUser?.id || null,
          action: 'delete',
          resource_type: 'merchant',
          resource_id: merchantId,
          details: null,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Failed to log admin activity (merchant delete):', e);
      }

      refresh();
    } catch (e: any) {
      console.error('Error deleting merchant:', e);
      alert(e.message || 'حدث خطأ أثناء حذف التاجر');
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, statusFilter, searchTerm]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg">
        <div className="text-red-700">حدث خطأ: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t('merchantsManagement')}</h1>
        {hasPermission(PERMISSIONS.MANAGE_MERCHANTS) && (
          <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
            {t('addMerchant')}
          </button>
        )}
      </div>

      {/* فلاتر البحث */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* بحث بالنص */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              {t('search')}
            </label>
            <input
              type="text"
              id="search"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              placeholder="البحث باسم التاجر"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* فلتر الفئة */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              {t('category')}
            </label>
            <select
              id="category"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {MERCHANT_CATEGORIES.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          {/* فلتر الحالة */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              {t('status')}
            </label>
            <select
              id="status"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">الكل</option>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedMerchants.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg flex items-center justify-between">
          <div>
            تم تحديد {selectedMerchants.length} تجار
          </div>
          <div className="flex space-x-2 space-x-reverse">
            <button 
              className="btn-secondary"
              onClick={() => handleBulkAction('activate')}
            >
              تفعيل التجار المحددة
            </button>
            <button 
              className="btn-secondary"
              onClick={() => handleBulkAction('deactivate')}
            >
              إلغاء تفعيل التجار المحددة
            </button>
          </div>
        </div>
      )}

      {/* جدول التجار */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedMerchants.length === paginatedMerchants.length && paginatedMerchants.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('name_ar')}
                >
                  <div className="flex items-center">
                    <span>{t('merchantName')}</span>
                    {sortBy === 'name_ar' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center">
                    <span>{t('category')}</span>
                    {sortBy === 'category' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('rating')}
                >
                  <div className="flex items-center">
                    <span>{t('rating')}</span>
                    {sortBy === 'rating' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('is_active')}
                >
                  <div className="flex items-center">
                    <span>{t('status')}</span>
                    {sortBy === 'is_active' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center">
                    <span>{t('date')}</span>
                    {sortBy === 'created_at' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedMerchants.length > 0 ? (
                paginatedMerchants.map((merchant) => (
                  <tr key={merchant.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedMerchants.includes(merchant.id)}
                        onChange={() => handleSelectMerchant(merchant.id)}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-white font-medium">
                              {merchant.name_ar.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="mr-4">
                          <div className="text-sm font-medium text-gray-900">{merchant.name_ar}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getCategoryText(merchant.category)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="mr-1 text-sm text-gray-900">{merchant.rating.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(merchant.is_active)}`}>
                        {getStatusText(merchant.is_active)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(merchant.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {hasPermission(PERMISSIONS.MANAGE_MERCHANTS) && (
                        <button 
                          className="text-primary hover:text-primary-dark ml-4"
                          onClick={() => handleEditMerchant(merchant)}
                        >
                          {t('edit')}
                        </button>
                      )}
                      <button className="text-red-600 hover:text-red-900 mr-4" onClick={() => handleDeleteMerchant(merchant.id)}>
                        {t('delete')}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
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
                عرض <span className="font-medium">{startIndex + 1}</span> إلى <span className="font-medium">{Math.min(startIndex + itemsPerPage, filteredMerchants.length)}</span> من{' '}
                <span className="font-medium">{filteredMerchants.length}</span> نتائج
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
      
      {/* نموذج تعديل تاجر */}
      <EditMerchantModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)}
        merchant={selectedMerchant}
        onMerchantUpdated={handleMerchantUpdated}
      />

      {/* نموذج إضافة تاجر */}
      {hasPermission(PERMISSIONS.MANAGE_MERCHANTS) && (
        <AddMerchantModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onMerchantAdded={refresh}
        />
      )}
    </div>
  );
};

export default MerchantsPage;