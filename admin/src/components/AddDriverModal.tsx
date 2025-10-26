import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface AddDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDriverAdded: () => void;
}

const AddDriverModal: React.FC<AddDriverModalProps> = ({ isOpen, onClose, onDriverAdded }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [vehicleType, setVehicleType] = useState('car');
  const [vehicleModel, setVehicleModel] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Basic validations
      const emailRegex = /[^@\s]+@[^@\s]+\.[^@\s]+/;
      if (!emailRegex.test(email)) {
        throw new Error('يرجى إدخال بريد إلكتروني صحيح');
      }
      if (password.length < 6) {
        throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      }
      if (password !== confirmPassword) {
        throw new Error('كلمة المرور وتأكيد كلمة المرور غير متطابقين');
      }
      if (!/^\+?\d{7,15}$/.test(phoneNumber)) {
        throw new Error('يرجى إدخال رقم هاتف صحيح');
      }

      // 1) إنشاء مستخدم في Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone_number: phoneNumber,
            user_type: 'driver',
          }
        }
      });
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error('لم يتم إنشاء المستخدم');

      // 2) إنشاء سجل في profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          full_name: fullName,
          phone_number: phoneNumber,
          user_type: 'driver',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      if (profileError) throw profileError;

      // 3) إنشاء سجل في driver_profiles
      const { error: driverError } = await supabase
        .from('driver_profiles')
        .insert({
          id: userId,
          vehicle_type: vehicleType,
          vehicle_model: vehicleModel,
          license_plate: licensePlate,
          average_rating: 0,
          is_verified: false,
          is_online: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      if (driverError) throw driverError;

      setFullName('');
      setEmail('');
      setPhoneNumber('');
      setPassword('');
      setVehicleType('car');
      setVehicleModel('');
      setLicensePlate('');
      setConfirmPassword('');

      onDriverAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء السائق');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">إضافة سائق جديد</h3>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {error && (
              <div className="bg-red-50 p-3 rounded-md">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">الاسم الكامل</label>
              <input
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">البريد الإلكتروني</label>
              <input
                type="email"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">رقم الهاتف</label>
              <input
                type="tel"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">كلمة المرور</label>
              <input
                type="password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">تأكيد كلمة المرور</label>
              <input
                type="password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">نوع المركبة</label>
              <select
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
              >
                <option value="car">سيارة</option>
                <option value="motorcycle">دراجة نارية</option>
                <option value="bicycle">دراجة</option>
                <option value="scooter">سكوتر</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">موديل المركبة</label>
              <input
                type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">رقم اللوحة</label>
              <input
                type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
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
              {loading ? 'جاري الإضافة...' : 'إضافة السائق'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDriverModal;
