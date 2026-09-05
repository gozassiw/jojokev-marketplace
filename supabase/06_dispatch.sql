-- JOJOKEV DISPATCH WORKFLOW
-- Riders are approved by staff; delivery is completed only with a buyer OTP.

alter type user_role add value if not exists 'rider';

create type rider_status as enum ('pending','approved','suspended');

create table if not exists rider_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  phone text not null,
  vehicle_type text,
  vehicle_plate text,
  status rider_status not null default 'pending',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rider_profiles_status_idx on rider_profiles(status);

create table if not exists delivery_assignments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null unique references orders(id) on delete cascade,
  rider_id uuid not null references rider_profiles(id) on delete restrict,
  assigned_by uuid not null references profiles(id),
  status text not null default 'assigned' check (status in ('assigned','picked_up','out_for_delivery','arrived','delivered','cancelled')),
  assigned_at timestamptz not null default now(),
  picked_up_at timestamptz,
  out_for_delivery_at timestamptz,
  arrived_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists delivery_assignments_rider_idx on delivery_assignments(rider_id, status);
create index if not exists delivery_assignments_status_idx on delivery_assignments(status);

create table if not exists delivery_codes (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null unique references orders(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, created_at desc);

alter table rider_profiles enable row level security;
alter table delivery_assignments enable row level security;
alter table delivery_codes enable row level security;
alter table notifications enable row level security;

create policy "rider reads own profile" on rider_profiles for select using (user_id = auth.uid() or is_admin(auth.uid()));
create policy "rider reads own assignments" on delivery_assignments for select using (
  rider_id in (select id from rider_profiles where user_id = auth.uid())
  or exists (select 1 from orders o where o.id = delivery_assignments.order_id and o.buyer_id = auth.uid())
  or is_admin(auth.uid())
);
create policy "buyer reads own delivery code notification" on delivery_codes for select using (
  exists (select 1 from orders o where o.id = delivery_codes.order_id and o.buyer_id = auth.uid())
  or is_admin(auth.uid())
);
create policy "user reads own notifications" on notifications for select using (user_id = auth.uid() or is_admin(auth.uid()));
create policy "user updates own notifications" on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function touch_dispatch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists t_rider_profiles_updated_at on rider_profiles;
create trigger t_rider_profiles_updated_at before update on rider_profiles for each row execute function touch_dispatch_updated_at();
drop trigger if exists t_delivery_assignments_updated_at on delivery_assignments;
create trigger t_delivery_assignments_updated_at before update on delivery_assignments for each row execute function touch_dispatch_updated_at();

create or replace function verify_delivery_code(p_order_id uuid, p_code_hash text)
returns boolean as $$
declare v_code record;
begin
  select * into v_code from delivery_codes where order_id = p_order_id for update;
  if not found or v_code.used_at is not null or v_code.expires_at < now() or v_code.attempts >= 5 then return false; end if;
  if v_code.code_hash <> p_code_hash then
    update delivery_codes set attempts = attempts + 1 where id = v_code.id;
    return false;
  end if;
  update delivery_codes set used_at = now() where id = v_code.id;
  return true;
end;
$$ language plpgsql security definer;

revoke all on function verify_delivery_code(uuid, text) from public;
revoke all on function verify_delivery_code(uuid, text) from anon;
revoke all on function verify_delivery_code(uuid, text) from authenticated;
grant execute on function verify_delivery_code(uuid, text) to service_role;

revoke all on table delivery_codes from authenticated;
revoke all on table delivery_codes from anon;

create index if not exists orders_paid_dispatch_idx on orders(status, created_at desc) where status in ('paid','shipped','delivered');
