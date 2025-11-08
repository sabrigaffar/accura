-- Migration: Maintain orders.items_count via triggers on order_items
-- Safe, non-destructive. Sets items_count to number of distinct lines (COUNT(*)), not sum of quantities.

BEGIN;

-- 1) Helper function to recompute items_count for a single order
CREATE OR REPLACE FUNCTION public.recompute_order_items_count(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders o
  SET items_count = COALESCE(sub.cnt, 0)
  FROM (
    SELECT oi.order_id, COUNT(*)::int AS cnt
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
    GROUP BY oi.order_id
  ) AS sub
  WHERE o.id = p_order_id;

  -- Ensure orders with no items get zero
  UPDATE public.orders o
  SET items_count = 0
  WHERE o.id = p_order_id AND o.items_count IS NULL;
END;
$$;

-- 2) Trigger function to handle INSERT/UPDATE/DELETE on order_items
CREATE OR REPLACE FUNCTION public.trg_orders_items_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_order_items_count(NEW.order_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_order_items_count(OLD.order_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.order_id IS DISTINCT FROM OLD.order_id THEN
      PERFORM public.recompute_order_items_count(OLD.order_id);
      PERFORM public.recompute_order_items_count(NEW.order_id);
    ELSE
      PERFORM public.recompute_order_items_count(NEW.order_id);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- 3) Create triggers (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'order_items_items_count_aiud'
  ) THEN
    CREATE TRIGGER order_items_items_count_aiud
    AFTER INSERT OR UPDATE OR DELETE ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION public.trg_orders_items_count();
  END IF;
END
$$;

-- 4) Backfill existing orders
DO $$
DECLARE
  _r RECORD;
BEGIN
  FOR _r IN SELECT id FROM public.orders LOOP
    PERFORM public.recompute_order_items_count(_r.id);
  END LOOP;
END $$;

COMMIT;
