-- RPC to return merchants visible to customers: active subscription or within trial
create or replace function public.list_active_merchants()
returns setof public.merchants
language sql
security definer
set search_path = public, pg_temp
as $$
  select m.*
  from public.merchants m
  join public.merchant_subscriptions s
    on s.merchant_id = m.id
  where m.is_active = true
    and (
      (s.status = 'active' and (s.next_due_at is null or s.next_due_at > now()))
      or (s.trial_end_at is not null and s.trial_end_at > now())
    );
$$;

grant execute on function public.list_active_merchants() to authenticated;
