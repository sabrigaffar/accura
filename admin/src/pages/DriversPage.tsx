import React, { useState, useEffect } from 'react';
import { useDrivers } from '../hooks/useSupabaseData';
import EditDriverModal from '../components/EditDriverModal';
import AddDriverModal from '../components/AddDriverModal';

import { PERMISSIONS, usePermissions } from '../contexts/PermissionsContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// أنواع المركبات
const VEHICLE_TYPES = [
  { key: 'all', label: 'الكل' },
  { key: 'car', label: 'سيارة' },
  { key: 'motorcycle', label: 'دراجة نارية' },
  { key: 'bicycle', label: 'دراجة' },
  { key: 'scooter', label: 'سكوتر' },
];

const DriversPage = () => {
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [onlineFilter, setOnlineFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<keyof any>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { hasPermission } = usePermissions();
  const { t } = useLanguage();
  const { user: authUser } = useAuth();

  // Use the custom hook to fetch drivers
  const { drivers, loading, error, refresh } = useDrivers({
    vehicleType: vehicleTypeFilter,
    status: statusFilter,
    online: onlineFilter,
    search: searchTerm
  });

  // Filter and sort drivers
  const filteredDrivers = drivers
    .filter(driver => {
      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          driver.full_name.toLowerCase().includes(searchLower) ||
          driver.phone_number.includes(searchTerm) ||
          driver.license_plate.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .sort((a, b) => {
      // Apply sorting
      let aValue, bValue;
      
      switch (sortBy) {
        case 'full_name':
          aValue = a.full_name;
          bValue = b.full_name;
          break;
        case 'vehicle_type':
          aValue = a.vehicle_type;
          bValue = b.vehicle_type;
          break;
        case 'average_rating':
          aValue = a.average_rating;
          bValue = b.average_rating;
          break;
        case 'is_online':
          aValue = a.is_online;
          bValue = b.is_online;
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
  const totalPages = Math.ceil(filteredDrivers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDrivers = filteredDrivers.slice(startIndex, startIndex + itemsPerPage);

  // الحصول على نص قابل للقراءة لنوع المركبة
  const getVehicleTypeText = (type: string) => {
    const vehicleType = VEHICLE_TYPES.find(vt => vt.key === type);
    return vehicleType ? vehicleType.label : type;
  };

  // تحديد لون الحالة
  const getStatusColor = (isVerified: boolean) => {
    return isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  // تحديد نص الحالة
  const getStatusText = (isVerified: boolean) => {
    return isVerified ? 'مفعل' : 'غير مفعل';
  };

  // تحديد لون الحالة المتصل
  const getOnlineStatusColor = (isOnline: boolean) => {
    return isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  // تحديد نص الحالة المتصل
  const getOnlineStatusText = (isOnline: boolean) => {
    return isOnline ? 'متصل' : 'غير متصل';
  };

  const handleDriverUpdated = () => {
    // تحديث قائمة السائقين
    refresh();
  };

  const handleEditDriver = (driver: any) => {
    setSelectedDriver(driver);
    setIsEditModalOpen(true);
  };

  const handleSelectDriver = (driverId: string) => {
    setSelectedDrivers(prev => 
      prev.includes(driverId) 
        ? prev.filter(id => id !== driverId) 
        : [...prev, driverId]
    );
  };

  const handleSelectAll = () => {
    if (selectedDrivers.length === paginatedDrivers.length) {
      setSelectedDrivers([]);
    } else {
      setSelectedDrivers(paginatedDrivers.map(driver => driver.id));
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedDrivers.length === 0) return;

    try {
      switch (action) {
        case 'verify':
          await supabase
            .from('driver_profiles')
            .update({ is_verified: true })
            .in('id', selectedDrivers);
          break;
        case 'unverify':
          await supabase
            .from('driver_profiles')
            .update({ is_verified: false })
            .in('id', selectedDrivers);
          break;
      }
      refresh();
      setSelectedDrivers([]);
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

  const handleDeleteDriver = async (driverId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السائق وجميع بياناته؟ هذا الإجراء لا يمكن التراجع عنه.')) return;
    try {
      await supabase.from('orders').update({ driver_id: null }).eq('driver_id', driverId);
      await supabase.from('chat_conversations').delete().eq('driver_id', driverId);
      const { error: drvErr } = await supabase.from('driver_profiles').delete().eq('id', driverId);
      if (drvErr) console.warn('Could not delete driver_profiles (might be cascaded):', drvErr.message);
      const { error: profErr } = await supabase.from('profiles').delete().eq('id', driverId);
      if (profErr) throw profErr;

      // Log admin activity
      try {
        await supabase.from('admin_activity_log').insert({
          admin_id: authUser?.id || null,
          action: 'delete',
          resource_type: 'driver',
          resource_id: driverId,
          details: null,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Failed to log admin activity (driver delete):', e);
      }

      refresh();
    } catch (e: any) {
      console.error('Error deleting driver:', e);
      alert(e.message || 'حدث خطأ أثناء حذف السائق');
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [vehicleTypeFilter, statusFilter, onlineFilter, searchTerm]);

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
        <h1 className="text-2xl font-bold text-gray-900">{t('driversManagement')}</h1>
        {hasPermission(PERMISSIONS.MANAGE_DRIVERS) && (
          <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
            {t('addDriver')}
          </button>
        )}
      </div>

      {/* فلاتر البحث */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* بحث بالنص */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              {t('search')}
            </label>
            <input
              type="text"
              id="search"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              placeholder="البحث بالاسم أو الهاتف"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* فلتر نوع المركبة */}
          <div>
            <label htmlFor="vehicleType" className="block text-sm font-medium text-gray-700 mb-1">
              {t('vehicleType')}
            </label>
            <select
              id="vehicleType"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              value={vehicleTypeFilter}
              onChange={(e) => setVehicleTypeFilter(e.target.value)}
            >
              {VEHICLE_TYPES.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.label}
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
              <option value="verified">مفعل</option>
              <option value="unverified">غير مفعل</option>
            </select>
          </div>

          {/* فلتر الحالة المتصل */}
          <div>
            <label htmlFor="online" className="block text-sm font-medium text-gray-700 mb-1">
              {t('onlineStatus')}
            </label>
            <select
              id="online"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              value={onlineFilter}
              onChange={(e) => setOnlineFilter(e.target.value)}
            >
              <option value="all">الكل</option>
              <option value="online">متصل</option>
              <option value="offline">غير متصل</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedDrivers.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg flex items-center justify-between">
          <div>
            تم تحديد {selectedDrivers.length} سائقين
          </div>
          <div className="flex space-x-2 space-x-reverse">
            <button 
              className="btn-secondary"
              onClick={() => handleBulkAction('verify')}
            >
              تفعيل السائقين المحددة
            </button>
            <button 
              className="btn-secondary"
              onClick={() => handleBulkAction('unverify')}
            >
              إلغاء تفعيل السائقين المحددة
            </button>
          </div>
        </div>
      )}

      {/* جدول السائقين */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedDrivers.length === paginatedDrivers.length && paginatedDrivers.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('full_name')}
                >
                  <div className="flex items-center">
                    <span>{t('driverName')}</span>
                    {sortBy === 'full_name' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('vehicle_type')}
                >
                  <div className="flex items-center">
                    <span>{t('vehicleType')}</span>
                    {sortBy === 'vehicle_type' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('licensePlate')}
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('average_rating')}
                >
                  <div className="flex items-center">
                    <span>{t('rating')}</span>
                    {sortBy === 'average_rating' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('is_verified')}
                >
                  <div className="flex items-center">
                    <span>{t('status')}</span>
                    {sortBy === 'is_verified' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('is_online')}
                >
                  <div className="flex items-center">
                    <span>{t('online')}</span>
                    {sortBy === 'is_online' && (
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
              {paginatedDrivers.length > 0 ? (
                paginatedDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedDrivers.includes(driver.id)}
                        onChange={() => handleSelectDriver(driver.id)}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-white font-medium">
                              {driver.full_name.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="mr-4">
                          <div className="text-sm font-medium text-gray-900">{driver.full_name}</div>
                          <div className="text-sm text-gray-500">{driver.phone_number}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getVehicleTypeText(driver.vehicle_type)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {driver.license_plate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="mr-1 text-sm text-gray-900">{driver.average_rating.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(driver.is_verified)}`}>
                        {getStatusText(driver.is_verified)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getOnlineStatusColor(driver.is_online)}`}>
                        {getOnlineStatusText(driver.is_online)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(driver.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {hasPermission(PERMISSIONS.MANAGE_DRIVERS) && (
                        <button 
                          className="text-primary hover:text-primary-dark ml-4"
                          onClick={() => handleEditDriver(driver)}
                        >
                          {t('edit')}
                        </button>
                      )}
                      <button className="text-red-600 hover:text-red-900 mr-4" onClick={() => handleDeleteDriver(driver.id)}>
                        {t('delete')}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-sm text-gray-500">
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
                عرض <span className="font-medium">{startIndex + 1}</span> إلى <span className="font-medium">{Math.min(startIndex + itemsPerPage, filteredDrivers.length)}</span> من{' '}
                <span className="font-medium">{filteredDrivers.length}</span> نتائج
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
      
      {/* نموذج تعديل سائق */}
      <EditDriverModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)}
        driver={selectedDriver}
        onDriverUpdated={handleDriverUpdated}
      />

      {/* نموذج إضافة سائق */}
      {hasPermission(PERMISSIONS.MANAGE_DRIVERS) && (
        <AddDriverModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onDriverAdded={refresh}
        />
      )}
    </div>
  );
};

export default DriversPage;