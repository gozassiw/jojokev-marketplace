-- BROADCAST DELIVERY OFFERS
create table if not exists delivery_offers (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  rider_id uuid not null references rider_profiles(id) on delete cascade,
  quote_kobo bigint not null default 0,
  status text not null default 'offered' check (status in ('offered','accepted','declined','expired','cancelled')),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique(order_id, rider_id)
);
create index if not exists delivery_offers_rider_idx on delivery_offers(rider_id, status, created_at desc);
create index if not exists delivery_offers_order_idx on delivery_offers(order_id, status);
alter table delivery_offers enable row level security;
create policy "riders read own delivery offers" on delivery_offers for select using (rider_id in (select id from rider_profiles where user_id = auth.uid()) or is_admin(auth.uid()));

create or replace function accept_delivery_offer(p_offer_id uuid, p_rider_id uuid)
returns jsonb as $$
declare v_offer delivery_offers%rowtype; v_order orders%rowtype; v_rider rider_profiles%rowtype; v_assignment_id uuid;
begin
  select * into v_offer from delivery_offers where id = p_offer_id and rider_id = p_rider_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Delivery offer not found.'); end if;
  if v_offer.status <> 'offered' or v_offer.expires_at <= now() then
    update delivery_offers set status = case when status = 'offered' then 'expired' else status end, responded_at = coalesce(responded_at, now()) where id = v_offer.id;
    return jsonb_build_object('ok', false, 'error', 'This delivery offer has expired or is no longer available.');
  end if;
  select * into v_order from orders where id = v_offer.order_id for update;
  if not found or v_order.status not in ('paid','shipped','delivered') then return jsonb_build_object('ok', false, 'error', 'This order is not available for dispatch.'); end if;
  if exists (select 1 from delivery_assignments where order_id = v_order.id and status <> 'cancelled') then
    update delivery_offers set status = 'cancelled', responded_at = now() where order_id = v_order.id and status = 'offered';
    return jsonb_build_object('ok', false, 'error', 'Another rider has already accepted this delivery.');
  end if;
  select * into v_rider from rider_profiles where id = p_rider_id and status = 'approved';
  if not found then return jsonb_build_object('ok', false, 'error', 'Approved rider access required.'); end if;
  insert into delivery_assignments(order_id, rider_id, assigned_by, rider_quote_kobo, status) values (v_order.id, p_rider_id, v_rider.user_id, v_offer.quote_kobo, 'assigned') returning id into v_assignment_id;
  update delivery_offers set status = 'accepted', responded_at = now() where id = v_offer.id;
  update delivery_offers set status = 'cancelled', responded_at = now() where order_id = v_order.id and status = 'offered' and id <> v_offer.id;
  return jsonb_build_object('ok', true, 'assignment_id', v_assignment_id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Another rider has already accepted this delivery.');
end;
$$ language plpgsql security definer set search_path = public;
revoke all on function accept_delivery_offer(uuid, uuid) from public;
revoke all on function accept_delivery_offer(uuid, uuid) from anon;
revoke all on function accept_delivery_offer(uuid, uuid) from authenticated;
grant execute on function accept_delivery_offer(uuid, uuid) to service_role;
