-- Ensure unique order_id in driver_earnings for idempotent upserts
CREATE UNIQUE INDEX IF NOT EXISTS ux_driver_earnings_order ON driver_earnings(order_id);
