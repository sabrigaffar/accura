-- Drop the auth.users trigger that inserts into public.profiles on signup.
-- We'll rely on the client upsert after OTP verification to create profiles.
-- Date: 2025-11-08

BEGIN;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- keep the function for manual invocation/debugging if needed
-- DROP FUNCTION IF EXISTS public.handle_new_user();

COMMIT;
