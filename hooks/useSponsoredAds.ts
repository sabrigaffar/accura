import { useState, useEffect } from 'react';
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
      let idsQuery = supabase
        .from('sponsored_ads')
        .select('id')
        .eq('is_active', true)
        .eq('approval_status', 'approved')
        .lte('start_date', new Date().toISOString())
        .gte('end_date', new Date().toISOString());
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
          .lte('start_date', new Date().toISOString())
          .gte('end_date', new Date().toISOString());
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
      if (idsRes.error) {
        console.warn('SponsoredAds: RLS ids filter error (failing closed):', idsRes.error.message);
        setAds([]);
        return;
      }

      const allowedIds = new Set<string>((idsRes.data || []).map((r: any) => r.id));

      // Always intersect with allowedIds to fail closed
      const finalData = rpcData.filter(ad => allowedIds.has(ad.id));
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

    // Auto-refresh every 5 minutes if enabled
    if (autoRefresh) {
      const interval = setInterval(fetchAds, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
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
