-- Free BAC Water: spend the threshold (default $75, merchandise after discounts, as free shipping is decided) and the
-- order carries one BAC Water 10 mL at $0.00. place_order adds it, never the browser; its stock is reserved by the
-- existing lot-allocation trigger. Without stock the order is placed without it and its placed event says so.
-- place_order below is 20261017000000_lot_inventory.sql's definition with only the free vial added.
begin;

alter table public.settings add column if not exists free_bac_water_threshold numeric(10,2) default 75
  check (free_bac_water_threshold >= 0);
-- Units of a line given free. An order keeps one line per product, so BAC Water already in the cart carries the free
-- vial as one more unit on its line; the line charges (quantity - free_quantity) * unit_price.
alter table public.order_lines add column if not exists free_quantity integer not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'order_lines_free_quantity_check') then
    alter table public.order_lines add constraint order_lines_free_quantity_check check (free_quantity between 0 and quantity);
  end if;
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
    or (draft ? 'freeBacWaterThreshold' and draft -> 'freeBacWaterThreshold' <> 'null'::jsonb
      and (jsonb_typeof(draft -> 'freeBacWaterThreshold') <> 'number' or (draft ->> 'freeBacWaterThreshold') !~ '^[0-9]+(\.[0-9]{1,2})?$'))
    or (draft ? 'insuranceRate' and draft -> 'insuranceRate' <> 'null'::jsonb
      and (jsonb_typeof(draft -> 'insuranceRate') <> 'number' or (draft ->> 'insuranceRate') !~ '^[0-9]+(\.[0-9]{1,5})?$')) then
    raise exception 'invalid settings' using errcode = '22023';
  end if;
  update public.settings set
    free_shipping_threshold = case when draft ? 'freeShippingThreshold' then (draft ->> 'freeShippingThreshold')::numeric else free_shipping_threshold end,
    free_bac_water_threshold = case when draft ? 'freeBacWaterThreshold' then (draft ->> 'freeBacWaterThreshold')::numeric else free_bac_water_threshold end,
    insurance_mode = case when draft ? 'insuranceMode' then draft ->> 'insuranceMode' else insurance_mode end,
    insurance_rate = case when draft ? 'insuranceRate' then (draft ->> 'insuranceRate')::numeric else insurance_rate end,
    updated_at = now()
    where id = true returning * into saved;
  if not found then raise exception 'storefront settings unavailable' using errcode = 'P0002'; end if;
  return saved;
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
  benefits jsonb;
  program public.customer_program_settings;
  tier public.membership_tiers;
  member_amount numeric(12,2) := 0;
  reward_amount numeric(12,2) := 0;
  requested_points integer := 0;
  chosen_earn numeric := 0;
  -- The free BAC Water vial.
  entry record;
  gift public.products;
  gift_id constant text := 'bacteriostatic-water-10-ml';
  gift_threshold numeric(10,2);
  gift_locked boolean := false;
  gift_paid integer := 0;
  gift_note text;
  list_subtotal numeric(12,2) := 0;
begin
  if auth.uid() is null or public.platform_role() is distinct from 'buyer' then
    raise exception 'a verified buyer account is required' using errcode = '42501';
  end if;
  select * into buyer from public.buyers where user_id = auth.uid() for share;
  if not found or buyer.status <> 'verified' then
    raise exception 'buyer account awaits verification' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(buyer.id::text, 168));
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
  -- An order whose merchandise after discounts reaches settings.free_bac_water_threshold gets one BAC Water 10 mL at
  -- $0, decided after discounts as free shipping is. Discounts only lower the list-price total, so when that total
  -- reaches the threshold, the vial's product row is locked in its place among the lines' (by id): checkouts never
  -- wait on each other in opposite orders.
  select s.free_bac_water_threshold into gift_threshold from public.settings s where s.id = true;
  if gift_threshold is not null then
    select coalesce(sum(p.price * (x ->> 'quantity')::integer), 0) into list_subtotal
      from jsonb_array_elements(draft -> 'lines') x join public.products p on p.id = x ->> 'productId' and p.active
      where jsonb_typeof(x) = 'object' and jsonb_typeof(x -> 'quantity') = 'number' and (x ->> 'quantity') ~ '^[0-9]{1,5}$';
  end if;
  for entry in
    select l.value, l.gift from (
      select value, false as gift from jsonb_array_elements(draft -> 'lines')
      union all
      select null::jsonb, true where gift_threshold is not null and list_subtotal >= gift_threshold
    ) l order by case when l.gift then gift_id else l.value ->> 'productId' end, l.gift
  loop
    if entry.gift then
      perform public.inventory_refresh(gift_id);
      gift_locked := true;
      continue;
    end if;
    item := entry.value;
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item -> 'quantity') is distinct from 'number'
      or (item ->> 'quantity') !~ '^[0-9]{1,5}$' then
      raise exception 'quantity must be a positive integer' using errcode = '22023';
    end if;
    quantity := (item ->> 'quantity')::integer;
    if quantity not between 1 and 10000 then raise exception 'quantity out of range' using errcode = '22023'; end if;
    if exists (select 1 from jsonb_array_elements(priced) x where x ->> 'productId' = item ->> 'productId') then
      raise exception 'duplicate product line' using errcode = '22023';
    end if;
    perform public.inventory_refresh(item ->> 'productId');
    select * into product from public.products where id = item ->> 'productId' and active for update;
    if not found then raise exception 'product unavailable' using errcode = '22023'; end if;
    if not exists (select 1 from public.lots where lot = product.lot and product_id = product.id) then
      raise exception 'product lot unavailable' using errcode = '22023';
    end if;
    if product.stock is not null and product.stock < quantity then
      raise exception 'Only % left of %', product.stock, product.name using errcode = '22023';
    end if;
    -- Child allocations reserve physical lots when the priced order line is inserted.
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

  end if;
  select * into program from public.customer_program_settings where id for share;
  benefits := public.customer_benefits(buyer.id, subtotal, discount_amount, coalesce((draft ->> 'rewardPoints')::numeric,0));
  member_amount := (benefits ->> 'membershipAmount')::numeric;
  reward_amount := (benefits ->> 'rewardAmount')::numeric;
  requested_points := (benefits ->> 'rewardPoints')::integer;
  if program.rewards_enabled then chosen_earn := program.earn_per_dollar; end if;
  if member_amount > 0 then
    requested_code := null; partner := null; discount_amount := 0;
  elsif requested_code is not null then
    update public.discounts d set uses = uses + 1 where d.code = requested_code;
  end if;
  discount_amount := discount_amount + member_amount + reward_amount;
  base := subtotal - discount_amount;
  select * into storefront from public.settings where id = true for share;
  if not found then raise exception 'storefront settings unavailable' using errcode = '22023'; end if;
  if storefront.free_shipping_threshold is not null
    and method.id = storefront.free_shipping_method
    and base >= storefront.free_shipping_threshold then
    method.price := 0;
  end if;
  if gift_threshold is not null and base >= gift_threshold then
    -- Reached only by a price raised since the first look: the vial's row is locked now instead.
    if not gift_locked then perform public.inventory_refresh(gift_id); end if;
    select * into gift from public.products where id = gift_id and active for update;
    gift_paid := coalesce((select (x ->> 'quantity')::integer from jsonb_array_elements(priced) x where x ->> 'productId' = gift_id), 0);
    if gift.id is not null and coalesce(gift.stock, 0) >= gift_paid + 1
      and exists (select 1 from public.lots where lot = gift.lot and product_id = gift.id) then
      if gift_paid > 0 then
        -- An order has one line per product (order_lines' unique key): BAC Water already in the cart takes one more
        -- unit, marked free, at its own price; what the line charges is its quantity less its free units.
        select jsonb_agg(case when x ->> 'productId' = gift_id
            then x || jsonb_build_object('quantity', gift_paid + 1, 'stockReserved', (x ->> 'stockReserved')::integer + 1, 'freeQuantity', 1)
            else x end order by n)
          into priced from jsonb_array_elements(priced) with ordinality as e(x, n);
      else
        select jsonb_agg(x order by x ->> 'productId') into priced
          from jsonb_array_elements(priced || jsonb_build_array(jsonb_build_object('productId', gift.id, 'quantity', 1,
            'unitPrice', 0, 'lot', gift.lot, 'stockReserved', 1, 'freeQuantity', 1))) x;
      end if;
    else
      -- None to send: the order is placed without it, and says so.
      gift_note := 'Free BAC Water not included: out of stock';
    end if;
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
    discount_code, discount_amount, discount_partner_id, insurance, insurance_applied, total, tax, tax_rate, tax_region, payment, payment_expires_at, referral_via, membership_name, membership_amount, reward_points, reward_amount, reward_earn_rate)
    values (buyer.id, destination, method.id, method.price, subtotal, requested_code, discount_amount, partner.id, insurance_amount, insured, base + method.price + insurance_amount + tax_amount, tax_amount, chosen_rate, chosen_region, case when payment_mode='off' then 'authorized' else 'pending' end, case when payment_mode='off' then null else now()+interval '30 minutes' end, via, benefits ->> 'membershipName', member_amount, requested_points, reward_amount, chosen_earn)
    returning * into placed;
  insert into public.order_lines(order_id, product_id, quantity, unit_price, lot, stock_reserved, free_quantity)
    select placed.id, x ->> 'productId', (x ->> 'quantity')::integer, (x ->> 'unitPrice')::numeric, x ->> 'lot', (x ->> 'stockReserved')::integer,
      coalesce((x ->> 'freeQuantity')::integer, 0)
      from jsonb_array_elements(priced) x;
  insert into public.order_events(order_id, status, actor_id, source, note) values (placed.id, 'placed', auth.uid(), 'buyer',
    nullif(concat_ws('. ', case when payment_mode='off' then null else 'Awaiting payment' end, gift_note), ''));
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
  if requested_points > 0 then
    insert into public.reward_ledger(buyer_id, order_id, points, kind, entry_key, note, actor_id)
      values (buyer.id, placed.id, -requested_points, 'redeem', 'redeem:'||placed.id, 'Reserved at checkout', auth.uid());
  end if;
  return placed;
end;
$$;


revoke all on function public.update_storefront_settings(jsonb), public.place_order(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.update_storefront_settings(jsonb), public.place_order(jsonb) to authenticated;

commit;
