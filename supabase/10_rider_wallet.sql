-- RIDER EARNINGS WALLET
alter table rider_profiles add column if not exists bank_name text;
alter table rider_profiles add column if not exists bank_code text;
alter table rider_profiles add column if not exists account_number text;
alter table rider_profiles add column if not exists account_name text;

create table if not exists rider_wallets (
  id uuid primary key default uuid_generate_v4(),
  rider_id uuid not null unique references rider_profiles(id) on delete cascade,
  held_balance_kobo bigint not null default 0,
  available_balance_kobo bigint not null default 0,
  lifetime_earned_kobo bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists rider_wallet_transactions (
  id uuid primary key default uuid_generate_v4(),
  wallet_id uuid not null references rider_wallets(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  assignment_id uuid references delivery_assignments(id) on delete set null,
  type text not null check (type in ('delivery_hold','delivery_release','withdrawal','withdrawal_reversal')),
  amount_kobo bigint not null,
  balance_after_hold_kobo bigint not null,
  balance_after_available_kobo bigint not null,
  description text not null,
  created_at timestamptz not null default now()
);
create table if not exists rider_withdrawals (
  id uuid primary key default uuid_generate_v4(),
  rider_id uuid not null references rider_profiles(id) on delete restrict,
  amount_kobo bigint not null,
  fee_kobo bigint not null default 0,
  net_payout_kobo bigint not null,
  bank_name text,
  bank_code text,
  account_number text,
  account_name text,
  status text not null default 'requested' check (status in ('requested','processing','paid','rejected')),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rider_wallet_tx_idx on rider_wallet_transactions(wallet_id, created_at desc);
create index if not exists rider_withdrawals_idx on rider_withdrawals(rider_id, created_at desc);
alter table rider_wallets enable row level security;
alter table rider_wallet_transactions enable row level security;
alter table rider_withdrawals enable row level security;
create policy "rider reads own wallet" on rider_wallets for select using (rider_id in (select id from rider_profiles where user_id = auth.uid()) or is_admin(auth.uid()));
create policy "rider reads own wallet transactions" on rider_wallet_transactions for select using (wallet_id in (select id from rider_wallets where rider_id in (select id from rider_profiles where user_id = auth.uid())) or is_admin(auth.uid()));
create policy "rider reads own withdrawals" on rider_withdrawals for select using (rider_id in (select id from rider_profiles where user_id = auth.uid()) or is_admin(auth.uid()));

create or replace function hold_rider_delivery_earnings(p_order_id uuid, p_assignment_id uuid, p_rider_id uuid, p_amount_kobo bigint)
returns void as $$
declare w record;
begin
  insert into rider_wallets(rider_id) values (p_rider_id) on conflict (rider_id) do nothing;
  select * into w from rider_wallets where rider_id = p_rider_id for update;
  if not exists (select 1 from rider_wallet_transactions where order_id = p_order_id and type = 'delivery_hold') then
    update rider_wallets set held_balance_kobo = held_balance_kobo + p_amount_kobo, lifetime_earned_kobo = lifetime_earned_kobo + p_amount_kobo, updated_at = now() where id = w.id returning * into w;
    insert into rider_wallet_transactions(wallet_id, order_id, assignment_id, type, amount_kobo, balance_after_hold_kobo, balance_after_available_kobo, description) values (w.id, p_order_id, p_assignment_id, 'delivery_hold', p_amount_kobo, w.held_balance_kobo, w.available_balance_kobo, 'Delivery quote held until verified delivery');
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function release_rider_delivery_earnings(p_order_id uuid)
returns void as $$
declare t record; w record;
begin
  for t in select * from rider_wallet_transactions where order_id = p_order_id and type = 'delivery_hold' loop
    if not exists (select 1 from rider_wallet_transactions where order_id = p_order_id and type = 'delivery_release') then
      select * into w from rider_wallets where id = t.wallet_id for update;
      if w.held_balance_kobo >= t.amount_kobo then
        update rider_wallets set held_balance_kobo = held_balance_kobo - t.amount_kobo, available_balance_kobo = available_balance_kobo + t.amount_kobo, updated_at = now() where id = w.id returning * into w;
        insert into rider_wallet_transactions(wallet_id, order_id, assignment_id, type, amount_kobo, balance_after_hold_kobo, balance_after_available_kobo, description) values (w.id, p_order_id, t.assignment_id, 'delivery_release', t.amount_kobo, w.held_balance_kobo, w.available_balance_kobo, 'Released after buyer delivery code verification');
      end if;
    end if;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function hold_rider_delivery_earnings(uuid, uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function release_rider_delivery_earnings(uuid) from public, anon, authenticated;
grant execute on function hold_rider_delivery_earnings(uuid, uuid, uuid, bigint) to service_role;
grant execute on function release_rider_delivery_earnings(uuid) to service_role;
