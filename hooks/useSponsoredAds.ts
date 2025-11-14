import { useState, useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';

interface SponsoredAd {
  id: string;
  merchant_id: string;
  merchant_name: string;
  ad_type: 'banner' | 'story' | 'featured';
  title: string;
  description: string | null;
  image_url: string;
  priority: number;
  impression_count: number;
  click_count: number;
  ctr: number;
}

interface UseSponsoredAdsOptions {
  adType?: 'banner' | 'story' | 'featured';
  limit?: number;
  autoRefresh?: boolean;
}

export function useSponsoredAds(options: UseSponsoredAdsOptions = {}) {
  const { adType, limit = 10, autoRefresh = false } = options;
  const [ads, setAds] = useState<SponsoredAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAds = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1) Fetch via RPC (should already filter to approved+active)
      const rpcPromise = supabase.rpc('get_active_sponsored_ads', {
        p_ad_type: adType || null,
        p_limit: limit,
      });

      // 2) In parallel, fetch allowed IDs via direct table select constrained by RLS
      //    This guarantees we never show pending/unapproved ads even if RPC is stale.
      const nowIso = new Date().toISOString();
      let idsQuery = supabase
        .from('sponsored_ads')
        .select('id')
        .eq('is_active', true)
        .eq('approval_status', 'approved')
        .lte('start_date', nowIso)
        .or(`end_date.is.null,end_date.gte.${nowIso}`);
      if (adType) idsQuery = idsQuery.eq('ad_type', adType);

      const [rpcRes, idsRes] = await Promise.all([rpcPromise, idsQuery]);

      // If RPC failed (e.g. gateway timeout), fallback to direct table queries under RLS
      let rpcData: SponsoredAd[] = [];
      if (rpcRes.error) {
        console.warn('SponsoredAds RPC failed, falling back to direct query:', rpcRes.error.message);
        // Fallback: fetch sponsored_ads directly with strict filters, then fetch merchant names separately
        let base = supabase
          .from('sponsored_ads')
          .select('id, merchant_id, ad_type, title, description, image_url, priority, impression_count, click_count')
          .eq('is_active', true)
          .eq('approval_status', 'approved')
          .lte('start_date', nowIso)
          .or(`end_date.is.null,end_date.gte.${nowIso}`);
        if (adType) base = base.eq('ad_type', adType);
        const { data: adsRows, error: adsErr } = await base.order('priority', { ascending: false }).limit(limit);
        if (adsErr) throw adsErr;

        const ids = Array.from(new Set((adsRows || []).map((r: any) => r.merchant_id)));
        let m = supabase.from('merchants').select('id, name_ar').in('id', ids).eq('is_active', true);
        const { data: merchantsRows, error: merchantsErr } = await m;
        if (merchantsErr) throw merchantsErr;
        const nameById: Record<string, string> = {};
        (merchantsRows || []).forEach((row: any) => { nameById[row.id] = row.name_ar; });
        rpcData = (adsRows || []).map((r: any) => ({
          ...r,
          merchant_name: nameById[r.merchant_id] || '',
          ctr: r.impression_count > 0 ? Math.round((r.click_count / r.impression_count) * 10000) / 100 : 0,
        }));
      } else {
        rpcData = (rpcRes.data || []) as SponsoredAd[];
      }
      let allowedIds: Set<string> | null = null;
      if (idsRes.error) {
        console.warn('SponsoredAds: RLS ids filter error, relying on RPC only:', idsRes.error.message);
      } else {
        allowedIds = new Set<string>((idsRes.data || []).map((r: any) => r.id));
      }

      // Prefer RPC data; if RPC failed, rpcData contains fallback results.
      let finalData = allowedIds ? rpcData.filter(ad => allowedIds!.has(ad.id)) : rpcData;

      // If RPC returned empty but ids query has items, fetch those ads directly (avoid blank UI)
      if ((finalData.length === 0) && allowedIds && allowedIds.size > 0) {
        const idList = Array.from(allowedIds);
        let base2 = supabase
          .from('sponsored_ads')
          .select('id, merchant_id, ad_type, title, description, image_url, priority, impression_count, click_count')
          .in('id', idList)
          .order('priority', { ascending: false })
          .limit(limit);
        const { data: adsRows2, error: adsErr2 } = await base2;
        if (!adsErr2) {
          const ids2 = Array.from(new Set((adsRows2 || []).map((r: any) => r.merchant_id)));
          const { data: merchantsRows2 } = await supabase.from('merchants').select('id, name_ar').in('id', ids2);
          const nameById2: Record<string, string> = {};
          (merchantsRows2 || []).forEach((row: any) => { nameById2[row.id] = row.name_ar; });
          finalData = (adsRows2 || []).map((r: any) => ({
            ...r,
            merchant_name: nameById2[r.merchant_id] || '',
            ctr: r.impression_count > 0 ? Math.round((r.click_count / r.impression_count) * 10000) / 100 : 0,
          }));
        }
      }
      setAds(finalData);
    } catch (err: any) {
      console.error('Error fetching sponsored ads:', err);
      setError(err.message);
      setAds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();

    const cleanups: Array<() => void> = [];

    // Auto-refresh every 2 minutes if enabled
    let interval: any = null;
    if (autoRefresh) {
      interval = setInterval(fetchAds, 2 * 60 * 1000);
      cleanups.push(() => clearInterval(interval));

      // Refresh on app foreground
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') fetchAds();
      });
      cleanups.push(() => sub.remove());

      // Realtime updates on sponsored_ads
      try {
        const channel = supabase
          .channel('realtime:sponsored_ads')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsored_ads' }, () => {
            // Debounce by a tick
            setTimeout(fetchAds, 50);
          })
          .subscribe();
        cleanups.push(() => {
          try { supabase.removeChannel(channel); } catch {}
        });
      } catch {}
    }

    return () => {
      cleanups.forEach(fn => fn());
    };
  }, [adType, limit, autoRefresh]);

  // Record impression
  const recordImpression = async (adId: string, userId?: string) => {
    try {
      await supabase.rpc('record_ad_impression', {
        p_ad_id: adId,
        p_user_id: userId || null,
        p_session_id: null,
        p_device_type: 'mobile',
        p_location_lat: null,
        p_location_lng: null,
      });
    } catch (err) {
      console.error('Error recording impression:', err);
    }
  };

  // Record click
  const recordClick = async (adId: string, userId?: string) => {
    try {
      await supabase.rpc('record_ad_click', {
        p_ad_id: adId,
        p_user_id: userId || null,
        p_session_id: null,
      });
    } catch (err) {
      console.error('Error recording click:', err);
    }
  };

  return {
    ads,
    loading,
    error,
    refresh: fetchAds,
    recordImpression,
    recordClick,
  };
}

// Transform ads for different component formats
export function transformAdsForBanner(ads: SponsoredAd[]) {
  return ads.map(ad => ({
    id: ad.id,
    merchantId: ad.merchant_id,
    merchantName: ad.merchant_name,
    imageUrl: ad.image_url,
    title: ad.title,
    description: ad.description || '',
    discount: ad.title, // Use title as discount text
    rating: 0,
    distance: '',
    deliveryFee: 0,
  }));
}

export function transformAdsForStories(ads: SponsoredAd[]) {
  const gradients = [
    ['#FF6B6B', '#FFD700', '#FF6B6B'],
    ['#4ECDC4', '#45B7D1', '#4ECDC4'],
    ['#FFA07A', '#FF6B6B', '#FFA07A'],
    ['#95A5A6', '#7F8C8D', '#95A5A6'],
  ];

  return ads.map((ad, index) => ({
    id: ad.id,
    merchantId: ad.merchant_id,
    merchantName: ad.merchant_name,
    imageUrl: ad.image_url,
    badge: ad.title.length > 10 ? '🔥' : ad.title,
    gradientColors: gradients[index % gradients.length],
  }));
}

export function transformAdsForFeatured(ads: SponsoredAd[]) {
  return ads.map(ad => ({
    adId: ad.id, // keep original ad id for attribution
    id: ad.merchant_id, // use merchant id to navigate to the store page
    name: ad.merchant_name,
    imageUrl: ad.image_url,
    rating: 4.5 + Math.random() * 0.5, // Mock rating
    distance: '2 كم', // Mock distance
    discount: ad.title,
    isSponsored: true,
  }));
}
