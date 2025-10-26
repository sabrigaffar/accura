import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface SystemStatus {
  database: 'healthy' | 'degraded' | 'down';
  api: 'healthy' | 'degraded' | 'down';
  storage: 'healthy' | 'degraded' | 'down';
  auth: 'healthy' | 'degraded' | 'down';
  lastChecked: string;
}

const SystemHealth: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    database: 'healthy',
    api: 'healthy',
    storage: 'healthy',
    auth: 'healthy',
    lastChecked: new Date().toISOString()
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSystemHealth();
    // تحديث الحالة كل 5 دقائق
    const interval = setInterval(checkSystemHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkSystemHealth = async () => {
    setLoading(true);
    try {
      // التحقق من قاعدة البيانات
      const { data: dbData, error: dbError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      const databaseStatus = dbError ? 'down' : 'healthy';
      
      // التحقق من المصادقة
      const { data: { session } } = await supabase.auth.getSession();
      const authStatus = session ? 'healthy' : 'degraded';
      
      // التحديث
      setSystemStatus({
        database: databaseStatus,
        api: 'healthy', // في بيئة حقيقية، يمكن التحقق من نقاط النهاية المختلفة
        storage: 'healthy',
        auth: authStatus,
        lastChecked: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error checking system health:', error);
      setSystemStatus({
        database: 'down',
        api: 'down',
        storage: 'down',
        auth: 'down',
        lastChecked: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'down': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy': return 'فعال';
      case 'degraded': return 'منخفض الأداء';
      case 'down': return 'غير فعال';
      default: return 'غير معروف';
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

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">حالة النظام</h3>
        <button 
          onClick={checkSystemHealth}
          className="text-sm text-primary hover:text-primary-dark"
        >
          تحديث
        </button>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(systemStatus.database)} mr-3`}></div>
            <span className="text-sm text-gray-700">قاعدة البيانات</span>
          </div>
          <span className="text-sm font-medium text-gray-900">{getStatusText(systemStatus.database)}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(systemStatus.api)} mr-3`}></div>
            <span className="text-sm text-gray-700">واجهة برمجة التطبيقات</span>
          </div>
          <span className="text-sm font-medium text-gray-900">{getStatusText(systemStatus.api)}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(systemStatus.storage)} mr-3`}></div>
            <span className="text-sm text-gray-700">التخزين</span>
          </div>
          <span className="text-sm font-medium text-gray-900">{getStatusText(systemStatus.storage)}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(systemStatus.auth)} mr-3`}></div>
            <span className="text-sm text-gray-700">المصادقة</span>
          </div>
          <span className="text-sm font-medium text-gray-900">{getStatusText(systemStatus.auth)}</span>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          آخر تحديث: {new Date(systemStatus.lastChecked).toLocaleString('ar-SA')}
        </p>
      </div>
    </div>
  );
};

export default SystemHealth;