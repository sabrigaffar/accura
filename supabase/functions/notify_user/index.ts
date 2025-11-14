// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('ANON_KEY');
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization');
    const providedSecret = req.headers.get('x-notify-secret') || req.headers.get('X-Notify-Secret');
    const REQUIRED_SECRET = Deno.env.get('NOTIFY_WEBHOOK_SECRET') || '';

    // Optionally validate the caller is authenticated and (ideally) admin
    let callerIsAdmin = false;
    try {
      if (SUPABASE_ANON_KEY && authHeader) {
        const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false },
        });
        // Try calling is_admin() (if exposed) or fallback to user role heuristics
        const { data: isAdminRes } = await authClient.rpc('is_admin');
        if (Array.isArray(isAdminRes)) {
          // some Postgres clients return setof; normalize
          callerIsAdmin = !!(isAdminRes[0]?.is_admin ?? isAdminRes[0] ?? false);
        } else if (typeof isAdminRes === 'boolean') {
          callerIsAdmin = isAdminRes;
        }
      }
    } catch (_e) {
      // ignore; do not block
    }

    const { user_id, title, body, data } = await req.json();
    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing user_id/title/body' }), { status: 400 });
    }

    // Authorization hardening: require admin or valid secret
    const authorized = (!!REQUIRED_SECRET && providedSecret === REQUIRED_SECRET) || callerIsAdmin;
    if (!authorized) {
      return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // 1) Find active push tokens for the user
    const { data: tokens, error: tErr } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', user_id)
      .eq('is_active', true);
    if (tErr) {
      console.error('push_tokens error', tErr);
    }

    const list = (tokens ?? []).map((t: any) => t.token).filter(Boolean);

    // 2) Insert into notifications table as source of truth (idempotent enough for UI)
    try {
      await supabase.from('notifications').insert({
        user_id,
        title,
        body,
        type: 'system',
        data: { ...(data || {}), source: 'internal' },
      });
    } catch (e) {
      console.warn('notifications insert warning', e);
    }

    // 3) Do not send from here; rely on DB trigger -> push_queue -> push_worker
    // The insert above enqueues a job via trigger on public.notifications
    const sent = 0;
    return new Response(JSON.stringify({ ok: true, enqueued: true, sent }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('notify_user error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
