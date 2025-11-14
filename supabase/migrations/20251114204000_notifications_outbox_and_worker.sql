-- Notifications Outbox + Worker migration
-- Date: 2025-11-14

BEGIN;

-- 1) Create push_queue table to decouple push dispatch from DB transactions
CREATE TABLE IF NOT EXISTS public.push_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending | processing | sent | failed
  attempts integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Internal table; RLS not enabled intentionally (service role worker manages it)
-- Ensure helpful indexes for the worker scan
CREATE INDEX IF NOT EXISTS idx_push_queue_status_scheduled ON public.push_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_push_queue_user ON public.push_queue(user_id);

-- 2) Drop legacy HTTP-dispatch trigger that calls pg_net from inside Postgres
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_notifications_insert_push'
  ) THEN
    DROP TRIGGER on_notifications_insert_push ON public.notifications;
  END IF;
EXCEPTION WHEN undefined_object THEN
  -- ignore
END $$;

-- Drop known function if exists
DO $$ BEGIN
  PERFORM 1 FROM pg_proc WHERE proname = 'dispatch_push_for_notification' AND pg_function_is_visible(oid);
  IF FOUND THEN
    DROP FUNCTION public.dispatch_push_for_notification();
  END IF;
EXCEPTION WHEN undefined_function THEN
  -- ignore
END $$;

-- 3) Ensure old enqueue trigger is dropped, then (re)create function and trigger
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_notifications_insert_enqueue'
  ) THEN
    DROP TRIGGER on_notifications_insert_enqueue ON public.notifications;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.notifications_queue_enqueue();
CREATE OR REPLACE FUNCTION public.notifications_queue_enqueue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'title', COALESCE(NEW.title, NEW.title_ar, NEW.title_en, 'إشعار'),
    'body', COALESCE(NEW.body, NEW.body_ar, NEW.body_en, ''),
    'type', COALESCE(NEW.type, NEW.notification_type, 'system'),
    'data', COALESCE(NEW.data, '{}'::jsonb)
  );

  INSERT INTO public.push_queue(user_id, notification_id, payload, status, attempts, scheduled_at)
  VALUES (NEW.user_id, NEW.id, v_payload, 'pending', 0, now());

  RETURN NEW;
END $$;

-- Create (or replace) the new trigger name to avoid confusion with legacy ones
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_notifications_insert_enqueue'
  ) THEN
    DROP TRIGGER on_notifications_insert_enqueue ON public.notifications;
  END IF;
END $$;

CREATE TRIGGER on_notifications_insert_enqueue
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.notifications_queue_enqueue();

-- 4) Dequeue helper for worker: claim a batch using SKIP LOCKED and mark as processing
DROP FUNCTION IF EXISTS public.dequeue_push_jobs(integer);
CREATE OR REPLACE FUNCTION public.dequeue_push_jobs(p_batch integer DEFAULT 100)
RETURNS SETOF public.push_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT id
    FROM public.push_queue
    WHERE status = 'pending' AND scheduled_at <= now()
    ORDER BY scheduled_at ASC
    LIMIT COALESCE(p_batch, 100)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.push_queue pq
  SET status = 'processing', attempts = pq.attempts + 1, updated_at = now()
  FROM cte
  WHERE pq.id = cte.id
  RETURNING pq.*;
END $$;

COMMIT;
