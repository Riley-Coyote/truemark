-- WP-13 Phase B. Read a partner's own code even while their account is paused.
-- The existing team policy and public resolve_code RPC are unchanged.
begin;
drop policy if exists platform_partner_discount_read on public.discounts;
create policy platform_partner_discount_read on public.discounts
  for select to authenticated using (
    (select public.platform_role()) = 'partner'
    and partner_id in (select id from public.partners where user_id = (select auth.uid()))
  );
commit;
