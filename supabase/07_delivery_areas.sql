-- JOJOKEV DELIVERY AREAS AND RIDER QUOTES
-- Admin controls the buyer fee and the internal rider offer per area.

create table if not exists delivery_areas (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  city text not null,
  state text not null,
  customer_fee_kobo bigint not null check (customer_fee_kobo >= 0),
  rider_quote_kobo bigint not null check (rider_quote_kobo >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, city, state)
);

alter table orders add column if not exists delivery_area_id uuid references delivery_areas(id) on delete set null;
alter table orders add column if not exists rider_quote_kobo bigint not null default 0 check (rider_quote_kobo >= 0);
alter table delivery_assignments add column if not exists rider_quote_kobo bigint not null default 0 check (rider_quote_kobo >= 0);
create index if not exists orders_delivery_area_idx on orders(delivery_area_id);

alter table delivery_areas enable row level security;
create policy "active delivery areas are readable" on delivery_areas for select using (is_active = true or is_admin(auth.uid()));

create or replace function touch_delivery_area_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists t_delivery_areas_updated_at on delivery_areas;
create trigger t_delivery_areas_updated_at before update on delivery_areas for each row execute function touch_delivery_area_updated_at();
