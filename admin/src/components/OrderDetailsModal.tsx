import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

interface OrderData {
  id: string;
  order_number: string;
  customer_id: string;
  merchant_id: string;
  driver_id: string | null;
  status: string;
  total: number;
  created_at: string;
  items: OrderItem[];
}

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
}

// حالات الطلب
const ORDER_STATUS = [
  { key: 'pending', label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'accepted', label: 'مقبول', color: 'bg-blue-100 text-blue-800' },
  { key: 'preparing', label: 'قيد التحضير', color: 'bg-indigo-100 text-indigo-800' },
  { key: 'ready', label: 'جاهز للتسليم', color: 'bg-purple-100 text-purple-800' },
  { key: 'picked_up', label: 'تم الاستلام', color: 'bg-cyan-100 text-cyan-800' },
  { key: 'on_the_way', label: 'في الطريق', color: 'bg-teal-100 text-teal-800' },
  { key: 'delivered', label: 'تم التوصيل', color: 'bg-green-100 text-green-800' },
  { key: 'cancelled', label: 'ملغى', color: 'bg-red-100 text-red-800' },
];

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ isOpen, onClose, orderId }) => {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderDetails();
    }
  }, [isOpen, orderId]);

  const fetchOrderDetails = async () => {
    if (!orderId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // جلب تفاصيل الطلب
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      
      if (orderError) throw orderError;
      
      // جلب عناصر الطلب
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
      
      if (itemsError) throw itemsError;
      
      setOrder({
        ...orderData,
        items: itemsData || []
      });
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب تفاصيل الطلب');
    } finally {
      setLoading(false);
    }
  };

  // الحصول على نص قابل للقراءة لحالة الطلب
  const getStatusText = (status: string) => {
    const orderStatus = ORDER_STATUS.find(os => os.key === status);
    return orderStatus ? orderStatus.label : status;
  };

  // الحصول على لون الحالة
  const getStatusColor = (status: string) => {
    const orderStatus = ORDER_STATUS.find(os => os.key === status);
    return orderStatus ? orderStatus.color : 'bg-gray-100 text-gray-800';
  };

  if (!isOpen || !orderId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">تفاصيل الطلب</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 p-6">
            <div className="text-red-700">حدث خطأ: {error}</div>
          </div>
        ) : order ? (
          <div className="px-6 py-4 space-y-6">
            {/* معلومات الطلب */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">رقم الطلب</p>
                  <p className="font-medium">{order.order_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">تاريخ الطلب</p>
                  <p className="font-medium">{new Date(order.created_at).toLocaleDateString('ar-SA')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">الحالة</p>
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">المجموع</p>
                  <p className="font-medium">{order.total.toFixed(2)} ر.س</p>
                </div>
              </div>
            </div>
            
            {/* عناصر الطلب */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">عناصر الطلب</h4>
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center border-b border-gray-200 pb-3">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-gray-500">الكمية: {item.quantity}</p>
                    </div>
                    <p className="font-medium">{(item.price * item.quantity).toFixed(2)} ر.س</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* معلومات العميل والتاجر */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-medium text-gray-900 mb-2">معلومات العميل</h4>
                <p className="text-sm text-gray-500">ID: {order.customer_id}</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-medium text-gray-900 mb-2">معلومات التاجر</h4>
                <p className="text-sm text-gray-500">ID: {order.merchant_id}</p>
              </div>
            </div>
            
            {/* معلومات السائق */}
            {order.driver_id && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-medium text-gray-900 mb-2">معلومات السائق</h4>
                <p className="text-sm text-gray-500">ID: {order.driver_id}</p>
              </div>
            )}
          </div>
        ) : null}
        
        <div className="px-6 py-4 bg-gray-50 flex justify-end">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            onClick={onClose}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsModal;