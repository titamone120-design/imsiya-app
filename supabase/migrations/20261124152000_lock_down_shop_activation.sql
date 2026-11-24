-- Prevent sellers from activating their own shops or changing protected shop fields.
-- Shop activation remains controlled by verified subscription/payment server workflows.

alter table public.shops
  alter column active set default false;

drop policy if exists "Users can create their own shop" on public.shops;
create policy "Users can create inactive own shop"
  on public.shops
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and active is false
  );

drop policy if exists "Admins and owners can update shops" on public.shops;
create policy "Admins and owners can update shop details"
  on public.shops
  for update
  to authenticated
  using (
    public.is_imsiya_admin()
    or owner_id = (select auth.uid())
  )
  with check (
    public.is_imsiya_admin()
    or owner_id = (select auth.uid())
  );

revoke update on public.shops from anon, authenticated, public;
grant update (shop_name, description) on public.shops to authenticated;
