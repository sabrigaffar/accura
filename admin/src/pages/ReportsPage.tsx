import { useEffect, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import DataExport from '../components/DataExport';
import { useReportsData } from '../hooks/useSupabaseData';
import { supabase } from '../lib/supabase';

const ReportsPage = () => {
  const [reportType, setReportType] = useState('orders');
  const [dateRange, setDateRange] = useState('monthly');

  // Platform revenue summary (RPC) and upcoming notifications
  const [rev, setRev] = useState<{ total_in:number; subscriptions_in:number; per_km_in:number; service_fee_in:number; other_in:number } | null>(null);
  const [upcoming, setUpcoming] = useState<Array<{ merchant_id:string; merchant_name:string; event:string; due_at:string | null }>>([]);
  const [loadingKpis, setLoadingKpis] = useState<boolean>(false);

  const loadKpis = async () => {
    try {
      setLoadingKpis(true);
      const { data: r } = await supabase.rpc('get_platform_revenue_summary');
      const row = r && r.length > 0 ? r[0] : null;
      setRev(row ? {
        total_in: Number(row.total_in || 0),
        subscriptions_in: Number(row.subscriptions_in || 0),
        per_km_in: Number(row.per_km_in || 0),
        service_fee_in: Number(row.service_fee_in || 0),
        other_in: Number(row.other_in || 0),
      } : { total_in:0, subscriptions_in:0, per_km_in:0, service_fee_in:0, other_in:0 });

      const { data: list } = await supabase.rpc('list_upcoming_billing_notifications');
      setUpcoming(Array.isArray(list) ? list : []);
    } finally {
      setLoadingKpis(false);
    }
  };

  useEffect(() => { loadKpis(); }, []);

  const { ordersData: ordersDataReal, usersData: usersDataReal, categoriesData: categoriesDataReal, loading, error } = useReportsData(reportType as any, dateRange as any);

  // بيانات فارغة - سيتم ملؤها من قاعدة البيانات
  const ordersData: any[] = [];
  const usersData: any[] = [];
  const categoriesData: any[] = [];

  const COLORS = ['#00B074', '#FFD84D', '#0088FE', '#FF6B6B'];

  const ordersDataToShow = (ordersDataReal && ordersDataReal.length > 0) ? ordersDataReal : ordersData;
  const usersDataToShow = (usersDataReal && usersDataReal.length > 0) ? usersDataReal : usersData;
  const categoriesDataToShow = (categoriesDataReal && categoriesDataReal.length > 0) ? categoriesDataReal : categoriesData;

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
    <div className="space-y-6">
      {/* KPIs: Platform Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-gray-500 text-sm">إجمالي الداخل</div>
          <div className="text-2xl font-bold">{loadingKpis ? '...' : (rev?.total_in ?? 0).toFixed(2)} EGP</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-gray-500 text-sm">اشتراكات التجار</div>
          <div className="text-2xl font-bold">{loadingKpis ? '...' : (rev?.subscriptions_in ?? 0).toFixed(2)} EGP</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-gray-500 text-sm">رسوم لكل كم</div>
          <div className="text-2xl font-bold">{loadingKpis ? '...' : (rev?.per_km_in ?? 0).toFixed(2)} EGP</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-gray-500 text-sm">رسوم الخدمة</div>
          <div className="text-2xl font-bold">{loadingKpis ? '...' : (rev?.service_fee_in ?? 0).toFixed(2)} EGP</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-gray-500 text-sm">أخرى</div>
          <div className="text-2xl font-bold">{loadingKpis ? '...' : (rev?.other_in ?? 0).toFixed(2)} EGP</div>
        </div>
      </div>

      {/* Upcoming billing notifications */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium text-gray-900">تنبيهات قادمة (خلال يومين)</h2>
          <button className="px-3 py-1 bg-gray-100 rounded" onClick={loadKpis} disabled={loadingKpis}>تحديث</button>
        </div>
        {upcoming.length === 0 ? (
          <div className="text-gray-500">لا توجد تنبيهات قريبة</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-right">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-2">المتجر</th>
                  <th className="px-3 py-2">الحدث</th>
                  <th className="px-3 py-2">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((u, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{u.merchant_name || u.merchant_id?.slice(0,8)}</td>
                    <td className="px-3 py-2">{u.event === 'trial_ending' ? 'انتهاء التجربة' : 'استحقاق الاشتراك'}</td>
                    <td className="px-3 py-2">{u.due_at ? new Date(u.due_at).toLocaleString('ar-EG') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">التقارير والإحصائيات</h1>
        <div className="flex gap-2">
          <button className="btn-secondary">
            تصدير التقرير
          </button>
        </div>
      </div>

      {/* فلاتر التقارير */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="reportType" className="block text-sm font-medium text-gray-700 mb-1">
              نوع التقرير
            </label>
            <select
              id="reportType"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="orders">الطلبات والإيرادات</option>
              <option value="users">المستخدمون</option>
              <option value="categories">فئات التجار</option>
            </select>
          </div>

          <div>
            <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700 mb-1">
              الفترة الزمنية
            </label>
            <select
              id="dateRange"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="weekly">أسبوعي</option>
              <option value="monthly">شهري</option>
              <option value="quarterly">ربع سنوي</option>
              <option value="yearly">سنوي</option>
            </select>
          </div>
        </div>
      </div>

      {/* مخططات التقارير */}
      <div className="bg-white p-6 rounded-lg shadow">
        {reportType === 'orders' && (
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">الطلبات والإيرادات</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={ordersDataToShow}
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
                  <Bar dataKey="orders" fill="#00B074" name="الطلبات" />
                  <Bar dataKey="revenue" fill="#FFD84D" name="الإيرادات (ر.س)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {reportType === 'users' && (
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">نمو المستخدمين</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={usersDataToShow}
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
                  <Line type="monotone" dataKey="customers" stroke="#00B074" name="العملاء" />
                  <Line type="monotone" dataKey="merchants" stroke="#FFD84D" name="التجار" />
                  <Line type="monotone" dataKey="drivers" stroke="#0088FE" name="السائقين" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {reportType === 'categories' && (
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">توزيع فئات التجار</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoriesDataToShow}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoriesDataToShow.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* جدول البيانات */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  التاريخ
                </th>
                {reportType === 'orders' && (
                  <>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الطلبات
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الإيرادات (ر.س)
                    </th>
                  </>
                )}
                {reportType === 'users' && (
                  <>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      العملاء
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      التجار
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      السائقين
                    </th>
                  </>
                )}
                {reportType === 'categories' && (
                  <>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الفئة
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      العدد
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      النسبة
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportType === 'orders' && ordersDataToShow.map((data, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {data.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {data.orders}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {data.revenue.toFixed(2)}
                  </td>
                </tr>
              ))}
              {reportType === 'users' && usersDataToShow.map((data, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {data.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {data.customers}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {data.merchants}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {data.drivers}
                  </td>
                </tr>
              ))}
              {reportType === 'categories' && categoriesDataToShow.map((data, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {data.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {data.value}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {((data.value / categoriesDataToShow.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* تصدير البيانات */}
      <DataExport />
    </div>
  );
};

export default ReportsPage;