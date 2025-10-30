-- Platform revenue summary and upcoming billing notifications RPCs

-- Revenue summary from admin wallet transactions
create or replace function public.get_platform_revenue_summary()
returns table (
  total_in numeric,
  subscriptions_in numeric,
  per_km_in numeric,
  service_fee_in numeric,
  other_in numeric
) language sql security definer set search_path = public, pg_temp as $$
  with admin_wallet as (
    select id from public.wallets where owner_type='admin' limit 1
  ), tx as (
    select t.* from public.wallet_transactions t where t.wallet_id = (select id from admin_wallet)
  )
  select 
    coalesce(sum(case when type in ('transfer_in','deposit','capture') then amount else 0 end),0) as total_in,
    coalesce(sum(case when memo ilike '%اشتراك تاجر%' then amount else 0 end),0) as subscriptions_in,
    coalesce(sum(case when memo ilike '%لكل كم%' then amount else 0 end),0) as per_km_in,
    coalesce(sum(case when memo ilike '%الخدمة%' then amount else 0 end),0) as service_fee_in,
    coalesce(sum(case when memo ilike '%اشتراك تاجر%' or memo ilike '%لكل كم%' or memo ilike '%الخدمة%' then 0 else amount end),0) as other_in
  from tx;
$$;

grant execute on function public.get_platform_revenue_summary() to authenticated;

-- Upcoming notifications within 2 days (trial end or next due)
create or replace function public.list_upcoming_billing_notifications()
returns table (
  merchant_id uuid,
  merchant_name text,
  event text,
  due_at timestamptz
) language sql security definer set search_path = public, pg_temp as $$
  select m.id, m.name_ar::text as merchant_name,
         case 
           when s.trial_end_at is not null and s.trial_end_at <= now() + interval '2 days' and s.trial_end_at > now() then 'trial_ending'
           when s.next_due_at is not null and s.next_due_at <= now() + interval '2 days' and s.status <> 'expired' then 'subscription_due'
           else 'none'
         end as event,
         coalesce(
           case when s.trial_end_at is not null and s.trial_end_at <= now() + interval '2 days' and s.trial_end_at > now() then s.trial_end_at end,
           case when s.next_due_at is not null and s.next_due_at <= now() + interval '2 days' then s.next_due_at end
         ) as due_at
  from public.merchant_subscriptions s
  join public.merchants m on m.id = s.merchant_id
  where (
    (s.trial_end_at is not null and s.trial_end_at <= now() + interval '2 days' and s.trial_end_at > now())
    or (s.next_due_at is not null and s.next_due_at <= now() + interval '2 days' and s.status <> 'expired')
  );
$$;

grant execute on function public.list_upcoming_billing_notifications() to authenticated;
