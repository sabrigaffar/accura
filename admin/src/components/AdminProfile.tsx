import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface ProfileData {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  created_at: string;
  user_type: string;
}

const AdminProfile: React.FC = () => {
  const { user, refreshUser, session } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfileData();
    }
  }, [user]);

  const fetchProfileData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfileData({
        id: data.id,
        full_name: data.full_name,
        email: user.email,
        phone_number: data.phone_number,
        created_at: data.created_at,
        user_type: data.user_type
      });

      setFullName(data.full_name);
      setEmail(user.email);
      setPhoneNumber(data.phone_number || '');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب بيانات الملف الشخصي');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setUpdateLoading(true);
      setError(null);
      setSuccess(null);

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone_number: phoneNumber || null
        })
        .eq('id', user.id);

      if (error) throw error;

      setSuccess('تم تحديث الملف الشخصي بنجاح');
      setIsEditing(false);
      
      // Refresh user data
      await refreshUser();
      await fetchProfileData();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحديث الملف الشخصي');
    } finally {
      setUpdateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">الملف الشخصي</h2>
        </div>
        <div className="px-6 py-4">
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">الملف الشخصي</h2>
        </div>
        <div className="px-6 py-4">
          <div className="bg-red-50 p-3 rounded-md">
            <div className="text-red-700 text-sm">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return null;
  }

  // Get last sign in time from session
  const lastSignInAt = session?.user?.last_sign_in_at;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">الملف الشخصي</h2>
      </div>
      
      <div className="px-6 py-4">
        {error && (
          <div className="mb-4 bg-red-50 p-3 rounded-md">
            <div className="text-red-700 text-sm">{error}</div>
          </div>
        )}
        
        {success && (
          <div className="mb-4 bg-green-50 p-3 rounded-md">
            <div className="text-green-700 text-sm">{success}</div>
          </div>
        )}
        
        {!isEditing ? (
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-white text-xl font-medium">
                    {profileData.full_name.charAt(0)}
                  </span>
                </div>
              </div>
              <div className="mr-4">
                <h3 className="text-lg font-medium text-gray-900">{profileData.full_name}</h3>
                <p className="text-sm text-gray-500">مدير النظام</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">البريد الإلكتروني</label>
                <p className="mt-1 text-sm text-gray-900">{profileData.email}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">رقم الهاتف</label>
                <p className="mt-1 text-sm text-gray-900">{profileData.phone_number || 'غير محدد'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">تاريخ التسجيل</label>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(profileData.created_at).toLocaleDateString('ar-SA')}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">آخر تسجيل دخول</label>
                <p className="mt-1 text-sm text-gray-900">
                  {lastSignInAt 
                    ? new Date(lastSignInAt).toLocaleString('ar-SA') 
                    : 'أول تسجيل دخول'}
                </p>
              </div>
            </div>
            
            <div className="pt-4">
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                تعديل الملف الشخصي
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUpdateProfile}>
            <div className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  id="fullName"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  id="email"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled
                />
                <p className="mt-1 text-sm text-gray-500">لا يمكن تغيير البريد الإلكتروني</p>
              </div>
              
              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                  رقم الهاتف
                </label>
                <input
                  type="text"
                  id="phoneNumber"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              
              <div className="flex space-x-2 space-x-reverse pt-4">
                <button
                  type="submit"
                  disabled={updateLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  {updateLoading ? 'جاري التحديث...' : 'حفظ التغييرات'}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setFullName(profileData.full_name);
                    setEmail(profileData.email);
                    setPhoneNumber(profileData.phone_number || '');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminProfile;