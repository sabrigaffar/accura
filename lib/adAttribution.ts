import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const LAST_AD_ID_KEY = 'last_ad_id';
const LAST_AD_TS_KEY = 'last_ad_ts';

export async function setLastAdId(adId: string): Promise<void> {
  try {
    await AsyncStorage.multiSet([[LAST_AD_ID_KEY, adId], [LAST_AD_TS_KEY, String(Date.now())]]);
  } catch {}
}

export async function getLastAdId(maxAgeMs: number = 30 * 60 * 1000): Promise<string | null> {
  try {
    const [id, ts] = await AsyncStorage.multiGet([LAST_AD_ID_KEY, LAST_AD_TS_KEY]);
    const adId = id?.[1] || null;
    const tsStr = ts?.[1] || null;
    if (!adId || !tsStr) return null;
    const age = Date.now() - Number(tsStr);
    if (Number.isNaN(age) || age > maxAgeMs) return null;
    return adId;
  } catch {
    return null;
  }
}

export async function clearLastAdId(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([LAST_AD_ID_KEY, LAST_AD_TS_KEY]);
  } catch {}
}

export async function applyLastAdToOrder(orderId: string, maxAgeMinutes: number = 30): Promise<{ ok: boolean; message: string }> {
  try {
    const adId = await getLastAdId(maxAgeMinutes * 60 * 1000);
    if (!adId) return { ok: false, message: 'no_recent_ad' };

    const { data, error } = await supabase.rpc('apply_ad_discount_if_eligible', {
      p_order_id: orderId,
      p_ad_id: adId,
    });

    if (error) return { ok: false, message: error.message };
    // clear on success to avoid re-use
    await clearLastAdId();
    const row = Array.isArray(data) && data[0] ? data[0] : { ok: true, message: 'ok' };
    return { ok: !!row.ok, message: row.message || 'ok' };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'unknown_error' };
  }
}
