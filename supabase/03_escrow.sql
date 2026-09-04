-- ============================================================
-- ESCROW ENGINE
-- All money movement lives here. Never move balances from app code.
-- ============================================================

-- ------------------------------------------------------------
-- settle_paid_order — called by the payment webhook.
-- Deducts stock, credits each seller's HOLD balance, records commission.
-- Atomic and idempotent.
-- ------------------------------------------------------------
create or replace function settle_paid_order(p_order_id uuid)
returns void as $$
declare
  v_order   record;
  v_item    record;
  v_wallet  record;
begin
  -- lock the order so two concurrent webhooks cannot both settle it
  select * into v_order from orders where id = p_order_id for update;

  if not found then raise exception 'Order % not found', p_order_id; end if;

  -- idempotency guard: a retried webhook exits quietly
  if v_order.status <> 'awaiting_payment' then return; end if;

  for v_item in
    select * from order_items where order_id = p_order_id
  loop
    -- deduct stock now that payment is real
    update products
       set stock = greatest(0, stock - v_item.quantity)
     where id = v_item.product_id;

    -- out of stock -> delist automatically
    update products set status = 'out_of_stock'
     where id = v_item.product_id and stock = 0 and status = 'active';

    -- lock this seller's wallet, then credit HOLD
    select * into v_wallet from wallets
     where seller_id = v_item.seller_id for update;

    if not found then
      -- safety net: wallet should exist from the approval trigger
      insert into wallets (seller_id) values (v_item.seller_id)
      returning * into v_wallet;
    end if;

    update wallets
       set hold_balance_kobo    = hold_balance_kobo + v_item.seller_net_kobo,
           lifetime_earned_kobo = lifetime_earned_kobo + v_item.seller_net_kobo,
           updated_at = now()
     where id = v_wallet.id
    returning * into v_wallet;

    insert into wallet_transactions (
      wallet_id, order_id, type, amount_kobo,
      balance_after_hold_kobo, balance_after_available_kobo, description
    ) values (
      v_wallet.id, p_order_id, 'sale_hold', v_item.seller_net_kobo,
      v_wallet.hold_balance_kobo, v_wallet.available_balance_kobo,
      'Sale held in escrow: ' || v_item.product_title
    );

    -- platform commission
    if v_item.commission_kobo > 0 then
      insert into platform_revenue (source, order_id, amount_kobo, note)
      values ('commission', p_order_id, v_item.commission_kobo,
              'Commission on ' || v_item.product_title);
    end if;
  end loop;

  -- delivery fee is platform revenue
  if v_order.delivery_fee_kobo > 0 then
    insert into platform_revenue (source, order_id, amount_kobo, note)
    values ('adjustment', p_order_id, v_order.delivery_fee_kobo, 'Delivery fee');
  end if;

  update orders
     set status = 'paid', paid_at = now()
   where id = p_order_id;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- release_order_escrow — HOLD becomes AVAILABLE.
-- Triggered by buyer confirmation, admin action, or the auto-release job.
-- ------------------------------------------------------------
create or replace function release_order_escrow(p_order_id uuid, p_reason text default 'confirmed')
returns void as $$
declare
  v_order  record;
  v_item   record;
  v_wallet record;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'Order % not found', p_order_id; end if;

  -- only paid/shipped/delivered orders can release; 'completed' exits quietly
  if v_order.status not in ('paid','shipped','delivered') then return; end if;

  for v_item in select * from order_items where order_id = p_order_id
  loop
    select * into v_wallet from wallets where seller_id = v_item.seller_id for update;
    if not found then continue; end if;

    -- guard against releasing more than is held (data-integrity safety net)
    if v_wallet.hold_balance_kobo < v_item.seller_net_kobo then
      raise warning 'Hold balance too low for order % seller %', p_order_id, v_item.seller_id;
      continue;
    end if;

    update wallets
       set hold_balance_kobo      = hold_balance_kobo - v_item.seller_net_kobo,
           available_balance_kobo = available_balance_kobo + v_item.seller_net_kobo,
           updated_at = now()
     where id = v_wallet.id
    returning * into v_wallet;

    insert into wallet_transactions (
      wallet_id, order_id, type, amount_kobo,
      balance_after_hold_kobo, balance_after_available_kobo, description
    ) values (
      v_wallet.id, p_order_id, 'hold_release', v_item.seller_net_kobo,
      v_wallet.hold_balance_kobo, v_wallet.available_balance_kobo,
      'Released to withdrawable (' || p_reason || ')'
    );
  end loop;

  update orders
     set status = 'completed', completed_at = now()
   where id = p_order_id;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- auto_release_due_orders — the 2-day safety net.
-- Run on a schedule. Releases delivered orders the buyer never confirmed.
-- ------------------------------------------------------------
create or replace function auto_release_due_orders()
returns int as $$
declare
  v_order record;
  v_count int := 0;
begin
  for v_order in
    select id from orders
     where status = 'delivered'
       and auto_release_at is not null
       and auto_release_at <= now()
     limit 500
  loop
    begin
      perform release_order_escrow(v_order.id, 'auto-release after buyer window');
      v_count := v_count + 1;
    exception when others then
      -- one bad order must not stop the whole batch
      raise warning 'auto-release failed for %: %', v_order.id, sqlerrm;
    end;
  end loop;
  return v_count;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- request_withdrawal — seller cashes out.
-- Debits AVAILABLE immediately so the same naira cannot be requested twice.
-- ------------------------------------------------------------
create or replace function request_withdrawal(p_seller_id uuid, p_amount_kobo bigint)
returns uuid as $$
declare
  v_wallet   record;
  v_settings record;
  v_seller   record;
  v_fee      bigint;
  v_id       uuid;
begin
  select * into v_settings from platform_settings where id = 1;
  select * into v_seller  from seller_profiles where id = p_seller_id;

  if v_seller.status <> 'approved' then
    raise exception 'Seller account is not approved';
  end if;
  if v_seller.account_number is null or v_seller.account_number = '' then
    raise exception 'Add your bank account details before withdrawing';
  end if;

  select * into v_wallet from wallets where seller_id = p_seller_id for update;
  if not found then raise exception 'Wallet not found'; end if;

  if p_amount_kobo < v_settings.min_withdrawal_kobo then
    raise exception 'Minimum withdrawal is %', v_settings.min_withdrawal_kobo / 100;
  end if;
  if v_wallet.available_balance_kobo < p_amount_kobo then
    raise exception 'Insufficient withdrawable balance';
  end if;

  v_fee := case when v_settings.withdrawal_fee_enabled
                then v_settings.withdrawal_fee_kobo else 0 end;

  if p_amount_kobo <= v_fee then
    raise exception 'Amount must be greater than the withdrawal fee';
  end if;

  -- debit now: prevents requesting the same money twice while pending
  update wallets
     set available_balance_kobo = available_balance_kobo - p_amount_kobo,
         updated_at = now()
   where id = v_wallet.id
  returning * into v_wallet;

  insert into withdrawals (
    seller_id, amount_kobo, fee_kobo, net_payout_kobo,
    bank_code, bank_name, account_number, account_name, status
  ) values (
    p_seller_id, p_amount_kobo, v_fee, p_amount_kobo - v_fee,
    v_seller.bank_code, v_seller.bank_name, v_seller.account_number,
    v_seller.account_name, 'requested'
  ) returning id into v_id;

  insert into wallet_transactions (
    wallet_id, type, amount_kobo,
    balance_after_hold_kobo, balance_after_available_kobo, description
  ) values (
    v_wallet.id, 'withdrawal', -p_amount_kobo,
    v_wallet.hold_balance_kobo, v_wallet.available_balance_kobo,
    'Withdrawal requested'
  );

  if v_fee > 0 then
    insert into platform_revenue (source, amount_kobo, note)
    values ('withdrawal_fee', v_fee, 'Withdrawal fee');
  end if;

  return v_id;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- reject_withdrawal — refund the money to the seller's available balance.
-- ------------------------------------------------------------
create or replace function reject_withdrawal(p_withdrawal_id uuid, p_reason text)
returns void as $$
declare
  v_w      record;
  v_wallet record;
begin
  select * into v_w from withdrawals where id = p_withdrawal_id for update;
  if not found then raise exception 'Withdrawal not found'; end if;
  if v_w.status in ('paid','rejected') then
    raise exception 'Withdrawal already finalised';
  end if;

  select * into v_wallet from wallets where seller_id = v_w.seller_id for update;

  update wallets
     set available_balance_kobo = available_balance_kobo + v_w.amount_kobo,
         updated_at = now()
   where id = v_wallet.id
  returning * into v_wallet;

  insert into wallet_transactions (
    wallet_id, type, amount_kobo,
    balance_after_hold_kobo, balance_after_available_kobo, description
  ) values (
    v_wallet.id, 'refund_reversal', v_w.amount_kobo,
    v_wallet.hold_balance_kobo, v_wallet.available_balance_kobo,
    'Withdrawal rejected: ' || coalesce(p_reason,'no reason given')
  );

  -- reverse the fee we booked at request time
  if v_w.fee_kobo > 0 then
    insert into platform_revenue (source, amount_kobo, note)
    values ('withdrawal_fee', -v_w.fee_kobo, 'Reversed: withdrawal rejected');
  end if;

  update withdrawals
     set status = 'rejected', failure_reason = p_reason, updated_at = now()
   where id = p_withdrawal_id;
end;
$$ language plpgsql security definer;
