import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderAdded: () => void;
}

const AddOrderModal: React.FC<AddOrderModalProps> = ({ isOpen, onClose, onOrderAdded }) => {
  const { currency } = useSettings();
  const [orderNumber, setOrderNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [total, setTotal] = useState('');
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [merchants, setMerchants] = useState<{ id: string; name: string }[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  const [listsLoading, setListsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const fetchLists = async () => {
      try {
        setListsLoading(true);
        // Customers
        const { data: cust, error: custErr } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('user_type', 'customer')
          .order('full_name', { ascending: true });
        if (custErr) throw custErr;
        setCustomers((cust || []).map((c: any) => ({ id: c.id, name: c.full_name })));

        // Merchants
        const { data: mers, error: merErr } = await supabase
          .from('merchants')
          .select('id, name_ar')
          .order('name_ar', { ascending: true });
        if (merErr) throw merErr;
        setMerchants((mers || []).map((m: any) => ({ id: m.id, name: m.name_ar })));

        // Drivers
        const { data: drvs, error: drvErr } = await supabase
          .from('driver_profiles')
          .select(`id, profiles(full_name)`);
        if (drvErr) throw drvErr;
        setDrivers((drvs || []).map((d: any) => ({ id: d.id, name: d.profiles?.full_name || d.id })));
      } catch (e: any) {
        setError(e.message || 'تعذر جلب القوائم');
      } finally {
        setListsLoading(false);
      }
    };
    fetchLists();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        order_number: orderNumber,
        customer_id: customerId,
        merchant_id: merchantId,
        status,
        total: parseFloat(total || '0') || 0,
        created_at: new Date().toISOString(),
      };
      if (driverId) payload.driver_id = driverId;

      const { error } = await supabase
        .from('orders')
        .insert(payload);

      if (error) throw error;

      setOrderNumber('');
      setCustomerId('');
      setMerchantId('');
      setDriverId('');
      setTotal('');
      setStatus('pending');

      onOrderAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء الطلب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">إضافة طلب جديد</h3>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {error && (
              <div className="bg-red-50 p-3 rounded-md">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">رقم الطلب</label>
              <input
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">العميل</label>
              <select
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="" disabled>{listsLoading ? 'جاري التحميل...' : 'اختر عميلًا'}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">التاجر</label>
              <select
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
              >
                <option value="" disabled>{listsLoading ? 'جاري التحميل...' : 'اختر تاجرًا'}</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">السائق (اختياري)</label>
              <select
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
              >
                <option value="">بدون سائق</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">الإجمالي ({currency})</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">الحالة</label>
              <select
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="pending">قيد الانتظار</option>
                <option value="accepted">مقبول</option>
                <option value="preparing">قيد التحضير</option>
                <option value="ready">جاهز للتسليم</option>
                <option value="picked_up">تم الاستلام</option>
                <option value="on_the_way">في الطريق</option>
                <option value="delivered">تم التوصيل</option>
                <option value="cancelled">ملغى</option>
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
              {loading ? 'جاري الإضافة...' : 'إضافة الطلب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddOrderModal;
