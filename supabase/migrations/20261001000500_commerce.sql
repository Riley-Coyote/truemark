-- WP-15. Runs after 000300; independent of WP-16's 000400.
begin;
set local standard_conforming_strings = on;

create table if not exists public.categories (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null check (length(btrim(name)) between 1 and 200),
  short text not null check (length(btrim(short)) between 1 and 100),
  label_color text not null check (label_color ~ '^#[0-9A-Fa-f]{6}$'),
  position integer not null check (position >= 0),
  on_home boolean not null default true,
  members_note text not null default '' check (length(members_note) <= 1000)
);
insert into public.categories(id, name, short, label_color, position, on_home, members_note) values
  ('metabolic-peptides', 'Metabolic peptides', 'Metabolic', '#7A39B1', 1, true, 'Retatrutide ' || chr(183) || ' Tirzepatide ' || chr(183) || ' Semaglutide ' || chr(183) || ' Cagrilintide'),
  ('peptide-fragments', 'Peptide fragments', 'Peptide fragments', '#058F93', 2, true, 'BPC-157 ' || chr(183) || ' BPC-157 / TB-500 ' || chr(183) || ' KPV'),
  ('copper-peptides', 'Copper peptides', 'Copper peptides', '#CC3358', 3, true, 'GHK-Cu ' || chr(183) || ' GLOW'),
  ('secretagogue-peptides', 'Secretagogue peptides', 'Secretagogues', '#0273D0', 4, true, 'Tesamorelin ' || chr(183) || ' CJC (No DAC) / Ipamorelin'),
  ('mitochondrial-peptides', 'Mitochondrial peptides', 'Mitochondrial', '#B97102', 5, true, 'MOTS-C'),
  ('coenzymes-cofactors', 'Coenzymes & cofactors', 'Coenzymes', '#B97102', 6, true, 'NAD+'),
  ('neuropeptides', 'Neuropeptides', 'Neuropeptides', '#4E762E', 7, true, 'Semax ' || chr(183) || ' Selank'),
  ('melanocortin-analogs', 'Melanocortin analogs', 'Melanocortins', '#AB531A', 8, true, 'Melanotan II'),
  ('lab-supplies', 'Lab supplies', 'Lab supplies', '#486377', 9, false, 'BAC Water')
on conflict (id) do nothing;
alter table public.categories enable row level security;
revoke all on public.categories from public, anon, authenticated, service_role;
grant select on public.categories to anon, authenticated;
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories for select to anon, authenticated using (true);

alter table public.products add column if not exists description text;
alter table public.products add column if not exists stock integer check (stock >= 0);
alter table public.products drop constraint if exists products_category_fkey;
alter table public.products add constraint products_category_fkey foreign key (category) references public.categories(id);
alter table public.orders add column if not exists insurance numeric(12,2) not null default 0 check (insurance >= 0);
alter table public.orders add column if not exists insurance_applied boolean not null default false;
-- The old unnamed total check predates insurance. Drop only that exact check.
do $$ declare constraint_name text;
begin
  for constraint_name in select conname from pg_constraint
    where conrelid = 'public.orders'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) = 'CHECK ((total = ((subtotal - discount_amount) + shipping_price)))'
  loop execute format('alter table public.orders drop constraint %I', constraint_name); end loop;
end $$;
alter table public.orders drop constraint if exists orders_commerce_total;
alter table public.orders add constraint orders_commerce_total check (total = subtotal - discount_amount + shipping_price + insurance);
-- Legacy/untracked lines reserve zero: enabling tracking later must not create stock on cancellation.
alter table public.order_lines add column if not exists stock_reserved integer not null default 0 check (stock_reserved between 0 and quantity);
alter table public.settings drop constraint if exists settings_insurance_rate_valid;
alter table public.settings add constraint settings_insurance_rate_valid
  check ((insurance_rate is null or insurance_rate between 0 and 1) and (insurance_mode = 'off' or insurance_rate is not null));

create or replace function public.upsert_category(draft jsonb) returns public.categories
language plpgsql security definer set search_path = public
as $$ declare saved public.categories;
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'team access required' using errcode = '42501';
  end if;
  if jsonb_typeof(draft) is distinct from 'object' or coalesce(draft ->> 'id', '') !~ '^[a-z0-9-]+$'
    or jsonb_typeof(draft -> 'position') is distinct from 'number' or (draft ->> 'position') !~ '^[0-9]{1,9}$'
    or jsonb_typeof(draft -> 'onHome') is distinct from 'boolean' then
    raise exception 'invalid class fields' using errcode = '22023';
  end if;
  insert into public.categories(id, name, short, label_color, position, on_home, members_note)
    values (draft ->> 'id', btrim(draft ->> 'name'), btrim(draft ->> 'short'),
      coalesce((select label_color from public.categories where id = draft ->> 'id'), draft ->> 'labelColor'),
      (draft ->> 'position')::integer, (draft ->> 'onHome')::boolean, coalesce(draft ->> 'members', ''))
    on conflict (id) do update set name = excluded.name, short = excluded.short,
      position = excluded.position, on_home = excluded.on_home, members_note = excluded.members_note
    returning * into saved;
  return saved;
end $$;

create or replace function public.upsert_product(draft jsonb) returns public.products
language plpgsql security definer set search_path = public
as $$ declare saved public.products; field text; previous public.products;
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'team access required' using errcode = '42501';
  end if;
  if jsonb_typeof(draft) is distinct from 'object' or coalesce(draft ->> 'id', '') !~ '^[a-z0-9-]+$'
    or jsonb_typeof(draft -> 'price') is distinct from 'number'
    or (draft ->> 'price') !~ '^[0-9]+(\.[0-9]{1,2})?$'
    or jsonb_typeof(draft -> 'active') is distinct from 'boolean'
    or (draft -> 'stock' is not null and draft -> 'stock' <> 'null'::jsonb and
      (jsonb_typeof(draft -> 'stock') <> 'number' or (draft ->> 'stock') !~ '^[0-9]{1,9}$')) then
    raise exception 'invalid product fields' using errcode = '22023';
  end if;
  foreach field in array array['name', 'size', 'category', 'form'] loop
    if jsonb_typeof(draft -> field) is distinct from 'string' or length(btrim(draft ->> field)) not between 1 and 200 then
      raise exception 'invalid product field: %', field using errcode = '22023';
    end if;
  end loop;
  if length(coalesce(draft ->> 'description', '')) > 10000 or length(coalesce(draft ->> 'tag', '')) > 100
    or (nullif(draft ->> 'image', '') is not null and (draft ->> 'image') !~ '^(https://|/images/)') then
    raise exception 'invalid description, tag or photo' using errcode = '22023';
  end if;
  select * into previous from public.products where id = draft ->> 'id' for update;
  if found and draft ? 'expectedStock' and previous.stock is distinct from (draft ->> 'expectedStock')::integer then
    raise exception 'Stock changed. Close and reopen the product to load current values.' using errcode = '40001';
  end if;
  -- Updates cannot change brand colours or lot assignments. WP-16 owns lot management.
  insert into public.products(id, name, size, category, price, active, form, tag, description, stock, image, color, color_ink, lot)
    values (draft ->> 'id', btrim(draft ->> 'name'), btrim(draft ->> 'size'), draft ->> 'category',
      (draft ->> 'price')::numeric, (draft ->> 'active')::boolean, btrim(draft ->> 'form'),
      nullif(btrim(draft ->> 'tag'), ''), nullif(btrim(draft ->> 'description'), ''), (draft ->> 'stock')::integer,
      nullif(draft ->> 'image', ''), draft ->> 'color', draft ->> 'colorInk',
      coalesce((select lot from public.products where id = draft ->> 'id'), nullif(draft ->> 'lot', '')))
    on conflict (id) do update set name = excluded.name, size = excluded.size, category = excluded.category,
      price = excluded.price, active = excluded.active, form = excluded.form, tag = excluded.tag,
      description = excluded.description, stock = excluded.stock, image = excluded.image
    returning * into saved;
  return saved;
end $$;

create or replace function public.update_storefront_settings(draft jsonb) returns public.settings
language plpgsql security definer set search_path = public
as $$ declare saved public.settings;
begin
  if public.platform_role() is distinct from 'owner' then
    raise exception 'owner access required' using errcode = '42501';
  end if;
  if jsonb_typeof(draft) is distinct from 'object'
    or (draft ? 'freeShippingThreshold' and draft -> 'freeShippingThreshold' <> 'null'::jsonb
      and (jsonb_typeof(draft -> 'freeShippingThreshold') <> 'number' or (draft ->> 'freeShippingThreshold') !~ '^[0-9]+(\.[0-9]{1,2})?$'))
    or (draft ? 'insuranceRate' and draft -> 'insuranceRate' <> 'null'::jsonb
      and (jsonb_typeof(draft -> 'insuranceRate') <> 'number' or (draft ->> 'insuranceRate') !~ '^[0-9]+(\.[0-9]{1,5})?$')) then
    raise exception 'invalid settings' using errcode = '22023';
  end if;
  update public.settings set
    free_shipping_threshold = case when draft ? 'freeShippingThreshold' then (draft ->> 'freeShippingThreshold')::numeric else free_shipping_threshold end,
    insurance_mode = case when draft ? 'insuranceMode' then draft ->> 'insuranceMode' else insurance_mode end,
    insurance_rate = case when draft ? 'insuranceRate' then (draft ->> 'insuranceRate')::numeric else insurance_rate end,
    updated_at = now()
    where id = true returning * into saved;
  if not found then raise exception 'storefront settings unavailable' using errcode = 'P0002'; end if;
  return saved;
end $$;

-- Supabase Storage enforces MIME and byte limits; only this bucket's policies are touched.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('catalog', 'catalog', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists catalog_public_read on storage.objects;
create policy catalog_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'catalog');
drop policy if exists catalog_team_insert on storage.objects;
create policy catalog_team_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog' and (select public.platform_role()) in ('owner', 'staff'));
drop policy if exists catalog_team_update on storage.objects;
create policy catalog_team_update on storage.objects for update to authenticated
  using (bucket_id = 'catalog' and (select public.platform_role()) in ('owner', 'staff'))
  with check (bucket_id = 'catalog' and (select public.platform_role()) in ('owner', 'staff'));
drop policy if exists catalog_team_delete on storage.objects;
create policy catalog_team_delete on storage.objects for delete to authenticated
  using (bucket_id = 'catalog' and (select public.platform_role()) in ('owner', 'staff'));

create or replace function public.restore_cancelled_stock() returns trigger
language plpgsql security definer set search_path = public
as $$ declare item record;
begin
  if old.status = 'placed' and old.payment = 'authorized' and new.status = 'cancelled' then
    -- Match checkout's lock order; cancellations and multi-line orders cannot deadlock each other.
    for item in select p.id, l.stock_reserved from public.order_lines l join public.products p on p.id = l.product_id
      where l.order_id = new.id and l.stock_reserved > 0 order by p.id for update of p
    loop
      update public.products set stock = stock + item.stock_reserved where id = item.id and stock is not null;
    end loop;
    update public.order_lines set stock_reserved = 0 where order_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists commerce_restore_stock on public.orders;
create trigger commerce_restore_stock after update of status on public.orders for each row execute function public.restore_cancelled_stock();

revoke all on function public.upsert_product(jsonb), public.upsert_category(jsonb), public.update_storefront_settings(jsonb), public.restore_cancelled_stock()
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_product(jsonb), public.upsert_category(jsonb), public.update_storefront_settings(jsonb) to authenticated;

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
  insurance_amount numeric(12,2) := 0;
  insured boolean := false;
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

  if draft ? 'insurance' and jsonb_typeof(draft -> 'insurance') <> 'boolean' then
    raise exception 'insurance must be a boolean' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(draft -> 'lines') order by value ->> 'productId' loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item -> 'quantity') is distinct from 'number'
      or (item ->> 'quantity') !~ '^[0-9]{1,5}$' then
      raise exception 'quantity must be a positive integer' using errcode = '22023';
    end if;
    quantity := (item ->> 'quantity')::integer;
    if quantity not between 1 and 10000 then raise exception 'quantity out of range' using errcode = '22023'; end if;
    if exists (select 1 from jsonb_array_elements(priced) x where x ->> 'productId' = item ->> 'productId') then
      raise exception 'duplicate product line' using errcode = '22023';
    end if;
    select * into product from public.products where id = item ->> 'productId' and active for update;
    if not found then raise exception 'product unavailable' using errcode = '22023'; end if;
    if not exists (select 1 from public.lots where lot = product.lot and product_id = product.id) then
      raise exception 'product lot unavailable' using errcode = '22023';
    end if;
    if product.stock is not null and product.stock < quantity then
      raise exception 'Only % left of %', product.stock, product.name using errcode = '22023';
    end if;
    update public.products set stock = stock - quantity where id = product.id and stock is not null;
    subtotal := subtotal + product.price * quantity;
    priced := priced || jsonb_build_array(jsonb_build_object('productId', product.id, 'quantity', quantity, 'unitPrice', product.price, 'lot', product.lot, 'stockReserved', case when product.stock is null then 0 else quantity end));
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
  if storefront.insurance_mode = 'automatic' or (storefront.insurance_mode = 'optional' and coalesce((draft ->> 'insurance')::boolean, false)) then
    insured := true;
    insurance_amount := round(base * storefront.insurance_rate, 2);
  end if;
  insert into public.orders(buyer_id, address, shipping_method_id, shipping_price, subtotal,
    discount_code, discount_amount, discount_partner_id, insurance, insurance_applied, total)
    values (buyer.id, destination, method.id, method.price, subtotal, requested_code, discount_amount, partner.id, insurance_amount, insured, base + method.price + insurance_amount)
    returning * into placed;
  insert into public.order_lines(order_id, product_id, quantity, unit_price, lot, stock_reserved)
    select placed.id, x ->> 'productId', (x ->> 'quantity')::integer, (x ->> 'unitPrice')::numeric, x ->> 'lot', (x ->> 'stockReserved')::integer
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
