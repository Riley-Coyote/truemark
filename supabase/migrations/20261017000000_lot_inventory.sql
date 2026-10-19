-- Lot inventory is authoritative. Existing unknown counts/dates remain unknown.
begin;

alter table public.lots add column if not exists inventory_id uuid not null default gen_random_uuid();
create unique index if not exists lots_inventory_id on public.lots(inventory_id);
alter table public.lots add column if not exists lot_number text;
alter table public.lots add column if not exists testing_status text not null default 'pending' check (testing_status in ('pending','passed','failed'));
alter table public.lots add column if not exists hold_reason text;
alter table public.lots add column if not exists expected_units integer not null default 0 check (expected_units >= 0);
alter table public.lots add column if not exists received_units integer not null default 0 check (received_units >= 0);
alter table public.lots add column if not exists expected_at date;
alter table public.lots add column if not exists reserved_units integer not null default 0 check (reserved_units >= 0);
alter table public.lots add column if not exists version integer not null default 1;
alter table public.orders add column if not exists inventory_issue text;
create unique index if not exists lots_number_unique on public.lots(upper(coalesce(lot_number,lot)));

create table if not exists public.inventory_events (
  id uuid primary key default gen_random_uuid(), request_id uuid unique,
  product_id text not null references public.products(id), lot_id uuid references public.lots(inventory_id),
  kind text not null, reason text not null, before_value jsonb, after_value jsonb,
  actor_id uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.order_lot_allocations (
  id uuid primary key default gen_random_uuid(), order_line_id uuid not null references public.order_lines(id),
  lot_id uuid not null references public.lots(inventory_id), quantity integer not null check(quantity > 0),
  state text not null default 'reserved' check(state in ('reserved','fulfilled','released')),
  lot_number text not null, certificate_path text, certificate_snapshot jsonb,
  returned_units integer not null default 0 check(returned_units >= 0 and returned_units <= quantity),
  legacy boolean not null default false, created_at timestamptz not null default now()
);
create index if not exists allocations_line on public.order_lot_allocations(order_line_id);
create index if not exists allocations_lot on public.order_lot_allocations(lot_id,state);
alter table public.inventory_events enable row level security;
alter table public.order_lot_allocations enable row level security;
revoke all on public.inventory_events,public.order_lot_allocations from public,anon,authenticated,service_role;
grant select on public.inventory_events,public.order_lot_allocations to authenticated,service_role;
drop policy if exists inventory_team_read on public.inventory_events;
create policy inventory_team_read on public.inventory_events for select to authenticated using ((select public.platform_role()) in ('owner','staff'));
drop policy if exists allocations_read on public.order_lot_allocations;
create policy allocations_read on public.order_lot_allocations for select to authenticated using (
 (select public.platform_role()) in ('owner','staff') or exists (
 select 1 from public.order_lines li join public.orders o on o.id=li.order_id join public.buyers b on b.id=o.buyer_id
 where li.id=order_line_id and b.user_id=(select auth.uid())));
drop policy if exists allocations_service on public.order_lot_allocations;
create policy allocations_service on public.order_lot_allocations for select to service_role using(true);

create or replace function public.inventory_team() returns void language plpgsql security definer set search_path=public as $$ begin
 if coalesce(public.platform_role(),'') not in ('owner','staff') then raise exception 'Team access required' using errcode='42501'; end if;
end $$;

-- This predicate is shared by checkout, receipt, edits and shipping. Unknown is not unlimited.
create or replace function public.inventory_eligible(l public.lots) returns boolean language sql stable security definer set search_path=public as $$
 select l.status='released' and l.testing_status='passed' and l.received_at is not null and l.units is not null
 and nullif(btrim(l.hold_reason),'') is null and l.coa_path is not null
 and exists(select 1 from storage.objects s where s.bucket_id='certificates' and s.name=l.coa_path)
$$;

create or replace function public.inventory_refresh(product_key text) returns void language plpgsql security definer set search_path=public as $$
declare first_lot text; available integer;
begin
 perform 1 from public.products where id=$1 for update;
 select coalesce(sum(greatest(units-reserved_units,0)),0)::integer into available from public.lots l where product_id=$1 and public.inventory_eligible(l);
 select lot into first_lot from public.lots l where product_id=$1 and public.inventory_eligible(l) and units>reserved_units order by received_at,inventory_id limit 1;
 update public.products set stock=available,lot=coalesce(first_lot,lot) where id=$1;
 -- Open-order issues are derived from allocation lot eligibility on read; avoid locking orders under product locks.

end $$;

create or replace function public.inventory_lot_changed() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if tg_op='UPDATE' and new is not distinct from old then return new; end if;
 if tg_op='UPDATE' and new.lot_number is distinct from old.lot_number then
  update public.order_lot_allocations set lot_number=coalesce(new.lot_number,new.lot) where lot_id=new.inventory_id and state='reserved';
 end if;
 insert into public.inventory_events(product_id,lot_id,kind,reason,before_value,after_value,actor_id)
 values(new.product_id,new.inventory_id,'lot',coalesce(nullif(current_setting('inventory.reason',true),''),'Lot updated'),case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new),auth.uid());
 perform public.inventory_refresh(new.product_id); return new;
end $$;
drop trigger if exists inventory_lot_changed on public.lots;
create trigger inventory_lot_changed after insert or update on public.lots for each row execute function public.inventory_lot_changed();

create or replace function public.save_inventory_lot(draft jsonb) returns public.lots language plpgsql security definer set search_path=public as $$
declare l public.lots; old_l public.lots; p text := draft->>'productId'; n text:=upper(btrim(draft->>'number')); v_units integer; v_note text;
begin
 perform public.inventory_team();
 perform 1 from public.products where id=p for update;
 if not found then raise exception 'Choose an existing product' using errcode='22023'; end if;
 if n is null or n !~ '^[A-Z0-9][A-Z0-9_-]{1,99}$' then raise exception 'Enter a lot number using letters, numbers and dashes' using errcode='22023'; end if;
 if nullif(btrim(draft->>'reason'),'') is null then raise exception 'Enter a reason for the change' using errcode='22023'; end if;
 perform set_config('inventory.reason',draft->>'reason',true);
 if nullif(draft->>'id','') is null then
   if exists(select 1 from public.lots where upper(coalesce(lot_number,lot))=n or upper(lot)=n) then raise exception 'This lot already exists. Select it to receive more units.' using errcode='22023'; end if;
   insert into public.lots(lot,lot_number,product_id,units,status) values(n,n,p,0,'quarantine') returning * into l;
 else
   select * into l from public.lots where inventory_id=(draft->>'id')::uuid and product_id=p for update;
   if not found then raise exception 'Lot not found' using errcode='22023'; end if;
   if l.version is distinct from (draft->>'version')::integer then raise exception 'This lot changed. Reopen it before saving.' using errcode='40001'; end if;
 end if;
 if exists(select 1 from public.lots other where other.inventory_id<>l.inventory_id and (upper(other.lot)=n or upper(coalesce(other.lot_number,other.lot))=n)) then raise exception 'This lot number is already in use' using errcode='22023'; end if;
 old_l:=l;
 v_units:=case when draft ? 'units' then (draft->>'units')::integer else l.units end;
 if (v_units is null and l.reserved_units>0) or v_units<l.reserved_units then raise exception '% units are reserved. Substitute or cancel those allocations before reducing this count.',l.reserved_units using errcode='22023'; end if;
 if v_units is distinct from l.units and coalesce(v_units,0)>coalesce(l.units,0) and draft->>'reason' like 'Returns%' and coalesce((draft->>'resaleConfirmed')::boolean,false)=false then
   raise exception 'Confirm returned units are suitable for resale' using errcode='22023'; end if;
 if (draft->>'expectedUnits')::integer < l.received_units then raise exception 'Expected quantity cannot be below the quantity already received' using errcode='22023'; end if;
 if nullif(draft->>'receivedAt','')::timestamptz>now()+interval '5 minutes' then raise exception 'Enter the actual receipt date' using errcode='22023'; end if;
 if draft ? 'status' and draft->>'status' not in ('active','held','archived','rejected','quarantine','awaiting_certificate') then raise exception 'Invalid inventory status' using errcode='22023'; end if;
 if draft->>'status'='held' and nullif(btrim(draft->>'holdReason'),'') is null then raise exception 'Enter the reason for this hold' using errcode='22023'; end if;
 -- Rejecting needs its own note, kept on the lot. The lot editor has no rejection field yet, so its free-text
 -- explanation ("<reason>: <explanation>") is accepted until it sends rejectionNote.
 if draft->>'status'='rejected' and l.status<>'rejected' then
   v_note:=coalesce(nullif(btrim(draft->>'rejectionNote'),''),nullif(btrim(substring(draft->>'reason' from '^[^:]*:(.*)$')),''));
   if v_note is null then raise exception 'Explain why this lot is rejected' using errcode='22023'; end if;
 end if;
 -- A rejected lot (or one archived after rejection) cannot be returned to testing or sale by a status edit.
 -- release_lot must first record new passing results with a new certificate.
 if (l.status='rejected' or l.testing_status='failed') and (draft->>'status' in ('quarantine','awaiting_certificate')
   or (draft->>'status'='active' and (l.testing_status<>'passed' or l.coa_path is null))) then
   raise exception 'This lot was rejected. Record new passing results and a new certificate before returning it to sale.' using errcode='22023'; end if;
 update public.lots set lot_number=n,units=v_units,rejection_note=coalesce(v_note,rejection_note),
   expected_units=coalesce((draft->>'expectedUnits')::integer,l.expected_units),expected_at=nullif(draft->>'expectedAt','')::date,
   received_at=case when draft ? 'receivedAt' then nullif(draft->>'receivedAt','')::timestamptz else l.received_at end,
   coa_path=case when draft->>'status' in ('quarantine','awaiting_certificate') then null else coa_path end,
   testing_status=case when draft->>'status'='quarantine' then 'pending' when draft->>'status'='awaiting_certificate' then 'passed' when draft->>'status'='rejected' then 'failed' else testing_status end,
   hold_reason=case when draft->>'status'='held' then btrim(draft->>'holdReason') when draft->>'status'='active' then null else hold_reason end,
   status=case when draft->>'status' in ('archived','rejected') then draft->>'status' when draft->>'status' in ('quarantine','awaiting_certificate') then 'quarantine' when draft->>'status'='active' then case when testing_status='passed' and coa_path is not null then 'released' else 'quarantine' end else status end,
   version=version+1,updated_at=now(),updated_by=auth.uid() where inventory_id=l.inventory_id returning * into l;
 return l;
end $$;

create or replace function public.receive_inventory(lot_id uuid, quantity integer, received_at timestamptz, request_id uuid) returns public.lots language plpgsql security definer set search_path=public as $$
declare l public.lots; e public.inventory_events;
begin
 perform public.inventory_team();
 if $2 is null or $2<=0 or $3 is null or $3>now()+interval '5 minutes' or $4 is null then raise exception 'Enter a positive quantity and actual receipt date' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended($4::text,170));
 select * into e from public.inventory_events where inventory_events.request_id=$4;
 if found then
   if e.kind is distinct from 'receipt' or e.lot_id is distinct from $1 or (e.after_value->>'quantity')::integer is distinct from $2 or (e.after_value->>'receivedAt')::timestamptz is distinct from $3 then raise exception 'Receipt reference was already used for different details' using errcode='22023'; end if;
   select * into l from public.lots where inventory_id=$1; return l;
 end if;
 perform 1 from public.products where id=(select product_id from public.lots where inventory_id=$1) for update;
 select * into l from public.lots where inventory_id=$1 for update;
 if not found or l.status in ('archived','rejected') then raise exception 'Choose an active lot for receiving' using errcode='22023'; end if;
 if l.units is null then raise exception 'Reconcile the existing lot count before receiving more units' using errcode='22023'; end if;
 perform set_config('inventory.reason','Shipment received',true);
 update public.lots set units=units+$2,received_units=received_units+$2,expected_units=greatest(expected_units,received_units+$2),
 received_at=case when lots.received_at is null then $3 else least(lots.received_at,$3) end,
 status=case when testing_status='passed' and coa_path is not null then 'released' else 'quarantine' end,
 version=version+1,updated_at=now(),updated_by=auth.uid() where inventory_id=$1 returning * into l;
 insert into public.inventory_events(request_id,product_id,lot_id,kind,reason,after_value,actor_id)
 values($4,l.product_id,$1,'receipt','Shipment received',jsonb_build_object('quantity',$2,'receivedAt',$3),auth.uid());
 return l;
end $$;

create or replace function public.inventory_allocate() returns trigger language plpgsql security definer set search_path=public as $$
declare l public.lots; remaining integer:=new.quantity; take integer;
begin
 perform 1 from public.products where id=new.product_id and active for update;
 if not found then raise exception 'Product unavailable' using errcode='22023'; end if;
 for l in select * from public.lots x where product_id=new.product_id and public.inventory_eligible(x) and units>reserved_units order by received_at,inventory_id for update loop
   take:=least(remaining,l.units-l.reserved_units);
   insert into public.order_lot_allocations(order_line_id,lot_id,quantity,lot_number) values(new.id,l.inventory_id,take,coalesce(l.lot_number,l.lot));
   update public.lots set reserved_units=reserved_units+take,version=version+1 where inventory_id=l.inventory_id;
   remaining:=remaining-take; exit when remaining=0;
 end loop;
 if remaining>0 then raise exception 'Not enough received, certified inventory for this order' using errcode='22023'; end if;
 perform public.inventory_refresh(new.product_id); return new;
end $$;
drop trigger if exists inventory_allocate on public.order_lines;
create trigger inventory_allocate after insert on public.order_lines for each row execute function public.inventory_allocate();

create or replace function public.restore_cancelled_stock() returns trigger language plpgsql security definer set search_path=public as $$
declare a record;
begin
 if old.status in ('placed','paid','packed') and new.status in ('cancelled','refunded') then
   perform 1 from public.products p where id in(select product_id from public.order_lines where order_id=new.id) order by id for update;
   for a in select alloc.* from public.order_lot_allocations alloc join public.order_lines li on li.id=alloc.order_line_id where li.order_id=new.id and alloc.state='reserved' order by alloc.lot_id loop
     update public.order_lot_allocations set state='released' where id=a.id;
     update public.lots set reserved_units=reserved_units-a.quantity,version=version+1 where inventory_id=a.lot_id;
   end loop;
   update public.order_lines set stock_reserved=0 where order_id=new.id;
 end if; return new;
end $$;

-- A trigger covers both team actions and shipping-provider events.
create or replace function public.inventory_fulfillment() returns trigger language plpgsql security definer set search_path=public as $$
declare a record;
begin
 if old.status is distinct from new.status and new.status in ('packed','shipped') then
   perform 1 from public.products p where id in(select product_id from public.order_lines where order_id=new.id) order by id for update;
   if exists(select 1 from public.order_lines li where li.order_id=new.id and li.quantity<>(select coalesce(sum(quantity),0) from public.order_lot_allocations where order_line_id=li.id and state='reserved')) then
     raise exception 'Resolve missing lot allocations before fulfillment' using errcode='22023'; end if;
   for a in select alloc.id,alloc.quantity,l.* from public.order_lot_allocations alloc join public.order_lines li on li.id=alloc.order_line_id join public.lots l on l.inventory_id=alloc.lot_id where li.order_id=new.id and alloc.state='reserved' order by l.inventory_id for update of l loop
     if not public.inventory_eligible((select l from public.lots l where inventory_id=a.inventory_id)) or a.units<a.reserved_units then
       raise exception 'Allocated lot % is unavailable. Resolve its testing, certificate, hold or quantity before fulfillment.',a.lot using errcode='22023'; end if;
     if new.status='shipped' then
       update public.order_lot_allocations set state='fulfilled',lot_number=coalesce(a.lot_number,a.lot),certificate_path=a.coa_path,
       certificate_snapshot=jsonb_build_object('reference',a.reference,'results',a.results,'testedAt',a.tested_at,'lot',coalesce(a.lot_number,a.lot)) where id=a.id;
       update public.lots set units=units-a.quantity,reserved_units=reserved_units-a.quantity,version=version+1 where inventory_id=a.inventory_id;
     end if;
   end loop;
 end if; return new;
end $$;
drop trigger if exists inventory_fulfillment on public.orders;
create trigger inventory_fulfillment before update of status on public.orders for each row execute function public.inventory_fulfillment();

create or replace function public.substitute_inventory(order_id uuid, product_id text, allocations jsonb, reason text) returns void language plpgsql security definer set search_path=public as $$
declare o public.orders; li public.order_lines; a record; x jsonb; l public.lots; total integer:=0; q integer;
begin
 perform public.inventory_team();
 select * into o from public.orders where id=$1 for update;
 if o.status not in ('placed','paid','packed') or nullif(btrim($4),'') is null then raise exception 'Only unshipped orders can change lots; a reason is required' using errcode='22023'; end if;
 perform 1 from public.products where id=$2 for update;
 select * into li from public.order_lines where order_lines.order_id=$1 and order_lines.product_id=$2;
 if not found or jsonb_typeof($3) is distinct from 'array' or jsonb_array_length($3)=0 then raise exception 'Choose lots and quantities' using errcode='22023'; end if;
 perform set_config('inventory.reason','Lots substituted: '||$4,true);
 for a in select * from public.order_lot_allocations where order_line_id=li.id and state='reserved' loop
   update public.order_lot_allocations set state='released' where id=a.id;
   update public.lots set reserved_units=reserved_units-a.quantity,version=version+1 where inventory_id=a.lot_id;
 end loop;
 for x in select value from jsonb_array_elements($3) loop
   q:=(x->>'quantity')::integer;
   select * into l from public.lots where inventory_id=(x->>'lotId')::uuid and lots.product_id=$2 for update;
   if not found or not public.inventory_eligible(l) or q is null or q<=0 or q>l.units-l.reserved_units then raise exception 'Choose available, certified lots with enough units' using errcode='22023'; end if;
   insert into public.order_lot_allocations(order_line_id,lot_id,quantity,lot_number) values(li.id,l.inventory_id,q,coalesce(l.lot_number,l.lot));
   update public.lots set reserved_units=reserved_units+q,version=version+1 where inventory_id=l.inventory_id;
   total:=total+q;
 end loop;
 if total<>li.quantity then raise exception 'Lot quantities must equal the ordered quantity (%)',li.quantity using errcode='22023'; end if;
 if o.status='packed' then update public.orders set status='paid' where id=$1; end if;
 insert into public.order_events(order_id,status,note,actor_id,source) values($1,case when o.status='packed' then 'paid' else o.status end,'Lots substituted: '||$4,auth.uid(),'team');
 perform public.inventory_refresh($2);
end $$;

create or replace function public.remove_inventory_certificate(lot_id uuid, reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 perform public.inventory_team();
 if nullif(btrim($2),'') is null then raise exception 'Enter a reason' using errcode='22023'; end if;
 perform 1 from public.products where id=(select product_id from public.lots where inventory_id=$1) for update;
 perform set_config('inventory.reason',$2,true);
 update public.lots set coa_path=null,status=case when status in ('archived','rejected') then status else 'quarantine' end,version=version+1 where inventory_id=$1;
end $$;

-- Historical allocations come only from the recorded lot on each existing line.
-- No physical quantity or receipt date is invented, and commercial lines are untouched.
insert into public.order_lot_allocations(order_line_id,lot_id,quantity,state,lot_number,legacy)
 select li.id,l.inventory_id,li.quantity,case when o.status in ('placed','paid','packed') then 'reserved' when o.status='cancelled' or (o.status='refunded' and not exists(select 1 from public.order_events ev where ev.order_id=o.id and ev.status in ('shipped','delivered'))) then 'released' else 'fulfilled' end,li.lot,true
 from public.order_lines li join public.orders o on o.id=li.order_id join public.lots l on l.lot=li.lot
 where not exists(select 1 from public.order_lot_allocations a where a.order_line_id=li.id);
update public.lots l set reserved_units=(select coalesce(sum(quantity),0) from public.order_lot_allocations a where a.lot_id=l.inventory_id and a.state='reserved');

-- Helper and trigger functions are not callable by browsers.
revoke all on function public.inventory_team(),public.inventory_eligible(public.lots),public.inventory_refresh(text),public.inventory_lot_changed(),public.inventory_allocate(),public.inventory_fulfillment() from public,anon,authenticated,service_role;
revoke all on function public.save_inventory_lot(jsonb),public.receive_inventory(uuid,integer,timestamptz,uuid),public.substitute_inventory(uuid,text,jsonb,text),public.remove_inventory_certificate(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.save_inventory_lot(jsonb),public.receive_inventory(uuid,integer,timestamptz,uuid),public.substitute_inventory(uuid,text,jsonb,text),public.remove_inventory_certificate(uuid,text) to authenticated;


create or replace function public.release_lot(lot text, results jsonb, reference text, tested_at date, coa_path text)
returns public.lots language plpgsql security definer set search_path = public
as $$
declare
  v_lot public.lots;
  item jsonb;
  -- A blend names each component after the label, after a space, chr(183) and a space.
  v_dot constant text := ' ' || chr(183) || ' ';
  v_label text;
  v_at integer;
  v_base text;
  v_component text;
  v_method text;
  v_purity text[] := '{}';
  v_identity text[] := '{}';
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'Team access required' using errcode = '42501';
  end if;
  perform 1 from public.products where id=(select product_id from public.lots where lots.lot=$1) for update;
  select * into v_lot from public.lots l where l.lot = $1 for update;
  if not found then
    raise exception 'Lot not found' using errcode = '22023';
  end if;
  if $2 is null or jsonb_typeof($2) <> 'array' then
    raise exception 'Results must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length($2) = 0 or jsonb_array_length($2) > 30 then
    raise exception 'Results are required' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements($2) loop
    if jsonb_typeof(item) <> 'object' or not (item ?& array['label', 'method', 'value', 'unit'])
      or item - array['label', 'method', 'value', 'unit'] <> '{}'::jsonb
      or jsonb_typeof(item->'label') <> 'string' or nullif(btrim(item->>'label'), '') is null
      or jsonb_typeof(item->'method') <> 'string'
      or jsonb_typeof(item->'value') <> 'string' or nullif(btrim(item->>'value'), '') is null
      or jsonb_typeof(item->'unit') <> 'string' then
      raise exception 'Each result needs label, method, value and unit strings' using errcode = '22023';
    end if;
    v_label := btrim(item->>'label');
    v_at := strpos(v_label, v_dot);
    v_base := lower(case when v_at > 0 then btrim(left(v_label, v_at - 1)) else v_label end);
    v_component := case when v_at > 0 then btrim(substr(v_label, v_at + length(v_dot))) else '' end;
    v_method := lower(btrim(item->>'method'));
    if v_base = 'purity' and v_method = 'hplc' then
      if v_at > 0 and v_component = '' then
        raise exception 'Each component needs a name' using errcode = '22023';
      end if;
      -- LotResult values are strings. Check before casting; NaN/Infinity are not measurements.
      if btrim(item->>'value') !~ '^[0-9]+([.][0-9]+)?$' then
        raise exception 'HPLC purity must be a number at least 95.0' using errcode = '22023';
      end if;
      if (item->>'value')::numeric < 95.0 then
        raise exception 'HPLC purity must be at least 95.0' using errcode = '22023';
      end if;
      v_purity := array_append(v_purity, v_component);
    elsif v_base = 'identity' then
      if v_at > 0 and v_component = '' then
        raise exception 'Each component needs a name' using errcode = '22023';
      end if;
      if not ((v_method like 'hplc%' and item->>'value' = 'Conforms')
        or (v_method in ('ms', 'mass spectrometry') and item->>'value' = 'Confirmed')) then
        raise exception 'Identity must conform' using errcode = '22023';
      end if;
      v_identity := array_append(v_identity, v_component);
    end if;
  end loop;
  -- Every component with a purity has an identity (its own, or one for the whole sample), and
  -- every named identity has a purity.
  if cardinality(v_purity) = 0 or cardinality(v_identity) = 0
    or exists (select 1 from unnest(v_purity) p(component)
      where not (p.component = any(v_identity) or '' = any(v_identity)))
    or exists (select 1 from unnest(v_identity) i(component)
      where i.component <> '' and not (i.component = any(v_purity))) then
    raise exception 'Release needs HPLC purity at least 95.0 and a conforming identity for every component' using errcode = '22023';
  end if;
  if $4 is null or nullif(btrim($3), '') is null or not ($5 = v_lot.lot || '.pdf' or (left($5,length(v_lot.lot)+1)=v_lot.lot || '-' and substring($5 from length(v_lot.lot)+2) ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}[.]pdf$'))
    or $5 !~ '^[A-Za-z0-9_-]+[.]pdf$' then
    raise exception 'Test date, reference and the lot certificate PDF are required' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'certificates' and o.name = $5) then
    raise exception 'Upload the certificate before releasing the lot' using errcode = '22023';
  end if;
  -- New evidence clears a rejection only with a certificate file this lot has never carried.
  if (v_lot.status = 'rejected' or v_lot.testing_status = 'failed') and ($5 = v_lot.coa_path
    or exists (select 1 from public.inventory_events e where e.lot_id = v_lot.inventory_id
      and $5 in (e.before_value->>'coa_path', e.after_value->>'coa_path'))) then
    raise exception 'This lot was rejected. Upload a new certificate with the new passing results.' using errcode = '22023';
  end if;
  update public.lots l set status = case when l.status in ('archived','rejected') then l.status else 'released' end, testing_status='passed', version=version+1, results = $2, reference = btrim($3),
    tested_at = $4, coa_path = $5, released_at = coalesce(l.released_at,now()) where l.lot = v_lot.lot returning * into v_lot;
  return v_lot;
end $$;


create or replace function public.inventory_results_pass(results jsonb) returns boolean language plpgsql immutable set search_path=public as $$
declare
  v_lot public.lots;
  item jsonb;
  -- A blend names each component after the label, after a space, chr(183) and a space.
  v_dot constant text := ' ' || chr(183) || ' ';
  v_label text;
  v_at integer;
  v_base text;
  v_component text;
  v_method text;
  v_purity text[] := '{}';
  v_identity text[] := '{}';
begin
  if $1 is null or jsonb_typeof($1) <> 'array' then
    raise exception 'Results must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length($1) = 0 or jsonb_array_length($1) > 30 then
    raise exception 'Results are required' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements($1) loop
    if jsonb_typeof(item) <> 'object' or not (item ?& array['label', 'method', 'value', 'unit'])
      or item - array['label', 'method', 'value', 'unit'] <> '{}'::jsonb
      or jsonb_typeof(item->'label') <> 'string' or nullif(btrim(item->>'label'), '') is null
      or jsonb_typeof(item->'method') <> 'string'
      or jsonb_typeof(item->'value') <> 'string' or nullif(btrim(item->>'value'), '') is null
      or jsonb_typeof(item->'unit') <> 'string' then
      raise exception 'Each result needs label, method, value and unit strings' using errcode = '22023';
    end if;
    v_label := btrim(item->>'label');
    v_at := strpos(v_label, v_dot);
    v_base := lower(case when v_at > 0 then btrim(left(v_label, v_at - 1)) else v_label end);
    v_component := case when v_at > 0 then btrim(substr(v_label, v_at + length(v_dot))) else '' end;
    v_method := lower(btrim(item->>'method'));
    if v_base = 'purity' and v_method = 'hplc' then
      if v_at > 0 and v_component = '' then
        raise exception 'Each component needs a name' using errcode = '22023';
      end if;
      -- LotResult values are strings. Check before casting; NaN/Infinity are not measurements.
      if btrim(item->>'value') !~ '^[0-9]+([.][0-9]+)?$' then
        raise exception 'HPLC purity must be a number at least 95.0' using errcode = '22023';
      end if;
      if (item->>'value')::numeric < 95.0 then
        raise exception 'HPLC purity must be at least 95.0' using errcode = '22023';
      end if;
      v_purity := array_append(v_purity, v_component);
    elsif v_base = 'identity' then
      if v_at > 0 and v_component = '' then
        raise exception 'Each component needs a name' using errcode = '22023';
      end if;
      if not ((v_method like 'hplc%' and item->>'value' = 'Conforms')
        or (v_method in ('ms', 'mass spectrometry') and item->>'value' = 'Confirmed')) then
        raise exception 'Identity must conform' using errcode = '22023';
      end if;
      v_identity := array_append(v_identity, v_component);
    end if;
  end loop;
  -- Every component with a purity has an identity (its own, or one for the whole sample), and
  -- every named identity has a purity.
  if cardinality(v_purity) = 0 or cardinality(v_identity) = 0
    or exists (select 1 from unnest(v_purity) p(component)
      where not (p.component = any(v_identity) or '' = any(v_identity)))
    or exists (select 1 from unnest(v_identity) i(component)
      where i.component <> '' and not (i.component = any(v_purity))) then
    raise exception 'Release needs HPLC purity at least 95.0 and a conforming identity for every component' using errcode = '22023';
  end if;
return true; exception when others then return false; end $$;
update public.lots l set testing_status='passed' where l.status='released' and testing_status='pending'
 and reference is not null and tested_at is not null and public.inventory_results_pass(results)
 and exists(select 1 from storage.objects s where s.bucket_id='certificates' and s.name=l.coa_path);
-- Lots rejected before testing status existed (including those archived after rejection) keep their failure.
select set_config('inventory.reason','Rejected before inventory tracking: testing marked failed',true);
update public.lots set testing_status='failed' where testing_status='pending'
 and (status='rejected' or (status='archived' and rejection_note is not null));
select set_config('inventory.reason','',true);

create or replace function public.set_lot_certificate(lot text, coa_path text) returns public.lots language plpgsql security definer set search_path=public as $$
declare l public.lots; begin
 perform public.inventory_team();
 select * into l from public.lots where lots.lot=$1;
 raise exception 'Confirm the certificate results through the test certificate form' using errcode='22023';
end $$;
create or replace function public.set_lot_status(lot text,status text) returns public.lots language plpgsql security definer set search_path=public as $$
declare l public.lots; begin
 perform public.inventory_team();
 perform 1 from public.products where id=(select product_id from public.lots where lots.lot=$1) for update;
 select * into l from public.lots where lots.lot=$1 for update;
 if not found or $2 is null or $2 not in ('quarantine','testing','released','rejected','archived') then raise exception 'Invalid lot status' using errcode='22023'; end if;
 -- A rejection always records its note on the lot: reject_lot takes one, a bare status change cannot.
 if $2='rejected' then
   if l.status='rejected' then return l; end if;
   raise exception 'Rejecting a lot needs a rejection note' using errcode='22023';
 end if;
 if (l.status='rejected' or l.testing_status='failed') and $2 in ('quarantine','testing') then
   raise exception 'This lot was rejected. Record new passing results and a new certificate before returning it to sale.' using errcode='22023'; end if;
 if $2='released' and (l.testing_status<>'passed' or l.coa_path is null) then raise exception 'Upload passing test results and the certificate first' using errcode='22023'; end if;
 update public.lots set coa_path=case when $2 in ('quarantine','testing') then null else coa_path end,status=$2,testing_status=case when $2 in ('quarantine','testing') then 'pending' when $2='rejected' then 'failed' else testing_status end,version=version+1 where inventory_id=l.inventory_id returning * into l;
 return l;
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
  perform pg_advisory_xact_lock(hashtextextended(lower(btrim(draft->>'name')) || '/' || lower(btrim(draft->>'size')) || '/' || lower(btrim(draft->>'form')),170));
  if exists(select 1 from public.products where id<>draft->>'id' and lower(btrim(name))=lower(btrim(draft->>'name')) and lower(btrim(size))=lower(btrim(draft->>'size')) and lower(btrim(form))=lower(btrim(draft->>'form'))) then raise exception 'This product and size already exist. Receive inventory for the existing product.' using errcode='22023'; end if;
  -- Updates cannot change brand colours or lot assignments. WP-16 owns lot management.
  insert into public.products(id, name, size, category, price, active, form, tag, description, stock, image, color, color_ink, lot)
    values (draft ->> 'id', btrim(draft ->> 'name'), btrim(draft ->> 'size'), draft ->> 'category',
      (draft ->> 'price')::numeric, (draft ->> 'active')::boolean, btrim(draft ->> 'form'),
      nullif(btrim(draft ->> 'tag'), ''), nullif(btrim(draft ->> 'description'), ''), coalesce(previous.stock,0),
      nullif(draft ->> 'image', ''), draft ->> 'color', draft ->> 'colorInk',
      coalesce((select lot from public.products where id = draft ->> 'id'), nullif(draft ->> 'lot', ''),''))
    on conflict (id) do update set name = excluded.name, size = excluded.size, category = excluded.category,
      price = excluded.price, active = excluded.active, form = excluded.form, tag = excluded.tag,
      description = excluded.description, image = excluded.image
    returning * into saved;
  if previous.id is null then insert into public.inventory_events(product_id,kind,reason,after_value,actor_id) values(saved.id,'product','Product created',to_jsonb(saved),auth.uid());end if;
  perform public.inventory_refresh(saved.id);
  select * into saved from public.products where id=saved.id;
  return saved;
end $$;


-- Certificate files are append-only once attached or shipped. Detaching never erases evidence.
create or replace function public.certificate_retained(path text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.lots where coa_path=$1) or exists(select 1 from public.order_lot_allocations where certificate_path=$1)
 or exists(select 1 from public.inventory_events where before_value->>'coa_path'=$1 or after_value->>'coa_path'=$1)
$$;
drop policy if exists platform_content_update on storage.objects;
create policy platform_content_update on storage.objects for update to authenticated
 using (bucket_id in ('certificates','journal') and (select public.platform_role()) in ('owner','staff') and (bucket_id='journal' or not public.certificate_retained(name)))
 with check (bucket_id in ('certificates','journal') and (select public.platform_role()) in ('owner','staff') and (bucket_id='journal' or not public.certificate_retained(name)));
drop policy if exists platform_content_delete on storage.objects;
create policy platform_content_delete on storage.objects for delete to authenticated
 using (bucket_id in ('certificates','journal') and (select public.platform_role()) in ('owner','staff') and (bucket_id='journal' or not public.certificate_retained(name)));
revoke all on function public.inventory_results_pass(jsonb),public.certificate_retained(text) from public,anon,authenticated,service_role;
grant execute on function public.certificate_retained(text) to authenticated;
create or replace function public.inventory_eligible(l public.lots) returns boolean language sql stable security definer set search_path=public as $$
 select l.status='released' and l.testing_status='passed' and l.received_at is not null and l.units is not null
 and nullif(btrim(l.hold_reason),'') is null and l.coa_path is not null and public.inventory_results_pass(l.results)
 and exists(select 1 from storage.objects s where s.bucket_id='certificates' and s.name=l.coa_path)
$$;
create or replace function public.return_inventory(allocation_id uuid, quantity integer, reason text, resale_confirmed boolean, request_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare a public.order_lot_allocations; l public.lots; e public.inventory_events;
begin
 perform public.inventory_team();
 if $2 is null or $2<=0 or $4 is distinct from true or nullif(btrim($3),'') is null or $5 is null then raise exception 'Enter a positive return quantity, reason and confirm suitability for resale' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended($5::text,170));
 select * into e from public.inventory_events where inventory_events.request_id=$5;
 if found then
  if e.kind is distinct from 'return' or e.after_value->>'allocationId' is distinct from $1::text or (e.after_value->>'quantity')::integer is distinct from $2 then raise exception 'Return reference already used' using errcode='22023'; end if;
  return;
 end if;
 perform 1 from public.products p where id=(select li.product_id from public.order_lines li join public.order_lot_allocations alloc on alloc.order_line_id=li.id where alloc.id=$1) for update;
 select * into a from public.order_lot_allocations where id=$1 for update;
 if not found or a.state<>'fulfilled' or a.returned_units+$2>a.quantity then raise exception 'Return exceeds the unreturned shipped quantity' using errcode='22023'; end if;
 select * into l from public.lots where inventory_id=a.lot_id for update;
 if l.units is null then raise exception 'Reconcile this lot count before returning stock' using errcode='22023'; end if;
 perform set_config('inventory.reason','Return: '||$3,true);
 update public.order_lot_allocations set returned_units=returned_units+$2 where id=$1;
 update public.lots set units=units+$2,version=version+1 where inventory_id=a.lot_id;
 insert into public.inventory_events(request_id,product_id,lot_id,kind,reason,after_value,actor_id) values($5,l.product_id,l.inventory_id,'return',$3,jsonb_build_object('allocationId',$1,'quantity',$2),auth.uid());
end $$;
revoke all on function public.return_inventory(uuid,integer,text,boolean,uuid) from public,anon,authenticated,service_role;
grant execute on function public.return_inventory(uuid,integer,text,boolean,uuid) to authenticated;
do $$ declare p record; begin for p in select id from public.products order by id loop perform public.inventory_refresh(p.id); end loop; end $$;

create or replace function public.inventory_product_guard() returns trigger language plpgsql security definer set search_path=public as $$ begin
 new.stock:=(select coalesce(sum(greatest(units-reserved_units,0)),0)::integer from public.lots l where l.product_id=new.id and public.inventory_eligible(l));
 if tg_op='UPDATE' and (to_jsonb(new)-array['stock','lot','updated_at','updated_by']) is distinct from (to_jsonb(old)-array['stock','lot','updated_at','updated_by']) then
  insert into public.inventory_events(product_id,kind,reason,before_value,after_value,actor_id) values(new.id,'product','Product details changed',to_jsonb(old),to_jsonb(new),auth.uid());
 end if;
 return new;
end $$;
drop trigger if exists inventory_product_guard on public.products;
create trigger inventory_product_guard before insert or update on public.products for each row execute function public.inventory_product_guard();
revoke all on function public.inventory_product_guard() from public,anon,authenticated,service_role;
create or replace function public.reject_lot(lot text,note text) returns public.lots language plpgsql security definer set search_path=public as $$
declare l public.lots; begin
 perform public.inventory_team();if nullif(btrim($2),'') is null then raise exception 'Enter a rejection reason' using errcode='22023'; end if;
 perform 1 from public.products where id=(select product_id from public.lots where lots.lot=$1) for update;
 select * into l from public.lots where lots.lot=$1 for update;
 if not found then raise exception 'Lot not found' using errcode='22023'; end if;
 -- A rejection is final; its note is not rewritten.
 if l.status='rejected' then raise exception 'This lot is already rejected' using errcode='22023'; end if;
 perform set_config('inventory.reason','Lot rejected: '||btrim($2),true);
 update public.lots set status='rejected',testing_status='failed',rejection_note=btrim($2),version=version+1 where inventory_id=l.inventory_id returning * into l;
 return l;
end $$;
-- A lot archived after rejection still verifies as rejected, without presenting its failed evidence.
create or replace function public.lot_lookup(lot text) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('lot',coalesce(l.lot_number,l.lot),'productId',l.product_id,'status',s.status,'releasedAt',l.released_at,
 'testedAt',case when s.status in ('released','archived') then l.tested_at end,
 'reference',case when s.status in ('released','archived') then l.reference end,
 'results',case when s.status in ('released','archived') then l.results else '[]'::jsonb end,
 'coaUrl',case when s.status in ('released','archived') and l.coa_path is not null then 'https://gydihnfzmuqmbnykaihg.supabase.co/storage/v1/object/public/certificates/'||l.coa_path end)
 from public.lots l cross join lateral (select case when l.testing_status='failed' then 'rejected' else l.status end as status) s
 where upper(regexp_replace($1,'[[:space:]]+','','g')) in (upper(l.lot),upper(l.lot_number));
$$;
-- Freeze the already recorded certificate association of historical shipped lines.
update public.order_lot_allocations a set certificate_path=l.coa_path,
 certificate_snapshot=jsonb_build_object('legacy',true,'reference',l.reference,'results',l.results,'lot',a.lot_number)
 from public.lots l where a.lot_id=l.inventory_id and a.legacy and a.state='fulfilled' and a.certificate_snapshot is null;
-- Current stock and lot edits propagate to other open, authorized sessions.
do $$ declare t text; begin
 foreach t in array array['products','lots','order_lot_allocations','inventory_events'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
 end loop;
end $$;
-- Keep a readable operator identity with the audit record.
alter table public.inventory_events add column if not exists actor_label text;
create or replace function public.inventory_event_actor() returns trigger language plpgsql security definer set search_path=public as $$ begin
 select coalesce(nullif(u.raw_user_meta_data->>'name',''),nullif(u.raw_user_meta_data->>'full_name',''),u.email) into new.actor_label from auth.users u where u.id=new.actor_id;
 return new;
end $$;
drop trigger if exists inventory_event_actor on public.inventory_events;
create trigger inventory_event_actor before insert on public.inventory_events for each row execute function public.inventory_event_actor();
revoke all on function public.inventory_event_actor() from public,anon,authenticated,service_role;
update public.inventory_events e set actor_label=coalesce(nullif(u.raw_user_meta_data->>'name',''),nullif(u.raw_user_meta_data->>'full_name',''),u.email) from auth.users u where u.id=e.actor_id and e.actor_label is null;
commit;
