-- ============================================================
-- JOJOKEV MARKETPLACE — DATABASE SCHEMA
-- MONEY CONVENTION: all amounts in KOBO (integer). ₦1,500.00 = 150000
-- ============================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
create type user_role         as enum ('buyer', 'seller', 'admin');
create type seller_status     as enum ('pending', 'approved', 'rejected', 'suspended');
create type product_status    as enum ('draft', 'active', 'out_of_stock', 'delisted');
create type order_status      as enum (
  'awaiting_payment',   -- virtual account issued, buyer has not transferred
  'paid',               -- money received, funds sat into seller HOLD balance
  'shipped',            -- seller dispatched
  'delivered',          -- delivered; auto-release clock starts
  'completed',          -- confirmed (or auto-released) -> funds AVAILABLE
  'cancelled',
  'refunded'
);
create type txn_type          as enum (
  'sale_hold', 'hold_release', 'commission',
  'withdrawal', 'withdrawal_fee', 'refund_reversal', 'adjustment'
);
create type withdrawal_status as enum ('requested','approved','processing','paid','rejected','failed');

-- ------------------------------------------------------------
-- PROFILES (extends supabase auth.users)
-- ------------------------------------------------------------
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  phone      text,
  role       user_role not null default 'buyer',
  avatar_url text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on profiles(role);

-- ------------------------------------------------------------
-- SELLER PROFILES (admin must approve before selling)
-- ------------------------------------------------------------
create table seller_profiles (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null unique references profiles(id) on delete cascade,
  business_name    text not null,
  business_address text,
  business_phone   text,
  bank_code        text,
  bank_name        text,
  account_number   text,
  account_name     text,
  status           seller_status not null default 'pending',
  rejection_reason text,
  approved_by      uuid references profiles(id),
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on seller_profiles(status);

-- ------------------------------------------------------------
-- ADDRESSES
-- ------------------------------------------------------------
create table addresses (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profiles(id) on delete cascade,
  full_name  text not null,
  phone      text not null,
  street     text not null,
  city       text not null,
  state      text not null,
  landmark   text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index on addresses(user_id);

-- ------------------------------------------------------------
-- CATEGORIES
-- ------------------------------------------------------------
create table categories (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,
  slug       text not null unique,
  icon       text,
  sort_order int not null default 0
);

-- ------------------------------------------------------------
-- PRODUCTS
-- ------------------------------------------------------------
create table products (
  id          uuid primary key default uuid_generate_v4(),
  seller_id   uuid not null references seller_profiles(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  title       text not null,
  slug        text not null unique,
  description text,
  price_kobo  bigint not null check (price_kobo > 0),
  stock       int not null default 0 check (stock >= 0),
  images      text[] not null default '{}',
  status      product_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on products(seller_id);
create index on products(category_id);
create index on products(status);
create index products_search_idx on products
  using gin (to_tsvector('english', title || ' ' || coalesce(description,'')));

-- ------------------------------------------------------------
-- ORDERS
-- ------------------------------------------------------------
create table orders (
  id                uuid primary key default uuid_generate_v4(),
  order_number      text not null unique,
  buyer_id          uuid not null references profiles(id) on delete restrict,
  address_id        uuid references addresses(id) on delete set null,
  subtotal_kobo     bigint not null,
  delivery_fee_kobo bigint not null default 0,
  total_kobo        bigint not null,
  status            order_status not null default 'awaiting_payment',
  -- TransactPay linkage
  payment_reference text unique,
  va_account_number text,
  va_bank_name      text,
  va_expires_at     timestamptz,
  paid_at           timestamptz,
  delivered_at      timestamptz,
  completed_at      timestamptz,
  auto_release_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on orders(buyer_id);
create index on orders(status);
create index on orders(payment_reference);
create index on orders(auto_release_at) where status = 'delivered';

-- ------------------------------------------------------------
-- ORDER ITEMS (one row per product; supports multi-seller carts)
-- Commission is per item so each seller settles correctly.
-- ------------------------------------------------------------
create table order_items (
  id              uuid primary key default uuid_generate_v4(),
  order_id        uuid not null references orders(id) on delete cascade,
  product_id      uuid references products(id) on delete set null,
  seller_id       uuid not null references seller_profiles(id) on delete restrict,
  product_title   text not null,          -- snapshot: survives product edits
  unit_price_kobo bigint not null,
  quantity        int not null check (quantity > 0),
  line_total_kobo bigint not null,
  commission_kobo bigint not null default 0,
  seller_net_kobo bigint not null default 0,
  created_at      timestamptz not null default now()
);
create index on order_items(order_id);
create index on order_items(seller_id);

-- ------------------------------------------------------------
-- WALLETS — the escrow core
-- ------------------------------------------------------------
create table wallets (
  id                     uuid primary key default uuid_generate_v4(),
  seller_id              uuid not null unique references seller_profiles(id) on delete cascade,
  hold_balance_kobo      bigint not null default 0 check (hold_balance_kobo >= 0),
  available_balance_kobo bigint not null default 0 check (available_balance_kobo >= 0),
  lifetime_earned_kobo   bigint not null default 0,
  updated_at             timestamptz not null default now()
);

-- ------------------------------------------------------------
-- WALLET TRANSACTIONS — append-only audit ledger.
-- Source of truth if a balance is ever disputed. Never edit or delete.
-- ------------------------------------------------------------
create table wallet_transactions (
  id          uuid primary key default uuid_generate_v4(),
  wallet_id   uuid not null references wallets(id) on delete cascade,
  order_id    uuid references orders(id) on delete set null,
  type        txn_type not null,
  amount_kobo bigint not null,            -- positive credit, negative debit
  balance_after_hold_kobo      bigint not null,
  balance_after_available_kobo bigint not null,
  description text,
  created_at  timestamptz not null default now()
);
create index on wallet_transactions(wallet_id, created_at desc);

-- ------------------------------------------------------------
-- WITHDRAWALS
-- ------------------------------------------------------------
create table withdrawals (
  id               uuid primary key default uuid_generate_v4(),
  seller_id        uuid not null references seller_profiles(id) on delete restrict,
  amount_kobo      bigint not null check (amount_kobo > 0),
  fee_kobo         bigint not null default 0,
  net_payout_kobo  bigint not null,
  bank_code        text,
  bank_name        text,
  account_number   text,
  account_name     text,
  status           withdrawal_status not null default 'requested',
  payout_reference text,
  failure_reason   text,
  processed_by     uuid references profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on withdrawals(seller_id);
create index on withdrawals(status);

-- ------------------------------------------------------------
-- PLATFORM SETTINGS — single row, every fee toggleable
-- ------------------------------------------------------------
create table platform_settings (
  id                      int primary key default 1 check (id = 1),
  commission_enabled      boolean not null default true,
  commission_percent      numeric(5,2) not null default 5.00,
  withdrawal_fee_enabled  boolean not null default true,
  withdrawal_fee_kobo     bigint not null default 10000,    -- ₦100
  delivery_fee_enabled    boolean not null default true,
  delivery_fee_kobo       bigint not null default 120000,   -- ₦1,200
  listing_fee_enabled     boolean not null default false,
  listing_fee_kobo        bigint not null default 20000,    -- ₦200
  pay_on_delivery_enabled boolean not null default false,
  auto_release_days       int not null default 2,
  min_withdrawal_kobo     bigint not null default 100000,   -- ₦1,000
  updated_at              timestamptz not null default now()
);
insert into platform_settings (id) values (1);

-- ------------------------------------------------------------
-- PLATFORM REVENUE LEDGER
-- ------------------------------------------------------------
create table platform_revenue (
  id          uuid primary key default uuid_generate_v4(),
  source      txn_type not null,
  order_id    uuid references orders(id) on delete set null,
  amount_kobo bigint not null,
  note        text,
  created_at  timestamptz not null default now()
);
create index on platform_revenue(created_at desc);

-- ------------------------------------------------------------
-- TRIGGERS
-- ------------------------------------------------------------
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger t_profiles        before update on profiles        for each row execute function touch_updated_at();
create trigger t_seller_profiles before update on seller_profiles for each row execute function touch_updated_at();
create trigger t_products        before update on products        for each row execute function touch_updated_at();
create trigger t_orders          before update on orders          for each row execute function touch_updated_at();
create trigger t_withdrawals     before update on withdrawals     for each row execute function touch_updated_at();

-- create a profile automatically on signup
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New user'),
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'buyer')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- create the wallet the moment a seller is approved
create or replace function handle_seller_approved() returns trigger as $$
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    insert into wallets (seller_id) values (new.id) on conflict (seller_id) do nothing;
    update profiles set role = 'seller' where id = new.user_id and role = 'buyer';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_seller_approved
  after update on seller_profiles
  for each row execute function handle_seller_approved();

-- ------------------------------------------------------------
-- HELPERS used by the security policies
-- ------------------------------------------------------------
create or replace function is_admin(uid uuid) returns boolean as $$
  select exists (select 1 from profiles where id = uid and role = 'admin');
$$ language sql security definer stable;

create or replace function my_seller_id() returns uuid as $$
  select id from seller_profiles where user_id = auth.uid();
$$ language sql security definer stable;

-- ------------------------------------------------------------
-- SEED CATEGORIES
-- ------------------------------------------------------------
insert into categories (name, slug, icon, sort_order) values
  ('Phones & Tablets','phones-tablets','📱',1),
  ('Electronics','electronics','🔌',2),
  ('Fashion','fashion','👗',3),
  ('Home & Kitchen','home-kitchen','🍳',4),
  ('Health & Beauty','health-beauty','💄',5),
  ('Computing','computing','💻',6),
  ('Groceries','groceries','🛒',7),
  ('Baby Products','baby-products','🍼',8);
