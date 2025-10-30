-- Functions to support scheduled subscription charging

-- List merchants due for charge: due if trial ended and (next_due_at IS NULL OR next_due_at <= now())
create or replace function public.list_merchants_due_for_charge()
returns table(merchant_id uuid)
language sql
security definer
set search_path = public, pg_temp
as $$
  select s.merchant_id
  from public.merchant_subscriptions s
  where coalesce(s.trial_end_at, now() - interval '1 day') <= now()
    and (s.next_due_at is null or s.next_due_at <= now());
$$;

grant execute on function public.list_merchants_due_for_charge() to authenticated;

-- Optional helper: mark subscriptions as expired when overdue by > 7 days (grace to expired)
create or replace function public.mark_overdue_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int := 0;
begin
  update public.merchant_subscriptions
  set status = 'expired'
  where status in ('active','grace')
    and next_due_at is not null
    and next_due_at <= now() - interval '7 days';
  get diagnostics v_count = row_count;
  return v_count;
end;$$;

grant execute on function public.mark_overdue_subscriptions() to authenticated;
