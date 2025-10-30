-- Ensure only one active order per driver + safe accept RPC

-- 1) Unique partial index: one active order per driver
create unique index if not exists uq_one_active_order_per_driver
on public.orders (driver_id)
where status in ('heading_to_merchant','picked_up','heading_to_customer','on_the_way');

-- 2) Safe accept RPC with atomic checks
create or replace function public.accept_order_safe(p_order_id uuid)
returns table (accepted boolean, message text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_count int;
  v_driver uuid := auth.uid();
begin
  -- Check existing active order for this driver
  select count(*) into v_active_count
  from public.orders
  where driver_id = v_driver
    and status in ('heading_to_merchant','picked_up','heading_to_customer','on_the_way');

  if v_active_count > 0 then
    accepted := false;
    message := 'لديك طلب نشط بالفعل. لا يمكنك قبول طلب آخر الآن.';
    return next; return;
  end if;

  -- Accept order only if not assigned and is acceptable status
  update public.orders
  set driver_id = v_driver,
      status = 'heading_to_merchant',
      updated_at = now()
  where id = p_order_id
    and (driver_id is null or driver_id = v_driver)
    and status in ('ready','out_for_delivery','accepted')
  returning true, 'تم قبول الطلب بنجاح' into accepted, message;

  if not found then
    accepted := false;
    message := 'تعذر قبول الطلب. ربما تم قبوله من شخص آخر.';
  end if;

  return next;
end; $$;

grant execute on function public.accept_order_safe(uuid) to authenticated;
