import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ImageBackground,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { MapPin, Search, UtensilsCrossed, ShoppingCart, Pill, Gift, Grid3x3, Store } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { Merchant } from '@/types/database';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLocation } from '@/hooks/useLocation';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCart } from '@/contexts/CartContext';

// New Components
import HeroSection from '@/components/home/HeroSection';
import SponsoredBanner from '@/components/home/SponsoredBanner';
import SponsoredStories from '@/components/home/SponsoredStories';
import QuickActions from '@/components/home/QuickActions';
import FeaturedStores from '@/components/home/FeaturedStores';
import { useSponsoredAds, transformAdsForBanner, transformAdsForStories, transformAdsForFeatured } from '@/hooks/useSponsoredAds';
import { MerchantGridCardSkeleton } from '@/components/ui/Skeleton';
import * as Haptics from 'expo-haptics';

const CATEGORIES = [
  { id: 'restaurant', name: 'مطاعم', icon: UtensilsCrossed, color: '#FF6B6B' },
  { id: 'grocery', name: 'بقالة', icon: ShoppingCart, color: '#4ECDC4' },
  { id: 'pharmacy', name: 'صيدلية', icon: Pill, color: '#45B7D1' },
  { id: 'gifts', name: 'هدايا', icon: Gift, color: '#FFA07A' },
  { id: 'other', name: 'أخرى', icon: Store, color: '#95A5A6' },
  { id: 'all', name: 'الكل', icon: Grid3x3, color: '#95A5A6' },
];

export default function HomeScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  type NearbyMerchant = Merchant & { distance_km?: number };
  type TopOffer = {
    source: 'promotion' | 'rule';
    id: string;
    name: string;
    applyOn?: 'subtotal' | 'delivery_fee' | 'service_fee' | 'merchant_commission';
    discountType: 'flat' | 'percent';
    discountAmount: number;
    storeId?: string | null;
  };
  const [merchants, setMerchants] = useState<NearbyMerchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ type: 'merchant' | 'product'; id: string; title: string; subtitle?: string; image?: string | null; storeId?: string }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locationText, setLocationText] = useState('جارٍ تحديد الموقع...');
  const [offersCount, setOffersCount] = useState(0);
  const [maxPercent, setMaxPercent] = useState(0);
  const [nearestStoreName, setNearestStoreName] = useState<string | null>(null);
  const [nearestStoreImage, setNearestStoreImage] = useState<string | null>(null);
  const [topOffer, setTopOffer] = useState<TopOffer | null>(null);

  // Fetch real sponsored ads from database
  const { 
    ads: bannerAds, 
    loading: bannerLoading,
    recordImpression: recordBannerImpression,
    recordClick: recordBannerClick 
  } = useSponsoredAds({ adType: 'banner', limit: 5 });
  
  const { 
    ads: storyAds,
    recordImpression: recordStoryImpression,
    recordClick: recordStoryClick 
  } = useSponsoredAds({ adType: 'story', limit: 10 });
  
  const { 
    ads: featuredAds,
    recordImpression: recordFeaturedImpression,
    recordClick: recordFeaturedClick 
  } = useSponsoredAds({ adType: 'featured', limit: 6 });

  // Transform ads for components (use only real data from database)
  const sponsoredBanners = transformAdsForBanner(bannerAds);
  const sponsoredStories = transformAdsForStories(storyAds);
  const featuredStores = transformAdsForFeatured(featuredAds);

  const styles = useMemo(() => createStyles(theme), [theme]);
  const { getTotalItems, getTotalPrice } = useCart();
  const cartCount = getTotalItems();
  const cartSubtotal = getTotalPrice();
  
  // Hook الموقع
  const { location, getCurrentLocation, loading: locationLoading } = useLocation();

  // ----- Reverse geocoding throttle + cache -----
  const lastReverseGeocodeTs = useRef(0);
  const GEOCODE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
  const GEOCODE_MIN_INTERVAL_MS = 5000; // 5s between calls to avoid rate limit

  const reverseGeocodeWithCache = useCallback(async (lat: number, lon: number): Promise<string | null> => {
    try {
      // Round coordinates to 3 decimals (~110m) to increase cache hits
      const round = (x: number) => Math.round(x * 1000) / 1000;
      const rlat = round(lat);
      const rlon = round(lon);
      const key = `reverse_geocode_cache:${rlat}:${rlon}`;

      // Read cache first
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as { ts: number; text: string };
          if (Date.now() - parsed.ts < GEOCODE_TTL_MS) {
            return parsed.text;
          }
        } catch {}
      }

      // Throttle requests
      const now = Date.now();
      if (now - lastReverseGeocodeTs.current < GEOCODE_MIN_INTERVAL_MS) {
        // If throttled, return stale cached value if exists
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as { ts: number; text: string };
            return parsed.text;
          } catch {}
        }
        return null;
      }

      // Perform reverse geocode
      lastReverseGeocodeTs.current = now;
      const address = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (address && address[0]) {
        const { city, district, street, region, name } = address[0] as any;
        const parts = [city || region || '', district || '', street || name || ''].filter(Boolean);
        const text = parts.join('، ') || 'الموقع الحالي';
        try { await AsyncStorage.setItem(key, JSON.stringify({ ts: Date.now(), text })); } catch {}
        return text;
      }
      return null;
    } catch (err) {
      // Swallow rate limit errors gracefully
      console.warn('reverseGeocode skipped:', (err as any)?.message || err);
      return null;
    }
  }, [GEOCODE_TTL_MS]);

  // تحديد الموقع عند تحميل الصفحة
  useEffect(() => {
    (async () => {
      const loc = await getCurrentLocation();
      if (loc) {
        // الحصول على اسم المنطقة من الإحداثيات مع كاش وثروتل
        const text = await reverseGeocodeWithCache(loc.latitude, loc.longitude);
        setLocationText(text || 'الموقع الحالي');
      } else {
        setLocationText('الرياض، حي النخيل'); // fallback
      }
    })();
  }, [reverseGeocodeWithCache]);

  useEffect(() => {
    fetchMerchants();
  }, [selectedCategory, searchQuery]);

  // Typeahead search: fetch merchants + products as user types (from first character)
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    setShowSuggestions(true);
    const timer = setTimeout(async () => {
      try {
        const results: Array<{ type: 'merchant' | 'product'; id: string; title: string; subtitle?: string; image?: string | null; storeId?: string }> = [];

        // Merchants search (active only)
        const { data: mrows, error: merr } = await supabase
          .from('merchants')
          .select('id, name_ar, description_ar, logo_url, is_active')
          .eq('is_active', true)
          .or(`name_ar.ilike.%${q}%,description_ar.ilike.%${q}%`)
          .limit(5);
        if (!merr && Array.isArray(mrows)) {
          mrows.forEach((m: any) => {
            results.push({
              type: 'merchant',
              id: String(m.id),
              title: String(m.name_ar || 'متجر'),
              subtitle: m.description_ar || undefined,
              image: m.logo_url || null,
            });
          });
        }

        // Products search (new schema)
        let prows: any[] | null = null;
        let perr: any = null;
        const pRes = await supabase
          .from('products')
          .select('id, name, description, images, store_id, price, is_active')
          .eq('is_active', true)
          .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
          .limit(5);
        prows = pRes.data as any[] | null;
        perr = pRes.error;

        if (perr) {
          // Fallback to legacy merchant_products
          const lRes = await supabase
            .from('merchant_products')
            .select('id, name_ar, description_ar, image_url, merchant_id, price, is_available')
            .eq('is_available', true)
            .or(`name_ar.ilike.%${q}%,description_ar.ilike.%${q}%`)
            .limit(5);
          if (!lRes.error && Array.isArray(lRes.data)) {
            lRes.data.forEach((p: any) => {
              results.push({
                type: 'product',
                id: String(p.id),
                title: String(p.name_ar || 'منتج'),
                subtitle: p.description_ar || undefined,
                image: p.image_url || null,
                storeId: String(p.merchant_id),
              });
            });
          }
        } else if (Array.isArray(prows)) {
          prows.forEach((p: any) => {
            const firstImage = Array.isArray(p.images) ? (p.images[0] || null) : (p.images || null);
            results.push({
              type: 'product',
              id: String(p.id),
              title: String(p.name || 'منتج'),
              subtitle: p.description || undefined,
              image: firstImage,
              storeId: p.store_id ? String(p.store_id) : undefined,
            });
          });
        }

        if (!cancelled) {
          setSuggestions(results);
        }
      } catch (e) {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 200); // debounce 200ms

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // جلب ملخص العروض لعرضه في البانر (مع مراعاة طريقة الدفع الأخيرة)
  const refreshOffersSummary = useCallback(async () => {
    try {
      const now = new Date();

      // استنتاج آخر طريقة دفع استخدمها العميل (إن وجدت)
      let pm: 'any' | 'cash' | 'card' = 'any';
      if (user?.id) {
        const { data: lastOrders } = await supabase
          .from('orders')
          .select('payment_method, created_at')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (lastOrders && lastOrders.length > 0) {
          const m = String(lastOrders[0].payment_method || '').toLowerCase();
          pm = m.includes('cash') ? 'cash' : 'card';
        }
      }

      // تحديد أقرب متجر نشط حسب الموقع (إن توفر)
      let nearestId: string | null = null;
      let nearestCat: string | null = null;
      let nearestName: string | null = null;
      let nearestImg: string | null = null;
      if (location?.latitude && location?.longitude) {
        const { data: mrows } = await supabase
          .from('merchants')
          .select('id, name_ar, category, latitude, longitude, is_active, banner_url, logo_url')
          .eq('is_active', true)
          .limit(100);
        if (mrows && mrows.length > 0) {
          let bestDist = Number.POSITIVE_INFINITY;
          for (const r of mrows as any[]) {
            if (r.latitude != null && r.longitude != null) {
              const dlat = Number(r.latitude) - Number(location.latitude);
              const dlon = Number(r.longitude) - Number(location.longitude);
              const dist2 = dlat * dlat + dlon * dlon;
              if (dist2 < bestDist) {
                bestDist = dist2;
                nearestId = r.id;
                nearestCat = r.category || null;
                nearestName = r.name_ar || null;
                nearestImg = r.banner_url || r.logo_url || null;
              }
            }
          }
        }
      }
      setNearestStoreName(nearestName);
      setNearestStoreImage(nearestImg);

      const [promosRes, rulesRes, adsRes] = await Promise.all([
        supabase
          .from('promotions')
          .select('id, name, audience, target_id, discount_type, discount_amount, start_at, end_at, is_active')
          .eq('is_active', true),
        supabase
          .from('promotion_rules')
          .select('id, name, apply_on, audience, store_id, merchant_category, discount_type, discount_amount, start_at, end_at, is_active, payment_filter')
          .eq('is_active', true),
        supabase
          .from('sponsored_ads')
          .select('promotion_rule_id, approval_status, is_active, start_date, end_date')
          .not('promotion_rule_id', 'is', null),
      ]);

      const inWindow = (row: any) => {
        const startOk = row.start_at ? new Date(row.start_at) <= now : true;
        const endOk = !row.end_at || now <= new Date(row.end_at);
        return row.is_active && startOk && endOk;
      };

      // Promotions: عام + موجه للمتجر الأقرب (إن وُجد)
      const promosGeneral = (promosRes.data || []).filter(
        (p: any) => inWindow(p) && (p.audience === 'all' || p.audience === 'customer')
      );
      const promosStore = nearestId
        ? (promosRes.data || []).filter(
            (p: any) => inWindow(p) && p.audience === 'merchant' && p.target_id === nearestId
          )
        : [];
      const promoIds = new Set<string>([
        ...promosGeneral.map((p: any) => String(p.id)),
        ...promosStore.map((p: any) => String(p.id)),
      ]);

      // Rules: مراعاة طريقة الدفع؛ إن وجد متجر أقرب نفضل قواعده + قواعد الفئة العامة له
      // استبعاد أي قواعد مرتبطة بإعلانات ممولة لتجنّب التكرار في الواجهة
      const adRuleIds = new Set<string>(
        ((adsRes.data as any[]) || [])
          .filter((a: any) => a && a.promotion_rule_id)
          .map((a: any) => String(a.promotion_rule_id))
      );
      const allRules = (rulesRes.data || []) as any[];
      const prunedRules = allRules.filter((r: any) => !adRuleIds.has(String(r.id)));

      const rulesBase = prunedRules.filter(
        (r: any) => inWindow(r) && (r.audience === 'all' || r.audience === 'customer') && (r.payment_filter === 'any' || r.payment_filter === pm)
      );
      let rulesFinal: any[] = [];
      if (nearestId) {
        const rulesStore = rulesBase.filter((r: any) => r.store_id === nearestId);
        const rulesCategory = rulesBase.filter(
          (r: any) => !r.store_id && (r.merchant_category == null || String(r.merchant_category) === String(nearestCat))
        );
        rulesFinal = [...rulesStore, ...rulesCategory];
        // في حال لم نجد شيئاً، اسقط إلى كل القواعد العامة
        if (rulesFinal.length === 0) rulesFinal = rulesBase;
      } else {
        rulesFinal = rulesBase;
      }

      const count = promoIds.size + rulesFinal.length;
      const maxP = Math.max(
        0,
        ...[...promosGeneral, ...promosStore]
          .filter((p: any) => p.discount_type === 'percent')
          .map((p: any) => Number(p.discount_amount) || 0),
        ...rulesFinal
          .filter((r: any) => r.discount_type === 'percent')
          .map((r: any) => Number(r.discount_amount) || 0)
      );

      setOffersCount(count);
      setMaxPercent(maxP);

      // تحديد أبرز عرض لعرضه في الرئيسية
      const candidates: TopOffer[] = [
        ...promosGeneral.map((p: any) => ({
          source: 'promotion' as const,
          id: String(p.id),
          name: String(p.name || 'عرض خاص'),
          applyOn: 'subtotal' as const,
          discountType: (p.discount_type as 'flat' | 'percent'),
          discountAmount: Number(p.discount_amount) || 0,
          storeId: null,
        })),
        ...promosStore.map((p: any) => ({
          source: 'promotion' as const,
          id: String(p.id),
          name: String(p.name || 'عرض المتجر'),
          applyOn: 'subtotal' as const,
          discountType: (p.discount_type as 'flat' | 'percent'),
          discountAmount: Number(p.discount_amount) || 0,
          storeId: nearestId,
        })),
        ...rulesFinal.map((r: any) => ({
          source: 'rule' as const,
          id: String(r.id),
          name: String(r.name || 'قاعدة عرض'),
          applyOn: (r.apply_on as 'subtotal' | 'delivery_fee' | 'service_fee' | 'merchant_commission'),
          discountType: (r.discount_type as 'flat' | 'percent'),
          discountAmount: Number(r.discount_amount) || 0,
          storeId: r.store_id ? String(r.store_id) : null,
        })),
      ];

      let best: TopOffer | null = null;
      // فضّل النسبة الأعلى إن وجدت، وإلا أعلى قيمة ثابتة
      const percentCandidates = candidates.filter(c => c.discountType === 'percent');
      if (percentCandidates.length > 0) {
        best = percentCandidates.reduce((a, b) => (b.discountAmount > a.discountAmount ? b : a));
      } else if (candidates.length > 0) {
        best = candidates.reduce((a, b) => (b.discountAmount > a.discountAmount ? b : a));
      }
      setTopOffer(best);
    } catch (e) {
      console.warn('offers summary error:', e);
    }
  }, [user?.id, location?.latitude, location?.longitude]);

  useEffect(() => {
    refreshOffersSummary();
  }, [refreshOffersSummary]);

  useFocusEffect(
    useCallback(() => {
      refreshOffersSummary();
    }, [refreshOffersSummary])

  );

  const fetchMerchants = async () => {
    setLoading(true);
    try {
      // محاولة أولى: إظهار المتاجر القريبة (10 كم)
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const { data, error } = await supabase.rpc('merchants_nearby', {
          p_lat: pos.coords.latitude,
          p_lng: pos.coords.longitude,
          p_radius_km: 10,
        });
        if (!error && Array.isArray(data) && data.length > 0) {
          // تطبيق تصفية الفئة/البحث محلياً على النتائج القريبة
          let rows = data as NearbyMerchant[];
          const q = searchQuery.trim();
          if (selectedCategory !== 'all') {
            rows = rows.filter(r => r.category === selectedCategory);
          }
          if (q) {
            rows = rows.filter(r =>
              (r.name_ar || '').toLowerCase().includes(q.toLowerCase()) ||
              (r.description_ar || '').toLowerCase().includes(q.toLowerCase())
            );
          }
          setMerchants(rows);
          return;
        }

        // محاولة احتياطية: دالة Haversine بدون PostGIS
        const alt = await supabase.rpc('merchants_nearby_haversine', {
          p_lat: pos.coords.latitude,
          p_lng: pos.coords.longitude,
          p_radius_km: 10,
        });
        if (!alt.error && Array.isArray(alt.data) && alt.data.length > 0) {
          let rows = alt.data as NearbyMerchant[];
          const q = searchQuery.trim();
          if (selectedCategory !== 'all') rows = rows.filter(r => r.category === selectedCategory);
          if (q) rows = rows.filter(r => (r.name_ar || '').toLowerCase().includes(q.toLowerCase()) || (r.description_ar || '').toLowerCase().includes(q.toLowerCase()));
          setMerchants(rows);
          return;
        }
      }

      // سقوط: القوائم النشطة كما كانت
      const rpc = await supabase.rpc('list_active_merchants');
      if (!rpc.error && Array.isArray(rpc.data)) {
        let rows = rpc.data as any[];
        // احسب المسافة يدوياً إن كان لدينا موقع المستخدم
        try {
          const pos2 = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const lat = pos2.coords.latitude;
          const lng = pos2.coords.longitude;
          const toRad = (x: number) => (x * Math.PI) / 180;
          rows = rows.map((m: any) => {
            if (m.latitude != null && m.longitude != null) {
              const R = 6371;
              const dLat = toRad(Number(m.latitude) - lat);
              const dLon = toRad(Number(m.longitude) - lng);
              const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(Number(m.latitude))) * Math.sin(dLon / 2) ** 2;
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const d = R * c;
              return { ...m, distance_km: d };
            }
            return m;
          });
        } catch {}
        const q = searchQuery.trim();
        if (selectedCategory !== 'all') rows = rows.filter(r => r.category === selectedCategory);
        if (q) rows = rows.filter(r => (r.name_ar || '').toLowerCase().includes(q.toLowerCase()) || (r.description_ar || '').toLowerCase().includes(q.toLowerCase()));
        setMerchants(rows as any);
        return;
      }

      // سقوط واسع
      let q1 = supabase
        .from('merchants')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (selectedCategory !== 'all') q1 = q1.eq('category', selectedCategory);
      const sq = searchQuery.trim();
      if (sq) q1 = q1.or(`name_ar.ilike.%${sq}%,description_ar.ilike.%${sq}%`);
      const res1 = await q1;
      if (!res1.error && Array.isArray(res1.data)) {
        let rows: any[] = res1.data as any[];
        // احسب المسافة يدوياً إن أمكن
        try {
          const pos3 = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const lat = pos3.coords.latitude;
          const lng = pos3.coords.longitude;
          const toRad = (x: number) => (x * Math.PI) / 180;
          rows = rows.map((m: any) => {
            if (m.latitude != null && m.longitude != null) {
              const R = 6371;
              const dLat = toRad(Number(m.latitude) - lat);
              const dLon = toRad(Number(m.longitude) - lng);
              const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(Number(m.latitude))) * Math.sin(dLon / 2) ** 2;
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const d = R * c;
              return { ...m, distance_km: d };
            }
            return m;
          });
        } catch {}
        setMerchants(rows as any);
        return;
      }

      const res2 = await supabase
        .from('merchants')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!res2.error && Array.isArray(res2.data)) {
        let rows = res2.data as any[];
        // احسب المسافة يدوياً إن أمكن
        try {
          const pos4 = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const lat = pos4.coords.latitude;
          const lng = pos4.coords.longitude;
          const toRad = (x: number) => (x * Math.PI) / 180;
          rows = rows.map((m: any) => {
            if (m.latitude != null && m.longitude != null) {
              const R = 6371;
              const dLat = toRad(Number(m.latitude) - lat);
              const dLon = toRad(Number(m.longitude) - lng);
              const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(Number(m.latitude))) * Math.sin(dLon / 2) ** 2;
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const d = R * c;
              return { ...m, distance_km: d };
            }
            return m;
          });
        } catch {}
        if (selectedCategory !== 'all') rows = rows.filter(r => r.category === selectedCategory);
        const sq2 = searchQuery.trim();
        if (sq2) rows = rows.filter(r => (r.name_ar || '').toLowerCase().includes(sq2.toLowerCase()) || (r.description_ar || '').toLowerCase().includes(sq2.toLowerCase()));
        setMerchants(rows as any);
      } else {
        setMerchants([]);
      }
    } catch (e) {
      console.error('Home fetchMerchants error:', e);
      setMerchants([]);
    } finally {
      setLoading(false);
    }
  };

  const renderMerchantCard = ({ item }: { item: NearbyMerchant }) => (
    <TouchableOpacity
      style={styles.merchantCard}
      onPress={() => router.push({ pathname: '/merchant/[id]', params: { id: item.id } })}
      accessibilityRole="button"
      accessibilityLabel={`فتح صفحة ${item.name_ar}`}
    >
      <View style={styles.merchantImage}>
        { (item.banner_url || item.logo_url) ? (
          <Image source={{ uri: (item.banner_url || item.logo_url) as string }} style={styles.merchantLogo} />
        ) : (
          <View style={[styles.merchantLogo, styles.placeholderLogo]}>
            <UtensilsCrossed size={32} color={theme.textLight} />
          </View>
        )}
      </View>
      <View style={styles.merchantInfo}>
        <Text style={styles.merchantName} numberOfLines={1}>
          {item.name_ar}
        </Text>
        <View style={styles.merchantMeta}>
          <Text style={styles.rating}>⭐⭐⭐⭐⭐ {item.rating.toFixed(1)}</Text>
          <Text style={styles.metaDivider}>•</Text>
          <Text style={styles.deliveryTime}>{item.avg_delivery_time} دقيقة</Text>
          {typeof item.distance_km === 'number' && (
            <>
              <Text style={styles.metaDivider}>•</Text>
              <Text style={styles.deliveryTime}>{item.distance_km.toFixed(1)} كم</Text>
            </>
          )}
        </View>
        <View style={styles.deliveryFeeContainer}>
          <Text style={styles.deliveryFee}>
            {item.delivery_fee === 0 ? 'توصيل مجاني' : `${item.delivery_fee} جنيه توصيل`}
          </Text>
        </View>
        {!item.is_open && (
          <View style={styles.closedBadge}>
            <Text style={styles.closedText}>مغلق</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.locationBar} onPress={getCurrentLocation}>
          <MapPin size={20} color={theme.primary} />
          <View style={styles.locationText}>
            <Text style={styles.locationLabel}>التوصيل إلى</Text>
            <Text style={styles.locationValue} numberOfLines={1}>
              {locationLoading ? 'جارٍ تحديد الموقع...' : locationText}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.searchBarContainer}>
          <View style={styles.searchBar}>
            <Search size={20} color={theme.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث عن مطعم أو منتج..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={theme.textLight}
              onFocus={() => setShowSuggestions(Boolean(searchQuery.trim()))}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            />
          </View>
          <TouchableOpacity style={styles.cartButton} onPress={() => router.push('/cart')}>
            <ShoppingCart size={24} color="#FFFFFF" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : String(cartCount)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Typeahead Suggestions */}
        {showSuggestions && (
          <View style={styles.suggestionsContainer}>
            {searchLoading ? (
              <View style={[styles.suggestionItem, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.suggestionTitle}>جارٍ البحث...</Text>
              </View>
            ) : suggestions.length === 0 ? (
              <View style={[styles.suggestionItem, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.suggestionTitle}>لا توجد نتائج</Text>
              </View>
            ) : (
              suggestions.map((s, idx) => (
                <TouchableOpacity
                  key={`${s.type}-${s.id}-${idx}`}
                  style={styles.suggestionItem}
                  onPress={() => {
                    setShowSuggestions(false);
                    // Navigate based on type
                    if (s.type === 'merchant') {
                      router.push({ pathname: '/merchant/[id]', params: { id: s.id } });
                    } else {
                      const destStore = s.storeId || '';
                      router.push({ pathname: '/merchant/[id]', params: { id: destStore, highlightProductId: s.id } });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.suggestionIconCircle}>
                    {s.type === 'merchant' ? (
                      <Store size={16} color={theme.primary} />
                    ) : (
                      <UtensilsCrossed size={16} color={theme.primary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionTitle} numberOfLines={1}>
                      {s.title || (s.type === 'merchant' ? 'متجر' : 'منتج')}
                    </Text>
                    {!!s.subtitle && (
                      <Text style={styles.suggestionSubtitle} numberOfLines={1}>{s.subtitle}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {/* Sponsored Banner Carousel */}
        {!bannerLoading && sponsoredBanners.length > 0 && (
          <SponsoredBanner 
            ads={sponsoredBanners}
            onImpression={(adId) => recordBannerImpression(adId, user?.id)}
            onClick={async (adId) => {
              try {
                await AsyncStorage.setItem('last_ad_id', adId);
                await AsyncStorage.setItem('last_ad_ts', String(Date.now()));
              } catch (e) {}
              recordBannerClick(adId, user?.id);
            }}
          />
        )}

        {/* Sponsored Stories */}
        <SponsoredStories stories={sponsoredStories} />

        {/* Quick Actions */}
        <QuickActions />

        {/* Featured Stores */}
        <FeaturedStores stores={featuredStores} />

        {(offersCount > 0 || !!topOffer) && (
        <View style={styles.bannersContainer}>
          <TouchableOpacity style={styles.banner} onPress={() => router.push('/(tabs)/offers')}>
            {nearestStoreImage ? (
              <ImageBackground source={{ uri: nearestStoreImage }} style={styles.bannerBg} imageStyle={styles.bannerBgImage}>
                <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.35)"]} style={styles.bannerOverlay} />
              </ImageBackground>
            ) : (
              <LinearGradient
                colors={["#FFE082", "#FFC107"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bannerGradient}
              />
            )}
            <Text style={[styles.bannerText, nearestStoreImage && styles.bannerTextOnImage]}>عروض خاصة اليوم 🔥</Text>
            <Text style={[styles.bannerSubtext, nearestStoreImage && styles.bannerSubtextOnImage]}>
              {offersCount > 0
                ? (maxPercent > 0
                  ? `خصم حتى ${maxPercent}% • ${offersCount} عرض متاح${nearestStoreName ? ' • بالقرب من ' + nearestStoreName : ''}`
                  : `يوجد ${offersCount} عرض متاح الآن${nearestStoreName ? ' • بالقرب من ' + nearestStoreName : ''}`)
                : `خصم حتى 50% على مطاعم مختارة${nearestStoreName ? ' • بالقرب من ' + nearestStoreName : ''}`}
            </Text>
            {topOffer && (
              <TouchableOpacity
                style={styles.topOfferCard}
                onPress={() => {
                  if (topOffer.storeId) {
                    router.push({ pathname: '/merchant/[id]', params: { id: topOffer.storeId } });
                  } else {
                    router.push('/(tabs)/offers');
                  }
                }}
                activeOpacity={0.92}
              >
                <View style={styles.topOfferHeaderRow}>
                  <View style={styles.topOfferIconCircle}>
                    <Gift size={20} color={theme.primary} />
                  </View>
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>
                      {topOffer.discountType === 'percent' ? `خصم ${topOffer.discountAmount}%` : `خصم ${topOffer.discountAmount}ج`}
                    </Text>
                  </View>
                </View>
                <Text style={styles.topOfferTitle}>{topOffer.name}</Text>
                <View style={styles.topOfferMetaRow}>
                  <View style={styles.applyOnPill}>
                    <Text style={styles.applyOnPillText}>
                      {topOffer.applyOn === 'delivery_fee' ? 'رسوم التوصيل' : topOffer.applyOn === 'service_fee' ? 'رسوم الخدمة' : topOffer.applyOn === 'merchant_commission' ? 'عمولة التاجر' : 'قيمة الطلب'}
                    </Text>
                  </View>
                  {!!nearestStoreName && (
                    <Text style={styles.topOfferMetaText}>بالقرب من {nearestStoreName}</Text>
                  )}
                </View>
                <View style={styles.topOfferFooterRow}>
                  <Text style={styles.topOfferDesc}>استفد الآن</Text>
                  <Text style={styles.topOfferDesc}>›</Text>
                </View>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>التصنيفات</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          >
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isSelected = selectedCategory === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryCard,
                    isSelected && styles.categoryCardSelected,
                  ]}
                  onPress={() => { try { Haptics.selectionAsync(); } catch {}; setSelectedCategory(category.id); }}
                >
                  <View
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: isSelected ? category.color : colors.lightGray },
                    ]}
                  >
                    <Icon size={24} color={isSelected ? colors.white : category.color} />
                  </View>
                  <Text
                    style={[
                      styles.categoryName,
                      isSelected && styles.categoryNameSelected,
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>المطاعم المتاحة</Text>
            <Text style={styles.sectionCount}>({merchants.length})</Text>
          </View>

          {loading ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: spacing.md }}>
              <MerchantGridCardSkeleton />
              <MerchantGridCardSkeleton />
              <MerchantGridCardSkeleton />
              <MerchantGridCardSkeleton />
              <MerchantGridCardSkeleton />
              <MerchantGridCardSkeleton />
            </View>
          ) : merchants.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>لا توجد مطاعم متاحة حالياً</Text>
            </View>
          ) : (
            <FlatList
              data={merchants}
              renderItem={renderMerchantCard}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.merchantRow}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  locationText: {
    marginRight: spacing.sm,
  },
  locationLabel: {
    ...typography.small,
    color: theme.textLight,
  },
  locationValue: {
    ...typography.bodyMedium,
    color: theme.text,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.lightGray,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  cartButton: {
    width: 48,
    height: 48,
    backgroundColor: theme.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  suggestionsContainer: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    ...shadows.small,
    borderWidth: 1,
    borderColor: theme.border,
    zIndex: 10,
    elevation: 6,
  },
  suggestionItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  suggestionTitle: {
    ...typography.bodyMedium,
    color: theme.text,
    textAlign: 'right',
  },
  suggestionSubtitle: {
    ...typography.small,
    color: theme.textLight,
    marginTop: 2,
    textAlign: 'right',
  },
  suggestionIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: theme.text,
    marginRight: spacing.sm,
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  fabCart: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    backgroundColor: theme.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    ...shadows.small,
  },
  fabCartText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginHorizontal: spacing.sm,
  },
  fabBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  fabBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  bannersContainer: {
    padding: spacing.md,
  },
  banner: {
    backgroundColor: theme.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
    ...shadows.small,
    position: 'relative',
  },
  bannerGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.lg,
  },
  bannerBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.lg,
  },
  bannerBgImage: {
    borderRadius: borderRadius.lg,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.lg,
  },
  bannerText: {
    ...typography.h3,
    color: theme.text,
    marginBottom: spacing.xs,
  },
  bannerSubtext: {
    ...typography.body,
    color: theme.text,
  },
  bannerTextOnImage: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bannerSubtextOnImage: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  topOfferCard: {
    marginTop: spacing.sm,
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.small,
  },
  topOfferHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  topOfferIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBadge: {
    backgroundColor: theme.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  discountBadgeText: {
    ...typography.small,
    color: '#FFFFFF',
  },
  topOfferTitle: {
    ...typography.bodyMedium,
    color: theme.text,
    marginBottom: spacing.xs,
  },
  topOfferMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  applyOnPill: {
    backgroundColor: theme.lightGray,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  applyOnPillText: {
    ...typography.small,
    color: theme.text,
  },
  topOfferMetaText: {
    ...typography.small,
    color: theme.textLight,
  },
  topOfferFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topOfferDesc: {
    ...typography.small,
    color: theme.textLight,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: theme.text,
  },
  sectionCount: {
    ...typography.body,
    color: theme.textLight,
    marginRight: spacing.xs,
  },
  categoriesContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  categoryCard: {
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  categoryCardSelected: {
    transform: [{ scale: 1.05 }],
  },
  categoryIcon: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  categoryName: {
    ...typography.caption,
    color: theme.text,
  },
  categoryNameSelected: {
    ...typography.bodyMedium,
    color: theme.text,
  },
  merchantRow: {
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  merchantCard: {
    width: '48%',
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.small,
  },
  merchantImage: {
    width: '100%',
    height: 120,
    backgroundColor: theme.lightGray,
  },
  merchantLogo: {
    width: '100%',
    height: '100%',
  },
  placeholderLogo: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  merchantInfo: {
    padding: spacing.sm,
  },
  merchantName: {
    ...typography.bodyMedium,
    color: theme.text,
    marginBottom: spacing.xs,
  },
  merchantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  rating: {
    ...typography.small,
    color: theme.text,
  },
  metaDivider: {
    ...typography.small,
    color: theme.textLight,
    marginHorizontal: spacing.xs,
  },
  deliveryTime: {
    ...typography.small,
    color: theme.textLight,
  },
  deliveryFeeContainer: {
    marginTop: spacing.xs,
  },
  deliveryFee: {
    ...typography.caption,
    color: theme.primary,
  },
  closedBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: theme.error + 'DD',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  closedText: {
    ...typography.small,
    color: '#FFFFFF',
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: theme.textLight,
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: theme.textLight,
  },
});
