-- Deduplicate and enforce uniqueness on driver_earnings (driver_id, order_id)
-- NOTE: This migration runs in a single transaction (Supabase default). Avoid CONCURRENTLY here.

-- 1) Remove duplicates, keep the newest by earned_at when duplicates exist
with ranked as (
  select ctid, driver_id, order_id,
         row_number() over (partition by driver_id, order_id order by earned_at desc, ctid desc) as rn
  from public.driver_earnings
)
delete from public.driver_earnings d
using ranked r
where d.ctid = r.ctid and r.rn > 1;

-- 2) Add unique constraint to prevent future duplicates
alter table public.driver_earnings
add constraint uq_driver_earnings_driver_order unique (driver_id, order_id);
