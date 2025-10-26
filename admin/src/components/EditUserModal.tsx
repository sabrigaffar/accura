import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface UserData {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  user_type: 'customer' | 'merchant' | 'driver' | 'admin';
  is_active: boolean;
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserData | null;
  onUserUpdated: () => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, user, onUserUpdated }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userType, setUserType] = useState('customer');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user: authUser } = useAuth();

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setEmail(user.email);
      setPhoneNumber(user.phone_number);
      setUserType(user.user_type);
      setIsActive(user.is_active);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);
    
    try {
      // تحديث سجل المستخدم في جدول profiles
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone_number: phoneNumber,
          user_type: userType,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      
      if (updateError) throw updateError;
      
      // Log admin activity
      try {
        await supabase
          .from('admin_activity_log')
          .insert({
            admin_id: authUser?.id || null,
            action: 'update',
            resource_type: 'user',
            resource_id: user.id,
            details: {
              full_name: fullName,
              phone_number: phoneNumber,
              user_type: userType,
              is_active: isActive,
            },
            timestamp: new Date().toISOString(),
          });
      } catch (logErr) {
        console.error('Failed to log admin activity:', logErr);
      }
      
      // إغلاق النموذج وإبلاغ المكون الأصلي
      onUserUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحديث المستخدم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">تعديل المستخدم</h3>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {error && (
              <div className="bg-red-50 p-3 rounded-md">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
            
            <div>
              <label htmlFor="editFullName" className="block text-sm font-medium text-gray-700">
                الاسم الكامل
              </label>
              <input
                type="text"
                id="editFullName"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="editEmail" className="block text-sm font-medium text-gray-700">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                id="editEmail"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="editPhoneNumber" className="block text-sm font-medium text-gray-700">
                رقم الهاتف
              </label>
              <input
                type="tel"
                id="editPhoneNumber"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="editUserType" className="block text-sm font-medium text-gray-700">
                نوع المستخدم
              </label>
              <select
                id="editUserType"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={userType}
                onChange={(e) => setUserType(e.target.value)}
              >
                <option value="customer">عميل</option>
                <option value="merchant">تاجر</option>
                <option value="driver">سائق</option>
                <option value="admin">مدير</option>
              </select>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="editIsActive"
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="editIsActive" className="mr-2 block text-sm font-medium text-gray-700">
                المستخدم نشط
              </label>
            </div>
          </div>
          
          <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 space-x-reverse">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              onClick={onClose}
              disabled={loading}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              disabled={loading}
            >
              {loading ? 'جاري التحديث...' : 'تحديث المستخدم'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;