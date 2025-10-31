-- Drivers low balance RPC for notifications
create or replace function public.list_drivers_low_balance(p_min numeric default 50)
returns table (
  driver_id uuid,
  full_name text,
  balance numeric,
  trial_end_at timestamptz
) language sql security definer set search_path = public, pg_temp as $$
  select w.owner_id as driver_id,
         p.full_name::text as full_name,
         w.balance::numeric as balance,
         w.trial_end_at
  from public.wallets w
  join public.profiles p on p.id = w.owner_id
  where w.owner_type = 'driver'
    and coalesce(w.balance,0) < coalesce(p_min,50)
    and (w.trial_end_at is null or now() > w.trial_end_at);
$$;

grant execute on function public.list_drivers_low_balance(numeric) to authenticated;
