import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface DriverData {
  id: string;
  full_name: string;
  phone_number: string;
  vehicle_type: string;
  vehicle_model: string;
  license_plate: string;
  average_rating: number;
  is_verified: boolean;
  is_online: boolean;
}

interface EditDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: DriverData | null;
  onDriverUpdated: () => void;
}

// أنواع المركبات
const VEHICLE_TYPES = [
  { key: 'car', label: 'سيارة' },
  { key: 'motorcycle', label: 'دراجة نارية' },
  { key: 'bicycle', label: 'دراجة' },
];

const EditDriverModal: React.FC<EditDriverModalProps> = ({ isOpen, onClose, driver, onDriverUpdated }) => {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('car');
  const [vehicleModel, setVehicleModel] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [averageRating, setAverageRating] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (driver) {
      setFullName(driver.full_name);
      setPhoneNumber(driver.phone_number);
      setVehicleType(driver.vehicle_type);
      setVehicleModel(driver.vehicle_model);
      setLicensePlate(driver.license_plate);
      setAverageRating(driver.average_rating);
      setIsVerified(driver.is_verified);
      setIsOnline(driver.is_online);
    }
  }, [driver]);

  if (!isOpen || !driver) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);
    
    try {
      // تحديث سجل السائق في جدول driver_profiles
      const { error: updateError } = await supabase
        .from('driver_profiles')
        .update({
          vehicle_type: vehicleType,
          vehicle_model: vehicleModel,
          license_plate: licensePlate,
          average_rating: averageRating,
          is_verified: isVerified,
          is_online: isOnline,
          updated_at: new Date().toISOString(),
        })
        .eq('id', driver.id);
      
      if (updateError) throw updateError;
      
      // تحديث سجل المستخدم في جدول profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone_number: phoneNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', driver.id);
      
      if (profileError) throw profileError;
      
      // إغلاق النموذج وإبلاغ المكون الأصلي
      onDriverUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحديث السائق');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">تعديل السائق</h3>
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
              <label htmlFor="editVehicleType" className="block text-sm font-medium text-gray-700">
                نوع المركبة
              </label>
              <select
                id="editVehicleType"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
              >
                {VEHICLE_TYPES.map((type) => (
                  <option key={type.key} value={type.key}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="editVehicleModel" className="block text-sm font-medium text-gray-700">
                طراز المركبة
              </label>
              <input
                type="text"
                id="editVehicleModel"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="editLicensePlate" className="block text-sm font-medium text-gray-700">
                لوحة التسجيل
              </label>
              <input
                type="text"
                id="editLicensePlate"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="editAverageRating" className="block text-sm font-medium text-gray-700">
                التقييم
              </label>
              <input
                type="number"
                id="editAverageRating"
                min="0"
                max="5"
                step="0.1"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={averageRating}
                onChange={(e) => setAverageRating(parseFloat(e.target.value) || 0)}
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="editIsVerified"
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                checked={isVerified}
                onChange={(e) => setIsVerified(e.target.checked)}
              />
              <label htmlFor="editIsVerified" className="mr-2 block text-sm font-medium text-gray-700">
                السائق موثوق
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="editIsOnline"
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                checked={isOnline}
                onChange={(e) => setIsOnline(e.target.checked)}
              />
              <label htmlFor="editIsOnline" className="mr-2 block text-sm font-medium text-gray-700">
                السائق متصل
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
              {loading ? 'جاري التحديث...' : 'تحديث السائق'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDriverModal;