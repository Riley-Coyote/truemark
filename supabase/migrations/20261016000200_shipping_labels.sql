-- A ShipStation label is preparation, not evidence of carrier possession.
-- Keep the queue status "pushed" until a separate shipment event is received.
begin;
alter table public.shipments add column if not exists label_created_at timestamptz;
alter table public.shipments add column if not exists provider_shipment_id text;

create or replace function public.system_record_shipping_label(
  order_id uuid, carrier text, service text, tracking text, label_created_at timestamptz,
  provider text, event_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders; s public.shipments; label_event text := 'label:' || $7;
begin
  if $6 is null or $6 not in ('shipstation','simulator') or nullif(btrim($7),'') is null
    or length($7) > 200 or nullif(btrim($2),'') is null or length($2) > 100
    or nullif(btrim($4),'') is null or length($4) > 200 then
    raise exception 'Invalid shipping label.' using errcode = '22023';
  end if;
  -- Same lock order as order transitions: order first, then shipment.
  select * into o from public.orders where orders.id = $1 for update;
  if not found then return jsonb_build_object('outcome','ignored'); end if;
  select * into s from public.shipments where shipments.order_id = $1 for update;
  if not found or s.provider is distinct from $6 then return jsonb_build_object('outcome','ignored'); end if;
  if o.status in ('paid','packed') and s.status in ('queued','failed') and not s.cancel_requested then
    -- Do not acknowledge an event we cannot yet apply during the export race.
    raise exception 'Shipment synchronization pending.' using errcode = '40001';
  end if;
  insert into public.shipping_events(provider,event_id,type,outcome)
    values ($6,label_event,'label_created','ignored')
    on conflict on constraint shipping_events_provider_event_id_key do nothing;
  if not found then return jsonb_build_object('outcome','duplicate'); end if;
  if exists(select 1 from public.shipping_events e where e.provider = $6 and e.event_id = 'void:' || $7) then
    return jsonb_build_object('outcome','ignored');
  end if;
  if o.status in ('cancelled','refunded') or s.cancel_requested then
    perform public.system_alert('A cancelled order has a label',
      'Order ' || o.number || ' has a label. Check and void it in ShipStation.', '/admin/shipping?order=' || o.id);
  elsif o.status in ('paid','packed') and s.status = 'pushed' then
    -- A delayed older label must not replace a newer label on this order.
    if s.label_created_at is not null and $5 is not null and $5 < s.label_created_at then
      return jsonb_build_object('outcome','ignored');
    end if;
    update public.shipments set carrier = btrim($2), service = $3, tracking = btrim($4),
      label_created_at = coalesce($5,now()), provider_shipment_id = $7, updated_at = now()
      where shipments.order_id = $1;
    update public.orders set carrier = btrim($2), tracking = btrim($4) where id = $1;
    update public.shipping_events set outcome = 'applied'
      where shipping_events.provider = $6 and shipping_events.event_id = label_event;
    return jsonb_build_object('outcome','applied');
  end if;
  return jsonb_build_object('outcome','ignored');
end $$;
revoke all on function public.system_record_shipping_label(uuid,text,text,text,timestamptz,text,text) from public, anon, authenticated, service_role;
grant execute on function public.system_record_shipping_label(uuid,text,text,text,timestamptz,text,text) to service_role;
-- Voiding the current label clears preparation data, never rewinds shipment history.
create or replace function public.system_void_shipping_label(order_id uuid, provider text, event_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders; s public.shipments;
begin
  if $2 is null or $2 not in ('shipstation','simulator') or nullif(btrim($3),'') is null or length($3) > 200 then
    raise exception 'Invalid shipping label.' using errcode = '22023';
  end if;
  select * into o from public.orders where orders.id = $1 for update;
  if not found then return jsonb_build_object('outcome','ignored'); end if;
  select * into s from public.shipments where shipments.order_id = $1 for update;
  if not found or s.provider is distinct from $2 then return jsonb_build_object('outcome','ignored'); end if;
  insert into public.shipping_events(provider,event_id,type,outcome) values ($2,'void:' || $3,'label_voided','ignored')
    on conflict on constraint shipping_events_provider_event_id_key do nothing;
  if not found then return jsonb_build_object('outcome','duplicate'); end if;
  if o.status in ('paid','packed') and s.status = 'pushed' and s.provider_shipment_id = $3 then
    update public.shipments set carrier = null, service = null, tracking = null,
      label_created_at = null, provider_shipment_id = null, updated_at = now() where shipments.order_id = $1;
    update public.orders set carrier = null, tracking = null where id = $1;
    update public.shipping_events set outcome = 'applied' where shipping_events.provider = $2 and shipping_events.event_id = 'void:' || $3;
    return jsonb_build_object('outcome','applied');
  end if;
  return jsonb_build_object('outcome','ignored');
end $$;
revoke all on function public.system_void_shipping_label(uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.system_void_shipping_label(uuid,text,text) to service_role;
commit;
