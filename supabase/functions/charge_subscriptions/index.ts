// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

serve(async (_req: Request) => {
  try {
    // 1) Get merchants due for charge
    const { data: due, error: dueErr } = await supabase.rpc('list_merchants_due_for_charge');
    if (dueErr) throw dueErr;

    let charged = 0;
    let insufficient = 0;
    let missingSub = 0;

    for (const row of due ?? []) {
      const merchantId = row.merchant_id as string;
      // 2) Attempt to charge 100 via charge_merchant_subscription
      const { data: res, error: chErr } = await supabase.rpc('charge_merchant_subscription', { p_merchant_id: merchantId });
      if (chErr) {
        console.error('charge_merchant_subscription error', merchantId, chErr);
        continue;
      }
      const outcome = Array.isArray(res) && res.length > 0 ? res[0] : res;
      if (outcome?.ok) {
        charged++;
      } else if (outcome?.message?.includes('لا يوجد اشتراك')) {
        missingSub++;
      } else if (outcome?.message?.includes('غير كاف')) {
        insufficient++;
        // TODO: send notification to merchant (if push tokens exist)
      }
    }

    // 3) Optionally mark very overdue subs as expired
    const { data: expiredCount, error: markErr } = await supabase.rpc('mark_overdue_subscriptions');
    if (markErr) console.error('mark_overdue_subscriptions error', markErr);

    return new Response(JSON.stringify({ ok: true, charged, insufficient, missingSub, expiredMarked: expiredCount ?? 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('charge_subscriptions error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
