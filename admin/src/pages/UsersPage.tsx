import React, { useState, useEffect } from 'react';
import { useUsers } from '../hooks/useSupabaseData';
import UserModal from '../components/UserModal';
import EditUserModal from '../components/EditUserModal';
import { PERMISSIONS, usePermissions } from '../contexts/PermissionsContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// أنواع المستخدمين
const USER_TYPES = [
  { key: 'all', label: 'الكل' },
  { key: 'customer', label: 'عميل' },
  { key: 'merchant', label: 'تاجر' },
  { key: 'driver', label: 'سائق' },
  { key: 'admin', label: 'مدير' },
];

// حالة المستخدم
const USER_STATUS = [
  { key: 'all', label: 'الكل' },
  { key: 'active', label: 'نشط' },
  { key: 'inactive', label: 'غير نشط' },
];

const UsersPage = () => {
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<keyof any>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { hasPermission } = usePermissions();
  const { t } = useLanguage();
  const { user: authUser } = useAuth();

  // Use the custom hook to fetch users
  const { users, loading, error, refresh } = useUsers({
    userType: userTypeFilter,
    status: userStatusFilter,
    search: searchTerm
  });

  // Filter and sort users
  const filteredUsers = users
    .filter(user => {
      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const emailValue = (user as any).email ? String((user as any).email).toLowerCase() : '';
        return (
          user.full_name.toLowerCase().includes(searchLower) ||
          emailValue.includes(searchLower) ||
          user.phone_number.includes(searchTerm)
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
        case 'user_type':
          aValue = a.user_type;
          bValue = b.user_type;
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
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  // الحصول على نص قابل للقراءة لنوع المستخدم
  const getUserTypeText = (type: string) => {
    const userType = USER_TYPES.find(ut => ut.key === type);
    return userType ? userType.label : type;
  };

  // الحصول على نص قابل للقراءة لحالة المستخدم
  const getUserStatusText = (status: boolean) => {
    return status ? 'نشط' : 'غير نشط';
  };

  // تحديد لون الحالة
  const getStatusColor = (status: boolean) => {
    return status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const handleUserAdded = () => {
    // تحديث قائمة المستخدمين
    refresh();
  };

  const handleUserUpdated = () => {
    // تحديث قائمة المستخدمين
    refresh();
  };

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === paginatedUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(paginatedUsers.map(user => user.id));
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedUsers.length === 0) return;

    try {
      switch (action) {
        case 'activate':
          await supabase
            .from('profiles')
            .update({ is_active: true })
            .in('id', selectedUsers);
          break;
        case 'deactivate':
          await supabase
            .from('profiles')
            .update({ is_active: false })
            .in('id', selectedUsers);
          break;
        case 'delete':
          // In a real application, you might want to soft delete or archive
          await supabase
            .from('profiles')
            .delete()
            .in('id', selectedUsers);
          break;
      }
      refresh();
      setSelectedUsers([]);
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

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستخدم؟ هذا الإجراء لا يمكن التراجع عنه.')) return;
    try {
      const { data: profileRow, error: profileErr } = await supabase
        .from('profiles')
        .select('id, user_type')
        .eq('id', userId)
        .single();
      if (profileErr) throw profileErr;

      if (profileRow?.user_type === 'driver') {
        const { error: orderNullErr } = await supabase
          .from('orders')
          .update({ driver_id: null })
          .eq('driver_id', userId);
        if (orderNullErr) throw orderNullErr;

        const { error: chatDelErr } = await supabase
          .from('chat_conversations')
          .delete()
          .eq('driver_id', userId);
        if (chatDelErr) throw chatDelErr;

        const { error: ticketsAssignErr } = await supabase
          .from('support_tickets')
          .update({ assigned_to: null })
          .eq('assigned_to', userId);
        if (ticketsAssignErr) throw ticketsAssignErr;

        const { error: ticketsDelErr } = await supabase
          .from('support_tickets')
          .delete()
          .eq('user_id', userId);
        if (ticketsDelErr) throw ticketsDelErr;

        const { error: reviewsDelErr } = await supabase
          .from('reviews')
          .delete()
          .or(`reviewer_id.eq.${userId},reviewee_id.eq.${userId}`);
        if (reviewsDelErr) throw reviewsDelErr;

        const { error: txDelErr } = await supabase
          .from('transactions')
          .delete()
          .eq('user_id', userId);
        if (txDelErr) throw txDelErr;

        const { error: drvProfErr } = await supabase
          .from('driver_profiles')
          .delete()
          .eq('id', userId);
        if (drvProfErr) throw drvProfErr;
      } else if (profileRow?.user_type === 'customer') {
        const { count: custOrdersCount, error: custOrdersErr } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', userId);
        if (custOrdersErr) throw custOrdersErr;
        if ((custOrdersCount || 0) > 0) {
          alert('لا يمكن حذف هذا المستخدم لوجود طلبات مرتبطة به. يمكنك إلغاء تفعيل الحساب بدلاً من ذلك.');
          return;
        }
      } else if (profileRow?.user_type === 'merchant') {
        const { count: ownerMerchantsCount, error: ownerErr } = await supabase
          .from('merchants')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', userId);
        if (ownerErr) throw ownerErr;
        if ((ownerMerchantsCount || 0) > 0) {
          alert('لا يمكن حذف هذا المستخدم لارتباطه بتجّار كمالك. قم بتغيير المالك أو حذف التاجر أولاً.');
          return;
        }
      }

      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;

      try {
        await supabase.from('admin_activity_log').insert({
          admin_id: authUser?.id || null,
          action: 'delete',
          resource_type: 'user',
          resource_id: userId,
          details: null,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Failed to log admin activity (user delete):', e);
      }

      refresh();
    } catch (e: any) {
      console.error('Error deleting user:', e);
      alert(e.message || 'حدث خطأ أثناء حذف المستخدم');
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [userTypeFilter, userStatusFilter, searchTerm]);

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
        <h1 className="text-2xl font-bold text-gray-900">{t('usersManagement')}</h1>
        {hasPermission(PERMISSIONS.MANAGE_USERS) && (
          <button 
            className="btn-primary"
            onClick={() => setIsAddModalOpen(true)}
          >
            {t('addUser')}
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
              placeholder="البحث بالاسم أو الهاتف"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* فلتر نوع المستخدم */}
          <div>
            <label htmlFor="userType" className="block text-sm font-medium text-gray-700 mb-1">
              {t('userType')}
            </label>
            <select
              id="userType"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              value={userTypeFilter}
              onChange={(e) => setUserTypeFilter(e.target.value)}
            >
              {USER_TYPES.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* فلتر الحالة */}
          <div>
            <label htmlFor="userStatus" className="block text-sm font-medium text-gray-700 mb-1">
              {t('status')}
            </label>
            <select
              id="userStatus"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              value={userStatusFilter}
              onChange={(e) => setUserStatusFilter(e.target.value)}
            >
              {USER_STATUS.map((status) => (
                <option key={status.key} value={status.key}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg flex items-center justify-between">
          <div>
            تم تحديد {selectedUsers.length} مستخدمين
          </div>
          <div className="flex space-x-2 space-x-reverse">
            <button 
              className="btn-secondary"
              onClick={() => handleBulkAction('activate')}
            >
              تفعيل المحدد
            </button>
            <button 
              className="btn-secondary"
              onClick={() => handleBulkAction('deactivate')}
            >
              إلغاء تفعيل المحدد
            </button>
            <button 
              className="btn-danger"
              onClick={() => handleBulkAction('delete')}
            >
              حذف المحدد
            </button>
          </div>
        </div>
      )}

      {/* جدول المستخدمين */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0}
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
                    <span>{t('userName')}</span>
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
                  onClick={() => handleSort('user_type')}
                >
                  <div className="flex items-center">
                    <span>{t('userType')}</span>
                    {sortBy === 'user_type' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('phone')}
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
              {paginatedUsers.length > 0 ? (
                paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => handleSelectUser(user.id)}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-white font-medium">
                              {user.full_name.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="mr-4">
                          <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                          <div className="text-sm text-gray-500">{(user as any).email || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getUserTypeText(user.user_type)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.phone_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(user.is_active)}`}>
                        {getUserStatusText(user.is_active)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {hasPermission(PERMISSIONS.MANAGE_USERS) && (
                        <button 
                          className="text-primary hover:text-primary-dark ml-4"
                          onClick={() => handleEditUser(user)}
                        >
                          {t('edit')}
                        </button>
                      )}
                      <button className="text-red-600 hover:text-red-900 mr-4" onClick={() => handleDeleteUser(user.id)}>
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
                عرض <span className="font-medium">{startIndex + 1}</span> إلى <span className="font-medium">{Math.min(startIndex + itemsPerPage, filteredUsers.length)}</span> من{' '}
                <span className="font-medium">{filteredUsers.length}</span> نتائج
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
      
      {/* نموذج إضافة مستخدم */}
      <UserModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onUserAdded={handleUserAdded}
      />
      
      {/* نموذج تعديل مستخدم */}
      <EditUserModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)}
        user={selectedUser}
        onUserUpdated={handleUserUpdated}
      />
    </div>
  );
};

export default UsersPage;