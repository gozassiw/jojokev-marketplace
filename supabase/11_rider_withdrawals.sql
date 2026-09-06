create or replace function request_rider_withdrawal(p_rider_id uuid, p_amount_kobo bigint)
returns uuid as $$
declare r record; w record; id uuid;
begin
  select * into r from rider_profiles where id = p_rider_id for update;
  if not found or r.status <> 'approved' then raise exception 'Approved rider account required'; end if;
  if coalesce(r.account_number, '') = '' or coalesce(r.bank_name, '') = '' or coalesce(r.account_name, '') = '' then raise exception 'Add your bank details before requesting a withdrawal'; end if;
  if p_amount_kobo < 100000 then raise exception 'Minimum rider withdrawal is ₦1,000'; end if;
  select * into w from rider_wallets where rider_id = p_rider_id for update;
  if not found or w.available_balance_kobo < p_amount_kobo then raise exception 'Insufficient available rider balance'; end if;
  update rider_wallets set available_balance_kobo = available_balance_kobo - p_amount_kobo, updated_at = now() where id = w.id returning * into w;
  insert into rider_withdrawals(rider_id, amount_kobo, fee_kobo, net_payout_kobo, bank_name, bank_code, account_number, account_name, status) values (p_rider_id, p_amount_kobo, 0, p_amount_kobo, r.bank_name, r.bank_code, r.account_number, r.account_name, 'requested') returning rider_withdrawals.id into id;
  insert into rider_wallet_transactions(wallet_id, type, amount_kobo, balance_after_hold_kobo, balance_after_available_kobo, description) values (w.id, 'withdrawal', -p_amount_kobo, w.held_balance_kobo, w.available_balance_kobo, 'Rider withdrawal requested');
  return id;
end;
$$ language plpgsql security definer set search_path = public;
revoke all on function request_rider_withdrawal(uuid, bigint) from public, anon, authenticated;
grant execute on function request_rider_withdrawal(uuid, bigint) to service_role;
