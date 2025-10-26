import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, onUserAdded }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userType, setUserType] = useState('customer');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // التحقق من صحة البيانات
    if (password !== confirmPassword) {
      setError('كلمة المرور وتأكيد كلمة المرور غير متطابقين');
      return;
    }
    
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // إنشاء مستخدم جديد في Supabase Auth
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone_number: phoneNumber,
          }
        }
      });
      
      if (authError) throw authError;
      
      // إنشاء سجل في جدول profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user?.id,
          full_name: fullName,
          phone_number: phoneNumber,
          user_type: userType,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      
      if (profileError) throw profileError;
      
      // إعادة تعيين النموذج
      setFullName('');
      setEmail('');
      setPhoneNumber('');
      setUserType('customer');
      setPassword('');
      setConfirmPassword('');
      
      // إغلاق النموذج وإبلاغ المكون الأصلي
      onUserAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء المستخدم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">إضافة مستخدم جديد</h3>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {error && (
              <div className="bg-red-50 p-3 rounded-md">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
            
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                الاسم الكامل
              </label>
              <input
                type="text"
                id="fullName"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                id="email"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                رقم الهاتف
              </label>
              <input
                type="tel"
                id="phoneNumber"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="userType" className="block text-sm font-medium text-gray-700">
                نوع المستخدم
              </label>
              <select
                id="userType"
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
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                كلمة المرور
              </label>
              <input
                type="password"
                id="password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                تأكيد كلمة المرور
              </label>
              <input
                type="password"
                id="confirmPassword"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
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
              {loading ? 'جاري الإنشاء...' : 'إنشاء المستخدم'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;