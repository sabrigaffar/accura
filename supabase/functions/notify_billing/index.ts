// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// Prefer the platform-provided SUPABASE_SERVICE_ROLE_KEY when set in Dashboard Secrets,
// otherwise allow CLI-provided SERVICE_ROLE_KEY (since SUPABASE_* names are reserved in CLI).
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

serve(async (req: Request) => {
  try {
    // Optional: secure the endpoint when called by schedulers (GitHub Actions, etc.)
    const CRON_SECRET = Deno.env.get('CRON_SECRET');
    const reqSecret = req.headers.get('x-cron-key');
    if (CRON_SECRET && reqSecret !== CRON_SECRET) {
      return new Response('Forbidden', { status: 403 });
    }

    // 1) Fetch merchants upcoming notifications
    const { data: merchants, error: mErr } = await supabase.rpc('list_upcoming_billing_notifications');
    if (mErr) console.error('list_upcoming_billing_notifications error', mErr);

    // 2) Fetch drivers with low balance
    const { data: drivers, error: dErr } = await supabase.rpc('list_drivers_low_balance', { p_min: 50 });
    if (dErr) console.error('list_drivers_low_balance error', dErr);

    // 3) Resolve driver push tokens
    const driverIds = (drivers ?? []).map((d: any) => d.driver_id);
    // store token and last_notification_at to apply cooldown
    let driverPushMap: Record<string, { token: string; last_notification_at: string | null }> = {};
    if (driverIds.length > 0) {
      const { data: dp, error: dpErr } = await supabase
        .from('driver_profiles')
        .select('id, push_token, push_enabled, last_notification_at')
        .in('id', driverIds);
      if (dpErr) console.error('driver_profiles push lookup error', dpErr);
      (dp ?? []).forEach((row: any) => {
        if (row.push_enabled && row.push_token) {
          driverPushMap[row.id] = { token: row.push_token, last_notification_at: row.last_notification_at ?? null };
        }
      });
    }

    // 4) Build messages
    const expoMessages: any[] = [];
    const notifiedDriverIds: string[] = [];

    // Drivers: low balance
    for (const d of drivers ?? []) {
      const entry = driverPushMap[d.driver_id];
      if (!entry) continue;
      // cooldown: skip drivers notified in the last 12 hours
      const cutoffMs = 12 * 60 * 60 * 1000; // 12h
      const lastAt = entry.last_notification_at ? new Date(entry.last_notification_at).getTime() : 0;
      if (lastAt && Date.now() - lastAt < cutoffMs) continue;
      expoMessages.push({
        to: entry.token,
        sound: 'default',
        title: 'تنبيه: رصيد المحفظة منخفض',
        body: 'لن تستطيع قبول الطلبات إذا كان رصيدك أقل من 50 جنيه. يرجى شحن محفظتك للاستمرار.',
        data: { type: 'driver_low_balance', balance: d.balance },
      });
      notifiedDriverIds.push(d.driver_id);
    }

    // Merchants: upcoming billing/trial
    // Merchants: due for charge with insufficient balance -> alert to pay subscription
    // Strategy: find merchants whose subscription is due now (trial ended and next_due_at <= now() or null)
    // and whose wallet balance < 100. Then resolve push tokens from merchants table if columns exist.
    try {
      const { data: dueList, error: dueErr } = await supabase.rpc('list_merchants_due_for_charge');
      if (dueErr) console.error('list_merchants_due_for_charge error', dueErr);

      const dueIds = (dueList ?? []).map((r: any) => r.merchant_id);

      // Get balances for those merchants
      let merchantBalanceMap: Record<string, number> = {};
      if (dueIds.length > 0) {
        const { data: wrows, error: wErr } = await supabase
          .from('wallets')
          .select('owner_id, balance')
          .in('owner_id', dueIds)
          .eq('owner_type', 'merchant');
        if (wErr) console.error('merchant wallets lookup error', wErr);
        (wrows ?? []).forEach((row: any) => {
          merchantBalanceMap[row.owner_id] = Number(row.balance || 0);
        });
      }

      const insufficientMerchants = dueIds.filter((id: string) => (merchantBalanceMap[id] ?? 0) < 100);

      if (insufficientMerchants.length > 0) {
        // Try resolve push tokens from merchants table if present
        let merchantPushMap: Record<string, string> = {};
        try {
          const { data: mp, error: mpErr } = await supabase
            .from('merchants')
            .select('id, push_token, push_enabled')
            .in('id', insufficientMerchants);
          if (mpErr) {
            console.warn('merchants push lookup error (columns may not exist)', mpErr);
          } else {
            (mp ?? []).forEach((row: any) => {
              if ((row.push_enabled ?? true) && row.push_token) merchantPushMap[row.id] = row.push_token;
            });
          }
        } catch (e) {
          console.warn('merchants push lookup exception', e);
        }

        for (const mid of insufficientMerchants) {
          const token = merchantPushMap[mid];
          if (!token) continue; // skip if we do not have merchant push token
          expoMessages.push({
            to: token,
            sound: 'default',
            title: 'تنبيه: اشتراك متجرك مستحق',
            body: 'رصيد محفظة متجرك غير كافٍ لسداد الاشتراك (100 جنيه). يرجى الشحن لتجنب إخفاء المتجر عن العملاء.',
            data: { type: 'merchant_subscription_due', merchant_id: mid },
          });
        }
      }
    } catch (e) {
      console.error('merchant notifications block error', e);
    }

    // 5) Send messages in batches of 100
    let sent = 0;
    for (let i = 0; i < expoMessages.length; i += 100) {
      const batch = expoMessages.slice(i, i + 100);
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error('Expo push error', res.status, txt);
      } else {
        sent += batch.length;
      }
    }

    // 6) Update last_notification_at for drivers that were notified now
    if (notifiedDriverIds.length > 0) {
      const { error: updErr } = await supabase
        .from('driver_profiles')
        .update({ last_notification_at: new Date().toISOString() })
        .in('id', notifiedDriverIds);
      if (updErr) console.error('update last_notification_at error', updErr);
    }

    return new Response(JSON.stringify({ ok: true, drivers_notified: sent, merchants_checked: (merchants ?? []).length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('notify_billing error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
