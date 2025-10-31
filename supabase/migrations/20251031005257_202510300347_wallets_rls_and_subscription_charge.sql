-- RLS policies for wallets-related tables and subscription charge RPC

-- Enable RLS
alter table if exists public.wallets enable row level security;
alter table if exists public.wallet_transactions enable row level security;
alter table if exists public.wallet_holds enable row level security;
alter table if exists public.merchant_subscriptions enable row level security;

-- Helper: is_admin() - assumes you tag admin users via a table or role; here we treat presence in profiles.is_admin as admin
-- Adjust to your schema if different
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce((select user_type = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- wallets policies
do $$ begin
  if not exists (select 1 from pg_policies where tablename='wallets' and policyname='wallets_admin_all') then
    create policy wallets_admin_all on public.wallets for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='wallets' and policyname='wallets_owner_select') then
    create policy wallets_owner_select on public.wallets for select to authenticated using (owner_id = auth.uid());
  end if;
end $$;

-- wallet_transactions policies
do $$ begin
  if not exists (select 1 from pg_policies where tablename='wallet_transactions' and policyname='wallet_tx_admin_all') then
    create policy wallet_tx_admin_all on public.wallet_transactions for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='wallet_transactions' and policyname='wallet_tx_owner_select') then
    create policy wallet_tx_owner_select on public.wallet_transactions for select to authenticated using (
      wallet_id in (select id from public.wallets where owner_id = auth.uid())
    );
  end if;
end $$;

-- wallet_holds policies (read-only for owners; admin all)
do $$ begin
  if not exists (select 1 from pg_policies where tablename='wallet_holds' and policyname='wallet_holds_admin_all') then
    create policy wallet_holds_admin_all on public.wallet_holds for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='wallet_holds' and policyname='wallet_holds_owner_select') then
    create policy wallet_holds_owner_select on public.wallet_holds for select to authenticated using (
      wallet_id in (select id from public.wallets where owner_id = auth.uid())
    );
  end if;
end $$;

-- merchant_subscriptions policies (admin only by default)
do $$ begin
  if not exists (select 1 from pg_policies where tablename='merchant_subscriptions' and policyname='merchant_sub_admin_all') then
    create policy merchant_sub_admin_all on public.merchant_subscriptions for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- RPC: charge_merchant_subscription(merchant_id)
create or replace function public.charge_merchant_subscription(p_merchant_id uuid)
returns table (ok boolean, message text)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_wallet uuid;
  v_merchant_wallet uuid;
  v_sub public.merchant_subscriptions%rowtype;
  v_amount numeric := 100;
  v_now timestamptz := now();
  v_is_admin boolean := public.is_admin();
begin
  if not v_is_admin then
    ok := false; message := 'غير مصرح'; return next; return; 
  end if;

  -- find wallets
  select id into v_admin_wallet from public.wallets where owner_type='admin' limit 1;
  if v_admin_wallet is null then
    insert into public.wallets(owner_id, owner_type, balance) values (gen_random_uuid(), 'admin', 0) returning id into v_admin_wallet;
  end if;
  select id from public.wallets where owner_id = p_merchant_id and owner_type='merchant' into v_merchant_wallet;
  if v_merchant_wallet is null then
    v_merchant_wallet := public.create_wallet_if_missing(p_merchant_id, 'merchant', 30);
  end if;

  -- load subscription row
  select * into v_sub from public.merchant_subscriptions where merchant_id = p_merchant_id;
  if not found then
    ok := false; message := 'لا يوجد اشتراك للتاجر'; return next; return; 
  end if;

  -- check merchant balance
  if (select balance from public.wallets where id = v_merchant_wallet) < v_amount then
    ok := false; message := 'رصيد التاجر غير كاف'; return next; return; 
  end if;

  -- transfer 100 from merchant to admin
  update public.wallets set balance = balance - v_amount where id = v_merchant_wallet;
  insert into public.wallet_transactions(wallet_id, type, amount, memo) values (v_merchant_wallet, 'transfer_out', v_amount, 'سداد اشتراك شهري');

  update public.wallets set balance = balance + v_amount where id = v_admin_wallet;
  insert into public.wallet_transactions(wallet_id, type, amount, memo) values (v_admin_wallet, 'transfer_in', v_amount, 'اشتراك تاجر');

  -- update subscription dates
  update public.merchant_subscriptions
  set last_paid_at = v_now, next_due_at = v_now + interval '30 days', status = 'active'
  where merchant_id = p_merchant_id;

  ok := true; message := 'تم التحصيل وتحديث الاشتراك'; return next; return;
end; $$;

grant execute on function public.charge_merchant_subscription(uuid) to authenticated;
