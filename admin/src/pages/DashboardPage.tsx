import { useState, useEffect } from 'react';
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
import { useLanguage } from '../contexts/LanguageContext';
import SystemHealth from '../components/SystemHealth';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import AdminActivityLog from '../components/AdminActivityLog';

// بيانات فارغة - سيتم ملؤها من قاعدة البيانات
const statsData: any[] = [];
const userTypesData: any[] = [];
const ordersGrowthData: any[] = [];

// ألوان للرسم البياني الدائري
const COLORS = ['#00B074', '#FFD84D', '#0088FE', '#FF6B6B'];

const DashboardPage = () => {
  const [timeRange, setTimeRange] = useState('monthly');
  const { stats, loading, error, refresh } = useDashboardStats();
  const { statsData: statsDataReal, userTypesData: userTypesDataReal, ordersGrowthData: ordersGrowthDataReal, loading: chartsLoading, error: chartsError, refresh: refreshCharts } = useDashboardCharts(timeRange as any);
  const { t } = useLanguage();
  const { currency } = useSettings();
  const navigate = useNavigate();
  
  const [pendingAds, setPendingAds] = useState<any[]>([]);
  const [pendingAdsCount, setPendingAdsCount] = useState(0);
  const [adminWallet, setAdminWallet] = useState<{ balance: number; currency: string } | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  useEffect(() => {
    fetchPendingAds();
    fetchAdminWallet();
  }, []);

  const fetchPendingAds = async () => {
    try {
      const { data, error, count } = await supabase
        .from('sponsored_ads')
        .select('id, title, merchant_id, created_at, merchants!inner(name_ar)', { count: 'exact' })
        .eq('approval_status', 'pending')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      
      setPendingAds(data || []);
      setPendingAdsCount(count || 0);
    } catch (error) {
      console.error('Error fetching pending ads:', error);
    }
  };

  const fetchAdminWallet = async () => {
    try {
      setLoadingWallet(true);
      const { data: overview, error } = await supabase.rpc('get_admin_wallet_overview', { p_limit: 50 });
      if (error) throw error;
      const o: any = overview || {};
      const w: any = o.wallet || null;
      if (w) setAdminWallet({ balance: Number(w.balance) || 0, currency: w.currency || 'EGP' });
    } catch (e) {
      console.error('fetchAdminWallet', e);
    } finally {
      setLoadingWallet(false);
    }
  };

  const statsDataToShow = (statsDataReal && statsDataReal.length > 0) ? statsDataReal : statsData;
  const userTypesDataToShow = (userTypesDataReal && userTypesDataReal.length > 0) ? userTypesDataReal : userTypesData;
  const ordersGrowthDataToShow = (ordersGrowthDataReal && ordersGrowthDataReal.length > 0) ? ordersGrowthDataReal : ordersGrowthData;

  const CURRENCY_LABEL = currency;
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
            onClick={() => { refresh(); refreshCharts(); fetchAdminWallet(); }}
          >
            {t('refresh')}
          </button>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
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
              <p className="text-2xl font-semibold text-gray-900">{stats.totalRevenue.toFixed(2)} {CURRENCY_LABEL}</p>
            </div>
          </div>
        </div>

        {/* Platform Wallet Card */}
        <div className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-md transition" onClick={() => navigate('/wallet')}>
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-teal-100">
              <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2m2-4h-6m0 0l2-2m-2 2l2 2" />
              </svg>
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">محفظة المنصة</p>
              <p className="text-2xl font-semibold text-gray-900">
                {adminWallet ? `${adminWallet.balance.toFixed(2)} ${adminWallet.currency || CURRENCY_LABEL}` : (loadingWallet ? '...' : `- ${CURRENCY_LABEL}`)}
              </p>
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

        {/* Sponsored Ads Total */}
        <div className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-md transition" onClick={() => navigate('/sponsored-ads?tab=all')}>
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-pink-100">
              <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5l6 6-6 6M5 5h6v6" />
              </svg>
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">الإعلانات المموّلة</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalSponsoredAds}</p>
            </div>
          </div>
        </div>

        {/* Pending Orders */}
        <div className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-md transition" onClick={() => navigate('/orders?status=pending')}>
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">الطلبات المعلقة</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.pendingOrders}</p>
            </div>
          </div>
        </div>

        {/* Pending Ads */}
        <div className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-md transition" onClick={() => navigate('/sponsored-ads?tab=pending')}>
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-orange-100">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 18.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13z" />
              </svg>
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">الإعلانات المعلقة</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.pendingAds}</p>
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
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="orders" fill="#FFD84D" name={t('orders')} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#0088FE" name={`${t('revenue')} (${CURRENCY_LABEL})`} />
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
                  {userTypesDataToShow.map((_, index) => (
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

      {/* Pending Sponsored Ads Alert */}
      {pendingAdsCount > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="mr-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  لديك {pendingAdsCount} إعلان مموّل في انتظار الموافقة
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc list-inside space-y-1">
                    {pendingAds.slice(0, 3).map((ad: any) => (
                      <li key={ad.id}>
                        {ad.title} - {ad.merchants?.name_ar || 'غير معروف'}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/sponsored-ads')}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
            >
              مراجعة الآن
            </button>
          </div>
        </div>
      )}

      {/* Recent Activity (Live from DB) */}
      <AdminActivityLog />
    </div>
  );
};

export default DashboardPage;