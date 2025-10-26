import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface MerchantData {
  id: string;
  name_ar: string;
  owner_id: string;
  category: string;
  rating: number;
  is_active: boolean;
}

interface EditMerchantModalProps {
  isOpen: boolean;
  onClose: () => void;
  merchant: MerchantData | null;
  onMerchantUpdated: () => void;
}

// أنواع الفئات
const MERCHANT_CATEGORIES = [
  { key: 'restaurant', label: 'مطعم' },
  { key: 'grocery', label: 'بقالة' },
  { key: 'pharmacy', label: 'صيدلية' },
  { key: 'gifts', label: 'هدايا' },
  { key: 'other', label: 'أخرى' },
];

const EditMerchantModal: React.FC<EditMerchantModalProps> = ({ isOpen, onClose, merchant, onMerchantUpdated }) => {
  const [name, setName] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [category, setCategory] = useState('restaurant');
  const [rating, setRating] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (merchant) {
      setName(merchant.name_ar);
      setOwnerId(merchant.owner_id);
      setCategory(merchant.category);
      setRating(merchant.rating);
      setIsActive(merchant.is_active);
    }
  }, [merchant]);

  if (!isOpen || !merchant) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);
    
    try {
      // تحديث سجل التاجر في جدول merchants
      const { error: updateError } = await supabase
        .from('merchants')
        .update({
          name_ar: name,
          owner_id: ownerId,
          category: category,
          rating: rating,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', merchant.id);
      
      if (updateError) throw updateError;
      
      // إغلاق النموذج وإبلاغ المكون الأصلي
      onMerchantUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحديث التاجر');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">تعديل التاجر</h3>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {error && (
              <div className="bg-red-50 p-3 rounded-md">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
            
            <div>
              <label htmlFor="editName" className="block text-sm font-medium text-gray-700">
                اسم التاجر
              </label>
              <input
                type="text"
                id="editName"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="editOwnerId" className="block text-sm font-medium text-gray-700">
                ID المالك
              </label>
              <input
                type="text"
                id="editOwnerId"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="editCategory" className="block text-sm font-medium text-gray-700">
                الفئة
              </label>
              <select
                id="editCategory"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {MERCHANT_CATEGORIES.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="editRating" className="block text-sm font-medium text-gray-700">
                التقييم
              </label>
              <input
                type="number"
                id="editRating"
                min="0"
                max="5"
                step="0.1"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={rating}
                onChange={(e) => setRating(parseFloat(e.target.value) || 0)}
              />
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
                التاجر نشط
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
              {loading ? 'جاري التحديث...' : 'تحديث التاجر'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditMerchantModal;