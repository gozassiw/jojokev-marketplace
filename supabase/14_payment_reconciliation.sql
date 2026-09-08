alter table public.orders add column if not exists payment_provider_status text;
alter table public.orders add column if not exists payment_failure_reason text;
alter table public.orders add column if not exists payment_reversed_at timestamptz;

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  order_reference text,
  provider_status text,
  provider_status_id integer,
  amount_kobo bigint,
  payload jsonb not null,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.payment_webhook_events enable row level security;

drop policy if exists "admins read payment webhook events" on public.payment_webhook_events;
create policy "admins read payment webhook events" on public.payment_webhook_events for select using (is_admin(auth.uid()));

create or replace function public.reverse_paid_order(p_order_id uuid, p_reason text default 'Payment reversed by TransactPay')
returns void as $$
declare
  v_order record;
  v_item record;
  v_wallet record;
  v_revenue record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order % not found', p_order_id; end if;

  if v_order.status = 'awaiting_payment' then
    update public.orders
       set payment_provider_status = 'Failed',
           payment_failure_reason = p_reason
     where id = p_order_id;
    return;
  end if;

  if v_order.status = 'refunded' then return; end if;
  if v_order.status not in ('paid', 'shipped', 'delivered') then
    update public.orders
       set payment_provider_status = 'Reversed',
           payment_failure_reason = p_reason,
           payment_reversed_at = now()
     where id = p_order_id;
    return;
  end if;

  for v_item in select * from public.order_items where order_id = p_order_id loop
    update public.products
       set stock = stock + v_item.quantity
     where id = v_item.product_id;

    select * into v_wallet from public.wallets where seller_id = v_item.seller_id for update;
    if not found then
      raise exception 'Seller wallet missing for order %', p_order_id;
    end if;

    if v_wallet.hold_balance_kobo >= v_item.seller_net_kobo then
      update public.wallets
         set hold_balance_kobo = hold_balance_kobo - v_item.seller_net_kobo,
             lifetime_earned_kobo = greatest(0, lifetime_earned_kobo - v_item.seller_net_kobo),
             updated_at = now()
       where id = v_wallet.id
      returning * into v_wallet;
    elsif v_wallet.available_balance_kobo >= v_item.seller_net_kobo then
      update public.wallets
         set available_balance_kobo = available_balance_kobo - v_item.seller_net_kobo,
             lifetime_earned_kobo = greatest(0, lifetime_earned_kobo - v_item.seller_net_kobo),
             updated_at = now()
       where id = v_wallet.id
      returning * into v_wallet;
    else
      raise exception 'Seller wallet balance is insufficient to reverse order %', p_order_id;
    end if;

    insert into public.wallet_transactions (
      wallet_id, order_id, type, amount_kobo,
      balance_after_hold_kobo, balance_after_available_kobo, description
    ) values (
      v_wallet.id, p_order_id, 'refund_reversal', -v_item.seller_net_kobo,
      v_wallet.hold_balance_kobo, v_wallet.available_balance_kobo,
      'Payment reversed by TransactPay: ' || coalesce(p_reason, 'reversed payment')
    );

    if v_item.commission_kobo > 0 then
      insert into public.platform_revenue (source, order_id, amount_kobo, note)
      values ('commission', p_order_id, -v_item.commission_kobo, 'Commission reversed: ' || coalesce(p_reason, 'payment reversed'));
    end if;
  end loop;

  if v_order.delivery_fee_kobo > 0 then
    insert into public.platform_revenue (source, order_id, amount_kobo, note)
    values ('adjustment', p_order_id, -v_order.delivery_fee_kobo, 'Delivery fee reversed: ' || coalesce(p_reason, 'payment reversed'));
  end if;

  update public.orders
     set status = 'refunded',
         payment_provider_status = 'Reversed',
         payment_failure_reason = p_reason,
         payment_reversed_at = now()
   where id = p_order_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.reverse_paid_order(uuid, text) from public, anon, authenticated;
grant execute on function public.reverse_paid_order(uuid, text) to service_role;
