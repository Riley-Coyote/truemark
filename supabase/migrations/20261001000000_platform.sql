-- WP-13 Phase A. PostgreSQL 15-compatible; run as the SQL-editor schema owner.
-- Re-runnable without resetting data, order numbers, or the review layer.
-- No extension, credential, or service-role key is needed.
begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'buyer' check (role in ('owner', 'staff', 'buyer', 'partner')),
  created_at timestamptz not null default now()
);

create table if not exists public.buyers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id),
  name text not null,
  email text not null,
  institution text not null,
  role text not null default '', -- professional role, never an authorization role
  status text not null default 'pending' check (status in ('verified', 'pending', 'declined', 'suspended')),
  joined_at timestamptz not null default now(),
  verified_at timestamptz
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id),
  label text not null default 'Laboratory',
  institution text not null check (length(btrim(institution)) between 1 and 500),
  attention text not null check (length(btrim(attention)) between 1 and 500),
  line1 text not null check (length(btrim(line1)) between 1 and 500),
  line2 text,
  city text not null check (length(btrim(city)) between 1 and 200),
  region text not null check (length(btrim(region)) between 1 and 200),
  postal text not null check (length(btrim(postal)) between 1 and 50),
  country text not null check (length(btrim(country)) between 1 and 100),
  phone text
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null unique references public.buyers(id),
  submitted_at timestamptz not null default now(),
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'declined')),
  name text not null,
  email text not null,
  role text not null default '',
  institution text not null,
  institution_type text not null default '',
  website text,
  research_area text not null default '',
  intended_use text not null default '',
  attestations jsonb not null default '[]' check (jsonb_typeof(attestations) = 'array'),
  documents jsonb not null default '[]' check (jsonb_typeof(documents) = 'array'),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  review_note text
);

create table if not exists public.products (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  size text not null,
  category text not null,
  price numeric(12,2) not null check (price between 0 and 9999999999.99),
  active boolean not null default true,
  image text,
  color text,
  color_ink text,
  form text not null,
  lot text not null,
  tag text
);

create table if not exists public.lots (
  lot text primary key,
  product_id text not null references public.products(id),
  status text not null default 'quarantine' check (status in ('quarantine', 'testing', 'released', 'rejected', 'archived')),
  received_at timestamptz,
  tested_at timestamptz,
  released_at timestamptz,
  results jsonb not null default '[]' check (jsonb_typeof(results) = 'array'),
  reference text,
  units integer check (units >= 0),
  unique (lot, product_id)
);

create table if not exists public.shipping_methods (
  id text primary key,
  label text not null,
  detail text not null,
  price numeric(12,2) not null check (price between 0 and 9999999999.99),
  active boolean not null default true
);

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id),
  name text not null,
  handle text not null default '',
  email text not null,
  code text not null unique check (code = upper(btrim(code)) and code ~ '^[A-Z0-9_-]{1,64}$'),
  rate numeric(6,5) not null check (rate between 0 and 1),
  status text not null default 'pending' check (status in ('active', 'pending', 'paused')),
  joined_at timestamptz not null default now(),
  audience text not null default '',
  unique (id, code)
);

-- discounts.percent is the single source of truth (percentage points, 10 = 10%).
-- partners.rate is a fraction (0.12 = 12%); the adapter derives codeDiscount.
create table if not exists public.discounts (
  code text primary key check (code = upper(btrim(code)) and code ~ '^[A-Z0-9_-]{1,64}$'),
  kind text not null check (kind in ('partner', 'promo')),
  percent numeric(5,2) not null check (percent between 0 and 100),
  partner_id uuid unique,
  active boolean not null default false,
  uses bigint not null default 0 check (uses >= 0),
  expires_at timestamptz,
  check ((kind = 'partner' and partner_id is not null) or (kind = 'promo' and partner_id is null)),
  foreign key (partner_id, code) references public.partners(id, code)
);

create sequence if not exists public.platform_order_number_seq start with 10500;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('TM-' || nextval('public.platform_order_number_seq'::regclass)),
  buyer_id uuid not null references public.buyers(id),
  created_at timestamptz not null default now(),
  status text not null default 'placed' check (status in ('placed', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment text not null default 'authorized' check (payment in ('authorized', 'captured', 'refunded', 'failed')),
  address jsonb not null check (jsonb_typeof(address) = 'object'),
  shipping_method_id text not null references public.shipping_methods(id),
  shipping_price numeric(12,2) not null check (shipping_price between 0 and 9999999999.99),
  carrier text,
  tracking text,
  subtotal numeric(12,2) not null check (subtotal between 0 and 9999999999.99),
  discount_code text references public.discounts(code),
  discount_amount numeric(12,2) not null default 0 check (discount_amount between 0 and subtotal),
  discount_partner_id uuid references public.partners(id),
  total numeric(12,2) not null check (total between 0 and 9999999999.99),
  check (total = subtotal - discount_amount + shipping_price)
);

create table if not exists public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  product_id text not null references public.products(id),
  quantity integer not null check (quantity between 1 and 10000),
  unit_price numeric(12,2) not null check (unit_price between 0 and 9999999999.99),
  lot text not null,
  unique (order_id, product_id),
  foreign key (lot, product_id) references public.lots(lot, product_id)
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  status text not null check (status in ('placed', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded')),
  at timestamptz not null default now(),
  note text,
  actor_id uuid not null references public.profiles(id)
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  amount numeric(12,2) not null check (amount between 0 and 9999999999.99),
  referrals integer not null check (referrals > 0),
  status text not null check (status in ('scheduled', 'paid')),
  paid_at timestamptz,
  method text not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id)
);

-- Deliberately no buyer id, name, email, address or institution in this row.
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  order_id uuid not null unique references public.orders(id),
  order_number text not null,
  created_at timestamptz not null default now(),
  order_subtotal numeric(12,2) not null check (order_subtotal between 0 and 9999999999.99),
  commission numeric(12,2) not null check (commission between 0 and order_subtotal),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'void')),
  via text not null check (via in ('link', 'code')),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  payout_id uuid references public.payouts(id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience = 'owner' or audience ~ '^(buyer|partner):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  kind text not null check (kind in ('order.placed', 'order.paid', 'order.packed', 'order.shipped', 'order.delivered', 'order.cancelled', 'order.refunded', 'referral.created', 'commission.approved', 'payout.sent')),
  title text not null,
  body text not null,
  amount numeric(12,2) check (amount between 0 and 9999999999.99),
  href text,
  at timestamptz not null default now(),
  read boolean not null default false
);

create table if not exists public.visits (
  partner_id uuid not null references public.partners(id),
  date date not null,
  clicks bigint not null default 0 check (clicks >= 0),
  primary key (partner_id, date)
);

create index if not exists addresses_buyer_idx on public.addresses(buyer_id);
create index if not exists orders_buyer_created_idx on public.orders(buyer_id, created_at desc);
create index if not exists order_events_order_at_idx on public.order_events(order_id, at);
create index if not exists referrals_partner_created_idx on public.referrals(partner_id, created_at desc);
create index if not exists referrals_approval_idx on public.referrals(created_at) where status = 'pending';
create index if not exists payouts_partner_idx on public.payouts(partner_id, created_at desc);
create index if not exists notifications_audience_at_idx on public.notifications(audience, at desc);
create index if not exists lots_product_idx on public.lots(product_id);

-- A narrowly scoped definer lookup avoids recursive profiles policies. Roles are
-- read from the SQL-managed profile, never from user-editable JWT metadata.
create or replace function public.platform_role() returns text
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid(); $$;

-- All table access is read-only except a buyer's own address book. Do not use
-- ALL TABLES IN SCHEMA: the existing review tables and grants are independent.
do $$
declare t text;
begin
  foreach t in array array['profiles', 'buyers', 'addresses', 'applications', 'products', 'lots',
    'shipping_methods', 'partners', 'discounts', 'orders', 'order_lines', 'order_events',
    'payouts', 'referrals', 'notifications', 'visits'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('drop policy if exists platform_team_read on public.%I', t);
    execute format('create policy platform_team_read on public.%I for select to authenticated using ((select public.platform_role()) in (''owner'', ''staff''))', t);
  end loop;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.products, public.lots, public.shipping_methods to anon;
grant insert, update, delete on public.addresses to authenticated;
revoke all on sequence public.platform_order_number_seq from public, anon, authenticated, service_role;

drop policy if exists platform_self_read on public.profiles;
create policy platform_self_read on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists platform_buyer_read on public.buyers;
create policy platform_buyer_read on public.buyers for select to authenticated
  using ((select public.platform_role()) = 'buyer' and user_id = (select auth.uid()));
drop policy if exists platform_buyer_read on public.applications;
create policy platform_buyer_read on public.applications for select to authenticated
  using ((select public.platform_role()) = 'buyer' and buyer_id in (select id from public.buyers where user_id = (select auth.uid())));

drop policy if exists platform_buyer_addresses on public.addresses;
create policy platform_buyer_addresses on public.addresses for all to authenticated
  using ((select public.platform_role()) = 'buyer' and buyer_id in (select id from public.buyers where user_id = (select auth.uid())))
  with check ((select public.platform_role()) = 'buyer' and buyer_id in (select id from public.buyers where user_id = (select auth.uid())));

drop policy if exists platform_public_products on public.products;
create policy platform_public_products on public.products for select to anon, authenticated using (active);
drop policy if exists platform_public_shipping on public.shipping_methods;
create policy platform_public_shipping on public.shipping_methods for select to anon, authenticated using (active);
drop policy if exists platform_public_lots on public.lots;
create policy platform_public_lots on public.lots for select to anon, authenticated
  using (status = 'released' and jsonb_array_length(results) > 0);

drop policy if exists platform_partner_read on public.partners;
create policy platform_partner_read on public.partners for select to authenticated
  using ((select public.platform_role()) = 'partner' and user_id = (select auth.uid()));
drop policy if exists platform_buyer_read on public.orders;
create policy platform_buyer_read on public.orders for select to authenticated
  using ((select public.platform_role()) = 'buyer' and buyer_id in (select id from public.buyers where user_id = (select auth.uid())));
drop policy if exists platform_buyer_read on public.order_lines;
create policy platform_buyer_read on public.order_lines for select to authenticated
  using ((select public.platform_role()) = 'buyer' and order_id in (select id from public.orders));
drop policy if exists platform_buyer_read on public.order_events;
create policy platform_buyer_read on public.order_events for select to authenticated
  using ((select public.platform_role()) = 'buyer' and order_id in (select id from public.orders));

do $$
declare t text;
begin
  foreach t in array array['referrals', 'payouts', 'visits'] loop
    execute format('drop policy if exists platform_partner_read on public.%I', t);
    execute format('create policy platform_partner_read on public.%I for select to authenticated using ((select public.platform_role()) = ''partner'' and partner_id in (select id from public.partners where user_id = (select auth.uid())))', t);
  end loop;
end;
$$;
drop policy if exists platform_audience_read on public.notifications;
create policy platform_audience_read on public.notifications for select to authenticated using (
  ((select public.platform_role()) = 'buyer' and audience in (select 'buyer:' || id::text from public.buyers where user_id = (select auth.uid())))
  or ((select public.platform_role()) = 'partner' and audience in (select 'partner:' || id::text from public.partners where user_id = (select auth.uid())))
);

-- Supabase signUp options.data.application takes the Application form's camelCase
-- fields. Every auth insert gets a buyer-role profile; only an application object
-- also creates a pending buyer and application, atomically. Dashboard-provisioned
-- users without that object remain profile-only until SQL assigns their role.
-- The auth email and SQL defaults are authoritative.
create or replace function public.platform_handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  form jsonb := new.raw_user_meta_data -> 'application';
  buyer public.buyers;
begin
  insert into public.profiles(id, role) values (new.id, 'buyer');
  if jsonb_typeof(form) is distinct from 'object' then return new; end if;
  insert into public.buyers(user_id, name, email, institution, role)
    values (new.id, coalesce(form ->> 'name', ''), coalesce(new.email, ''),
      coalesce(form ->> 'institution', ''), coalesce(form ->> 'role', '')) returning * into buyer;
  insert into public.applications(buyer_id, name, email, role, institution, institution_type,
    website, research_area, intended_use, attestations, documents)
    values (buyer.id, buyer.name, buyer.email, buyer.role, buyer.institution,
      coalesce(form ->> 'institutionType', ''), form ->> 'website',
      coalesce(form ->> 'researchArea', ''), coalesce(form ->> 'intendedUse', ''),
      coalesce(form -> 'attestations', '[]'::jsonb), coalesce(form -> 'documents', '[]'::jsonb));
  return new;
end;
$$;
drop trigger if exists platform_new_auth_user on auth.users;
create trigger platform_new_auth_user after insert on auth.users
  for each row execute function public.platform_handle_new_user();

-- Verify can acknowledge unreleased lots without exposing their early evidence.
-- The direct lots-table policy stays restricted to released, nonempty results.
create or replace function public.lot_lookup(lot text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'lot', l.lot, 'productId', l.product_id, 'status', l.status,
    'releasedAt', l.released_at,
    'reference', case when l.status = 'released' then l.reference else null end,
    'results', case when l.status = 'released' then l.results else '[]'::jsonb end
  ) from public.lots l
    where upper(regexp_replace(l.lot, '[[:space:]]+', '', 'g')) = upper(regexp_replace($1, '[[:space:]]+', '', 'g'))
      and l.status in ('quarantine', 'testing', 'released');
$$;

-- Team members can read all alerts, but may mark only the shared owner audience.
-- Empty/null ids and already-read notices change nothing; ids never select all.
create or replace function public.mark_notifications_read(ids uuid[]) returns integer
language plpgsql security definer set search_path = public
as $$
declare
  caller_role text := public.platform_role();
  caller_audience text;
  changed integer;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if caller_role in ('owner', 'staff') then
    caller_audience := 'owner';
  elsif caller_role = 'buyer' then
    select 'buyer:' || b.id::text into caller_audience from public.buyers b where b.user_id = auth.uid();
  elsif caller_role = 'partner' then
    select 'partner:' || p.id::text into caller_audience from public.partners p where p.user_id = auth.uid();
  end if;
  update public.notifications n set read = true
    where n.id = any($1) and not n.read and n.audience = caller_audience;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

-- Public checkout gets exactly two fields, never ids, email, rates or uses.
create or replace function public.resolve_code(code text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('percent', d.percent, 'partnerName', p.name)
    from public.discounts d left join public.partners p on p.id = d.partner_id
    where d.code = upper(btrim($1)) and d.active and (d.expires_at is null or d.expires_at > now())
      and (d.kind = 'promo' or p.status = 'active');
$$;

create or replace function public.record_visit(code text) returns void
language plpgsql security definer set search_path = public
as $$
declare partner uuid;
begin
  select p.id into partner from public.partners p join public.discounts d on d.partner_id = p.id
    where p.code = upper(btrim($1)) and p.status = 'active' and d.active
      and (d.expires_at is null or d.expires_at > now());
  if partner is not null then
    insert into public.visits(partner_id, date, clicks) values (partner, (now() at time zone 'UTC')::date, 1)
      on conflict (partner_id, date) do update set clicks = public.visits.clicks + 1;
  end if;
end;
$$;

create or replace function public.place_order(draft jsonb) returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  buyer public.buyers;
  product public.products;
  method public.shipping_methods;
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
      '$' || placed.total::text || ' · ' || buyer.institution || case when partner.id is not null then ' · via ' || partner.code else '' end,
      placed.total, '/admin/orders?order=' || placed.id::text),
    ('buyer:' || buyer.id::text, 'order.placed', 'Order ' || placed.number || ' is confirmed',
      'We''ll write again when it ships, cold, to your institutional address.', null, '/account/orders/' || placed.id::text);
  if partner.id is not null then
    insert into public.referrals(partner_id, order_id, order_number, order_subtotal, commission, via)
      values (partner.id, placed.id, placed.number, base, round(base * partner.rate, 2), via);
    insert into public.notifications(audience, kind, title, body, amount, href) values
      ('partner:' || partner.id::text, 'referral.created', 'New order through your ' || via,
        'Order ' || placed.number || ' · $' || base::text || ' subtotal', round(base * partner.rate, 2), '/partners/app/referrals');
  end if;
  return placed;
end;
$$;

create or replace function public.advance_order(order_id uuid, status text, carrier text default null, tracking text default null, note text default null)
returns public.orders language plpgsql security definer set search_path = public
as $$
declare changed public.orders;
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'team access required' using errcode = '42501';
  end if;
  select * into changed from public.orders o where o.id = $1 for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if $2 is null or $2 not in ('paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded') then
    raise exception 'invalid order status' using errcode = '22023';
  end if;
  if changed.status = $2 then return changed; end if;
  -- Forward movement, cancellation and refund only. Shipping may skip packing;
  -- authorized orders must be captured before fulfillment or referral approval.
  if not (
    (changed.status = 'placed' and $2 in ('paid', 'cancelled')) or
    (changed.status = 'paid' and $2 in ('packed', 'shipped', 'cancelled', 'refunded')) or
    (changed.status = 'packed' and $2 in ('shipped', 'cancelled', 'refunded')) or
    (changed.status = 'shipped' and $2 in ('delivered', 'refunded')) or
    (changed.status = 'delivered' and $2 = 'refunded')
  ) then raise exception 'invalid order transition' using errcode = '22023'; end if;
  update public.orders o set status = $2,
    payment = case when $2 = 'paid' then 'captured' when $2 = 'refunded' then 'refunded'
      when $2 = 'cancelled' then case when o.payment = 'captured' then 'refunded' else 'failed' end else o.payment end,
    carrier = coalesce(nullif(btrim($3), ''), o.carrier), tracking = coalesce(nullif(btrim($4), ''), o.tracking)
    where o.id = $1 returning * into changed;
  insert into public.order_events(order_id, status, note, actor_id) values ($1, $2, $5, auth.uid());
  if $2 in ('cancelled', 'refunded') then
    update public.referrals r set status = 'void' where r.order_id = $1 and r.status in ('pending', 'approved');
  end if;
  insert into public.notifications(audience, kind, title, body, href) values
    ('buyer:' || changed.buyer_id::text, 'order.' || $2, 'Order ' || changed.number || ' is ' || $2,
      case when $2 = 'shipped' then coalesce(changed.carrier, 'Carrier') || coalesce(' · ' || changed.tracking, '')
        when $2 = 'packed' then 'Packed cold and held until it ships.'
        when $2 = 'delivered' then 'Certificates for each lot are in your account.'
        else 'Your order status has been updated.' end,
      '/account/orders/' || changed.id::text);
  return changed;
end;
$$;

create or replace function public.review_application(id uuid, status text, note text default null)
returns public.applications language plpgsql security definer set search_path = public
as $$
declare reviewed public.applications;
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'team access required' using errcode = '42501';
  end if;
  if $2 is null or $2 not in ('approved', 'declined') then
    raise exception 'invalid review status' using errcode = '22023';
  end if;
  select * into reviewed from public.applications a where a.id = $1 for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if reviewed.status = $2 then return reviewed; end if;
  if reviewed.status <> 'submitted' then
    raise exception 'application already reviewed' using errcode = '22023';
  end if;
  update public.applications a set status = $2, reviewed_at = now(), reviewed_by = auth.uid(), review_note = $3
    where a.id = $1 returning * into reviewed;
  update public.buyers b set status = case when $2 = 'approved' then 'verified' else 'declined' end,
    verified_at = case when $2 = 'approved' then now() else null end where b.id = reviewed.buyer_id;
  return reviewed;
end;
$$;

-- The cutoff is exclusive, at midnight UTC. Only captured, unvoided sales count.
create or replace function public.approve_referrals(before date) returns integer
language plpgsql security definer set search_path = public
as $$
declare referral public.referrals; approved integer := 0;
begin
  if public.platform_role() is distinct from 'owner' then
    raise exception 'owner access required' using errcode = '42501';
  end if;
  if $1 is null or not isfinite($1) then raise exception 'a cutoff date is required' using errcode = '22023'; end if;
  for referral in select r.* from public.referrals r join public.orders o on o.id = r.order_id
    where r.status = 'pending' and r.created_at < ($1::timestamp at time zone 'UTC')
      and o.payment = 'captured' and o.status in ('paid', 'packed', 'shipped', 'delivered')
    order by o.id for update of o, r loop
    update public.referrals set status = 'approved', approved_at = now(), approved_by = auth.uid() where id = referral.id;
    insert into public.notifications(audience, kind, title, body, amount, href) values
      ('partner:' || referral.partner_id::text, 'commission.approved', 'Commission approved',
        'Order ' || referral.order_number || ' · ready for payout', referral.commission, '/partners/app/payouts');
    approved := approved + 1;
  end loop;
  return approved;
end;
$$;

-- Records a transfer performed outside TrueMark; does not send money. The amount
-- and count are derived from locked, approved referrals, never from the caller.
-- Both period endpoints include the entire UTC date.
create or replace function public.record_payout(partner_id uuid, period_start date, period_end date, method text, note text default null)
returns public.payouts language plpgsql security definer set search_path = public
as $$
declare
  referral public.referrals;
  ids uuid[] := array[]::uuid[];
  amount numeric(12,2) := 0;
  recorded public.payouts;
begin
  if public.platform_role() is distinct from 'owner' then
    raise exception 'owner access required' using errcode = '42501';
  end if;
  if $2 is null or $3 is null or not isfinite($2) or not isfinite($3) or $3 < $2
    or $4 is null or length(btrim($4)) not between 1 and 200 then
    raise exception 'invalid payout period or method' using errcode = '22023';
  end if;
  perform 1 from public.partners p where p.id = $1 for update;
  if not found then raise exception 'partner not found' using errcode = 'P0002'; end if;
  for referral in select r.* from public.referrals r join public.orders o on o.id = r.order_id
    where r.partner_id = $1 and r.status = 'approved' and r.payout_id is null
      and r.created_at >= ($2::timestamp at time zone 'UTC')
      and r.created_at < (($3 + 1)::timestamp at time zone 'UTC')
      and o.payment = 'captured' and o.status in ('paid', 'packed', 'shipped', 'delivered')
    order by o.id for update of o, r loop
    ids := array_append(ids, referral.id);
    amount := amount + referral.commission;
  end loop;
  if cardinality(ids) = 0 then raise exception 'no approved referrals in period' using errcode = '22023'; end if;
  insert into public.payouts(partner_id, period_start, period_end, amount, referrals, status, paid_at, method, note, created_by)
    values ($1, $2, $3, amount, cardinality(ids), 'paid', now(), btrim($4), $5, auth.uid()) returning * into recorded;
  update public.referrals set status = 'paid', payout_id = recorded.id where id = any(ids);
  insert into public.notifications(audience, kind, title, body, amount, href) values
    ('partner:' || $1::text, 'payout.sent', 'Payout sent', cardinality(ids)::text || ' orders · ' || btrim($4), amount, '/partners/app/payouts');
  return recorded;
end;
$$;

-- Explicit ACLs also remove Supabase's default function grants. Only these RPCs
-- may cross the read-only table boundary; every private RPC checks the SQL role.
revoke all on function public.platform_role() from public, anon, authenticated, service_role;
revoke all on function public.platform_handle_new_user() from public, anon, authenticated, service_role;
revoke all on function public.lot_lookup(text) from public, anon, authenticated, service_role;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.resolve_code(text) from public, anon, authenticated, service_role;
revoke all on function public.record_visit(text) from public, anon, authenticated, service_role;
revoke all on function public.place_order(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.advance_order(uuid, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.review_application(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.approve_referrals(date) from public, anon, authenticated, service_role;
revoke all on function public.record_payout(uuid, date, date, text, text) from public, anon, authenticated, service_role;
grant execute on function public.platform_role() to authenticated;
grant execute on function public.resolve_code(text), public.record_visit(text), public.lot_lookup(text) to anon, authenticated;
grant execute on function public.place_order(jsonb), public.advance_order(uuid, text, text, text, text),
  public.review_application(uuid, text, text), public.approve_referrals(date),
  public.record_payout(uuid, date, date, text, text), public.mark_notifications_read(uuid[]) to authenticated;

-- Supabase provides this publication; the harness creates an empty stand-in.
-- Default replica identity sends primary keys for old rows, not buyer snapshots.
do $$
declare t text;
begin
  foreach t in array array['orders', 'order_events', 'referrals', 'notifications'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

commit;
