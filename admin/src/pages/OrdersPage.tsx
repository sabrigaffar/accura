import React, { useState, useEffect } from 'react';
import { useOrders } from '../hooks/useSupabaseData';
import OrderDetailsModal from '../components/OrderDetailsModal';
import AddOrderModal from '../components/AddOrderModal';

import { PERMISSIONS, usePermissions } from '../contexts/PermissionsContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// حالات الطلب
const ORDER_STATUS = [
  { key: 'all', label: 'الكل' },
  { key: 'pending', label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'accepted', label: 'مقبول', color: 'bg-blue-100 text-blue-800' },
  { key: 'preparing', label: 'قيد التحضير', color: 'bg-indigo-100 text-indigo-800' },
  { key: 'ready', label: 'جاهز للتسليم', color: 'bg-purple-100 text-purple-800' },
  { key: 'picked_up', label: 'تم الاستلام', color: 'bg-cyan-100 text-cyan-800' },
  { key: 'on_the_way', label: 'في الطريق', color: 'bg-teal-100 text-teal-800' },
  { key: 'delivered', label: 'تم التوصيل', color: 'bg-green-100 text-green-800' },
  { key: 'cancelled', label: 'ملغى', color: 'bg-red-100 text-red-800' },
];

const OrdersPage = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<keyof any>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { hasPermission } = usePermissions();
  const { t } = useLanguage();
  const { user } = useAuth();

  // Use the custom hook to fetch orders
  const { orders, loading, error, refresh } = useOrders({
    status: statusFilter,
    search: searchTerm
  });

  // Filter and sort orders
  const filteredOrders = orders
    .filter(order => {
      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          order.order_number.toLowerCase().includes(searchLower) ||
          order.customer_id.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .sort((a, b) => {
      // Apply sorting
      let aValue, bValue;
      
      switch (sortBy) {
        case 'order_number':
          aValue = a.order_number;
          bValue = b.order_number;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'total':
          aValue = a.total;
          bValue = b.total;
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
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

  // الحصول على نص قابل للقراءة لحالة الطلب
  const getStatusText = (status: string) => {
    const orderStatus = ORDER_STATUS.find(os => os.key === status);
    return orderStatus ? orderStatus.label : status;
  };

  // الحصول على لون الحالة
  const getStatusColor = (status: string) => {
    const orderStatus = ORDER_STATUS.find(os => os.key === status);
    return orderStatus ? orderStatus.color : 'bg-gray-100 text-gray-800';
  };

  const handleViewOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setIsModalOpen(true);
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId) 
        : [...prev, orderId]
    );
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === paginatedOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(paginatedOrders.map(order => order.id));
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedOrders.length === 0) return;

    try {
      switch (action) {
        case 'cancel':
          await supabase
            .from('orders')
            .update({ status: 'cancelled' })
            .in('id', selectedOrders);
          break;
        case 'mark_as_delivered':
          await supabase
            .from('orders')
            .update({ status: 'delivered' })
            .in('id', selectedOrders);
          break;
      }
      refresh();
      setSelectedOrders([]);
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

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب؟ هذا الإجراء لا يمكن التراجع عنه.')) return;
    try {
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw error;

      // Log admin activity (best-effort)
      try {
        await supabase.from('admin_activity_log').insert({
          admin_id: user?.id || null,
          action: 'delete',
          resource_type: 'order',
          resource_id: orderId,
          details: null,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Failed to log admin activity (order delete):', e);
      }

      refresh();
    } catch (e: any) {
      console.error('Error deleting order:', e);
      alert(e.message || 'حدث خطأ أثناء حذف الطلب');
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm]);

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
        <h1 className="text-2xl font-bold text-gray-900">{t('ordersManagement')}</h1>
        <div className="flex gap-2">
          <button className="btn-secondary">
            {t('exportReport')}
          </button>
          {hasPermission(PERMISSIONS.MANAGE_ORDERS) && (
            <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
              {t('addOrder')}
            </button>
          )}
        </div>
      </div>

      {/* فلاتر البحث */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* بحث بالنص */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              {t('search')}
            </label>
            <input
              type="text"
              id="search"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              placeholder="البحث برقم الطلب أو اسم العميل"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* فلتر الحالة */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              {t('orderStatus')}
            </label>
            <select
              id="status"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {ORDER_STATUS.map((status) => (
                <option key={status.key} value={status.key}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedOrders.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg flex items-center justify-between">
          <div>
            تم تحديد {selectedOrders.length} طلبات
          </div>
          <div className="flex space-x-2 space-x-reverse">
            <button 
              className="btn-secondary"
              onClick={() => handleBulkAction('mark_as_delivered')}
            >
              تحديد كـ "تم التوصيل"
            </button>
            <button 
              className="btn-danger"
              onClick={() => handleBulkAction('cancel')}
            >
              إلغاء الطلبات المحددة
            </button>
          </div>
        </div>
      )}

      {/* جدول الطلبات */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedOrders.length === paginatedOrders.length && paginatedOrders.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('order_number')}
                >
                  <div className="flex items-center">
                    <span>{t('orderNumber')}</span>
                    {sortBy === 'order_number' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('customer_id')}
                >
                  <div className="flex items-center">
                    <span>{t('customer')}</span>
                    {sortBy === 'customer_id' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center">
                    <span>{t('total')}</span>
                    {sortBy === 'total' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    <span>{t('orderStatus')}</span>
                    {sortBy === 'status' && (
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
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={() => handleSelectOrder(order.id)}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{order.order_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.customer_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.total.toFixed(2)} ر.س</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button 
                        className="text-primary hover:text-primary-dark ml-4"
                        onClick={() => handleViewOrder(order.id)}
                      >
                        {t('view')}
                      </button>
                      {hasPermission(PERMISSIONS.MANAGE_ORDERS) && (
                        <>
                          <button className="text-green-600 hover:text-green-900 mr-4">
                            {t('edit')}
                          </button>
                          <button className="text-red-600 hover:text-red-900 mr-4" onClick={() => handleDeleteOrder(order.id)}>
                            {t('delete')}
                          </button>
                        </>
                      )}
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
                عرض <span className="font-medium">{startIndex + 1}</span> إلى <span className="font-medium">{Math.min(startIndex + itemsPerPage, filteredOrders.length)}</span> من{' '}
                <span className="font-medium">{filteredOrders.length}</span> نتائج
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
      
      {/* نموذج تفاصيل الطلب */}
      <OrderDetailsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        orderId={selectedOrderId}
      />

      {/* نموذج إضافة طلب */}
      {hasPermission(PERMISSIONS.MANAGE_ORDERS) && (
        <AddOrderModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onOrderAdded={refresh}
        />
      )}
    </div>
  );
};

export default OrdersPage;