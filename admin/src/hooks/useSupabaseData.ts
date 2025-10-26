import { useState, useEffect } from 'react';
import { supabase, createAdminClient } from '../lib/supabase';

// Types
interface UserData {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  user_type: 'customer' | 'merchant' | 'driver' | 'admin';
  is_active: boolean;
  created_at: string;
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
}

interface MerchantData {
  id: string;
  name_ar: string;
  owner_id: string;
  category: string;
  rating: number;
  is_active: boolean;
  created_at: string;
}

interface DriverData {
  id: string;
  full_name: string;
  phone_number: string;
  vehicle_type: string;
  vehicle_model: string;
  license_plate: string;
  average_rating: number;
  is_verified: boolean;
  is_online: boolean;
  created_at: string;
}

// Hook for fetching users
export const useUsers = (filters: { userType?: string; status?: string; search?: string } = {}) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('profiles')
        .select('*');

      // Apply filters
      if (filters.userType && filters.userType !== 'all') {
        query = query.eq('user_type', filters.userType);
      }

      if (filters.status && filters.status !== 'all') {
        const isActive = filters.status === 'active';
        query = query.eq('is_active', isActive);
      }

      if (filters.search) {
        query = query.or(`full_name.ilike.%${filters.search}%,phone_number.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setUsers(data || []);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب المستخدمين');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [filters.userType, filters.status, filters.search]);

  return { users, loading, error, refresh: fetchUsers };
};

// Hook for fetching orders
export const useOrders = (filters: { status?: string; search?: string } = {}) => {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('orders')
        .select('*');

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        query = query.or(`order_number.ilike.%${filters.search}%,customer_id.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setOrders(data || []);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب الطلبات');
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filters.status, filters.search]);

  return { orders, loading, error, refresh: fetchOrders };
};

// Hook for fetching merchants
export const useMerchants = (filters: { category?: string; status?: string; search?: string } = {}) => {
  const [merchants, setMerchants] = useState<MerchantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMerchants = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('merchants')
        .select('*');

      // Apply filters
      if (filters.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }

      if (filters.status && filters.status !== 'all') {
        const isActive = filters.status === 'active';
        query = query.eq('is_active', isActive);
      }

      if (filters.search) {
        query = query.or(`name_ar.ilike.%${filters.search}%,owner_id.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setMerchants(data || []);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب التجار');
      console.error('Error fetching merchants:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, [filters.category, filters.status, filters.search]);

  return { merchants, loading, error, refresh: fetchMerchants };
};

// Hook for fetching drivers
export const useDrivers = (filters: { vehicleType?: string; status?: string; online?: string; search?: string } = {}) => {
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('driver_profiles')
        .select(`
          *,
          profiles(full_name, phone_number)
        `);

      // Apply filters
      if (filters.vehicleType && filters.vehicleType !== 'all') {
        query = query.eq('vehicle_type', filters.vehicleType);
      }

      if (filters.status && filters.status !== 'all') {
        const isActive = filters.status === 'active';
        // We need to join with profiles table to filter by is_active
        query = query.eq('profiles.is_active', isActive);
      }

      if (filters.online && filters.online !== 'all') {
        const isOnline = filters.online === 'online';
        query = query.eq('is_online', isOnline);
      }

      if (filters.search) {
        query = query.or(`profiles.full_name.ilike.%${filters.search}%,profiles.phone_number.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Transform data to match DriverData interface
      const transformedData = data?.map(driver => ({
        id: driver.id,
        full_name: driver.profiles?.full_name || '',
        phone_number: driver.profiles?.phone_number || '',
        vehicle_type: driver.vehicle_type,
        vehicle_model: driver.vehicle_model,
        license_plate: driver.license_plate,
        average_rating: driver.average_rating,
        is_verified: driver.is_verified,
        is_online: driver.is_online,
        created_at: driver.created_at
      })) || [];

      setDrivers(transformedData);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب السائقين');
      console.error('Error fetching drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, [filters.vehicleType, filters.status, filters.online, filters.search]);

  return { drivers, loading, error, refresh: fetchDrivers };
};

// Hook for fetching dashboard statistics
export const useDashboardStats = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOrders: 0,
    totalMerchants: 0,
    totalDrivers: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Fetch total users
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch total orders
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      // Fetch total merchants
      const { count: merchantsCount } = await supabase
        .from('merchants')
        .select('*', { count: 'exact', head: true });

      // Fetch total drivers
      const { count: driversCount } = await supabase
        .from('driver_profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch total revenue (sum of order totals)
      const { data: revenueData, error: revenueError } = await supabase
        .from('orders')
        .select('total');

      let totalRevenue = 0;
      if (!revenueError && revenueData) {
        totalRevenue = revenueData.reduce((sum, order) => sum + (order.total || 0), 0);
      }

      setStats({
        totalUsers: usersCount || 0,
        totalOrders: ordersCount || 0,
        totalMerchants: merchantsCount || 0,
        totalDrivers: driversCount || 0,
        totalRevenue
      });
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب الإحصائيات');
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, loading, error, refresh: fetchStats };
};

// Hooks for real charts and reports data
type ChartStatsRow = { name: string; users: number; orders: number; revenue: number };
type PieRow = { name: string; value: number };
type OrdersGrowthRow = { date: string; orders: number };

export const useDashboardCharts = (
  timeRange: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly'
) => {
  const [statsData, setStatsData] = useState<ChartStatsRow[]>([]);
  const [userTypesData, setUserTypesData] = useState<PieRow[]>([]);
  const [ordersGrowthData, setOrdersGrowthData] = useState<OrdersGrowthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCharts = async () => {
    try {
      setLoading(true);
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 11);
      startDate.setDate(1);

      const { data: ordersMonthly } = await supabase
        .from('v_orders_monthly')
        .select('*')
        .gte('month', startDate.toISOString())
        .order('month', { ascending: true });

      const { data: usersMonthly } = await supabase
        .from('v_users_monthly')
        .select('*')
        .gte('month', startDate.toISOString())
        .order('month', { ascending: true });

      const { data: userTypes } = await supabase
        .from('v_user_types_distribution')
        .select('*');

      const mapMonth = (iso: string) => iso.slice(0, 7);

      const usersByMonth: Record<string, number> = {};
      (usersMonthly || []).forEach((row: any) => {
        const m = mapMonth(row.month);
        usersByMonth[m] =
          (row.customers || 0) + (row.merchants || 0) + (row.drivers || 0) + (row.admins || 0);
      });

      const newStatsData: ChartStatsRow[] = (ordersMonthly || []).map((row: any) => {
        const m = mapMonth(row.month);
        return {
          name: m,
          users: usersByMonth[m] || 0,
          orders: row.orders || 0,
          revenue: row.revenue || 0,
        };
      });
      setStatsData(newStatsData);

      setOrdersGrowthData(
        (ordersMonthly || []).map((row: any) => ({
          date: mapMonth(row.month),
          orders: row.orders || 0,
        }))
      );

      const typeName = (t: string) =>
        t === 'customer' ? 'عملاء' :
        t === 'merchant' ? 'تجار' :
        t === 'driver' ? 'سائقين' :
        t === 'admin' ? 'مدراء' : t;

      setUserTypesData(
        (userTypes || []).map((row: any) => ({
          name: typeName(row.user_type),
          value: row.count || 0,
        }))
      );
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب بيانات الرسوم');
      console.error('Error fetching dashboard charts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharts();
  }, [timeRange]);

  return { statsData, userTypesData, ordersGrowthData, loading, error, refresh: fetchCharts };
};

export const useReportsData = (
  reportType: 'orders' | 'users' | 'categories',
  dateRange: 'weekly' | 'monthly' | 'quarterly' | 'yearly' = 'monthly'
) => {
  const [ordersData, setOrdersData] = useState<{ date: string; orders: number; revenue: number }[]>([]);
  const [usersData, setUsersData] = useState<{ date: string; customers: number; merchants: number; drivers: number; admins?: number }[]>([]);
  const [categoriesData, setCategoriesData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 11);
      startDate.setDate(1);

      const { data: ordersMonthly } = await supabase
        .from('v_orders_monthly')
        .select('*')
        .gte('month', startDate.toISOString())
        .order('month', { ascending: true });

      const { data: usersMonthly } = await supabase
        .from('v_users_monthly')
        .select('*')
        .gte('month', startDate.toISOString())
        .order('month', { ascending: true });

      const { data: cats } = await supabase
        .from('v_merchants_categories')
        .select('*');

      const mapMonth = (iso: string) => iso.slice(0, 7);

      setOrdersData(
        (ordersMonthly || []).map((row: any) => ({
          date: mapMonth(row.month),
          orders: row.orders || 0,
          revenue: row.revenue || 0,
        }))
      );

      setUsersData(
        (usersMonthly || []).map((row: any) => ({
          date: mapMonth(row.month),
          customers: row.customers || 0,
          merchants: row.merchants || 0,
          drivers: row.drivers || 0,
          admins: row.admins || 0,
        }))
      );

      setCategoriesData(
        (cats || []).map((row: any) => ({
          name: row.category,
          value: row.count || 0,
        }))
      );
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب بيانات التقارير');
      console.error('Error fetching reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [reportType, dateRange]);

  return { ordersData, usersData, categoriesData, loading, error, refresh: fetchReports };
};