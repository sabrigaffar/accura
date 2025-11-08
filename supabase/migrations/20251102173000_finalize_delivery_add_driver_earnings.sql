-- Ensure finalize_delivery_tx records driver earnings so UI summaries update
-- Adds idempotent INSERT into driver_earnings inside finalize_delivery_tx

BEGIN;

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
  v_exists boolean := false;
begin
  -- Load order (and basic sanity)
  select * into v_order from public.orders where id = p_order_id and driver_id = v_driver;
  if not found then ok := false; message := 'الطلب غير موجود أو غير متعلق بك'; return next; return; end if;

  v_platform_service_fee := coalesce(v_order.service_fee, 2.5);
  -- Prefer explicit delivery_fee, fallback to calculated_delivery_fee, then compute from distance
  v_driver_delivery_fee := coalesce(v_order.delivery_fee, 0);
  if coalesce(v_driver_delivery_fee, 0) <= 0 then
    v_driver_delivery_fee := coalesce(v_order.calculated_delivery_fee, 0);
  end if;
  if coalesce(v_driver_delivery_fee, 0) <= 0 then
    v_driver_delivery_fee := coalesce(public.calculate_delivery_fee(v_order.delivery_distance_km), 0);
  end if;
  -- ensure non-negative
  if v_driver_delivery_fee < 0 then v_driver_delivery_fee := 0; end if;
  v_payment_method := coalesce((v_order.payment_method)::text, 'cash');
  v_km_fee := v_driver_delivery_fee / 10.0; -- 1 جنيه لكل كم
  v_expected_hold := v_km_fee + case when v_payment_method = 'cash' then v_platform_service_fee else 0 end;

  -- Wallet ids
  select id into v_driver_wallet from public.wallets where owner_id = v_driver and owner_type = 'driver';
  if v_driver_wallet is null then v_driver_wallet := public.create_wallet_if_missing(v_driver, 'driver', 30); end if;
  -- Admin wallet: ensure one admin wallet exists
  select id into v_admin_wallet from public.wallets where owner_type = 'admin' limit 1;
  if v_admin_wallet is null then
    insert into public.wallets(owner_id, owner_type, balance) values (gen_random_uuid(), 'admin', 0) returning id into v_admin_wallet;
  end if;

  -- Fetch active hold
  select * into v_hold from public.wallet_holds where related_order_id = p_order_id and status = 'active' limit 1;

  -- 1) Credit driver earnings (delivery_fee) to wallet
  update public.wallets set balance = balance + v_driver_delivery_fee where id = v_driver_wallet;
  insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
  values (v_driver_wallet, 'deposit', v_driver_delivery_fee, 'أرباح التوصيل', p_order_id);

  -- 1.b) Record driver_earnings row (idempotent)
  select exists(
    select 1 from public.driver_earnings de where de.driver_id = v_driver and de.order_id = p_order_id
  ) into v_exists;
  if not v_exists then
    insert into public.driver_earnings(driver_id, order_id, amount, earned_at)
    values (v_driver, p_order_id, v_driver_delivery_fee, v_now);
    -- Harmonize legacy columns if present to satisfy old NOT NULL constraints
    -- total_earning
    if exists (
      select 1 from information_schema.columns 
      where table_schema='public' and table_name='driver_earnings' and column_name='total_earning'
    ) then
      update public.driver_earnings
      set total_earning = coalesce(total_earning, v_driver_delivery_fee)
      where driver_id = v_driver and order_id = p_order_id;
    end if;
    -- net_amount
    if exists (
      select 1 from information_schema.columns 
      where table_schema='public' and table_name='driver_earnings' and column_name='net_amount'
    ) then
      update public.driver_earnings
      set net_amount = coalesce(net_amount, v_driver_delivery_fee)
      where driver_id = v_driver and order_id = p_order_id;
    end if;
    -- commission_amount
    if exists (
      select 1 from information_schema.columns 
      where table_schema='public' and table_name='driver_earnings' and column_name='commission_amount'
    ) then
      update public.driver_earnings
      set commission_amount = coalesce(commission_amount, 0)
      where driver_id = v_driver and order_id = p_order_id;
    end if;
    -- status
    if exists (
      select 1 from information_schema.columns 
      where table_schema='public' and table_name='driver_earnings' and column_name='status'
    ) then
      update public.driver_earnings
      set status = coalesce(status, 'completed')
      where driver_id = v_driver and order_id = p_order_id;
    end if;
    -- timestamps
    if exists (
      select 1 from information_schema.columns 
      where table_schema='public' and table_name='driver_earnings' and column_name='updated_at'
    ) then
      update public.driver_earnings
      set updated_at = v_now
      where driver_id = v_driver and order_id = p_order_id;
    end if;
  end if;

  -- 2) Platform fees settlement
  if v_payment_method = 'cash' then
    -- Capture (km_fee + service_fee) from hold to admin
    if v_hold.id is not null then
      update public.wallet_holds set status = 'captured', captured_at = v_now where id = v_hold.id;
      insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      values (v_driver_wallet, 'capture', v_hold.amount, 'تحصيل رسوم المنصة (CASH)', p_order_id);
      update public.wallets set balance = balance + v_hold.amount where id = v_admin_wallet;
      insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      values (v_admin_wallet, 'transfer_in', v_hold.amount, 'رسوم المنصة من السائق (CASH)', p_order_id);
    end if;
  else
    -- Online (card/wallet): capture km_fee only; no service fee from driver
    if v_hold.id is not null then
      update public.wallet_holds set status = 'captured', captured_at = v_now where id = v_hold.id;
      insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      values (v_driver_wallet, 'capture', v_km_fee, 'تحصيل رسوم المنصة لكل كم (أونلاين)', p_order_id);
      update public.wallets set balance = balance + v_km_fee where id = v_admin_wallet;
      insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      values (v_admin_wallet, 'transfer_in', v_km_fee, 'رسوم المنصة لكل كم (أونلاين)', p_order_id);
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

COMMIT;
