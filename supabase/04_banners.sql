-- JOJOKEV storefront banners
create table if not exists public.banners (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  subtitle text,
  cta_label text,
  cta_url text,
  image_url text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists banners_active_order_idx on public.banners(is_active, sort_order);
alter table public.banners enable row level security;
drop policy if exists "Public can view active banners" on public.banners;
create policy "Public can view active banners" on public.banners for select using (is_active = true);
