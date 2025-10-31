-- Add delivered_at column to orders to support delivery completion timestamp
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivered_at timestamptz NULL;

-- Optional: index to speed up delivered queries and analytics
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON orders (delivered_at);

-- Comment for documentation
COMMENT ON COLUMN orders.delivered_at IS 'Timestamp when the order was delivered to the customer';
