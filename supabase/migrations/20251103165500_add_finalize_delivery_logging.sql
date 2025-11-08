-- Add logging to finalize_delivery_tx to debug merchant settlement issues
-- This will help identify why merchant wallet is not credited
-- Date: 2025-11-03

BEGIN;

CREATE OR REPLACE FUNCTION public.finalize_delivery_tx(p_order_id uuid)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_driver uuid := auth.uid();
  v_order public.orders;
  v_driver_wallet uuid;
  v_merchant_wallet uuid;
  v_admin_wallet uuid;
  v_hold public.wallet_holds;
  v_platform_service_fee numeric;
  v_driver_delivery_fee numeric;
  v_payment_method text;
  v_now timestamptz := now();
  v_km_fee numeric := 0;
  v_expected_hold numeric := 0;
  v_exists boolean := false;
  v_driver_deposit_exists boolean := false;
  v_merchant_tx_exists boolean := false;
  v_platform_capture_exists boolean := false;
  v_product_amount numeric := 0;
  v_tax_amount numeric := 0;
  v_merchant_amount numeric := 0;
  v_customer_total numeric := 0;
  v_capture_amount numeric := 0;
  v_commission_total numeric := 0;
begin
  -- Load order (and basic sanity)
  select * into v_order from public.orders where id = p_order_id and driver_id = v_driver;
  if not found then ok := false; message := 'الطلب غير موجود أو غير متعلق بك'; return next; return; end if;

  v_platform_service_fee := coalesce(v_order.service_fee, 2.5);
  v_driver_delivery_fee := coalesce(v_order.delivery_fee, 0);
  if coalesce(v_driver_delivery_fee, 0) <= 0 then
    v_driver_delivery_fee := coalesce(v_order.calculated_delivery_fee, 0);
  end if;
  if coalesce(v_driver_delivery_fee, 0) <= 0 then
    v_driver_delivery_fee := coalesce(public.calculate_delivery_fee(v_order.delivery_distance_km), 0);
  end if;
  if v_driver_delivery_fee < 0 then v_driver_delivery_fee := 0; end if;

  v_payment_method := coalesce((v_order.payment_method)::text, 'cash');
  v_km_fee := v_driver_delivery_fee / 10.0;
  v_expected_hold := v_km_fee + case when v_payment_method = 'cash' then v_platform_service_fee else 0 end;

  v_product_amount := coalesce(v_order.product_total, v_order.subtotal, 0);
  v_tax_amount := coalesce(v_order.tax_amount, v_order.tax, 0);
  v_merchant_amount := greatest(v_product_amount + v_tax_amount, 0);
  v_customer_total := coalesce(v_order.customer_total, v_order.total, 0);
  v_capture_amount := coalesce(v_customer_total, v_driver_delivery_fee + v_merchant_amount + v_platform_service_fee);

  -- ✅ Debug logging
  RAISE NOTICE 'finalize_delivery_tx: order_id=%, payment_method=%, merchant_id=%, product_amount=%, tax_amount=%, merchant_amount=%',
    p_order_id, v_payment_method, v_order.merchant_id, v_product_amount, v_tax_amount, v_merchant_amount;

  -- Wallet ids
  select id into v_driver_wallet from public.wallets where owner_id = v_driver and owner_type = 'driver';
  if v_driver_wallet is null then v_driver_wallet := public.create_wallet_if_missing(v_driver, 'driver', 30); end if;

  if v_order.merchant_id is not null then
    select id into v_merchant_wallet from public.wallets where owner_id = v_order.merchant_id and owner_type = 'merchant';
    if v_merchant_wallet is null then v_merchant_wallet := public.create_wallet_if_missing(v_order.merchant_id, 'merchant', 30); end if;
    RAISE NOTICE 'finalize_delivery_tx: merchant_wallet_id=%', v_merchant_wallet;
  else
    RAISE NOTICE 'finalize_delivery_tx: merchant_id is NULL!';
  end if;

  select id into v_admin_wallet from public.wallets where owner_type = 'admin' limit 1;
  if v_admin_wallet is null then
    insert into public.wallets(owner_id, owner_type, balance) values (gen_random_uuid(), 'admin', 0) returning id into v_admin_wallet;
  end if;

  select * into v_hold from public.wallet_holds where related_order_id = p_order_id and status = 'active' limit 1;

  -- Calculate commission upfront
  if v_payment_method = 'cash' then
    v_commission_total := v_km_fee + v_platform_service_fee;
  else
    v_commission_total := v_km_fee;
  end if;

  -- 1) Credit driver earnings
  select exists(
    select 1 from public.wallet_transactions wt 
    where wt.wallet_id = v_driver_wallet and wt.related_order_id = p_order_id and wt.type = 'deposit'
  ) into v_driver_deposit_exists;
  if not v_driver_deposit_exists then
    update public.wallets set balance = balance + v_driver_delivery_fee where id = v_driver_wallet;
    insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
    values (v_driver_wallet, 'deposit', v_driver_delivery_fee, 'أرباح التوصيل', p_order_id);
  end if;

  -- 1.b) Record driver_earnings
  select exists(
    select 1 from public.driver_earnings de where de.driver_id = v_driver and de.order_id = p_order_id
  ) into v_exists;
  if not v_exists then
    insert into public.driver_earnings(driver_id, order_id, amount, commission_amount, net_amount, earned_at)
    values (v_driver, p_order_id, v_driver_delivery_fee, v_commission_total, greatest(v_driver_delivery_fee - v_commission_total, 0), v_now)
    on conflict (driver_id, order_id) do nothing;
  end if;

  -- 1.c) Credit merchant settlement (product + tax) for ONLINE ONLY
  if v_payment_method in ('card','wallet') then
    RAISE NOTICE 'finalize_delivery_tx: Payment is card/wallet, checking merchant settlement...';
    if v_merchant_wallet is not null and v_merchant_amount > 0 then
      select exists(
        select 1 from public.wallet_transactions wt
        where wt.wallet_id = v_merchant_wallet and wt.related_order_id = p_order_id and wt.type = 'transfer_in'
      ) into v_merchant_tx_exists;
      if not v_merchant_tx_exists then
        RAISE NOTICE 'finalize_delivery_tx: Crediting merchant wallet % with amount %', v_merchant_wallet, v_merchant_amount;
        update public.wallets set balance = balance + v_merchant_amount where id = v_merchant_wallet;
        insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
        values (v_merchant_wallet, 'transfer_in', v_merchant_amount, 'Merchant settlement (product+tax)', p_order_id);
      else
        RAISE NOTICE 'finalize_delivery_tx: Merchant already credited (idempotent skip)';
      end if;
    else
      RAISE NOTICE 'finalize_delivery_tx: Skipping merchant credit - wallet=%, amount=%', v_merchant_wallet, v_merchant_amount;
    end if;
  else
    RAISE NOTICE 'finalize_delivery_tx: Payment method is %, skipping merchant settlement', v_payment_method;
  end if;

  -- 2) Platform fees settlement and captures
  if v_payment_method = 'cash' then
    if v_hold.id is not null then
      update public.wallet_holds set status = 'captured', captured_at = v_now where id = v_hold.id;
      insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      values (v_driver_wallet, 'capture', v_hold.amount, 'تحصيل رسوم المنصة (CASH)', p_order_id);
      update public.wallets set balance = balance - v_hold.amount where id = v_driver_wallet;
      update public.wallets set balance = balance + v_hold.amount where id = v_admin_wallet;
      insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      values (v_admin_wallet, 'transfer_in', v_hold.amount, 'رسوم المنصة من السائق (CASH)', p_order_id);
    end if;
  else
    if v_hold.id is not null then
      update public.wallet_holds set status = 'captured', captured_at = v_now where id = v_hold.id;
      insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      values (v_driver_wallet, 'capture', v_km_fee, 'تحصيل رسوم المنصة لكل كم (أونلاين)', p_order_id);
      update public.wallets set balance = balance - v_km_fee where id = v_driver_wallet;
      update public.wallets set balance = balance + v_km_fee where id = v_admin_wallet;
      insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      values (v_admin_wallet, 'transfer_in', v_km_fee, 'رسوم المنصة لكل كم (أونلاين)', p_order_id);
      if v_hold.amount > v_km_fee then
        insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
        values (v_driver_wallet, 'release', (v_hold.amount - v_km_fee), 'إرجاع الفارق من الحجز', p_order_id);
      end if;
    end if;

    select exists(
      select 1 from public.wallet_transactions wt
      where wt.wallet_id = v_admin_wallet and wt.related_order_id = p_order_id and wt.type = 'capture'
    ) into v_platform_capture_exists;
    if not v_platform_capture_exists then
      insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
      values (v_admin_wallet, 'capture', v_capture_amount, 'Card capture', p_order_id);
      update public.wallets set balance = balance + v_platform_service_fee where id = v_admin_wallet;
    end if;
  end if;

  update public.orders set status = 'delivered', updated_at = v_now where id = p_order_id and status in ('on_the_way','picked_up','heading_to_customer');

  ok := true; message := 'تم إنهاء التسليم وتسوية الرسوم'; return next; return;
end; $$;

GRANT EXECUTE ON FUNCTION public.finalize_delivery_tx(uuid) TO authenticated;

COMMIT;
