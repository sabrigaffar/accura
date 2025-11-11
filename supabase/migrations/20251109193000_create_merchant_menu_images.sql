-- Create merchant_menu_images table for multiple menu images per merchant
create table if not exists public.merchant_menu_images (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  image_url text not null,
  sort_order int default 0,
  created_at timestamptz not null default now()
);

alter table public.merchant_menu_images enable row level security;

-- Public read access (customers need to view menu images)
drop policy if exists "Public read menu images" on public.merchant_menu_images;
create policy "Public read menu images"
  on public.merchant_menu_images
  for select
  using (true);

-- Only merchant owner can insert/update/delete their menu images
drop policy if exists "Owner can manage menu images" on public.merchant_menu_images;
create policy "Owner can manage menu images"
  on public.merchant_menu_images
  for all
  using (
    exists (
      select 1 from public.merchants m
      where m.id = merchant_menu_images.merchant_id
        and m.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.merchants m
      where m.id = merchant_menu_images.merchant_id
        and m.owner_id = auth.uid()
    )
  );

-- Helpful indexes
create index if not exists merchant_menu_images_merchant_id_idx on public.merchant_menu_images(merchant_id);
create index if not exists merchant_menu_images_sort_idx on public.merchant_menu_images(merchant_id, sort_order, created_at);
