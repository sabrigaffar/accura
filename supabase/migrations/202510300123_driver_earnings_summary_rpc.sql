-- Function to return driver earnings summary (today/week/month/total) for authenticated driver
-- Uses SECURITY DEFINER to allow aggregate reads regardless of RLS restrictions on driver_earnings

create or replace function public.get_driver_earnings_summary()
returns table (
  today_earnings numeric,
  today_deliveries integer,
  week_earnings numeric,
  week_deliveries integer,
  month_earnings numeric,
  month_deliveries integer,
  total_earnings numeric,
  total_deliveries integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_driver uuid := auth.uid();
  v_today_start timestamptz := date_trunc('day', now());
  v_week_start timestamptz := date_trunc('week', now());
  v_month_start timestamptz := date_trunc('month', now());
begin
  -- Today
  select coalesce(sum(amount), 0), count(*)
  into today_earnings, today_deliveries
  from public.driver_earnings
  where driver_id = v_driver
    and earned_at >= v_today_start;

  -- Week
  select coalesce(sum(amount), 0), count(*)
  into week_earnings, week_deliveries
  from public.driver_earnings
  where driver_id = v_driver
    and earned_at >= v_week_start;

  -- Month
  select coalesce(sum(amount), 0), count(*)
  into month_earnings, month_deliveries
  from public.driver_earnings
  where driver_id = v_driver
    and earned_at >= v_month_start;

  -- Total
  select coalesce(sum(amount), 0), count(*)
  into total_earnings, total_deliveries
  from public.driver_earnings
  where driver_id = v_driver;

  return next;
end;
$$;

grant execute on function public.get_driver_earnings_summary() to authenticated;
