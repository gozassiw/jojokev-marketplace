create table if not exists public.store_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  state text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, city, state)
);

alter table public.seller_profiles drop constraint if exists seller_profiles_store_area_id_fkey;
alter table public.seller_profiles add constraint seller_profiles_store_area_id_fkey foreign key (store_area_id) references public.store_areas(id) on delete set null;
