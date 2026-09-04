-- Fix public product visibility without exposing seller_profiles rows or payout details.
create or replace function public.is_approved_seller(p_seller_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.seller_profiles
    where id = p_seller_id
      and status = 'approved'
  );
$$;

grant execute on function public.is_approved_seller(uuid) to anon, authenticated;

drop policy if exists "public sees active products" on public.products;
create policy "public sees active products" on public.products
  for select using (
    status = 'active'
    and public.is_approved_seller(seller_id)
  );
