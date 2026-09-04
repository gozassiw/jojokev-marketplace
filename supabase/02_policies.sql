-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles            enable row level security;
alter table seller_profiles     enable row level security;
alter table addresses           enable row level security;
alter table categories          enable row level security;
alter table products            enable row level security;
alter table orders              enable row level security;
alter table order_items         enable row level security;
alter table wallets             enable row level security;
alter table wallet_transactions enable row level security;
alter table withdrawals         enable row level security;
alter table platform_settings   enable row level security;
alter table platform_revenue    enable row level security;

-- ---------------- PROFILES ----------------
create policy "read own profile" on profiles
  for select using (auth.uid() = id or is_admin(auth.uid()));

-- the role comparison stops a user promoting themselves to admin
create policy "update own profile" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from profiles where id = auth.uid()));

create policy "admin manages profiles" on profiles
  for all using (is_admin(auth.uid()));

-- ---------------- SELLER PROFILES ----------------
create policy "read own seller profile" on seller_profiles
  for select using (user_id = auth.uid() or is_admin(auth.uid()));

create policy "apply to sell" on seller_profiles
  for insert with check (user_id = auth.uid() and status = 'pending');

create policy "edit own seller profile" on seller_profiles
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and status = (select status from seller_profiles where user_id = auth.uid())
  );

create policy "admin manages sellers" on seller_profiles
  for all using (is_admin(auth.uid()));

-- ---------------- ADDRESSES ----------------
create policy "own addresses" on addresses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------- CATEGORIES ----------------
create policy "categories are public" on categories for select using (true);
create policy "admin edits categories" on categories for all using (is_admin(auth.uid()));

-- ---------------- PRODUCTS ----------------
-- shoppers see only active products from approved sellers
create policy "public sees active products" on products
  for select using (
    status = 'active'
    and exists (select 1 from seller_profiles s where s.id = products.seller_id and s.status = 'approved')
  );

create policy "seller reads own products" on products
  for select using (seller_id = my_seller_id());

create policy "approved seller creates products" on products
  for insert with check (
    seller_id = my_seller_id()
    and exists (select 1 from seller_profiles s where s.id = seller_id and s.status = 'approved')
  );

create policy "seller edits own products" on products
  for update using (seller_id = my_seller_id()) with check (seller_id = my_seller_id());

create policy "seller deletes own products" on products
  for delete using (seller_id = my_seller_id());

create policy "admin manages products" on products
  for all using (is_admin(auth.uid()));

-- ---------------- ORDERS ----------------
create policy "buyer reads own orders" on orders
  for select using (buyer_id = auth.uid());

-- a seller sees an order only if it contains one of their items
create policy "seller reads orders containing their items" on orders
  for select using (
    exists (select 1 from order_items oi where oi.order_id = orders.id and oi.seller_id = my_seller_id())
  );

create policy "admin reads all orders" on orders
  for select using (is_admin(auth.uid()));

-- deliberately no insert/update policy: orders are created server-side only

-- ---------------- ORDER ITEMS ----------------
create policy "read own order items" on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_items.order_id and o.buyer_id = auth.uid())
    or seller_id = my_seller_id()
    or is_admin(auth.uid())
  );

-- ---------------- WALLETS (read-only to users) ----------------
create policy "seller reads own wallet" on wallets
  for select using (seller_id = my_seller_id() or is_admin(auth.uid()));
-- no write policy: only the service role can move money

-- ---------------- LEDGER (read-only) ----------------
create policy "seller reads own ledger" on wallet_transactions
  for select using (
    exists (select 1 from wallets w where w.id = wallet_transactions.wallet_id and w.seller_id = my_seller_id())
    or is_admin(auth.uid())
  );

-- ---------------- WITHDRAWALS ----------------
create policy "seller reads own withdrawals" on withdrawals
  for select using (seller_id = my_seller_id() or is_admin(auth.uid()));

create policy "seller requests withdrawal" on withdrawals
  for insert with check (seller_id = my_seller_id() and status = 'requested');

create policy "admin manages withdrawals" on withdrawals
  for all using (is_admin(auth.uid()));

-- ---------------- SETTINGS ----------------
create policy "settings readable" on platform_settings for select using (true);
create policy "admin edits settings" on platform_settings for all using (is_admin(auth.uid()));

-- ---------------- REVENUE (admin only) ----------------
create policy "admin reads revenue" on platform_revenue
  for select using (is_admin(auth.uid()));
