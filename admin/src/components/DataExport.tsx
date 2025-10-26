import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const DataExport: React.FC = () => {
  const [exportType, setExportType] = useState('users');
  const [dateRange, setDateRange] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const exportData = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      let query;
      let fileName = '';

      switch (exportType) {
        case 'users':
          query = supabase.from('profiles').select('*');
          fileName = 'users-export.csv';
          break;
        case 'orders':
          query = supabase.from('orders').select('*');
          fileName = 'orders-export.csv';
          break;
        case 'merchants':
          query = supabase.from('merchants').select('*');
          fileName = 'merchants-export.csv';
          break;
        case 'drivers':
          query = supabase.from('driver_profiles').select('*');
          fileName = 'drivers-export.csv';
          break;
        default:
          throw new Error('نوع التصدير غير مدعوم');
      }

      // تطبيق فلتر التاريخ إذا تم تحديده
      if (dateRange !== 'all') {
        const daysAgo = parseInt(dateRange);
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - daysAgo);
        
        // تحديد العمود المناسب للتاريخ حسب نوع الجدول
        let dateColumn = 'created_at';
        if (exportType === 'orders') {
          dateColumn = 'created_at';
        } else if (exportType === 'merchants') {
          dateColumn = 'created_at';
        }
        
        query = query.gte(dateColumn, fromDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // تحويل البيانات إلى CSV
      const csvContent = convertToCSV(data);
      
      // إنشاء ملف وتنزيله
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccess('تم تصدير البيانات بنجاح');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تصدير البيانات');
    } finally {
      setLoading(false);
    }
  };

  const convertToCSV = (data: any[]): string => {
    if (!data || data.length === 0) return '';

    // الحصول على العناوين من أول سجل
    const headers = Object.keys(data[0]).join(',');

    // تحويل السجلات إلى سطور CSV
    const rows = data.map(row => {
      return Object.values(row).map(value => {
        // التعامل مع القيم التي تحتوي على فواصل أو اقتباسات
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });

    return [headers, ...rows].join('\n');
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">تصدير البيانات</h3>
      
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="exportType" className="block text-sm font-medium text-gray-700 mb-1">
            نوع البيانات
          </label>
          <select
            id="exportType"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            value={exportType}
            onChange={(e) => setExportType(e.target.value)}
          >
            <option value="users">المستخدمون</option>
            <option value="orders">الطلبات</option>
            <option value="merchants">التجار</option>
            <option value="drivers">السائقون</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700 mb-1">
            الفترة الزمنية
          </label>
          <select
            id="dateRange"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="all">جميع البيانات</option>
            <option value="7">آخر 7 أيام</option>
            <option value="30">آخر 30 يوم</option>
            <option value="90">آخر 90 يوم</option>
          </select>
        </div>
      </div>
      
      <button
        onClick={exportData}
        disabled={loading}
        className="w-full px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
      >
        {loading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            جاري التصدير...
          </span>
        ) : (
          'تصدير البيانات'
        )}
      </button>
      
      <div className="mt-4 text-sm text-gray-500">
        <p>ملاحظة: سيتم تنزيل الملف بصيغة CSV ويمكن فتحه باستخدام Excel أو Google Sheets.</p>
      </div>
    </div>
  );
};

export default DataExport;