-- WP-25: payments, tax, cancellations and refunds. Local proofs only.
begin;
alter table public.orders drop constraint if exists orders_payment_check;
alter table public.orders add constraint orders_payment_check check (payment in ('pending','authorized','captured','partially_refunded','refunded','failed'));
alter table public.orders add column if not exists tax numeric(12,2) not null default 0 check (tax >= 0);
alter table public.orders add column if not exists tax_rate numeric(6,5);
alter table public.orders add column if not exists tax_region text;
alter table public.orders add column if not exists refunded numeric(12,2) not null default 0 check (refunded >= 0);
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists payment_expires_at timestamptz;
alter table public.orders add column if not exists payment_provider text;
alter table public.orders add column if not exists referral_via text check (referral_via is null or referral_via in ('link','code'));
alter table public.orders drop constraint if exists orders_commerce_total;
alter table public.orders drop constraint if exists orders_total_with_tax;
alter table public.orders add constraint orders_total_with_tax check (total = subtotal - discount_amount + shipping_price + insurance + tax);
alter table public.orders drop constraint if exists orders_refunded_limit;
alter table public.orders add constraint orders_refunded_limit check (refunded <= total);
alter table public.referrals add column if not exists commission_base numeric(12,2);
update public.referrals set commission_base = commission where commission_base is null;
alter table public.settings add column if not exists tax_mode text not null default 'off' check (tax_mode in ('off','rates'));
alter table public.settings add column if not exists tax_shipping boolean not null default false;
create table if not exists public.tax_rates (
 region text primary key check (region ~ '^[A-Z]{2}$'), rate numeric(6,5) not null check (rate >= 0 and rate <= 0.2),
 updated_at timestamptz not null default now(), updated_by uuid references public.profiles(id)
);
create table if not exists public.payments (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
 kind text not null check (kind in ('charge','refund')), provider text not null,
 amount numeric(12,2) not null check (amount > 0), status text not null default 'pending' check (status in ('pending','succeeded','failed','abandoned')),
 provider_ref text, failure_reason text check (length(failure_reason) <= 300), reason text check (length(reason) <= 500),
 cancels_order boolean not null default false, created_at timestamptz not null default now(), completed_at timestamptz,
 created_by uuid references public.profiles(id), unique(provider, provider_ref)
);
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check (status in ('pending','succeeded','failed','abandoned'));
alter table public.orders add column if not exists charge_id uuid references public.payments(id);
alter table public.payments add column if not exists refund_of uuid references public.payments(id);
alter table public.payments add column if not exists late boolean not null default false;
create index if not exists payments_order_created_idx on public.payments(order_id, created_at);
create table if not exists public.payment_events (
 id uuid primary key default gen_random_uuid(), provider text, event_id text, type text,
 received_at timestamptz default now(), payment_id uuid references public.payments(id),
 outcome text check (outcome in ('applied','duplicate','ignored','error')), detail text check (length(detail) <= 500), unique(provider,event_id)
);
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.tax_rates enable row level security;
revoke all on public.payments, public.payment_events, public.tax_rates from public, anon, authenticated, service_role;
grant select on public.payments, public.payment_events to authenticated, service_role;
grant select on public.tax_rates to anon, authenticated, service_role;
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated using (
 (select public.platform_role()) in ('owner','staff') or exists (select 1 from public.orders o join public.buyers b on b.id=o.buyer_id where o.id=order_id and b.user_id=auth.uid())
);
drop policy if exists payments_service on public.payments;
create policy payments_service on public.payments for select to service_role using (true);
drop policy if exists payment_events_read on public.payment_events;
create policy payment_events_read on public.payment_events for select to authenticated using ((select public.platform_role()) in ('owner','staff'));
drop policy if exists payment_events_service on public.payment_events;
create policy payment_events_service on public.payment_events for select to service_role using (true);
drop policy if exists tax_rates_read on public.tax_rates;
create policy tax_rates_read on public.tax_rates for select to anon, authenticated, service_role using (true);
create or replace function public.us_region_code(region text, country text) returns text
language sql immutable security definer set search_path = public as $$
 select code from (values ('AL','Alabama'),('AK','Alaska'),('AZ','Arizona'),('AR','Arkansas'),('CA','California'),('CO','Colorado'),('CT','Connecticut'),('DE','Delaware'),('DC','District of Columbia'),('FL','Florida'),('GA','Georgia'),('HI','Hawaii'),('ID','Idaho'),('IL','Illinois'),('IN','Indiana'),('IA','Iowa'),('KS','Kansas'),('KY','Kentucky'),('LA','Louisiana'),('ME','Maine'),('MD','Maryland'),('MA','Massachusetts'),('MI','Michigan'),('MN','Minnesota'),('MS','Mississippi'),('MO','Missouri'),('MT','Montana'),('NE','Nebraska'),('NV','Nevada'),('NH','New Hampshire'),('NJ','New Jersey'),('NM','New Mexico'),('NY','New York'),('NC','North Carolina'),('ND','North Dakota'),('OH','Ohio'),('OK','Oklahoma'),('OR','Oregon'),('PA','Pennsylvania'),('RI','Rhode Island'),('SC','South Carolina'),('SD','South Dakota'),('TN','Tennessee'),('TX','Texas'),('UT','Utah'),('VT','Vermont'),('VA','Virginia'),('WA','Washington'),('WV','West Virginia'),('WI','Wisconsin'),('WY','Wyoming')) s(code,name)
 where lower(regexp_replace($2,'\s','','g')) in ('us','usa','unitedstates','unitedstatesofamerica')
 and lower(regexp_replace($1,'\s','','g')) in (lower(code),lower(replace(name,' ','')))
$$;
create or replace function public.set_tax_settings(mode text, shipping boolean) returns public.settings
language plpgsql security definer set search_path = public as $$ declare saved public.settings; begin
 if public.platform_role() is distinct from 'owner' then raise exception 'owner access required' using errcode='42501'; end if;
 if $1 is null or $1 not in ('off','rates') or $2 is null then raise exception 'invalid tax settings' using errcode='22023'; end if;
 update public.settings set tax_mode=$1,tax_shipping=$2 where id=true returning * into saved; return saved;
end $$;
create or replace function public.set_tax_rate(region text, rate numeric) returns void
language plpgsql security definer set search_path = public as $$ begin
 if public.platform_role() is distinct from 'owner' then raise exception 'owner access required' using errcode='42501'; end if;
 if $1 is null or $1 !~ '^[A-Z]{2}$' or ($2 is not null and ($2 < 0 or $2 > .2 or $2::text in ('NaN','Infinity','-Infinity'))) then raise exception 'invalid tax rate' using errcode='22023'; end if;
 if $2 is null then delete from public.tax_rates where tax_rates.region=$1;
 else insert into public.tax_rates(region,rate,updated_by) values ($1,$2,auth.uid()) on conflict on constraint tax_rates_pkey do update set rate=excluded.rate,updated_at=now(),updated_by=auth.uid(); end if;
end $$;
create or replace function public.checkout_payment_mode() returns text
language sql security definer set search_path = public as $$ select coalesce((select mode from public.connections where id='payments'),'off') $$;
create or replace function public.restore_cancelled_stock() returns trigger
language plpgsql security definer set search_path = public
as $$ declare item record;
begin
  if old.status in ('placed','paid','packed') and new.status = 'cancelled' then
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
  payment_mode text;
  tax_amount numeric(12,2) := 0;
  chosen_rate numeric(6,5);
  chosen_region text;
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
  payment_mode := public.checkout_payment_mode();
  if storefront.tax_mode = 'rates' then
    chosen_region := public.us_region_code(destination ->> 'region', destination ->> 'country');
    select rate into chosen_rate from public.tax_rates where region=chosen_region;
    chosen_rate := coalesce(chosen_rate,0);
    tax_amount := round((base + case when storefront.tax_shipping then method.price else 0 end) * chosen_rate,2);
  end if;
  insert into public.orders(buyer_id, address, shipping_method_id, shipping_price, subtotal,
    discount_code, discount_amount, discount_partner_id, insurance, insurance_applied, total, tax, tax_rate, tax_region, payment, payment_expires_at, referral_via)
    values (buyer.id, destination, method.id, method.price, subtotal, requested_code, discount_amount, partner.id, insurance_amount, insured, base + method.price + insurance_amount + tax_amount, tax_amount, chosen_rate, chosen_region, case when payment_mode='off' then 'authorized' else 'pending' end, case when payment_mode='off' then null else now()+interval '30 minutes' end, via)
    returning * into placed;
  insert into public.order_lines(order_id, product_id, quantity, unit_price, lot, stock_reserved)
    select placed.id, x ->> 'productId', (x ->> 'quantity')::integer, (x ->> 'unitPrice')::numeric, x ->> 'lot', (x ->> 'stockReserved')::integer
      from jsonb_array_elements(priced) x;
  insert into public.order_events(order_id, status, actor_id, source, note) values (placed.id, 'placed', auth.uid(), 'buyer', case when payment_mode='off' then null else 'Awaiting payment' end);
  if payment_mode = 'off' then
  insert into public.notifications(audience, kind, title, body, amount, href) values
    ('owner', 'order.placed', 'New order ' || placed.number,
      '$' || placed.total::text || ' ' || chr(183) || ' ' || buyer.institution || case when partner.id is not null then ' ' || chr(183) || ' via ' || partner.code else '' end,
      placed.total, '/admin/orders?order=' || placed.id::text),
    ('buyer:' || buyer.id::text, 'order.placed', 'Order ' || placed.number || ' is confirmed',
      'We''ll write again when it ships.', null, '/account/orders/' || placed.id::text);
  if partner.id is not null then
    insert into public.referrals(partner_id, order_id, order_number, order_subtotal, commission, commission_base, via)
      values (partner.id, placed.id, placed.number, base, round(base * partner.rate, 2), round(base * partner.rate, 2), via);
    insert into public.notifications(audience, kind, title, body, amount, href) values
      ('partner:' || partner.id::text, 'referral.created', 'New order through your ' || via,
        'Order ' || placed.number || ' ' || chr(183) || ' $' || base::text || ' subtotal', round(base * partner.rate, 2), '/partners/app/referrals');
  end if;
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
  if $2='paid' and changed.payment <> 'authorized' then raise exception 'Payment marks this order paid.' using errcode='22023'; end if;
  if $2 in ('cancelled','refunded') then
    if changed.payment_provider is not null then raise exception 'Cancel or refund it from the order''s payment section.' using errcode='22023'; end if;
    if changed.payment='pending' then raise exception 'Cancel unpaid orders with Cancel order.' using errcode='22023'; end if;
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
  insert into public.order_events(order_id, status, note, actor_id, source) values ($1, $2, $5, auth.uid(), 'team');
  if $2 in ('cancelled', 'refunded') then
    update public.referrals r set status = 'void' where r.order_id = $1 and r.status in ('pending', 'approved');
  end if;
  insert into public.notifications(audience, kind, title, body, href) values
    ('buyer:' || changed.buyer_id::text, 'order.' || $2, 'Order ' || changed.number || ' is ' || $2,
      case when $2 = 'shipped' then coalesce(changed.carrier, 'Carrier') || coalesce(' ' || chr(183) || ' ' || changed.tracking, '')
        when $2 = 'packed' then 'Packed cold and held until it ships.'
        when $2 = 'delivered' then 'Certificates for each lot are in your account.'
        else 'Your order status has been updated.' end,
      '/account/orders/' || changed.id::text);
  return changed;
end;
$$;

create or replace function public.system_create_charge(order_id uuid, provider text, buyer_user uuid) returns public.payments
language plpgsql security definer set search_path = public as $$ declare o public.orders; saved public.payments; begin
 select * into o from public.orders where id=$1 for update;
 if not found or not exists (select 1 from public.buyers where id=o.buyer_id and user_id=$3) then raise exception 'buyer access required' using errcode='42501'; end if;
 if o.status <> 'placed' or o.payment <> 'pending' or o.payment_expires_at <= now() then raise exception 'Order is not awaiting payment.' using errcode='22023'; end if;
 if $2 is null or btrim($2)='' then raise exception 'provider required' using errcode='22023'; end if;
 update public.payments set status='abandoned',failure_reason='replaced',completed_at=now() where payments.order_id=$1 and kind='charge' and status='pending';
 insert into public.payments(order_id,kind,provider,amount,created_by) values ($1,'charge',$2,o.total,$3) returning * into saved; return saved;
end $$;
create or replace function public.cancel_unpaid_order(order_id uuid) returns public.orders
language plpgsql security definer set search_path = public as $$ declare o public.orders; src text; begin
 select * into o from public.orders where id=$1 for update;
 if not found then raise exception 'order not found' using errcode='P0002'; end if;
 if coalesce(public.platform_role(),'') in ('owner','staff') then src:='team';
 elsif exists (select 1 from public.buyers where id=o.buyer_id and user_id=auth.uid()) then src:='buyer';
 else raise exception 'buyer or team access required' using errcode='42501'; end if;
 if o.status <> 'placed' or o.payment <> 'pending' then raise exception 'Order is not awaiting payment.' using errcode='22023'; end if;
 update public.orders set status='cancelled',payment='failed' where id=$1 returning * into o;
 update public.payments set status='abandoned',failure_reason='cancelled',completed_at=now() where payments.order_id=$1 and status='pending' and kind='charge';
 update public.discounts set uses=greatest(uses-1,0) where code=o.discount_code;
 insert into public.order_events(order_id,status,source,note,actor_id) values ($1,'cancelled',src,'Payment not completed',auth.uid());
 return o;
end $$;
create or replace function public.system_expire_unpaid_orders() returns integer
language plpgsql security definer set search_path = public as $$ declare o public.orders; n integer:=0; begin
 for o in select * from public.orders where status='placed' and payment='pending' and payment_expires_at <= now() order by id for update loop
  update public.orders set status='cancelled',payment='failed' where id=o.id;
  update public.payments set status='abandoned',failure_reason='expired',completed_at=now() where order_id=o.id and status='pending' and kind='charge';
  update public.discounts set uses=greatest(uses-1,0) where code=o.discount_code;
  insert into public.order_events(order_id,status,source,note) values (o.id,'cancelled','system','Payment not completed within 30 minutes'); n:=n+1;
 end loop; return n;
end $$;
create or replace function public.system_create_refund(order_id uuid, amount numeric, reason text, cancels boolean, actor uuid) returns public.payments
language plpgsql security definer set search_path = public as $$ declare o public.orders; saved public.payments; remaining numeric; begin
 if $5 is not null and not exists (select 1 from public.profiles where id=$5 and role='owner') then raise exception 'Only an owner can move money.' using errcode='42501'; end if;
 select * into o from public.orders where id=$1 for update;
 if not found then raise exception 'order not found' using errcode='P0002'; end if;
 if o.payment not in ('captured','partially_refunded') or o.payment_provider is null then raise exception 'No provider payment to refund.' using errcode='22023'; end if;
 select o.total-o.refunded-coalesce(sum(p.amount),0) into remaining from public.payments p where p.order_id=$1 and p.kind='refund' and p.status='pending';
 if $2 is null or $2::text in ('NaN','Infinity','-Infinity') or $2<=0 or $2>remaining or $2<>round($2,2) then raise exception 'Refund exceeds the remaining payment.' using errcode='22023'; end if;
 if $3 is null or length(btrim($3)) not between 1 and 500 or $4 is null then raise exception 'Enter a reason of 1 to 500 characters.' using errcode='22023'; end if;
 if $4 and (o.status not in ('paid','packed') or $2<>o.total-o.refunded) then raise exception 'Cancellation requires the full remaining payment on a paid or packed order.' using errcode='22023'; end if;
 insert into public.payments(order_id,kind,provider,amount,reason,cancels_order,created_by,refund_of) values ($1,'refund',o.payment_provider,$2,btrim($3),$4,$5,o.charge_id) returning * into saved; return saved;
end $$;
create or replace function public.system_create_late_refund(charge_id uuid) returns public.payments
language plpgsql security definer set search_path = public as $$
declare charge public.payments; saved public.payments;
begin
 select * into charge from public.payments where id=$1;
 if not found then raise exception 'No provider payment to refund.' using errcode='22023'; end if;
 -- Match event/refund lock order and serialize refund creation for this charge.
 perform 1 from public.orders where id=charge.order_id for update;
 select * into charge from public.payments where id=$1 for update;
 if charge.kind <> 'charge' or charge.status <> 'succeeded' then
  raise exception 'No provider payment to refund.' using errcode='22023';
 end if;
 if exists (select 1 from public.payments p where p.refund_of=$1 and p.status in ('pending','succeeded')) then
  raise exception 'This payment is already being refunded.' using errcode='22023';
 end if;
 insert into public.payments(order_id,kind,provider,amount,reason,late,refund_of,created_by)
  values (charge.order_id,'refund',charge.provider,charge.amount,'Payment arrived after the order was released',true,$1,null)
  returning * into saved;
 return saved;
end $$;
create or replace function public.system_apply_payment_event(provider text,event_id text,type text,payment_id uuid,provider_ref text,amount numeric,failure_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e uuid; p public.payments; o public.orders; buyer public.buyers; partner public.partners; base numeric; result text:='ignored'; begin
 insert into public.payment_events(provider,event_id,type,payment_id,outcome) values ($1,$2,$3,$4,'ignored') on conflict on constraint payment_events_provider_event_id_key do nothing returning id into e;
 if e is null then return jsonb_build_object('result','duplicate'); end if;
 -- All monetary operations lock the order before its payments.
 select * into p from public.payments where id=$4;
 if not found or p.provider<>$1 then return jsonb_build_object('result','ignored'); end if;
 select * into o from public.orders where id=p.order_id for update;
 select * into p from public.payments where id=$4 for update;
 if $3='charge.succeeded' and p.kind='charge' then
  if p.status not in ('pending','abandoned') or $6 is distinct from p.amount then
   update public.payment_events set outcome='error',detail='Charge status or amount mismatch' where id=e;
   perform public.system_alert('A payment needs checking','Order '||o.number||': the processor reported '||coalesce($6::text,'null')||', expected '||p.amount::text||'.','/admin/orders?order='||o.id::text);
   return jsonb_build_object('result','ignored');
  end if;
  update public.payments set status='succeeded',provider_ref=$5,completed_at=now() where id=p.id;
  if o.status='placed' and o.payment='pending' then
   update public.orders set payment='captured',status='paid',paid_at=now(),payment_provider=$1,charge_id=p.id where id=o.id returning * into o;
   insert into public.order_events(order_id,status,source,note) values (o.id,'paid','payments','Payment received');
   select * into buyer from public.buyers where id=o.buyer_id;
   select * into partner from public.partners where id=o.discount_partner_id;
   base:=o.subtotal-o.discount_amount;
   insert into public.notifications(audience,kind,title,body,amount,href) values
    ('owner','order.placed','New order '||o.number,'$'||o.total::text||' '||chr(183)||' '||buyer.institution||case when partner.id is not null then ' '||chr(183)||' via '||partner.code else '' end,o.total,'/admin/orders?order='||o.id::text),
    ('buyer:'||buyer.id::text,'order.placed','Order '||o.number||' is confirmed','We''ll write again when it ships.',null,'/account/orders/'||o.id::text);
   if partner.id is not null then
    insert into public.referrals(partner_id,order_id,order_number,order_subtotal,commission,commission_base,via) values (partner.id,o.id,o.number,base,round(base*partner.rate,2),round(base*partner.rate,2),o.referral_via);
    insert into public.notifications(audience,kind,title,body,amount,href) values ('partner:'||partner.id::text,'referral.created','New order through your '||o.referral_via,'Order '||o.number||' '||chr(183)||' $'||base::text||' subtotal',round(base*partner.rate,2),'/partners/app/referrals');
   end if;
  else
   update public.payment_events set outcome='applied' where id=e;
   perform public.system_alert('A late payment is being refunded','Order '||o.number||' was released before its payment arrived. The payment is being refunded automatically.','/admin/orders?order='||o.id::text);
   return jsonb_build_object('result','applied','action','refund_needed','payment_id',p.id);
  end if;
  result:='applied';
 elsif $3='charge.failed' and p.kind='charge' and p.status in ('pending','abandoned') then
  update public.payments set status='failed',failure_reason=left($7,300),provider_ref=$5,completed_at=now() where id=p.id;
  if p.status='pending' and o.status='placed' and o.payment='pending' then
   insert into public.notifications(audience,kind,title,body,href) values ('buyer:'||o.buyer_id::text,'payment.failed','Payment didn''t go through for '||o.number,'Complete payment to keep your order.','/checkout/pay/'||o.id::text);
  end if;
  result:='applied';
 elsif $3 in ('refund.succeeded','refund.failed') and p.kind='refund' and p.status='pending' then
  if $3='refund.failed' then
   update public.payments set status='failed',provider_ref=$5,failure_reason=left($7,300),completed_at=now() where id=p.id;
   perform public.system_alert('A refund didn''t go through','Order '||o.number||': '||coalesce($7,'Unknown error')||'. Try again from the order.','/admin/orders?order='||o.id::text);
  elsif $6 is distinct from p.amount then
   update public.payment_events set outcome='error',detail='Refund amount mismatch' where id=e; return jsonb_build_object('result','ignored');
  else
   update public.payments set status='succeeded',provider_ref=$5,completed_at=now() where id=p.id;
   if not p.late then
    update public.orders set refunded=refunded+p.amount,payment=case when refunded+p.amount=total then 'refunded' else 'partially_refunded' end,
     status=case when p.cancels_order then 'cancelled' when refunded+p.amount=total then 'refunded' else status end where id=o.id returning * into o;
    if p.cancels_order or o.refunded=o.total then
     insert into public.order_events(order_id,status,source,note) values (o.id,o.status,'payments',p.reason);
     update public.referrals set status='void' where order_id=o.id and status in ('pending','approved');
    else
     update public.referrals set commission=case when order_subtotal=0 then 0 else round(commission_base*greatest(order_subtotal-least(o.refunded,order_subtotal),0)/order_subtotal,2) end where order_id=o.id and status in ('pending','approved');
    end if;
   end if;
   insert into public.notifications(audience,kind,title,body,amount,href) values ('buyer:'||o.buyer_id::text,case when p.cancels_order then 'order.cancelled' else 'order.refunded' end,
    case when p.cancels_order then 'Order '||o.number||' is cancelled' else 'Refund for '||o.number end,'A refund of $'||p.amount::text||' is on its way.',p.amount,'/account/orders/'||o.id::text);
  end if; result:='applied';
 end if;
 update public.payment_events set outcome=result where id=e; return jsonb_build_object('result',result);
end $$;
revoke all on function public.us_region_code(text,text),public.set_tax_settings(text,boolean),public.set_tax_rate(text,numeric),public.checkout_payment_mode(),public.restore_cancelled_stock(),public.place_order(jsonb),public.advance_order(uuid,text,text,text,text),public.cancel_unpaid_order(uuid),public.system_create_charge(uuid,text,uuid),public.system_create_refund(uuid,numeric,text,boolean,uuid),public.system_create_late_refund(uuid),public.system_apply_payment_event(text,text,text,uuid,text,numeric,text),public.system_expire_unpaid_orders() from public,anon,authenticated,service_role;
grant execute on function public.us_region_code(text,text),public.checkout_payment_mode() to anon,authenticated,service_role;
grant execute on function public.set_tax_settings(text,boolean),public.set_tax_rate(text,numeric),public.place_order(jsonb),public.advance_order(uuid,text,text,text,text),public.cancel_unpaid_order(uuid) to authenticated;
grant execute on function public.system_create_charge(uuid,text,uuid),public.system_create_refund(uuid,numeric,text,boolean,uuid),public.system_create_late_refund(uuid),public.system_apply_payment_event(text,text,text,uuid,text,numeric,text),public.system_expire_unpaid_orders() to service_role;
do $$ begin if to_regprocedure('cron.schedule(text,text,text)') is not null then perform cron.schedule('tm-payments-expire','*/5 * * * *',$c$select public.system_expire_unpaid_orders();$c$); end if; end $$;
commit;
