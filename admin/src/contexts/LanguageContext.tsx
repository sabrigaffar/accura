import React, { createContext, useContext, useState, useEffect } from 'react';

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// ترجمات النصوص
const translations: Record<string, Record<string, string>> = {
  ar: {
    // Navigation
    'dashboard': 'الرئيسية',
    'users': 'المستخدمون',
    'merchants': 'التجار',
    'drivers': 'السائقون',
    'orders': 'الطلبات',
    'reports': 'التقارير',
    'settings': 'الإعدادات',
    'logout': 'تسجيل الخروج',
    
    // Common
    'save': 'حفظ',
    'cancel': 'إلغاء',
    'edit': 'تعديل',
    'delete': 'حذف',
    'view': 'عرض',
    'add': 'إضافة',
    'addOrder': 'إضافة طلب',
    'addDriver': 'إضافة سائق',
    'addMerchant': 'إضافة تاجر',
    'search': 'بحث',
    'filter': 'تصفية',
    'export': 'تصدير',
    'loading': 'جاري التحميل...',
    'noData': 'لا توجد بيانات',
    'refresh': 'تحديث',
    'daily': 'يومي',
    'weekly': 'أسبوعي',
    'monthly': 'شهري',
    'yearly': 'سنوي',
    'revenue': 'الإيرادات',
    'ordersAndRevenue': 'الطلبات والإيرادات',
    'userDistribution': 'توزيع المستخدمين',
    'ordersGrowth': 'نمو الطلبات',
    'recentActivity': 'النشاط الأخير',
    'newUserRegistered': 'تم تسجيل مستخدم جديد',
    'newOrderCreated': 'تم إنشاء طلب جديد',
    'merchantActivated': 'تم تفعيل تاجر جديد',
    'driverAssigned': 'تم تعيين سائق لطلب',
    
    // Users
    'usersManagement': 'إدارة المستخدمين',
    'addUser': 'إضافة مستخدم',
    'userName': 'اسم المستخدم',
    'email': 'البريد الإلكتروني',
    'phone': 'رقم الهاتف',
    'userType': 'نوع المستخدم',
    'status': 'الحالة',
    'active': 'نشط',
    'inactive': 'غير نشط',
    
    // Orders
    'ordersManagement': 'إدارة الطلبات',
    'orderNumber': 'رقم الطلب',
    'customer': 'العميل',
    'total': 'الإجمالي',
    'orderStatus': 'حالة الطلب',
    'date': 'التاريخ',
    
    // Merchants
    'merchantsManagement': 'إدارة التجار',
    'merchantName': 'اسم التاجر',
    'category': 'الفئة',
    'rating': 'التقييم',
    
    // Drivers
    'driversManagement': 'إدارة السائقين',
    'driverName': 'اسم السائق',
    'vehicleType': 'نوع المركبة',
    'licensePlate': 'لوحة التسجيل',
    'online': 'متصل',
    'offline': 'غير متصل',
    
    // Reports
    'reportsAndStatistics': 'التقارير والإحصائيات',
    'exportReport': 'تصدير التقرير',
    
    // Settings
    'systemSettings': 'إعدادات النظام',
    'generalSettings': 'الإعدادات العامة',
    'systemSettingsAdditional': 'إعدادات النظام الإضافية',
    'appName': 'اسم التطبيق',
    'supportEmail': 'البريد الإلكتروني للدعم',
    'primaryColor': 'اللون الأساسي',
    'secondaryColor': 'اللون الثانوي',
    'commissionRate': 'نسبة العمولة (%)',
    'maxDeliveryRadius': 'أقصى نطاق توصيل (كم)',
    'notificationsEnabled': 'تفعيل الإشعارات',
    
    // Audit Log
    'auditLog': 'سجل التدقيق',
    'admin': 'الأدمن',
    'action': 'الإجراء',
    'table': 'الجدول',
    'details': 'التفاصيل',
    'insert': 'إضافة',
    'update': 'تعديل',
    'deleteAction': 'حذف',
  },
  en: {
    // Navigation
    'dashboard': 'Dashboard',
    'users': 'Users',
    'merchants': 'Merchants',
    'drivers': 'Drivers',
    'orders': 'Orders',
    'reports': 'Reports',
    'settings': 'Settings',
    'logout': 'Logout',
    
    // Common
    'save': 'Save',
    'cancel': 'Cancel',
    'edit': 'Edit',
    'delete': 'Delete',
    'view': 'View',
    'add': 'Add',
    'addOrder': 'Add Order',
    'addDriver': 'Add Driver',
    'addMerchant': 'Add Merchant',
    'search': 'Search',
    'filter': 'Filter',
    'export': 'Export',
    'loading': 'Loading...',
    'noData': 'No data available',
    'refresh': 'Refresh',
    'daily': 'Daily',
    'weekly': 'Weekly',
    'monthly': 'Monthly',
    'yearly': 'Yearly',
    'revenue': 'Revenue',
    'ordersAndRevenue': 'Orders and Revenue',
    'userDistribution': 'User Distribution',
    'ordersGrowth': 'Orders Growth',
    'recentActivity': 'Recent Activity',
    'newUserRegistered': 'New user registered',
    'newOrderCreated': 'New order created',
    'merchantActivated': 'Merchant activated',
    'driverAssigned': 'Driver assigned to order',
    
    // Users
    'usersManagement': 'Users Management',
    'addUser': 'Add User',
    'userName': 'User Name',
    'email': 'Email',
    'phone': 'Phone',
    'userType': 'User Type',
    'status': 'Status',
    'active': 'Active',
    'inactive': 'Inactive',
    
    // Orders
    'ordersManagement': 'Orders Management',
    'orderNumber': 'Order Number',
    'customer': 'Customer',
    'total': 'Total',
    'orderStatus': 'Order Status',
    'date': 'Date',
    
    // Merchants
    'merchantsManagement': 'Merchants Management',
    'merchantName': 'Merchant Name',
    'category': 'Category',
    'rating': 'Rating',
    
    // Drivers
    'driversManagement': 'Drivers Management',
    'driverName': 'Driver Name',
    'vehicleType': 'Vehicle Type',
    'licensePlate': 'License Plate',
    'online': 'Online',
    'offline': 'Offline',
    
    // Reports
    'reportsAndStatistics': 'Reports and Statistics',
    'exportReport': 'Export Report',
    
    // Settings
    'systemSettings': 'System Settings',
    'generalSettings': 'General Settings',
    'systemSettingsAdditional': 'Additional System Settings',
    'appName': 'App Name',
    'supportEmail': 'Support Email',
    'primaryColor': 'Primary Color',
    'secondaryColor': 'Secondary Color',
    'commissionRate': 'Commission Rate (%)',
    'maxDeliveryRadius': 'Max Delivery Radius (km)',
    'notificationsEnabled': 'Enable Notifications',
    
    // Audit Log
    'auditLog': 'Audit Log',
    'admin': 'Admin',
    'action': 'Action',
    'table': 'Table',
    'details': 'Details',
    'insert': 'Insert',
    'update': 'Update',
    'deleteAction': 'Delete',
  }
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState('ar');

  useEffect(() => {
    // الحصول على اللغة المحفوظة من localStorage أو استخدام اللغة الافتراضية
    const savedLanguage = localStorage.getItem('admin_language') || 'ar';
    setLanguage(savedLanguage);
  }, []);

  useEffect(() => {
    // حفظ اللغة المختارة في localStorage
    localStorage.setItem('admin_language', language);
    
    // تحديث اتجاه الصفحة
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};