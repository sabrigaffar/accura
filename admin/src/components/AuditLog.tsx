import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface AuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  timestamp: string;
  admin_name: string;
}

const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('7'); // Last 7 days

  useEffect(() => {
    fetchAuditLogs();
  }, [dateFilter]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const daysAgo = parseInt(dateFilter);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysAgo);
      
      const { data, error } = await supabase
        .from('audit_log')
        .select(`
          *,
          profiles:profiles!audit_log_user_id_fkey(full_name)
        `)
        .gte('timestamp', fromDate.toISOString())
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;

      const transformedData = data?.map(log => ({
        ...log,
        admin_name: log.profiles?.full_name || 'Unknown'
      })) || [];

      setLogs(transformedData);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب سجل التدقيق');
    } finally {
      setLoading(false);
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'INSERT': return 'إضافة';
      case 'UPDATE': return 'تعديل';
      case 'DELETE': return 'حذف';
      default: return action;
    }
  };

  const getTableText = (tableName: string) => {
    switch (tableName) {
      case 'profiles': return 'المستخدمون';
      case 'orders': return 'الطلبات';
      case 'merchants': return 'التجار';
      case 'driver_profiles': return 'السائقون';
      default: return tableName;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg">
        <div className="text-red-700">حدث خطأ: {error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">سجل التدقيق</h3>
        <div>
          <label htmlFor="dateFilter" className="mr-2 text-sm text-gray-700">
            عرض آخر:
          </label>
          <select
            id="dateFilter"
            className="px-3 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="1">يوم واحد</option>
            <option value="7">7 أيام</option>
            <option value="30">30 يوم</option>
            <option value="90">90 يوم</option>
          </select>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                التاريخ والوقت
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                الأدمن
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                الإجراء
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                الجدول
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                التفاصيل
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.length > 0 ? (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(log.timestamp).toLocaleString('ar-SA')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.admin_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      log.action === 'INSERT' ? 'bg-green-100 text-green-800' :
                      log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                      log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {getActionText(log.action)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getTableText(log.table_name)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {log.record_id && (
                      <div>
                        <span className="font-medium">ID:</span> {log.record_id}
                      </div>
                    )}
                    {log.new_values && Object.keys(log.new_values).length > 0 && (
                      <div className="mt-1">
                        <span className="font-medium">القيم الجديدة:</span>
                        <div className="max-w-xs truncate">
                          {Object.entries(log.new_values).map(([key, value]) => (
                            <span key={key} className="mr-2">
                              {key}: {String(value)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  لا توجد سجلات تدقيق
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            السابق
          </button>
          <button className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            التالي
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              عرض <span className="font-medium">1</span> إلى <span className="font-medium">{logs.length}</span> من{' '}
              <span className="font-medium">{logs.length}</span> نتائج
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                <span className="sr-only">السابق</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                1
              </button>
              <button className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                <span className="sr-only">التالي</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLog;