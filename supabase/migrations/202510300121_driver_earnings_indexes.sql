-- Indexes to speed up driver earnings queries
-- Latest earnings per driver, ordered by earned_at desc
create index if not exists idx_driver_earnings_driver_earned_at_desc
on public.driver_earnings (driver_id, earned_at desc);

-- Optional: index for aggregations per driver
create index if not exists idx_driver_earnings_driver_amount
on public.driver_earnings (driver_id, amount);
