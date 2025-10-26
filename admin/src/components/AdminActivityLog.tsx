import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface AdminActivity {
  id: string;
  admin_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, any> | null;
  timestamp: string;
  admin_name: string;
}

const AdminActivityLog: React.FC = () => {
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('7'); // Last 7 days

  useEffect(() => {
    fetchActivityLog();
  }, [dateFilter]);

  const fetchActivityLog = async () => {
    try {
      setLoading(true);
      const daysAgo = parseInt(dateFilter);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysAgo);
      
      const { data, error } = await supabase
        .from('admin_activity_log')
        .select(`
          *,
          profiles:profiles!admin_activity_log_admin_id_fkey(full_name)
        `)
        .gte('timestamp', fromDate.toISOString())
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;

      const transformedData = data?.map(activity => ({
        ...activity,
        admin_name: activity.profiles?.full_name || 'مدير غير معروف'
      })) || [];

      setActivities(transformedData);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب سجل النشاط');
    } finally {
      setLoading(false);
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'create': return 'إنشاء';
      case 'update': return 'تعديل';
      case 'delete': return 'حذف';
      case 'login': return 'تسجيل دخول';
      case 'logout': return 'تسجيل خروج';
      default: return action;
    }
  };

  const getResourceText = (resourceType: string) => {
    switch (resourceType) {
      case 'user': return 'مستخدم';
      case 'order': return 'طلب';
      case 'merchant': return 'تاجر';
      case 'driver': return 'سائق';
      case 'system': return 'نظام';
      default: return resourceType;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'bg-green-100 text-green-800';
      case 'update': return 'bg-blue-100 text-blue-800';
      case 'delete': return 'bg-red-100 text-red-800';
      case 'login': return 'bg-purple-100 text-purple-800';
      case 'logout': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="bg-red-50 p-4 rounded-md">
          <div className="text-red-700">حدث خطأ: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">سجل نشاط الأدمن</h3>
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
                المصدر
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                التفاصيل
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {activities.length > 0 ? (
              activities.map((activity) => (
                <tr key={activity.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(activity.timestamp).toLocaleString('ar-SA')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {activity.admin_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionColor(activity.action)}`}>
                      {getActionText(activity.action)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getResourceText(activity.resource_type)} #{activity.resource_id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {activity.details && Object.keys(activity.details).length > 0 && (
                      <div className="max-w-xs truncate">
                        {Object.entries(activity.details).map(([key, value]) => (
                          <span key={key} className="mr-2">
                            {key}: {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  لا توجد أنشطة حديثة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminActivityLog;