-- View to expose only merchants with active (or in-trial) subscriptions
-- Criteria: merchants.is_active = true AND (
--   (subscription.status='active' AND (next_due_at IS NULL OR next_due_at > now()))
--   OR (trial_end_at IS NOT NULL AND trial_end_at > now())
-- )

create or replace view public.active_merchants_public as
select m.*
from public.merchants m
join public.merchant_subscriptions s
  on s.merchant_id = m.id
where m.is_active = true
  and (
    (s.status = 'active' and (s.next_due_at is null or s.next_due_at > now()))
    or (s.trial_end_at is not null and s.trial_end_at > now())
  );

comment on view public.active_merchants_public is 'Merchants visible to customers: only active or within trial subscription';

-- Optional: convenience index if not present
create index if not exists idx_merchant_subscriptions_merchant on public.merchant_subscriptions(merchant_id);
