-- Shared customer programs. Discounts and points are always priced by the database.
begin;
create table if not exists public.customer_program_settings (
 id boolean primary key default true check(id), rewards_enabled boolean not null default false,
 memberships_enabled boolean not null default false,
 earn_per_dollar numeric(8,2) not null default 1 check(earn_per_dollar between 0 and 1000),
 points_per_dollar integer not null default 100 check(points_per_dollar between 1 and 1000000),
 min_points integer not null default 500 check(min_points between 0 and 100000000),
 max_percent numeric(5,2) not null default 10 check(max_percent between 0 and 100),
 version integer not null default 1, updated_at timestamptz not null default now(), updated_by uuid references public.profiles(id)
);
insert into public.customer_program_settings(id) values(true) on conflict do nothing;
create table if not exists public.membership_tiers (
 id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name)) between 1 and 80),
 threshold numeric(12,2) not null check(threshold between 0 and 100000000),
 discount numeric(5,2) not null check(discount between 0 and 100),
 note text not null default '' check(length(note)<=500), active boolean not null default true,
 version integer not null default 1, updated_at timestamptz not null default now()
);
insert into public.membership_tiers(id,name,threshold,discount,note) values
 ('00000000-0000-4000-8000-000000000101','Research',0,0,'Verified research account'),
 ('00000000-0000-4000-8000-000000000102','Research partner',2000,5,'Spend-qualified research purchasing'),
 ('00000000-0000-4000-8000-000000000103','Institution',7500,10,'Institution purchasing tier') on conflict do nothing;
create table if not exists public.reward_ledger (
 id uuid primary key default gen_random_uuid(), buyer_id uuid not null references public.buyers(id),
 order_id uuid references public.orders(id), points bigint not null check(points<>0 and abs(points)<=1000000000),
 kind text not null check(kind in ('earn','earn_reversal','redeem','redeem_return','adjustment')),
 entry_key text not null unique check(length(entry_key) between 1 and 150),
 note text not null check(length(btrim(note)) between 1 and 500), actor_id uuid references public.profiles(id),
 created_at timestamptz not null default now()
);
create index if not exists reward_ledger_buyer_idx on public.reward_ledger(buyer_id,created_at);
create index if not exists reward_ledger_order_idx on public.reward_ledger(order_id);
create table if not exists public.program_audit (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id),
 action text not null, detail jsonb not null, created_at timestamptz not null default now()
);
alter table public.orders add column if not exists membership_name text;
alter table public.orders add column if not exists membership_amount numeric(12,2) not null default 0 check(membership_amount>=0);
alter table public.orders add column if not exists reward_points integer not null default 0 check(reward_points>=0);
alter table public.orders add column if not exists reward_amount numeric(12,2) not null default 0 check(reward_amount>=0);
alter table public.orders add column if not exists reward_earn_rate numeric(8,2) not null default 0 check(reward_earn_rate>=0);
-- No browser writes, including owners, can bypass checked RPCs.
do $$ declare t text; begin
 foreach t in array array['customer_program_settings','membership_tiers','reward_ledger','program_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated,service_role',t);
  execute format('drop policy if exists programs_team_read on public.%I',t);
  execute format('create policy programs_team_read on public.%I for select to authenticated using ((select public.platform_role()) in (''owner'',''staff''))',t);
  execute format('drop policy if exists programs_service_read on public.%I',t);
  execute format('create policy programs_service_read on public.%I for select to service_role using (true)',t);
 end loop;
end $$;
drop policy if exists rewards_buyer_read on public.reward_ledger;
create policy rewards_buyer_read on public.reward_ledger for select to authenticated
 using(buyer_id in(select id from public.buyers where user_id=(select auth.uid())));

create or replace function public.set_customer_programs(draft jsonb, expected_version integer) returns public.customer_program_settings
language plpgsql security definer set search_path=public as $$
declare saved public.customer_program_settings; begin
 if public.platform_role() is distinct from 'owner' then raise exception 'Owner access required' using errcode='42501'; end if;
 select * into saved from public.customer_program_settings where id for update;
 if saved.version is distinct from $2 then raise exception 'Programs changed in another session. Reload before saving.' using errcode='22023'; end if;
 if jsonb_typeof(draft->'rewards_enabled') is distinct from 'boolean' or jsonb_typeof(draft->'memberships_enabled') is distinct from 'boolean'
 or exists(select 1 from unnest(array['earn_per_dollar','points_per_dollar','min_points','max_percent']) k where jsonb_typeof(draft->k) is distinct from 'number')
 then raise exception 'Complete program settings are required' using errcode='22023'; end if;
 -- Changing point value after issuance would silently revalue existing wallets.
 if (draft->>'points_per_dollar')::numeric<>saved.points_per_dollar and exists(select 1 from public.reward_ledger)
 then raise exception 'Point value is fixed after the first ledger entry.' using errcode='22023'; end if;
 if (draft->>'points_per_dollar')::numeric<>trunc((draft->>'points_per_dollar')::numeric) or (draft->>'min_points')::numeric<>trunc((draft->>'min_points')::numeric)
 then raise exception 'Point settings must be whole numbers' using errcode='22023'; end if;
 update public.customer_program_settings set rewards_enabled=(draft->>'rewards_enabled')::boolean,memberships_enabled=(draft->>'memberships_enabled')::boolean,
 earn_per_dollar=(draft->>'earn_per_dollar')::numeric,points_per_dollar=(draft->>'points_per_dollar')::integer,min_points=(draft->>'min_points')::integer,
 max_percent=(draft->>'max_percent')::numeric, version=version+1,updated_at=now(),updated_by=auth.uid() where id returning * into saved;
 insert into public.program_audit(actor_id,action,detail) values(auth.uid(),'program.settings',to_jsonb(saved));
 return saved;
end $$;
create or replace function public.save_membership_tier(draft jsonb, expected_version integer default null) returns public.membership_tiers
language plpgsql security definer set search_path=public as $$
declare saved public.membership_tiers; chosen uuid; begin
 if public.platform_role() is distinct from 'owner' then raise exception 'Owner access required' using errcode='42501'; end if;
 if jsonb_typeof(draft->'name') is distinct from 'string' or jsonb_typeof(draft->'threshold') is distinct from 'number' or jsonb_typeof(draft->'discount') is distinct from 'number'
 or jsonb_typeof(draft->'active') is distinct from 'boolean' then raise exception 'Complete tier settings are required' using errcode='22023'; end if;
 chosen:=coalesce(nullif(draft->>'id','')::uuid,gen_random_uuid());
 if $2 is null then
  insert into public.membership_tiers(id,name,threshold,discount,note,active) values(chosen,btrim(draft->>'name'),(draft->>'threshold')::numeric,(draft->>'discount')::numeric,coalesce(draft->>'note',''),(draft->>'active')::boolean) returning * into saved;
 else
  update public.membership_tiers set name=btrim(draft->>'name'),threshold=(draft->>'threshold')::numeric,discount=(draft->>'discount')::numeric,note=coalesce(draft->>'note',''),active=(draft->>'active')::boolean,version=version+1,updated_at=now() where id=chosen and version=$2 returning * into saved;
  if not found then raise exception 'Tier changed in another session. Reload before saving.' using errcode='22023'; end if;
 end if;
 insert into public.program_audit(actor_id,action,detail) values(auth.uid(),'membership.saved',to_jsonb(saved)); return saved;
end $$;
create or replace function public.adjust_reward_points(buyer_id uuid, points integer, note text, request_id uuid) returns public.reward_ledger
language plpgsql security definer set search_path=public as $$
declare saved public.reward_ledger; begin
 if public.platform_role() is distinct from 'owner' then raise exception 'Owner access required' using errcode='42501'; end if;
 if $2 is null or $2=0 or abs($2::bigint)>1000000 or length(btrim($3)) not between 3 and 500 or $4 is null
 then raise exception 'Enter nonzero whole points and an audit reason' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended($1::text,168));
 select * into saved from public.reward_ledger where entry_key='adjust:'||$4;
 if found then
  if saved.buyer_id<>$1 or saved.points<>$2 or saved.note<>btrim($3) then raise exception 'Request already used for a different adjustment' using errcode='22023'; end if;
  return saved;
 end if;
 if not exists(select 1 from public.buyers where id=$1 and status='verified') then raise exception 'Choose a verified buyer' using errcode='22023'; end if;
 if coalesce((select sum(l.points) from public.reward_ledger l where l.buyer_id=$1),0)+$2<0 then raise exception 'Adjustment exceeds the available balance' using errcode='22023'; end if;
 insert into public.reward_ledger(buyer_id,points,kind,entry_key,note,actor_id) values($1,$2,'adjustment','adjust:'||$4,btrim($3),auth.uid()) returning * into saved; return saved;
end $$;
-- Private helpers are reused by pricing, account display and order transitions.
create or replace function public.program_wallet(buyer_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare s public.customer_program_settings; t public.membership_tiers; spend numeric; balance bigint; begin
 select * into s from public.customer_program_settings where id;
 select coalesce(sum(round((o.subtotal-o.discount_amount)*greatest(o.total-o.refunded,0)/nullif(o.total,0),2)),0) into spend from public.orders o
  where o.buyer_id=$1 and o.payment in('captured','partially_refunded');
 if s.memberships_enabled then select * into t from public.membership_tiers where active and threshold<=spend order by threshold desc,discount desc,id limit 1; end if;
 select coalesce(sum(l.points),0) into balance from public.reward_ledger l where l.buyer_id=$1;
 return jsonb_build_object('buyerId',$1,'balance',balance,'available',greatest(balance,0),'spend',spend,'tier',case when t.id is null then null else to_jsonb(t) end,'settings',to_jsonb(s)-'updated_by');
end $$;
create or replace function public.my_customer_programs() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare b uuid; begin
 if public.platform_role() is distinct from 'buyer' then raise exception 'Buyer access required' using errcode='42501'; end if;
 select id into b from public.buyers where user_id=auth.uid();
 if b is null then raise exception 'Research account required' using errcode='42501'; end if;
 return public.program_wallet(b);
end $$;
create or replace function public.team_customer_wallets() returns setof jsonb
language plpgsql stable security definer set search_path=public as $$ begin
 if coalesce(public.platform_role(),'') not in('owner','staff') then raise exception 'Team access required' using errcode='42501'; end if;
 return query select public.program_wallet(id) from public.buyers order by id;
end $$;
create or replace function public.customer_benefits(buyer_id uuid, subtotal numeric, promo_amount numeric, reward_points numeric default 0) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare w jsonb; s public.customer_program_settings; member_amount numeric:=0; credit numeric:=0; chosen_points integer; begin
 w:=public.program_wallet($1); select * into s from public.customer_program_settings where id;
 if $2 is null or $2<0 or $3 is null or $3<0 or $3>$2 or $4 is null or $4<>trunc($4) or $4 not between 0 and 100000000 then raise exception 'Invalid benefit request' using errcode='22023'; end if;
 member_amount:=round($2*coalesce((w->'tier'->>'discount')::numeric,0)/100,2);
 if member_amount<$3 then member_amount:=0; end if;
 if $4>0 then
  if not s.rewards_enabled or $4<s.min_points or $4>(w->>'available')::numeric or mod($4,s.points_per_dollar)<>0 then raise exception 'Points are unavailable or below the redemption minimum' using errcode='22023'; end if;
  credit:=round($4/s.points_per_dollar,2);
  if credit>round(($2-greatest(member_amount,$3))*s.max_percent/100,2) then raise exception 'Rewards exceed the order redemption limit' using errcode='22023'; end if;
 end if;
 return jsonb_build_object('membershipName',case when member_amount>0 then w->'tier'->>'name' else null end,'membershipAmount',member_amount,'rewardAmount',credit,'rewardPoints',$4::integer,'promoAmount',case when member_amount>0 then 0 else $3 end);
end $$;
create or replace function public.my_checkout_benefits(subtotal numeric, promo_amount numeric, reward_points numeric default 0) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare b uuid; begin
 if public.platform_role() is distinct from 'buyer' then raise exception 'Buyer access required' using errcode='42501'; end if;
 select id into b from public.buyers where user_id=auth.uid() and status='verified';
 if b is null then raise exception 'Verified research account required' using errcode='42501'; end if;
 return public.customer_benefits(b,$1,$2,$3);
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
  if requested_points > 0 then
    insert into public.reward_ledger(buyer_id, order_id, points, kind, entry_key, note, actor_id)
      values (buyer.id, placed.id, -requested_points, 'redeem', 'redeem:'||placed.id, 'Reserved at checkout', auth.uid());
  end if;
  return placed;
end;
$$;


-- Snapshot earning rate at placement. Cumulative deltas make duplicate webhooks harmless.
create or replace function public.sync_order_rewards() returns trigger
language plpgsql security definer set search_path=public as $$
declare earned bigint:=0; previous_earned bigint; returned bigint:=0; previous_returned bigint; begin
 if new.reward_earn_rate=0 and new.reward_points=0 then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.buyer_id::text,168));
 if new.payment in('captured','partially_refunded') then
  earned:=floor(round((new.subtotal-new.discount_amount)*greatest(new.total-new.refunded,0)/nullif(new.total,0),2)*new.reward_earn_rate);
  returned:=case when new.total>0 then floor(new.reward_points*least(new.refunded/new.total,1)) else 0 end;
 end if;
 if new.payment='refunded' or new.status='refunded' or (new.status='cancelled' and new.payment not in('captured','partially_refunded')) then returned:=new.reward_points; earned:=0; end if;
 select coalesce(sum(points),0) into previous_earned from public.reward_ledger where order_id=new.id and kind in('earn','earn_reversal');
 if earned<>previous_earned then
  insert into public.reward_ledger(buyer_id,order_id,points,kind,entry_key,note)
   values(new.buyer_id,new.id,earned-previous_earned,case when earned>previous_earned then 'earn' else 'earn_reversal' end,'earned:'||new.id||':'||gen_random_uuid(),'Order '||new.number||' · net merchandise');
 end if;
 select coalesce(sum(points),0) into previous_returned from public.reward_ledger where order_id=new.id and kind='redeem_return';
 if returned>previous_returned then insert into public.reward_ledger(buyer_id,order_id,points,kind,entry_key,note)
  values(new.buyer_id,new.id,returned-previous_returned,'redeem_return','returned:'||new.id||':'||returned,'Order '||new.number||' · released redemption'); end if;
 return new;
end $$;
drop trigger if exists customer_rewards_order on public.orders;
create trigger customer_rewards_order after update of payment,refunded,status on public.orders for each row execute function public.sync_order_rewards();
revoke all on function public.set_customer_programs(jsonb,integer),public.save_membership_tier(jsonb,integer),public.adjust_reward_points(uuid,integer,text,uuid),public.program_wallet(uuid),public.my_customer_programs(),public.team_customer_wallets(),public.customer_benefits(uuid,numeric,numeric,numeric),public.my_checkout_benefits(numeric,numeric,numeric),public.sync_order_rewards(),public.place_order(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.set_customer_programs(jsonb,integer),public.save_membership_tier(jsonb,integer),public.adjust_reward_points(uuid,integer,text,uuid),public.my_customer_programs(),public.team_customer_wallets(),public.my_checkout_benefits(numeric,numeric,numeric),public.place_order(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
