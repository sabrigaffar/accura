-- Add photo_url to driver_profiles to store driver picture
alter table if exists public.driver_profiles
add column if not exists photo_url text;
