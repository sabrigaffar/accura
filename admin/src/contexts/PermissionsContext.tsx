import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

// أنواع الصلاحيات
const PERMISSIONS = {
  VIEW_USERS: 'view_users',
  MANAGE_USERS: 'manage_users',
  VIEW_ORDERS: 'view_orders',
  MANAGE_ORDERS: 'manage_orders',
  VIEW_MERCHANTS: 'view_merchants',
  MANAGE_MERCHANTS: 'manage_merchants',
  VIEW_DRIVERS: 'view_drivers',
  MANAGE_DRIVERS: 'manage_drivers',
  VIEW_REPORTS: 'view_reports',
  MANAGE_SETTINGS: 'manage_settings',
};

// مستويات الأدمن
const ADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  SUPPORT: 'support',
  FINANCE: 'finance',
};

// صلاحيات كل مستوى
const ROLE_PERMISSIONS = {
  [ADMIN_ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ADMIN_ROLES.ADMIN]: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.MANAGE_ORDERS,
    PERMISSIONS.VIEW_MERCHANTS,
    PERMISSIONS.MANAGE_MERCHANTS,
    PERMISSIONS.VIEW_DRIVERS,
    PERMISSIONS.MANAGE_DRIVERS,
    PERMISSIONS.VIEW_REPORTS,
  ],
  [ADMIN_ROLES.SUPPORT]: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.VIEW_MERCHANTS,
    PERMISSIONS.VIEW_DRIVERS,
    PERMISSIONS.VIEW_REPORTS,
  ],
  [ADMIN_ROLES.FINANCE]: [
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_MERCHANTS,
  ],
};

interface PermissionsContextType {
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  userRole: string;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    if (user) {
      // في الوقت الحالي، نعتبر جميع الأدمن سوبر أدمن
      // في المستقبل يمكن إضافة حقل role إلى جدول profiles
      const role = ADMIN_ROLES.SUPER_ADMIN;
      setUserRole(role);
      setPermissions(ROLE_PERMISSIONS[role] || []);
    } else {
      setPermissions([]);
      setUserRole('');
    }
  }, [user]);

  const hasPermission = (permission: string) => {
    return permissions.includes(permission);
  };

  return (
    <PermissionsContext.Provider value={{ permissions, hasPermission, userRole }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};

export { PERMISSIONS, ADMIN_ROLES };