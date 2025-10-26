import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AddMerchantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMerchantAdded: () => void;
}

const CATEGORIES = [
  { key: 'restaurant', label: 'مطعم' },
  { key: 'grocery', label: 'بقالة' },
  { key: 'pharmacy', label: 'صيدلية' },
  { key: 'gifts', label: 'هدايا' },
  { key: 'other', label: 'أخرى' },
];

const AddMerchantModal: React.FC<AddMerchantModalProps> = ({ isOpen, onClose, onMerchantAdded }) => {
  const [nameAr, setNameAr] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [category, setCategory] = useState('restaurant');
  const [owners, setOwners] = useState<{ id: string; full_name: string }[]>([]);
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerMode, setOwnerMode] = useState<'select' | 'create'>('select');
  const [ownerFullName, setOwnerFullName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerConfirmPassword, setOwnerConfirmPassword] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const fetchOwners = async () => {
      try {
        setLoadingOwners(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('user_type', 'merchant')
          .order('full_name', { ascending: true });
        if (error) throw error;
        setOwners((data || []).map((p: any) => ({ id: p.id, full_name: p.full_name })));
      } catch (e: any) {
        setError(e.message || 'تعذر جلب المالكين');
      } finally {
        setLoadingOwners(false);
      }
    };
    fetchOwners();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      setError('يرجى إدخال اسم التاجر');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let finalOwnerId = ownerId;

      if (ownerMode === 'create') {
        // تحقق أساسي لبيانات المالك الجديد
        if (!ownerFullName.trim()) throw new Error('يرجى إدخال اسم المالك');
        const emailRegex = /[^@\s]+@[^@\s]+\.[^@\s]+/;
        if (!emailRegex.test(ownerEmail)) throw new Error('يرجى إدخال بريد إلكتروني صحيح للمالك');
        if (ownerPassword.length < 6) throw new Error('كلمة مرور المالك يجب أن تكون 6 أحرف على الأقل');
        if (ownerPassword !== ownerConfirmPassword) throw new Error('كلمة المرور وتأكيد كلمة المرور للمالك غير متطابقين');
        if (ownerPhone && !/^\+?\d{7,15}$/.test(ownerPhone)) throw new Error('يرجى إدخال رقم هاتف صحيح للمالك');

        // إنشاء مستخدم للمالك
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: ownerEmail,
          password: ownerPassword,
          options: {
            data: {
              full_name: ownerFullName,
              phone_number: ownerPhone,
              user_type: 'merchant',
            }
          }
        });
        if (authError) throw authError;
        const newOwnerId = authData.user?.id;
        if (!newOwnerId) throw new Error('تعذر إنشاء حساب المالك');

        // إنشاء/تحديث ملف المالك في profiles
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: newOwnerId,
            full_name: ownerFullName,
            phone_number: ownerPhone,
            user_type: 'merchant',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        if (profileError) throw profileError;

        finalOwnerId = newOwnerId;
      } else {
        if (!finalOwnerId) {
          setError('يرجى اختيار مالك للتاجر');
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase
        .from('merchants')
        .insert({
          name_ar: nameAr.trim(),
          owner_id: finalOwnerId,
          category,
          rating: 0,
          is_active: true,
          created_at: new Date().toISOString(),
        });
      if (error) throw error;

      setNameAr('');
      setOwnerId('');
      setCategory('restaurant');
      setOwnerMode('select');
      setOwnerFullName('');
      setOwnerEmail('');
      setOwnerPhone('');
      setOwnerPassword('');
      setOwnerConfirmPassword('');

      onMerchantAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء التاجر');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">إضافة تاجر جديد</h3>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {error && (
              <div className="bg-red-50 p-3 rounded-md">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">اسم التاجر (عربي)</label>
              <input
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">المالك</label>
              <div className="flex items-center space-x-4 space-x-reverse mt-1 mb-2">
                <label className="flex items-center space-x-2 space-x-reverse">
                  <input type="radio" className="mr-1" checked={ownerMode === 'select'} onChange={() => setOwnerMode('select')} />
                  <span>اختيار موجود</span>
                </label>
                <label className="flex items-center space-x-2 space-x-reverse">
                  <input type="radio" className="mr-1" checked={ownerMode === 'create'} onChange={() => setOwnerMode('create')} />
                  <span>إنشاء مالك جديد</span>
                </label>
              </div>

              {ownerMode === 'select' ? (
                <select
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                >
                  <option value="" disabled>
                    {loadingOwners ? 'جاري التحميل...' : 'اختر مالكًا'}
                  </option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.full_name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="اسم المالك"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    value={ownerFullName}
                    onChange={(e) => setOwnerFullName(e.target.value)}
                  />
                  <input
                    type="email"
                    placeholder="البريد الإلكتروني للمالك"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                  />
                  <input
                    type="tel"
                    placeholder="رقم هاتف المالك (اختياري)"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                  />
                  <input
                    type="password"
                    placeholder="كلمة مرور المالك"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                  />
                  <input
                    type="password"
                    placeholder="تأكيد كلمة مرور المالك"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    value={ownerConfirmPassword}
                    onChange={(e) => setOwnerConfirmPassword(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">الفئة</label>
              <select
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
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
              {loading ? 'جاري الإضافة...' : 'إضافة التاجر'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMerchantModal;
