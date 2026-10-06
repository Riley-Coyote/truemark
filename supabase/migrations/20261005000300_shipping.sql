-- WP-26: ShipStation shipping, simulated until access.
begin;
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  provider text not null,
  status text not null default 'queued' check (status in ('queued','pushed','shipped','delivered','cancelled','failed')),
  provider_order_id text, carrier text, service text, tracking text,
  cancel_requested boolean not null default false,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(), locked_until timestamptz,
  last_error text check (length(last_error) <= 500),
  pushed_at timestamptz, shipped_at timestamptz, delivered_at timestamptz, cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.shipping_events (
  id uuid primary key default gen_random_uuid(), provider text, event_id text, type text,
  received_at timestamptz default now(), outcome text, unique(provider, event_id)
);
create table if not exists public.simulated_labels (
  id text primary key check (id ~ '^sim_sh_[0-9a-f]{24}$'),
  order_id uuid references public.orders(id), batch text not null,
  carrier text, service text, tracking text, created_at timestamptz default now()
);
do $$ declare t text; begin
  foreach t in array array['shipments','shipping_events','simulated_labels'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', t);
    execute format('grant select on table public.%I to authenticated, service_role', t);
    execute format('drop policy if exists shipping_team_read on public.%I', t);
    execute format('create policy shipping_team_read on public.%I for select to authenticated using ((select public.platform_role()) in (''owner'',''staff''))', t);
    execute format('drop policy if exists shipping_service_read on public.%I', t);
    execute format('create policy shipping_service_read on public.%I for select to service_role using (true)', t);
  end loop;
end $$;

create or replace function public.system_queue_shipment() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.connections;
begin
  if new.status is not distinct from old.status then return new; end if;
  select * into c from public.connections where id = 'shipping';
  if c.mode is null or c.mode = 'off' then return new; end if;
  if new.status = 'paid' then
    insert into public.shipments(order_id,provider) values (new.id,case when c.mode = 'simulated' then 'simulator' else c.provider end)
      on conflict(order_id) do nothing;
    perform public.system_poke('/shipping/flush');
  elsif new.status in ('cancelled','refunded') then
    update public.shipments set status = 'cancelled', cancelled_at = now(), locked_until = null, updated_at = now()
      where order_id = new.id and status = 'queued';
    update public.shipments set cancel_requested = true, updated_at = now() where order_id = new.id and status = 'pushed';
    if found then perform public.system_poke('/shipping/flush'); end if;
  end if;
  return new;
end $$;
revoke all on function public.system_queue_shipment() from public, anon, authenticated, service_role;
grant execute on function public.system_queue_shipment() to service_role;
drop trigger if exists shipping_order_status on public.orders;
create trigger shipping_order_status after update of status on public.orders for each row execute function public.system_queue_shipment();

create or replace function public.system_claim_shipments(batch integer default 20) returns setof public.shipments
language plpgsql security definer set search_path = public as $$
begin
  return query with due as (
    select s.id from public.shipments s where (s.status = 'queued' or (s.status = 'pushed' and s.cancel_requested))
      and s.next_attempt_at <= now() and (s.locked_until is null or s.locked_until <= now())
    order by s.next_attempt_at, s.id limit $1 for update skip locked
  ) update public.shipments s set locked_until = now() + interval '2 minutes',
    attempts = s.attempts + case when s.cancel_requested then 0 else 1 end, updated_at = now()
    from due where s.id = due.id returning s.*;
end $$;
revoke all on function public.system_claim_shipments(integer) from public, anon, authenticated, service_role;
grant execute on function public.system_claim_shipments(integer) to service_role;

create or replace function public.system_shipment_pushed(id uuid, provider_order_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.shipments s set status = 'pushed', provider_order_id = $2, pushed_at = now(), locked_until = null,
    last_error = null, cancel_requested = s.cancel_requested or exists(select 1 from public.orders o where o.id = s.order_id and o.status in ('cancelled','refunded')),
    updated_at = now() where s.id = $1 and s.status in ('queued','cancelled');
end $$;
revoke all on function public.system_shipment_pushed(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.system_shipment_pushed(uuid,text) to service_role;

create or replace function public.system_shipment_cancelled(id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.shipments s set status = 'cancelled', cancel_requested = false, cancelled_at = now(), locked_until = null,
    last_error = null, updated_at = now() where s.id = $1 and s.status in ('queued','pushed');
end $$;
revoke all on function public.system_shipment_cancelled(uuid) from public, anon, authenticated, service_role;
grant execute on function public.system_shipment_cancelled(uuid) to service_role;

create or replace function public.system_shipment_failed(id uuid, error text) returns void
language plpgsql security definer set search_path = public as $$
declare s public.shipments; n text;
begin
  select * into s from public.shipments where shipments.id = $1 for update;
  if not found or s.status not in ('queued','pushed') then return; end if;
  update public.shipments set status = case when s.attempts >= 6 then 'failed' else 'queued' end,
    next_attempt_at = now() + make_interval(mins => case s.attempts when 1 then 1 when 2 then 5 when 3 then 15 when 4 then 60 else 240 end),
    locked_until = null, last_error = left($2,500), updated_at = now() where shipments.id = $1;
  if s.attempts >= 6 then
    select number into n from public.orders where orders.id = s.order_id;
    perform public.system_alert('An order didn''t reach ShipStation', 'Order ' || n || ': ' || left($2,500), '/admin/orders?order=' || s.order_id);
  end if;
end $$;
revoke all on function public.system_shipment_failed(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.system_shipment_failed(uuid,text) to service_role;

create or replace function public.system_mark_shipped(order_id uuid, carrier text, service text, tracking text, shipped_at timestamptz, provider text, event_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  insert into public.shipping_events(provider,event_id,type,outcome) values ($6,$7,'shipped','ignored') on conflict on constraint shipping_events_provider_event_id_key do nothing;
  if not found then return jsonb_build_object('outcome','duplicate'); end if;
  select * into o from public.orders where orders.id = $1 for update;
  if o.status in ('cancelled','refunded') then
    perform public.system_alert('A cancelled order has a label', 'Order ' || o.number || ' was cancelled, but ShipStation reports a label. Check the shipment.', '/admin/orders?order=' || o.id);
  elsif o.status in ('paid','packed') then
    update public.orders set status = 'shipped', carrier = $2, tracking = $4 where id = $1;
    insert into public.order_events(order_id,status,at,note,source) values ($1,'shipped',coalesce($5,now()),$3,'shipping');
    insert into public.notifications(audience,kind,title,body,href) values
      ('buyer:' || o.buyer_id,'order.shipped','Order ' || o.number || ' is shipped',coalesce($2,'Carrier') || coalesce(' ' || chr(183) || ' ' || $4,''),'/account/orders/' || o.id);
    update public.shipments set status = 'shipped', carrier = $2, service = $3, tracking = $4, shipped_at = coalesce($5,now()), locked_until = null, updated_at = now() where shipments.order_id = $1;
    update public.shipping_events set outcome = 'applied' where shipping_events.provider = $6 and shipping_events.event_id = $7;
    return jsonb_build_object('outcome','applied');
  end if;
  return jsonb_build_object('outcome','ignored');
end $$;
revoke all on function public.system_mark_shipped(uuid,text,text,text,timestamptz,text,text) from public, anon, authenticated, service_role;
grant execute on function public.system_mark_shipped(uuid,text,text,text,timestamptz,text,text) to service_role;

create or replace function public.system_mark_delivered(order_id uuid, delivered_at timestamptz, provider text, event_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  insert into public.shipping_events(provider,event_id,type,outcome) values ($3,$4,'delivered','ignored') on conflict on constraint shipping_events_provider_event_id_key do nothing;
  if not found then return jsonb_build_object('outcome','duplicate'); end if;
  select * into o from public.orders where orders.id = $1 for update;
  if o.status <> 'shipped' or o.id is null then return jsonb_build_object('outcome','ignored'); end if;
  update public.orders set status = 'delivered' where id = $1;
  insert into public.order_events(order_id,status,at,source) values ($1,'delivered',coalesce($2,now()),'shipping');
  insert into public.notifications(audience,kind,title,body,href) values
    ('buyer:' || o.buyer_id,'order.delivered','Order ' || o.number || ' is delivered','Certificates for each lot are in your account.','/account/orders/' || o.id);
  update public.shipments set status = 'delivered', delivered_at = coalesce($2,now()), locked_until = null, updated_at = now() where shipments.order_id = $1;
  update public.shipping_events set outcome = 'applied' where shipping_events.provider = $3 and shipping_events.event_id = $4;
  return jsonb_build_object('outcome','applied');
end $$;
revoke all on function public.system_mark_delivered(uuid,timestamptz,text,text) from public, anon, authenticated, service_role;
grant execute on function public.system_mark_delivered(uuid,timestamptz,text,text) to service_role;

create or replace function public.retry_shipment(order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.platform_role(),'') not in ('owner','staff') then raise exception 'team access required' using errcode = '42501'; end if;
  update public.shipments set status = 'queued', attempts = 0, next_attempt_at = now(), locked_until = null, last_error = null, updated_at = now()
    where shipments.order_id = $1 and status = 'failed';
  if found then perform public.system_poke('/shipping/flush'); end if;
end $$;
revoke all on function public.retry_shipment(uuid) from public, anon, authenticated, service_role;
grant execute on function public.retry_shipment(uuid) to authenticated;

-- Simulator writes also go through a service-only function, never REST inserts.
create or replace function public.system_create_simulated_label(id text, order_id uuid, batch text, tracking text) returns public.simulated_labels
language plpgsql security definer set search_path = public as $$
declare s public.shipments; label public.simulated_labels; method text;
begin
  if not exists(select 1 from public.connections where connections.id = 'shipping' and mode = 'simulated') then raise exception 'Shipping is not simulated.' using errcode = '22023'; end if;
  select * into s from public.shipments where shipments.order_id = $2 for update;
  if s.status is distinct from 'pushed' or s.provider <> 'simulator' or s.cancel_requested then raise exception 'The shipment must be pushed.' using errcode = '22023'; end if;
  select m.label into method from public.orders o join public.shipping_methods m on m.id = o.shipping_method_id where o.id = $2 and o.status in ('paid','packed');
  if not found then raise exception 'The shipment must be pushed.' using errcode = '22023'; end if;
  insert into public.simulated_labels(id,order_id,batch,carrier,service,tracking) values ($1,$2,$3,'UPS',method,$4) returning * into label;
  return label;
end $$;
revoke all on function public.system_create_simulated_label(text,uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.system_create_simulated_label(text,uuid,text,text) to service_role;

alter table public.shipping_methods add column if not exists updated_at timestamptz not null default now();
alter table public.shipping_methods add column if not exists updated_by uuid references public.profiles(id);
create or replace function public.upsert_shipping_method(id text, label text, detail text, price numeric, active boolean) returns public.shipping_methods
language plpgsql security definer set search_path = public as $$
declare saved public.shipping_methods;
begin
  if public.platform_role() is distinct from 'owner' then raise exception 'owner access required' using errcode = '42501'; end if;
  if $2 is null or length(btrim($2)) not between 1 and 80 or $3 is null or length(btrim($3)) not between 1 and 160
    or $4 is null or $4 < 0 or $4 > 999.99 or $4 <> round($4,2) or $5 is null then raise exception 'Invalid shipping method.' using errcode = '22023'; end if;
  -- Lock every method so concurrent saves cannot disable the last two together.
  perform 1 from public.shipping_methods order by shipping_methods.id for update;
  if not exists(select 1 from public.shipping_methods where shipping_methods.id = $1) then raise exception 'Shipping method not found.' using errcode = 'P0002'; end if;
  if not $5 and not exists(select 1 from public.shipping_methods where shipping_methods.id <> $1 and shipping_methods.active) then raise exception 'At least one shipping method must stay active.' using errcode = '22023'; end if;
  update public.shipping_methods set label = btrim($2), detail = btrim($3), price = $4, active = $5, updated_at = now(), updated_by = auth.uid() where shipping_methods.id = $1 returning * into saved;
  update public.settings set shipping_rates_confirmed = true where settings.id = true;
  return saved;
end $$;
revoke all on function public.upsert_shipping_method(text,text,text,numeric,boolean) from public, anon, authenticated, service_role;
grant execute on function public.upsert_shipping_method(text,text,text,numeric,boolean) to authenticated;

do $$ begin if to_regprocedure('cron.schedule(text,text,text)') is not null then
  perform cron.schedule('tm-shipping-flush','* * * * *',$c$select public.system_poke('/shipping/flush')$c$);
end if; end $$;
commit;
