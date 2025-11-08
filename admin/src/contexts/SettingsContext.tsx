import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

type AppSettings = {
  id: string;
  site_name: string;
  email_notifications: boolean;
  push_notifications: boolean;
  two_factor_auth: boolean;
  language: string;
  theme: 'light' | 'dark' | string;
  maintenance_mode: boolean;
};

type PlatformSettings = {
  id: number;
  service_fee_flat: number;
  driver_commission_per_km: number;
  driver_commission_free_until: string | null;
  merchant_commission_rate: number;
  merchant_commission_flat: number;
  merchant_commission_apply_on_cash: boolean;
  currency: string;
};

type AdSettings = {
  id: string;
  cost_per_click: number;
  cost_per_impression: number;
  min_budget: number;
  max_budget: number;
  min_duration_days: number;
  max_duration_days: number;
};

interface SettingsContextValue {
  app: AppSettings | null;
  platform: PlatformSettings | null;
  ad: AdSettings | null;
  currency: string;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [app, setApp] = useState<AppSettings | null>(null);
  const [platform, setPlatform] = useState<PlatformSettings | null>(null);
  const [ad, setAd] = useState<AdSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      setLoading(true);
      const [{ data: appData }, { data: platformData }, { data: adData }] = await Promise.all([
        supabase.from('app_settings').select('*').eq('id', 'global').maybeSingle(),
        supabase.from('platform_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('platform_ad_settings').select('*').eq('id', '00000000-0000-0000-0000-000000000001').maybeSingle(),
      ]);
      if (appData) setApp(appData as any);
      if (platformData) setPlatform(platformData as any);
      if (adData) setAd(adData as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  // Side effects: apply theme and title when app or platform loaded
  useEffect(() => {
    if (app?.site_name) {
      document.title = app.site_name;
    }
    const root = document.documentElement;
    const theme = app?.theme || 'light';
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [app?.site_name, app?.theme]);

  const value = useMemo<SettingsContextValue>(() => ({
    app,
    platform,
    ad,
    currency: platform?.currency || 'EGP',
    loading,
    refresh,
  }), [app, platform, ad, loading]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
