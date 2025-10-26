import React, { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { useDashboardStats, useDashboardCharts } from '../hooks/useSupabaseData';
import { PERMISSIONS, usePermissions } from '../contexts/PermissionsContext';
import { useLanguage } from '../contexts/LanguageContext';
import SystemHealth from '../components/SystemHealth';

// بيانات تجريبية للإحصائيات
const statsData = [
  { name: 'يناير', users: 400, orders: 240, revenue: 24000 },
  { name: 'فبراير', users: 300, orders: 138, revenue: 13800 },
  { name: 'مارس', users: 200, orders: 980, revenue: 98000 },
  { name: 'أبريل', users: 278, orders: 390, revenue: 39000 },
  { name: 'مايو', users: 189, orders: 480, revenue: 48000 },
  { name: 'يونيو', users: 239, orders: 380, revenue: 38000 },
  { name: 'يوليو', users: 349, orders: 430, revenue: 43000 },
];

// بيانات تجريبية لنسب المستخدمين
const userTypesData = [
  { name: 'عملاء', value: 400 },
  { name: 'تجار', value: 300 },
  { name: 'سائقين', value: 200 },
  { name: 'مدراء', value: 10 },
];

// بيانات تجريبية لنمو الطلبات
const ordersGrowthData = [
  { date: '2023-01', orders: 120 },
  { date: '2023-02', orders: 150 },
  { date: '2023-03', orders: 180 },
  { date: '2023-04', orders: 210 },
  { date: '2023-05', orders: 240 },
  { date: '2023-06', orders: 280 },
];

// ألوان للرسم البياني الدائري
const COLORS = ['#00B074', '#FFD84D', '#0088FE', '#FF6B6B'];

const DashboardPage = () => {
  const [timeRange, setTimeRange] = useState('monthly');
  const { stats, loading, error, refresh } = useDashboardStats();
  const { statsData: statsDataReal, userTypesData: userTypesDataReal, ordersGrowthData: ordersGrowthDataReal, loading: chartsLoading, error: chartsError, refresh: refreshCharts } = useDashboardCharts(timeRange as any);
  const { hasPermission } = usePermissions();
  const { t } = useLanguage();

  const statsDataToShow = (statsDataReal && statsDataReal.length > 0) ? statsDataReal : statsData;
  const userTypesDataToShow = (userTypesDataReal && userTypesDataReal.length > 0) ? userTypesDataReal : userTypesData;
  const ordersGrowthDataToShow = (ordersGrowthDataReal && ordersGrowthDataReal.length > 0) ? ordersGrowthDataReal : ordersGrowthData;

  if (loading || chartsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || chartsError) {
    return (
      <div className="bg-red-50 p-4 rounded-lg">
        <div className="text-red-700">حدث خطأ: {error || chartsError}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard')}</h1>
        <div className="flex gap-2">
          <select
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="daily">{t('daily')}</option>
            <option value="weekly">{t('weekly')}</option>
            <option value="monthly">{t('monthly')}</option>
            <option value="yearly">{t('yearly')}</option>
          </select>
          <button 
            className="btn-secondary"
            onClick={() => { refresh(); refreshCharts(); }}
          >
            {t('refresh')}
          </button>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Users Card */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">{t('users')}</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalUsers}</p>
            </div>
          </div>
        </div>

        {/* Orders Card */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">{t('orders')}</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalOrders}</p>
            </div>
          </div>
        </div>

        {/* Revenue Card */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">{t('revenue')}</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalRevenue.toFixed(2)} ر.س</p>
            </div>
          </div>
        </div>

        {/* Merchants Card */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">{t('merchants')}</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalMerchants}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('ordersAndRevenue')}</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statsDataToShow}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="users" fill="#00B074" name={t('users')} />
                <Bar dataKey="orders" fill="#FFD84D" name={t('orders')} />
                <Bar dataKey="revenue" fill="#0088FE" name={`${t('revenue')} (ر.س)`} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('userDistribution')}</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={userTypesDataToShow}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {userTypesDataToShow.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Line Chart for Orders Growth and System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart */}
        <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('ordersGrowth')}</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={ordersGrowthDataToShow}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="orders" stroke="#00B074" name={t('orders')} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Health */}
        <div className="lg:col-span-1">
          <SystemHealth />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">{t('recentActivity')}</h2>
        <div className="space-y-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 text-sm">ع</span>
              </div>
            </div>
            <div className="mr-3">
              <p className="text-sm font-medium text-gray-900">{t('newUserRegistered')}</p>
              <p className="text-sm text-gray-500">أحمد محمد - قبل 10 دقائق</p>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-green-600 text-sm">ط</span>
              </div>
            </div>
            <div className="mr-3">
              <p className="text-sm font-medium text-gray-900">{t('newOrderCreated')}</p>
              <p className="text-sm text-gray-500">طلب #12345 - قبل 25 دقيقة</p>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                <span className="text-yellow-600 text-sm">ت</span>
              </div>
            </div>
            <div className="mr-3">
              <p className="text-sm font-medium text-gray-900">{t('merchantActivated')}</p>
              <p className="text-sm text-gray-500">مطعم الشاورما - قبل ساعة</p>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-purple-600 text-sm">س</span>
              </div>
            </div>
            <div className="mr-3">
              <p className="text-sm font-medium text-gray-900">{t('driverAssigned')}</p>
              <p className="text-sm text-gray-500">سليمان عبدالله - قبل ساعتين</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;