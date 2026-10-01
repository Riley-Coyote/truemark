-- WP-14: storefront classes, qualified shipping copy and server-priced free shipping.
-- New migration only. No lot results, accounts or historical financial rows change.
begin;
set local standard_conforming_strings = on;

create table if not exists public.settings (
  id boolean primary key default true check (id),
  free_shipping_threshold numeric(10,2) default 150 check (free_shipping_threshold >= 0),
  free_shipping_method text not null default 'cold-2day' references public.shipping_methods(id),
  insurance_mode text not null default 'off' check (insurance_mode in ('off', 'optional', 'automatic')),
  insurance_rate numeric(6,5),
  updated_at timestamptz not null default now()
);
insert into public.settings(id) values (true) on conflict (id) do nothing;
alter table public.settings enable row level security;
revoke all on public.settings from public, anon, authenticated, service_role;
grant select on public.settings to anon, authenticated;
drop policy if exists settings_public_read on public.settings;
create policy settings_public_read on public.settings for select to anon, authenticated using (true);

update public.products p set category = c.category
from (values
  ('retatrutide-10-mg', 'metabolic-peptides'),
  ('retatrutide-20-mg', 'metabolic-peptides'),
  ('retatrutide-30-mg', 'metabolic-peptides'),
  ('retatrutide-60-mg', 'metabolic-peptides'),
  ('tirzepatide-30-mg', 'metabolic-peptides'),
  ('semaglutide-20-mg', 'metabolic-peptides'),
  ('cagrilintide-10-mg', 'metabolic-peptides'),
  ('bpc-157-10-mg', 'peptide-fragments'),
  ('bpc-tb-1010-mg', 'peptide-fragments'),
  ('kpv-10-mg', 'peptide-fragments'),
  ('ghk-cu-100-mg', 'copper-peptides'),
  ('glow-70-mg', 'copper-peptides'),
  ('tesamorelin-10-mg', 'secretagogue-peptides'),
  ('nad-500-mg', 'coenzymes-cofactors'),
  ('mots-c-10-mg', 'mitochondrial-peptides'),
  ('semax-10-mg', 'neuropeptides'),
  ('selank-10-mg', 'neuropeptides'),
  ('melanotan-ii-10-mg', 'melanocortin-analogs'),
  ('bacteriostatic-water-10-ml', 'lab-supplies'),
  ('cjc-ipa-1010-mg', 'secretagogue-peptides')
) as c(id, category) where p.id = c.id and p.category is distinct from c.category;

update public.shipping_methods set detail = 'Shipped with temperature control when applicable'
where id = 'cold-2day' and detail is distinct from 'Shipped with temperature control when applicable';
update public.shipping_methods set detail = 'Shipped with temperature control when applicable, next business day'
where id = 'cold-overnight' and detail is distinct from 'Shipped with temperature control when applicable, next business day';

create or replace function public.place_order(draft jsonb) returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  buyer public.buyers;
  product public.products;
  method public.shipping_methods;
  storefront public.settings;
  discount public.discounts;
  partner public.partners;
  placed public.orders;
  item jsonb;
  priced jsonb := '[]'::jsonb;
  destination jsonb;
  field text;
  quantity integer;
  subtotal numeric(12,2) := 0;
  discount_amount numeric(12,2) := 0;
  base numeric(12,2);
  requested_code text := nullif(upper(btrim(draft ->> 'discountCode')), '');
  via text := coalesce(draft ->> 'via', 'code');
begin
  if auth.uid() is null or public.platform_role() is distinct from 'buyer' then
    raise exception 'a verified buyer account is required' using errcode = '42501';
  end if;
  select * into buyer from public.buyers where user_id = auth.uid() for share;
  if not found or buyer.status <> 'verified' then
    raise exception 'buyer account awaits verification' using errcode = '42501';
  end if;
  if jsonb_typeof(draft) is distinct from 'object' or jsonb_typeof(draft -> 'lines') is distinct from 'array' then
    raise exception 'lines must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(draft -> 'lines') not between 1 and 100 or via not in ('link', 'code') then
    raise exception 'invalid lines or referral source' using errcode = '22023';
  end if;
  destination := draft -> 'address';
  if jsonb_typeof(destination) is distinct from 'object' then
    raise exception 'a shipping address is required' using errcode = '22023';
  end if;
  foreach field in array array['institution', 'attention', 'line1', 'city', 'region', 'postal', 'country'] loop
    if jsonb_typeof(destination -> field) is distinct from 'string'
      or length(btrim(destination ->> field)) not between 1 and 500 then
      raise exception 'invalid address field: %', field using errcode = '22023';
    end if;
  end loop;
  -- Accept the inline OrderDraft address, but keep only its defined text fields.
  select jsonb_object_agg(key, value) into destination from jsonb_each(destination)
    where key = any(array['id', 'label', 'institution', 'attention', 'line1', 'line2', 'city', 'region', 'postal', 'country', 'phone'])
      and jsonb_typeof(value) = 'string';
  select * into method from public.shipping_methods where id = draft ->> 'shipping' and active for share;
  if not found then raise exception 'shipping method unavailable' using errcode = '22023'; end if;

  for item in select value from jsonb_array_elements(draft -> 'lines') loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item -> 'quantity') is distinct from 'number'
      or (item ->> 'quantity') !~ '^[0-9]{1,5}$' then
      raise exception 'quantity must be a positive integer' using errcode = '22023';
    end if;
    quantity := (item ->> 'quantity')::integer;
    if quantity not between 1 and 10000 then raise exception 'quantity out of range' using errcode = '22023'; end if;
    if exists (select 1 from jsonb_array_elements(priced) x where x ->> 'productId' = item ->> 'productId') then
      raise exception 'duplicate product line' using errcode = '22023';
    end if;
    select * into product from public.products where id = item ->> 'productId' and active for share;
    if not found then raise exception 'product unavailable' using errcode = '22023'; end if;
    if not exists (select 1 from public.lots where lot = product.lot and product_id = product.id) then
      raise exception 'product lot unavailable' using errcode = '22023';
    end if;
    subtotal := subtotal + product.price * quantity;
    priced := priced || jsonb_build_array(jsonb_build_object('productId', product.id, 'quantity', quantity, 'unitPrice', product.price, 'lot', product.lot));
  end loop;
  if requested_code is not null then
    select * into discount from public.discounts d where d.code = requested_code and active
      and (expires_at is null or expires_at > now()) for update;
    if not found then raise exception 'discount unavailable' using errcode = '22023'; end if;
    if discount.kind = 'partner' then
      select * into partner from public.partners where id = discount.partner_id and status = 'active' for share;
      if not found then raise exception 'partner code unavailable' using errcode = '22023'; end if;
    end if;
    discount_amount := round(subtotal * discount.percent / 100, 2);
    update public.discounts d set uses = uses + 1 where d.code = requested_code;
  end if;
  base := subtotal - discount_amount;
  select * into storefront from public.settings where id = true for share;
  if not found then raise exception 'storefront settings unavailable' using errcode = '22023'; end if;
  if storefront.free_shipping_threshold is not null
    and method.id = storefront.free_shipping_method
    and base >= storefront.free_shipping_threshold then
    method.price := 0;
  end if;
  insert into public.orders(buyer_id, address, shipping_method_id, shipping_price, subtotal,
    discount_code, discount_amount, discount_partner_id, total)
    values (buyer.id, destination, method.id, method.price, subtotal, requested_code, discount_amount, partner.id, base + method.price)
    returning * into placed;
  insert into public.order_lines(order_id, product_id, quantity, unit_price, lot)
    select placed.id, x ->> 'productId', (x ->> 'quantity')::integer, (x ->> 'unitPrice')::numeric, x ->> 'lot'
      from jsonb_array_elements(priced) x;
  insert into public.order_events(order_id, status, actor_id) values (placed.id, 'placed', auth.uid());
  insert into public.notifications(audience, kind, title, body, amount, href) values
    ('owner', 'order.placed', 'New order ' || placed.number,
      '$' || placed.total::text || ' ' || chr(183) || ' ' || buyer.institution || case when partner.id is not null then ' ' || chr(183) || ' via ' || partner.code else '' end,
      placed.total, '/admin/orders?order=' || placed.id::text),
    ('buyer:' || buyer.id::text, 'order.placed', 'Order ' || placed.number || ' is confirmed',
      'We''ll write again when it ships.', null, '/account/orders/' || placed.id::text);
  if partner.id is not null then
    insert into public.referrals(partner_id, order_id, order_number, order_subtotal, commission, via)
      values (partner.id, placed.id, placed.number, base, round(base * partner.rate, 2), via);
    insert into public.notifications(audience, kind, title, body, amount, href) values
      ('partner:' || partner.id::text, 'referral.created', 'New order through your ' || via,
        'Order ' || placed.number || ' ' || chr(183) || ' $' || base::text || ' subtotal', round(base * partner.rate, 2), '/partners/app/referrals');
  end if;
  return placed;
end;
$$;

revoke all on function public.place_order(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.place_order(jsonb) to authenticated;
commit;
