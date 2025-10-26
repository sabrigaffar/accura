import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// We'll use SVG icons instead of lucide-react to avoid import issues
const DatabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
  </svg>
);

const ShieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
  </svg>
);

const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);

const GlobeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="2" y1="12" x2="22" y2="12"></line>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
  </svg>
);

const MailIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
    <polyline points="22,6 12,13 2,6"></polyline>
  </svg>
);

const KeyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
  </svg>
);

const Trash2Icon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

const SaveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
    <polyline points="17 21 17 13 7 13 7 21"></polyline>
    <polyline points="7 3 7 8 15 8"></polyline>
  </svg>
);

const RefreshCwIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

// Restore the original imports
import SystemHealth from '../components/SystemHealth';
import AdminActivityLog from '../components/AdminActivityLog';
import AuditLog from '../components/AuditLog';

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    siteName: 'مسافة السكة - لوحة تحكم الأدمن',
    emailNotifications: true,
    pushNotifications: true,
    twoFactorAuth: false,
    language: 'ar',
    theme: 'dark',
    maintenanceMode: false
  });

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const payload = {
        id: 'global',
        site_name: settings.siteName,
        email_notifications: settings.emailNotifications,
        push_notifications: settings.pushNotifications,
        two_factor_auth: settings.twoFactorAuth,
        language: settings.language,
        theme: settings.theme,
        maintenance_mode: settings.maintenanceMode,
        updated_at: new Date().toISOString(),
      } as any;
      const { error } = await supabase
        .from('app_settings')
        .upsert(payload);
      if (error) throw error;
      alert('تم حفظ الإعدادات بنجاح');
    } catch (e: any) {
      alert(e.message || 'فشل حفظ الإعدادات. تأكد من وجود جدول app_settings وسياسات RLS');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNotificationPermission = async () => {
    try {
      if (!('Notification' in window)) {
        alert('المتصفح لا يدعم الإشعارات.');
        return;
      }
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        alert('تم منح إذن الإشعارات.');
      } else if (result === 'denied') {
        alert('تم رفض إذن الإشعارات من المتصفح.');
      } else {
        alert('لم يتم اختيار إذن الإشعارات.');
      }
    } catch (e) {
      alert('تعذر طلب إذن الإشعارات');
    }
  };

  const handleTestNotification = async () => {
    try {
      if (!('Notification' in window)) {
        alert('المتصفح لا يدعم الإشعارات.');
        return;
      }
      if (Notification.permission !== 'granted') {
        const res = await Notification.requestPermission();
        if (res !== 'granted') {
          alert('لا يمكن عرض الإشعار بدون إذن.');
          return;
        }
      }
      new Notification('اختبار إشعار', {
        body: 'هذا إشعار تجريبي من لوحة الأدمن',
      });
    } catch (e) {
      alert('تعذر عرض الإشعار');
    }
  };

  const handleClearCache = async () => {
    setLoading(true);
    try {
      try {
        localStorage.removeItem('admin_language');
      } catch {}
      try {
        await supabase.from('admin_activity_log').insert({
          admin_id: user?.id || null,
          action: 'system',
          resource_type: 'system',
          resource_id: 'clear_cache',
          details: null,
          timestamp: new Date().toISOString(),
        });
      } catch {}
      alert('تم مسح الذاكرة المؤقتة (المحلية)');
    } catch (error) {
      alert('حدث خطأ أثناء مسح الذاكرة المؤقتة');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLogs = async () => {
    if (window.confirm('هل أنت متأكد من حذف جميع السجلات؟ هذا الإجراء لا يمكن التراجع عنه.')) {
      setLoading(true);
      try {
        const { error: e1 } = await supabase
          .from('admin_activity_log')
          .delete()
          .gte('timestamp', '1900-01-01');
        if (e1) throw e1;

        const { error: e2 } = await supabase
          .from('audit_log')
          .delete()
          .gte('timestamp', '1900-01-01');
        if (e2) throw e2;

        try {
          await supabase.from('admin_activity_log').insert({
            admin_id: user?.id || null,
            action: 'system',
            resource_type: 'system',
            resource_id: 'delete_logs',
            details: null,
            timestamp: new Date().toISOString(),
          });
        } catch {}

        alert('تم حذف السجلات بنجاح');
      } catch (error) {
        alert('حدث خطأ أثناء حذف السجلات');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">الإعدادات</h1>
        <p className="mt-2 text-gray-600">إدارة إعدادات النظام والمظهر</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* إعدادات الموقع */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center gap-2 mb-4">
            <GlobeIcon />
            <h2 className="text-lg font-medium text-gray-900">إعدادات الموقع</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="siteName" className="block text-sm font-medium text-gray-700">اسم الموقع</label>
              <input
                id="siteName"
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={settings.siteName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({...settings, siteName: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="language" className="block text-sm font-medium text-gray-700">اللغة</label>
              <select
                id="language"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={settings.language}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettings({...settings, language: e.target.value})}
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="theme" className="block text-sm font-medium text-gray-700">المظهر</label>
              <select
                id="theme"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={settings.theme}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettings({...settings, theme: e.target.value})}
              >
                <option value="light">فاتح</option>
                <option value="dark">داكن</option>
              </select>
            </div>
          </div>
        </div>

        {/* إعدادات الأمان */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center gap-2 mb-4">
            <ShieldIcon />
            <h2 className="text-lg font-medium text-gray-900">إعدادات الأمان</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">المصادقة الثنائية</label>
                <p className="text-sm text-gray-500">إضافة طبقة أمان إضافية</p>
              </div>
              <button
                onClick={() => setSettings({...settings, twoFactorAuth: !settings.twoFactorAuth})}
                className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                  settings.twoFactorAuth ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    settings.twoFactorAuth ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">وضع الصيانة</label>
                <p className="text-sm text-gray-500">إيقاف الموقع للصيانة</p>
              </div>
              <button
                onClick={() => setSettings({...settings, maintenanceMode: !settings.maintenanceMode})}
                className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                  settings.maintenanceMode ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    settings.maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* إعدادات الإشعارات */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center gap-2 mb-4">
            <BellIcon />
            <h2 className="text-lg font-medium text-gray-900">إعدادات الإشعارات</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">الإشعارات البريدية</label>
                <p className="text-sm text-gray-500">إرسال تنبيهات عبر البريد</p>
              </div>
              <button
                onClick={() => setSettings({...settings, emailNotifications: !settings.emailNotifications})}
                className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                  settings.emailNotifications ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    settings.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">الإشعارات الفورية</label>
                <p className="text-sm text-gray-500">إرسال تنبيهات فورية</p>
              </div>
              <button
                onClick={() => setSettings({...settings, pushNotifications: !settings.pushNotifications})}
                className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                  settings.pushNotifications ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    settings.pushNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={handleRequestNotificationPermission}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50"
                disabled={loading}
              >
                طلب إذن الإشعارات
              </button>
              <button
                type="button"
                onClick={handleTestNotification}
                className="px-3 py-2 border border-transparent rounded-md text-sm text-white bg-primary hover:bg-primary-dark"
                disabled={loading}
              >
                اختبار إشعار
              </button>
            </div>
          </div>
        </div>

        {/* إدارة النظام */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center gap-2 mb-4">
            <DatabaseIcon />
            <h2 className="text-lg font-medium text-gray-900">إدارة النظام</h2>
          </div>
          <div className="space-y-4">
            <button 
              onClick={handleClearCache}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              <RefreshCwIcon />
              <span>{loading ? 'جاري المعالجة...' : 'مسح الذاكرة المؤقتة'}</span>
            </button>
            
            <button 
              onClick={handleDeleteLogs}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              <Trash2Icon />
              <span>حذف السجلات</span>
            </button>
          </div>
        </div>
      </div>

      {/* Restore the original components section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <SystemHealth />
        <AdminActivityLog />
        <AuditLog />
      </div>

      {/* زر حفظ الإعدادات */}
      <div className="flex justify-end">
        <button 
          onClick={handleSaveSettings}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
        >
          <SaveIcon />
          <span>{loading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;