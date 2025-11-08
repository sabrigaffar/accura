-- Fix ambiguous reference to "message" in accept_order_safe by qualifying selected columns
-- This replaces the function and aliases driver_can_accept result as d.allowed, d.message

BEGIN;

create or replace function public.accept_order_safe(p_order_id uuid)
returns table (accepted boolean, message text)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_active_count int;
  v_driver uuid := auth.uid();
  v_wallet_id uuid;
  v_can boolean; 
  v_msg text;
  v_hold_amount numeric := 0;
  v_order record;
  v_km_fee numeric := 0;
  v_service numeric := 0;
  v_payment_method text;
begin
  -- Gate by driver_can_accept
  select d.allowed, d.message into v_can, v_msg from public.driver_can_accept(50) as d;
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

  -- Compute per-km fee and service (if CASH)
  v_km_fee := coalesce(v_order.delivery_fee,0) / 10.0; -- 1 جنيه لكل كم (10 جنيه لكل كم)
  v_payment_method := coalesce((v_order.payment_method)::text, 'cash');
  v_service := case when v_payment_method = 'cash' then coalesce(v_order.service_fee,2.5) else 0 end;
  v_hold_amount := v_km_fee + v_service;

  -- Place hold on driver wallet (captured/released at delivery time)
  if v_hold_amount > 0 then
    insert into public.wallet_holds(wallet_id, amount, related_order_id)
    values (v_wallet_id, v_hold_amount, p_order_id);
    insert into public.wallet_transactions(wallet_id, type, amount, memo, related_order_id)
    values (v_wallet_id, 'hold', v_hold_amount, 'حجز رسوم المنصة المتوقعة (لكل كم + الخدمة إن كانت CASH)', p_order_id);
  end if;

  accepted := true; message := 'تم قبول الطلب بنجاح'; return next; return;
end; $$;

grant execute on function public.accept_order_safe(uuid) to authenticated;

COMMIT;
