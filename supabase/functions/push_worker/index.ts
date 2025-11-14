// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const WORKER_SECRET = Deno.env.get('PUSH_WORKER_SECRET') ?? '';
const DEFAULT_BATCH = Number.parseInt(Deno.env.get('PUSH_WORKER_BATCH') ?? '500');
const MAX_ATTEMPTS = Number.parseInt(Deno.env.get('PUSH_WORKER_MAX_ATTEMPTS') ?? '5');

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

serve(async (req: Request) => {
  try {
    // Basic auth via secret header or scheduled invocation
    const provided = req.headers.get('x-worker-secret') || req.headers.get('X-Worker-Secret') || '';
    const isScheduled = req.headers.get('x-scheduled') === 'true';
    if (!(isScheduled || (WORKER_SECRET && provided === WORKER_SECRET))) {
      return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const url = new URL(req.url);
    const batchParam = url.searchParams.get('batch');
    const batchSize = Math.max(1, Number.parseInt(batchParam || '') || DEFAULT_BATCH);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // 1) Dequeue a batch atomically (SKIP LOCKED inside the function)
    const { data: jobs, error: dqErr } = await supabase.rpc('dequeue_push_jobs', { p_batch: batchSize });
    if (dqErr) {
      console.error('dequeue error', dqErr);
      return new Response(JSON.stringify({ ok: false, error: 'dequeue_failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const dequeued: any[] = Array.isArray(jobs) ? jobs : [];
    if (dequeued.length === 0) {
      return new Response(JSON.stringify({ ok: true, dequeued: 0, sent: 0 }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 2) Resolve tokens for impacted users in one query
    const userIds = Array.from(new Set(dequeued.map(j => j.user_id).filter(Boolean)));
    const { data: tokens, error: tErr } = await supabase
      .from('push_tokens')
      .select('user_id, token')
      .in('user_id', userIds)
      .eq('is_active', true);
    if (tErr) console.error('push_tokens fetch error', tErr);
    const tokensByUser = new Map<string, string[]>();
    for (const row of tokens ?? []) {
      const k = String(row.user_id);
      const arr = tokensByUser.get(k) ?? [];
      arr.push(row.token);
      tokensByUser.set(k, arr);
    }

    // Fallback: legacy tokens on driver_profiles
    const { data: legacy, error: lErr } = await supabase
      .from('driver_profiles')
      .select('id, push_token, push_enabled')
      .in('id', userIds)
      .eq('push_enabled', true);
    if (lErr) console.error('driver_profiles fetch error', lErr);
    for (const row of legacy ?? []) {
      if (!row?.push_token) continue;
      const k = String(row.id);
      const arr = tokensByUser.get(k) ?? [];
      arr.push(row.push_token);
      tokensByUser.set(k, arr);
    }

    // 3) Build messages grouped from jobs
    type Job = { id: string; user_id: string; payload: any; attempts: number };
    const jobsList: Job[] = dequeued.map((j: any) => ({ id: j.id, user_id: j.user_id, payload: j.payload, attempts: j.attempts }));

    const successJobIds: string[] = [];
    const retryJobIds: string[] = [];
    const failJobIds: string[] = [];

    // Send per user in batches of 100 tokens
    for (const job of jobsList) {
      const toks = tokensByUser.get(String(job.user_id)) ?? [];
      if (toks.length === 0) {
        // No tokens: mark as sent to avoid infinite retries, UI still has notification row
        successJobIds.push(job.id);
        continue;
      }
      const title = job.payload?.title || 'إشعار';
      const body = job.payload?.body || '';
      const data = job.payload?.data || {};

      const messages = toks.map(to => ({ to, title, body, sound: 'default', data }));
      const chunks = chunk(messages, 100);
      let allOk = true;
      for (const c of chunks) {
        try {
          const res = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(c),
          });
          if (!res.ok) {
            allOk = false;
            console.error('expo push batch failed', await res.text());
          }
        } catch (e) {
          allOk = false;
          console.error('expo push network error', e);
        }
      }
      if (allOk) successJobIds.push(job.id);
      else if (job.attempts + 1 >= MAX_ATTEMPTS) failJobIds.push(job.id);
      else retryJobIds.push(job.id);
    }

    // 4) Persist results
    const nowIso = new Date().toISOString();

    if (successJobIds.length > 0) {
      const { error: upOkErr } = await supabase
        .from('push_queue')
        .update({ status: 'sent', processed_at: nowIso, updated_at: nowIso, last_error: null })
        .in('id', successJobIds);
      if (upOkErr) console.error('update sent error', upOkErr);
    }

    if (retryJobIds.length > 0) {
      // Exponential backoff: attempts already incremented by dequeue; schedule next try in (2^attempts)*60s
      // We do not know exact attempts value per row here, so apply generic +5m backoff.
      const backoffAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { error: upRetryErr } = await supabase
        .from('push_queue')
        .update({ status: 'pending', scheduled_at: backoffAt, updated_at: nowIso, last_error: 'retry' })
        .in('id', retryJobIds);
      if (upRetryErr) console.error('update retry error', upRetryErr);
    }

    if (failJobIds.length > 0) {
      const { error: upFailErr } = await supabase
        .from('push_queue')
        .update({ status: 'failed', processed_at: nowIso, updated_at: nowIso, last_error: 'max_attempts' })
        .in('id', failJobIds);
      if (upFailErr) console.error('update failed error', upFailErr);
    }

    const sentCount = successJobIds.length;
    return new Response(JSON.stringify({ ok: true, dequeued: dequeued.length, sent: sentCount, retry: retryJobIds.length, failed: failJobIds.length }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('push_worker error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
