-- RPC to create or fetch a chat conversation for an order by the authenticated driver
-- Returns a single row with the created/found conversation id

create or replace function public.create_chat_conversation(p_order_id uuid)
returns table (id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_driver_id uuid;
  v_customer_id uuid;
  v_convo_id uuid;
begin
  -- Fetch order details
  select o.driver_id, o.customer_id
  into v_driver_id, v_customer_id
  from public.orders o
  where o.id = p_order_id;

  if v_driver_id is null then
    raise exception 'Order % not found or has no driver assigned', p_order_id using errcode = 'P0001';
  end if;

  -- Ensure the caller is the assigned driver
  if v_driver_id <> auth.uid() then
    raise exception 'Not allowed: caller is not the assigned driver for order %', p_order_id using errcode = 'P0001';
  end if;

  -- Return existing conversation if present
  select c.id
  into v_convo_id
  from public.chat_conversations c
  where c.order_id = p_order_id
  limit 1;

  if v_convo_id is not null then
    id := v_convo_id;
    return next;
    return;
  end if;

  -- Create new conversation
  insert into public.chat_conversations(order_id, customer_id, driver_id)
  values (p_order_id, v_customer_id, v_driver_id)
  returning id into v_convo_id;

  id := v_convo_id;
  return next;
end;
$$;

-- Allow authenticated users (drivers) to call it; security enforced inside function
grant execute on function public.create_chat_conversation(uuid) to authenticated;
