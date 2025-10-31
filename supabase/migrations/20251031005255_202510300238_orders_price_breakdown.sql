-- Add price breakdown columns to orders and helpful views

alter table public.orders
add column if not exists product_total numeric,
add column if not exists delivery_fee numeric,
add column if not exists service_fee numeric,
add column if not exists tax_amount numeric,
add column if not exists customer_total numeric;

-- Optional consistency check
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_total_consistency'
  ) then
    alter table public.orders
    add constraint orders_total_consistency check (
      customer_total is null or customer_total = coalesce(product_total,0) + coalesce(delivery_fee,0) + coalesce(service_fee,0) + coalesce(tax_amount,0)
    );
  end if;
end $$;

-- Merchant view: what the merchant should see as revenue for the order
create or replace view public.merchant_orders_view as
select
  o.*,
  (coalesce(o.product_total,0) + coalesce(o.tax_amount,0)) as merchant_total
from public.orders o;

-- Driver view: what should be payable to the driver
create or replace view public.driver_orders_view as
select
  o.*,
  (coalesce(o.customer_total,0) - coalesce(o.service_fee,0)) as driver_payable
from public.orders o;
