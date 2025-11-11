import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { Megaphone, Check, X, Eye, Clock, DollarSign, TrendingUp, Settings } from 'lucide-react';

interface Ad {
  id: string;
  merchant_id: string;
  merchant_name: string;
  ad_type: 'banner' | 'story' | 'featured';
  title: string;
  description: string;
  image_url: string;
  budget_amount: number;
  amount_paid: number;
  amount_refunded: number;
  start_date: string;
  end_date: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  is_active: boolean;
  impressions: number;
  clicks: number;
  total_spent: number;
  billed_spent?: number;
  created_at: string;
}

interface PlatformSettings {
  cost_per_click: number;
  cost_per_impression: number;
  min_budget: number;
  max_budget: number;
  min_duration_days: number;
  max_duration_days: number;
}

type TimePreset = '7d' | '30d' | '90d';

export default function SponsoredAdsPage() {
  const location = useLocation();
  const { app, currency } = useSettings();
  const maintenance = app?.maintenance_mode === true;
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'settings'>('pending');
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [adTypeFilter, setAdTypeFilter] = useState<'all' | 'banner' | 'story' | 'featured'>('all');
  const [merchantFilter, setMerchantFilter] = useState('');
  const [timeRange, setTimeRange] = useState<TimePreset>('30d');
  const [roiMap, setRoiMap] = useState<Record<string, number>>({});
  const [kpis, setKpis] = useState<{ impressions: number; clicks: number; conversions: number; totalSpent: number; ctr: number; roi: number }>({ impressions: 0, clicks: 0, conversions: 0, totalSpent: 0, ctr: 0, roi: 0 });
  const [settings, setSettings] = useState<PlatformSettings>({
    cost_per_click: 0.5,
    cost_per_impression: 0.01,
    min_budget: 100,
    max_budget: 10000,
    min_duration_days: 7,
    max_duration_days: 90,
  });

  // Toasts
  type Toast = { id: number; type: 'success'|'error'|'info'; message: string };
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);
  const pushToast = (message: string, type: 'success'|'error'|'info' = 'info') => {
    const id = toastId.current++;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const getRunStatusBadge = (ad: Ad) => {
    const now = new Date();
    const start = new Date(ad.start_date);
    const end = new Date(ad.end_date);
    if (!ad.is_active) {
      return <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">متوقف</span>;
    }
    if (end < now) {
      return <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">منتهي</span>;
    }
    if (start > now) {
      return <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">لم يبدأ</span>;
    }
    return <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">نشط</span>;
  };

  useEffect(() => {
    fetchAds();
    fetchSettings();
  }, [activeTab, adTypeFilter, merchantFilter, timeRange]);

  // Sync activeTab from URL query param (?tab=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    const allowed = ['all','pending','approved','rejected','settings'];
    if (tabParam && allowed.includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [location.search]);

  // KPIs UI (appears when not in settings)
  // Shown above filters for quick insights
  // Uses kpis state populated from get_ad_analytics results

  // KPI strip (above filters)

  // Admin wallet (platform) balance
  const [adminWallet, setAdminWallet] = useState<{ id: string; balance: number; currency: string } | null>(null);
  const [loadingAdminWallet, setLoadingAdminWallet] = useState<boolean>(false);

  const fetchAdminWallet = async () => {
    try {
      setLoadingAdminWallet(true);
      const { data: overview, error } = await supabase.rpc('get_admin_wallet_overview', { p_limit: 50 });
      if (error) throw error;
      const o: any = overview || {};
      const w: any = o.wallet || null;
      if (w) setAdminWallet({ id: w.id, balance: Number(w.balance) || 0, currency: w.currency || 'EGP' });
    } catch (e) {
      console.error('fetchAdminWallet error', e);
      pushToast('تعذر تحميل رصيد محفظة المنصة', 'error');
    } finally {
      setLoadingAdminWallet(false);
    }
  };

  useEffect(() => {
    // Fetch platform wallet once on mount
    fetchAdminWallet();
  }, []);

  const fetchAds = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('sponsored_ads')
        .select(`
          *,
          merchants!inner(name_ar)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (activeTab !== 'settings' && activeTab !== 'all') {
        query = query.eq('approval_status', activeTab);
      }

      const { data, error } = await query;

      if (error) throw error;

      let adsWithMerchant: Ad[] = (data?.map((ad: any) => ({
        ...ad,
        merchant_name: ad.merchants?.name_ar || 'غير معروف',
      })) || []) as Ad[];

      // Apply client-side filters
      if (adTypeFilter !== 'all') {
        adsWithMerchant = adsWithMerchant.filter(a => a.ad_type === adTypeFilter);
      }
      if (merchantFilter.trim()) {
        const s = merchantFilter.trim().toLowerCase();
        adsWithMerchant = adsWithMerchant.filter(a => a.merchant_name?.toLowerCase().includes(s));
      }

      setAds(adsWithMerchant);

    // Fetch ROI via get_ad_analytics grouped by merchant to reduce calls
    await fetchRoiForAds(adsWithMerchant);
  } catch (error) {
    console.error('Error fetching ads:', error);
  } finally {
    setLoading(false);
  }
};

  const fetchRoiForAds = async (currentAds: Ad[]) => {
    try {
      const days = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30;
      const end = new Date();
      const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

      const adIds = currentAds.map(a => a.id);
      const { data, error } = await supabase.rpc('get_admin_ad_analytics', {
        p_ad_ids: adIds,
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
      });
      if (error) throw error;

      const analytics = Array.isArray(data) ? data : [];
      const byId: Record<string, { impressions:number; clicks:number; conversions:number; total_spent:number; roi:number }> = {};
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalConversions = 0;
      let totalSpent = 0;
      let roiWeightedNumerator = 0;
      analytics.forEach((row: any) => {
        const ad_id = row.ad_id as string;
        const imp = Number(row.impressions) || 0;
        const clk = Number(row.clicks) || 0;
        const conv = Number(row.conversions) || 0;
        const spent = Number(row.total_spent) || 0;
        const r = Number(row.roi) || 0;
        byId[ad_id] = { impressions: imp, clicks: clk, conversions: conv, total_spent: spent, roi: r };
        totalImpressions += imp;
        totalClicks += clk;
        totalConversions += conv;
        totalSpent += spent;
        roiWeightedNumerator += spent * r;
      });

      // Update per-ad metrics and ROI map
      setAds(() => currentAds.map((ad) => ({
        ...ad,
        impressions: byId[ad.id]?.impressions ?? ad.impressions ?? 0,
        clicks: byId[ad.id]?.clicks ?? ad.clicks ?? 0,
        total_spent: byId[ad.id]?.total_spent ?? ad.total_spent ?? 0,
      })) as any);
      const roiMapNew: Record<string, number> = {};
      Object.keys(byId).forEach(k => { roiMapNew[k] = byId[k].roi; });
      setRoiMap(roiMapNew);

      // KPIs
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const roi = totalSpent > 0 ? (roiWeightedNumerator / totalSpent) : 0;
      setKpis({ impressions: totalImpressions, clicks: totalClicks, conversions: totalConversions, totalSpent, ctr, roi });
    } catch (e) {
      console.warn('get_admin_ad_analytics failed, falling back to zeros', e);
      setKpis({ impressions: 0, clicks: 0, conversions: 0, totalSpent: 0, ctr: 0, roi: 0 });
    }
  };

  const duesSummary = useMemo(() => {
    const total = ads.reduce((sum, a) => sum + (a.total_spent || 0), 0);
    const billed = ads.reduce((sum, a) => sum + (a.billed_spent || 0), 0);
    const due = ads.reduce((sum, a) => sum + Math.max(0, (a.total_spent || 0) - (a.billed_spent || 0)), 0);
    return { total, billed, due };
  }, [ads]);

  const handleSettleAd = async (adId: string) => {
    try {
      const admin = (await supabase.auth.getUser()).data.user;
      const { data, error } = await supabase.rpc('admin_settle_ad_spend', {
        p_ad_id: adId,
        p_admin_id: admin?.id || null,
      });
      if (error) throw error;
      let ok = false;
      let msg = 'تمت محاولة التسوية';
      if (Array.isArray(data) && data.length > 0) {
        const row: any = data[0];
        ok = !!row.ok;
        const settled = Number(row.settled) || 0;
        const remaining = Number(row.remaining) || 0;
        msg = row.message || (ok ? 'تمت التسوية' : 'تمت تسوية جزئية');
        msg += ` (المسدّد: ${settled.toFixed(2)}, المتبقي: ${remaining.toFixed(2)})`;
      }
      pushToast(msg, ok ? 'success' : 'info');
      await fetchAds();
      // Refresh platform wallet balance after settlement
      await fetchAdminWallet();
    } catch (e) {
      console.error(e);
      const msg = (e && typeof e === 'object' && 'message' in (e as any)) ? (e as any).message : 'تعذر تسوية الإنفاق الآن';
      pushToast(String(msg), 'error');
    }
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_ad_settings')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();

      if (error) throw error;
      if (data) {
        setSettings({
          cost_per_click: data.cost_per_click,
          cost_per_impression: data.cost_per_impression,
          min_budget: data.min_budget,
          max_budget: data.max_budget,
          min_duration_days: data.min_duration_days,
          max_duration_days: data.max_duration_days,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleApprove = async (adId: string) => {
    try {
      const { error } = await supabase.rpc('approve_ad', {
        p_ad_id: adId,
        p_admin_id: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;
      pushToast('✅ تمت الموافقة على الإعلان بنجاح', 'success');
      fetchAds();
    } catch (error: any) {
      pushToast('خطأ: ' + error.message, 'error');
    }
  };

  const handleReject = async (adId: string) => {
    const reason = prompt('الرجاء إدخال سبب الرفض:');
    if (!reason || reason.trim() === '') {
      pushToast('يجب إدخال سبب الرفض', 'error');
      return;
    }

    try {
      const { error } = await supabase.rpc('reject_ad', {
        p_ad_id: adId,
        p_admin_id: (await supabase.auth.getUser()).data.user?.id,
        p_reason: reason,
      });

      if (error) throw error;
      pushToast('✅ تم رفض الإعلان واسترجاع المبلغ', 'success');
      fetchAds();
    } catch (error: any) {
      pushToast('خطأ: ' + error.message, 'error');
    }
  };

  const handleSaveSettings = async () => {
    try {
      const { error } = await supabase
        .from('platform_ad_settings')
        .update({
          cost_per_click: settings.cost_per_click,
          cost_per_impression: settings.cost_per_impression,
          min_budget: settings.min_budget,
          max_budget: settings.max_budget,
          min_duration_days: settings.min_duration_days,
          max_duration_days: settings.max_duration_days,
        })
        .eq('id', '00000000-0000-0000-0000-000000000001');

      if (error) throw error;
      // Log admin activity
      try {
        const user = (await supabase.auth.getUser()).data.user;
        await supabase.from('admin_activity_log').insert({
          admin_id: user?.id || null,
          action: 'update',
          resource_type: 'platform_ad_settings',
          resource_id: '00000000-0000-0000-0000-000000000001',
          details: {
            cost_per_click: settings.cost_per_click,
            cost_per_impression: settings.cost_per_impression,
            min_budget: settings.min_budget,
            max_budget: settings.max_budget,
            min_duration_days: settings.min_duration_days,
            max_duration_days: settings.max_duration_days,
          },
        });
      } catch (e) {
        console.warn('Failed to log admin activity for ad settings update', e);
      }
      pushToast('✅ تم حفظ الإعدادات بنجاح', 'success');
    } catch (error: any) {
      pushToast('خطأ: ' + error.message, 'error');
    }
  };

  const getAdTypeLabel = (type: string) => {
    const labels = {
      banner: 'بانر كبير',
      story: 'قصة',
      featured: 'مميز',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    const labels = {
      pending: '⏳ معلق',
      approved: '✅ مقبول',
      rejected: '❌ مرفوض',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const calculateCTR = (ad: Ad) => {
    if (ad.impressions === 0) return '0%';
    return ((ad.clicks / ad.impressions) * 100).toFixed(2) + '%';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Megaphone className="w-8 h-8 text-primary" />
          إدارة الإعلانات المموّلة
        </h1>
        <p className="text-gray-600">
          مراجعة وموافقة الإعلانات وتعديل الأسعار والإعدادات
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px" dir="rtl">
            <button
              onClick={() => setActiveTab('all')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'all'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Eye className="inline-block w-5 h-5 ml-2" />
              الكل
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'pending'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Clock className="inline-block w-5 h-5 ml-2" />
              الإعلانات المعلقة ({ads.filter(a => a.approval_status === 'pending').length})
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'approved'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Check className="inline-block w-5 h-5 ml-2" />
              المقبولة
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'rejected'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <X className="inline-block w-5 h-5 ml-2" />
              المرفوضة
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'settings'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Settings className="inline-block w-5 h-5 ml-2" />
              الإعدادات
            </button>
          </nav>
        </div>
      </div>

      {/* KPIs (except settings) */}
      {activeTab !== 'settings' && (
        <div className="bg-white rounded-lg shadow p-4 mb-4" dir="rtl">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-xs text-gray-500 mb-1">المشاهدات</div>
              <div className="text-lg font-semibold">{kpis.impressions}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-xs text-gray-500 mb-1">النقرات</div>
              <div className="text-lg font-semibold">{kpis.clicks}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-xs text-gray-500 mb-1">CTR</div>
              <div className="text-lg font-semibold">{kpis.ctr.toFixed(2)}%</div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-xs text-gray-500 mb-1">التحويلات</div>
              <div className="text-lg font-semibold">{kpis.conversions}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-xs text-gray-500 mb-1">المُنفق</div>
              <div className="text-lg font-semibold">{kpis.totalSpent.toFixed(2)} {currency}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-xs text-gray-500 mb-1">ROI</div>
              <div className="text-lg font-semibold">{kpis.roi.toFixed(2)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters (except settings) */}
      {activeTab !== 'settings' && (
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-3 items-end" dir="rtl">
          <div>
            <label className="block text-sm text-gray-600 mb-1">نوع الإعلان</label>
            <select className="border rounded px-3 py-2" value={adTypeFilter} onChange={(e) => setAdTypeFilter(e.target.value as any)}>
              <option value="all">الكل</option>
              <option value="banner">Banner</option>
              <option value="story">Story</option>
              <option value="featured">Featured</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">بحث عن متجر</label>
            <input className="border rounded px-3 py-2" placeholder="اسم المتجر" value={merchantFilter} onChange={(e) => setMerchantFilter(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">الفترة</label>
            <select className="border rounded px-3 py-2" value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)}>
              <option value="7d">آخر 7 أيام</option>
              <option value="30d">آخر 30 يوماً</option>
              <option value="90d">آخر 90 يوماً</option>
            </select>
          </div>
        </div>
      )}

      {/* Platform Wallet Balance (when not in settings) */}
      {activeTab !== 'settings' && (
        <div className="mb-3">
          <div className="bg-white rounded shadow p-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">محفظة المنصة</div>
              <div className="text-lg font-semibold text-gray-900">
                {adminWallet ? `${adminWallet.balance.toFixed(2)} ${adminWallet.currency || currency}` : (loadingAdminWallet ? '...' : `- ${currency}`)}
              </div>
            </div>
            <button onClick={fetchAdminWallet} className="px-3 py-1 rounded bg-gray-100 border text-sm">
              تحديث
            </button>
          </div>
        </div>
      )}

      {/* Dues Summary (when not in settings) */}
      {activeTab !== 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded shadow p-3 text-center">
            <div className="text-xs text-gray-500">المُنفق (إجمالي)</div>
            <div className="text-lg font-semibold text-primary">{duesSummary.total.toFixed(2)} {currency}</div>
          </div>
          <div className="bg-white rounded shadow p-3 text-center">
            <div className="text-xs text-gray-500">المسدّد</div>
            <div className="text-lg font-semibold text-green-700">{duesSummary.billed.toFixed(2)} {currency}</div>
          </div>
          <div className="bg-white rounded shadow p-3 text-center">
            <div className="text-xs text-gray-500">المستحق</div>
            <div className="text-lg font-semibold text-red-700">{duesSummary.due.toFixed(2)} {currency}</div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">إعدادات الأسعار والحدود</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                سعر النقرة (ج)
              </label>
              <input
                type="number"
                step="0.01"
                value={settings.cost_per_click}
                onChange={(e) => setSettings({ ...settings, cost_per_click: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                سعر المشاهدة (ج)
              </label>
              <input
                type="number"
                step="0.001"
                value={settings.cost_per_impression}
                onChange={(e) => setSettings({ ...settings, cost_per_impression: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الحد الأدنى للميزانية (ج)
              </label>
              <input
                type="number"
                value={settings.min_budget}
                onChange={(e) => setSettings({ ...settings, min_budget: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الحد الأقصى للميزانية (ج)
              </label>
              <input
                type="number"
                value={settings.max_budget}
                onChange={(e) => setSettings({ ...settings, max_budget: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الحد الأدنى للمدة (أيام)
              </label>
              <input
                type="number"
                value={settings.min_duration_days}
                onChange={(e) => setSettings({ ...settings, min_duration_days: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الحد الأقصى للمدة (أيام)
              </label>
              <input
                type="number"
                value={settings.max_duration_days}
                onChange={(e) => setSettings({ ...settings, max_duration_days: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveSettings}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
            >
              حفظ الإعدادات
            </button>
          </div>
        </div>
      )}

      {/* Ads List */}
      {activeTab !== 'settings' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : ads.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Megaphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">لا توجد إعلانات في هذا القسم</p>
            </div>
          ) : (
            ads.map((ad) => (
              <div key={ad.id} className="bg-white rounded-lg shadow p-6" dir="rtl">
                <div className="flex gap-6">
                  {/* Ad Image */}
                  <div className="flex-shrink-0">
                    <img
                      src={ad.image_url}
                      alt={ad.title}
                      className="w-48 h-32 object-cover rounded-lg"
                    />
                  </div>

                  {/* Ad Details */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{ad.title}</h3>
                        <p className="text-sm text-gray-500">{ad.merchant_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(ad.approval_status)}
                        {getRunStatusBadge(ad)}
                      </div>
                    </div>

                    <p className="text-gray-600 mb-3">{ad.description}</p>

                    <div className="grid grid-cols-4 gap-4 mb-3">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">النوع</div>
                        <div className="font-semibold">{getAdTypeLabel(ad.ad_type)}</div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-xs text-blue-600 mb-1 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          الميزانية
                        </div>
                        <div className="font-semibold text-blue-700">{ad.budget_amount} {currency}</div>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="text-xs text-green-600 mb-1 flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          المشاهدات
                        </div>
                        <div className="font-semibold text-green-700">{ad.impressions}</div>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-lg">
                        <div className="text-xs text-purple-600 mb-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          النقرات
                        </div>
                        <div className="font-semibold text-purple-700">{ad.clicks} ({calculateCTR(ad)})</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-500 mt-2">
                      <span>من {new Date(ad.start_date).toLocaleDateString('ar-EG')}</span>
                      <span>إلى {new Date(ad.end_date).toLocaleDateString('ar-EG')}</span>
                      {ad.total_spent > 0 && (
                        <span className="text-primary">المُنفق: {ad.total_spent.toFixed(2)} {currency}</span>
                      )}
                      <span className="text-green-700">ROI: {roiMap[ad.id] !== undefined ? `${roiMap[ad.id].toFixed(2)}%` : '-'}</span>
                      <span className="text-blue-700">المسدّد: {(ad.billed_spent || 0).toFixed(2)} {currency}</span>
                      <span className="text-red-700">المستحق: {Math.max(0, (ad.total_spent || 0) - (ad.billed_spent || 0)).toFixed(2)} {currency}</span>
                    </div>

                    {/* Rejection Reason */}
                    {ad.approval_status === 'rejected' && ad.rejection_reason && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700">
                          <strong>سبب الرفض:</strong> {ad.rejection_reason}
                        </p>
                      </div>
                    )}

                    {/* Actions for Pending Ads */}
                    {ad.approval_status === 'pending' && (
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={() => handleApprove(ad.id)}
                          disabled={maintenance}
                          className={`flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 ${maintenance ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Check className="w-5 h-5" />
                          موافقة
                        </button>
                        <button
                          onClick={() => handleReject(ad.id)}
                          disabled={maintenance}
                          className={`flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2 ${maintenance ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <X className="w-5 h-5" />
                          رفض
                        </button>
                      </div>
                    )}

                    {/* Always available: Settle ad spend now */}
                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={() => handleSettleAd(ad.id)}
                        disabled={Math.max(0, (ad.total_spent || 0) - (ad.billed_spent || 0)) <= 0}
                        className={`flex-1 bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary-dark transition ${Math.max(0, (ad.total_spent || 0) - (ad.billed_spent || 0)) <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        تحصيل إنفاق الإعلان الآن
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      {/* Toasts */}
      <div className="fixed top-4 right-4 space-y-2 z-50">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded shadow text-white ${t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
