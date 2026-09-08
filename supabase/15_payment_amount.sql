alter table public.orders add column if not exists payment_amount_kobo bigint;

update public.orders
set payment_amount_kobo = total_kobo
where payment_amount_kobo is null;

alter table public.orders drop constraint if exists orders_payment_amount_kobo_check;
alter table public.orders add constraint orders_payment_amount_kobo_check check (payment_amount_kobo is null or payment_amount_kobo >= total_kobo);
