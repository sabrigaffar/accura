-- Wallets, Transactions, Holds, Subscriptions, and RPCs

-- 1) Wallets
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  owner_type text not null check (owner_type in ('driver','merchant','customer','admin')),
  balance numeric not null default 0,
  currency text not null default 'EGP',
  trial_start_at timestamptz,
  trial_end_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, owner_type)
);

-- 2) Wallet Transactions
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  type text not null check (type in ('deposit','withdraw','hold','release','capture','transfer_in','transfer_out','adjust')),
  amount numeric not null,
  currency text not null default 'EGP',
  memo text,
  related_order_id uuid,
  created_at timestamptz not null default now()
);

-- 3) Wallet Holds (optional but recommended)
create table if not exists public.wallet_holds (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  amount numeric not null,
  related_order_id uuid not null,
  status text not null check (status in ('active','released','captured')) default 'active',
  created_at timestamptz not null default now(),
  captured_at timestamptz,
  released_at timestamptz
);
create index if not exists idx_wallet_holds_wallet on public.wallet_holds(wallet_id);
create index if not exists idx_wallet_holds_order on public.wallet_holds(related_order_id);

-- 4) Merchant Subscriptions
create table if not exists public.merchant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  monthly_fee numeric not null default 100,
  status text not null check (status in ('active','grace','expired')) default 'active',
  trial_end_at timestamptz,
  last_paid_at timestamptz,
  next_due_at timestamptz,
  created_at timestamptz not null default now(),
  unique (merchant_id)
);

-- Helper: ensure wallet exists
create or replace function public.create_wallet_if_missing(p_owner uuid, p_type text, p_trial_days int default 30)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.wallets where owner_id = p_owner and owner_type = p_type;
  if v_id is null then
    insert into public.wallets(owner_id, owner_type, trial_start_at, trial_end_at)
    values (p_owner, p_type, now(), now() + make_interval(days => coalesce(p_trial_days,30)))
    returning id into v_id;
  end if;
  return v_id;
end; $$;

grant execute on function public.create_wallet_if_missing(uuid, text, int) to authenticated;

-- Driver can accept? min 50 after trial
create or replace function public.driver_can_accept(p_min numeric default 50)
returns table(allowed boolean, message text)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_driver uuid := auth.uid();
  v_wallet public.wallets;
  v_now timestamptz := now();
begin
  select * into v_wallet from public.wallets where owner_id = v_driver and owner_type = 'driver';
  if v_wallet is null then
    perform public.create_wallet_if_missing(v_driver, 'driver', 30);
    select * into v_wallet from public.wallets where owner_id = v_driver and owner_type = 'driver';
  end if;

  if v_wallet.trial_end_at is not null and v_now <= v_wallet.trial_end_at then
    allowed := true; message := 'خلال الفترة التجريبية يمكن القبول دون حد أدنى'; return next; return;
  end if;

  if coalesce(v_wallet.balance,0) >= coalesce(p_min,50) then
    allowed := true; message := 'يمكنك قبول الطلب'; return next; return;
  else
    allowed := false; message := 'لا يمكنك قبول الطلبات: الحد الأدنى للمحفظة 50 جنيه'; return next; return;
  end if;
end; $$;

grant execute on function public.driver_can_accept(numeric) to authenticated;

-- Update accept_order_safe to also gate by driver_can_accept and create a 3.5 hold
create or replace function public.accept_order_safe(p_order_id uuid)
returns table (accepted boolean, message text)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_active_count int;
  v_driver uuid := auth.uid();
  v_wallet_id uuid;
  v_can boolean; v_msg text;
  v_hold_amount numeric := 0;
  v_order record;
  v_km_fee numeric := 0;
  v_service numeric := 0;
begin
  -- Gate by driver_can_accept
  select allowed, message into v_can, v_msg from public.driver_can_accept(50);
  if not v_can then
    accepted := false; message := v_msg; return next; return;
  end if;

  -- Prevent multiple active orders
  select count(*) into v_active_count
  from public.orders
  where driver_id = v_driver
    and status in ('heading_to_merchant','picked_up','heading_to_customer','on_the_way');
  if v_active_count > 0 then
    accepted := false; message := 'لديك طلب نشط بالفعل. لا يمكنك قبول طلب آخر الآن.'; return next; return;
  end if;

  -- Assign order atomically
  update public.orders
  set driver_id = v_driver,
      status = 'heading_to_merchant',
      updated_at = now()
  where id = p_order_id
    and (driver_id is null or driver_id = v_driver)
    and status in ('ready','out_for_delivery','accepted')
  returning * into v_order;

  if not found then
    accepted := false; message := 'تعذر قبول الطلب. ربما تم قبوله من شخص آخر.'; return next; return;
  end if;

  -- Create driver wallet if missing
  select public.create_wallet_if_missing(v_driver, 'driver', 30) into v_wallet_id;

  -- Compute per-km fee and service (if COD)
  v_km_fee := coalesce(v_order.delivery_fee,0) / 10.0; -- 1 جنيه لكل كيلو (10 جنيه لكل كم)
  v_service := case when coalesce(v_order.payment_method,'cod') = 'cod' then coalesce(v_order.service_fee,2.5) else 0 end;
  v_hold_amount := v_km_fee + v_service;

  -- Place hold on driver wallet (captured/released at delivery time)
  if v_hold_amount > 0 then
    insert into public.wallet_holds(wallet_id, amount, related_order_id)
    values (v_wallet_id, v_hold_amount, p_order_id);
    insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
    values (v_wallet_id, 'hold', v_hold_amount, 'حجز رسوم المنصة المتوقعة (لكل كم + الخدمة إن كانت COD)', p_order_id);
  end if;

  accepted := true; message := 'تم قبول الطلب بنجاح'; return next; return;
end; $$;

grant execute on function public.accept_order_safe(uuid) to authenticated;

-- Finalize delivery: settle driver earnings and platform fees
create or replace function public.finalize_delivery_tx(p_order_id uuid)
returns table (ok boolean, message text)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_driver uuid := auth.uid();
  v_order public.orders;
  v_driver_wallet uuid;
  v_admin_wallet uuid;
  v_hold public.wallet_holds;
  v_platform_service_fee numeric;
  v_driver_delivery_fee numeric;
  v_payment_method text;
  v_now timestamptz := now();
  v_km_fee numeric := 0;
  v_expected_hold numeric := 0;
begin
  -- Load order (and basic sanity)
  select * into v_order from public.orders where id = p_order_id and driver_id = v_driver;
  if not found then ok := false; message := 'الطلب غير موجود أو غير متعلق بك'; return next; return; end if;

  v_platform_service_fee := coalesce(v_order.service_fee, 2.5);
  v_driver_delivery_fee := coalesce(v_order.delivery_fee, 0);
  v_payment_method := coalesce(v_order.payment_method, 'cod');
  v_km_fee := v_driver_delivery_fee / 10.0; -- 1 جنيه لكل كم
  v_expected_hold := v_km_fee + case when v_payment_method = 'cod' then v_platform_service_fee else 0 end;

  -- Wallet ids
  select id into v_driver_wallet from public.wallets where owner_id = v_driver and owner_type = 'driver';
  if v_driver_wallet is null then v_driver_wallet := public.create_wallet_if_missing(v_driver, 'driver', 30); end if;
  -- Admin wallet: ensure one admin wallet exists (for simplicity pick first or create)
  select id into v_admin_wallet from public.wallets where owner_type = 'admin' limit 1;
  if v_admin_wallet is null then
    -- Create a generic admin wallet (owner_id can be null)
    insert into public.wallets(owner_id, owner_type, balance) values (gen_random_uuid(), 'admin', 0) returning id into v_admin_wallet;
  end if;

  -- Fetch active hold
  select * into v_hold from public.wallet_holds where related_order_id = p_order_id and status = 'active' limit 1;

  -- 1) Credit driver earnings (delivery_fee)
  update public.wallets set balance = balance + v_driver_delivery_fee where id = v_driver_wallet;
  insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
  values (v_driver_wallet, 'deposit', v_driver_delivery_fee, 'أرباح التوصيل', p_order_id);

  -- 2) Platform fees settlement
  if v_payment_method = 'cod' then
    -- Capture (km_fee + service_fee) from hold to admin
    if v_hold.id is not null then
      update public.wallet_holds set status = 'captured', captured_at = v_now where id = v_hold.id;
      insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      values (v_driver_wallet, 'capture', v_hold.amount, 'تحصيل رسوم المنصة (COD)', p_order_id);
      update public.wallets set balance = balance + v_hold.amount where id = v_admin_wallet;
      insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      values (v_admin_wallet, 'transfer_in', v_hold.amount, 'رسوم المنصة من السائق (COD)', p_order_id);
    end if;
  else
    -- Online: capture km_fee only; no service fee from driver
    if v_hold.id is not null then
      -- Capture km_fee
      update public.wallet_holds set status = 'captured', captured_at = v_now where id = v_hold.id;
      insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      values (v_driver_wallet, 'capture', v_km_fee, 'تحصيل رسوم المنصة لكل كم (أونلاين)', p_order_id);
      update public.wallets set balance = balance + v_km_fee where id = v_admin_wallet;
      insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      values (v_admin_wallet, 'transfer_in', v_km_fee, 'رسوم المنصة لكل كم (أونلاين)', p_order_id);
      -- Release any remaining amount from hold (should be ~ service fee if included by mistake)
      if v_hold.amount > v_km_fee then
        insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
        values (v_driver_wallet, 'release', (v_hold.amount - v_km_fee), 'إرجاع الفارق من الحجز', p_order_id);
      end if;
    end if;
  end if;

  -- Mark order delivered
  update public.orders set status = 'delivered', updated_at = v_now where id = p_order_id and status in ('on_the_way','picked_up','heading_to_customer');

  ok := true; message := 'تم إنهاء التسليم وتسوية الرسوم'; return next; return;
end; $$;

grant execute on function public.finalize_delivery_tx(uuid) to authenticated;
