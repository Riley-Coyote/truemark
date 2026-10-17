-- Customer follow-ups and durable activity history. No delivery provider is activated.
begin;
create table if not exists public.retention_staff_access (
 id uuid primary key references public.profiles(id), allowed boolean not null default false,
 updated_at timestamptz not null default now(), updated_by uuid references public.profiles(id)
);
create or replace function public.can_manage_retention() returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce(public.platform_role()='owner' or (public.platform_role()='staff' and exists(
 select 1 from public.retention_staff_access where id=auth.uid() and allowed)),false)
$$;
create table if not exists public.retention_records (
 id uuid primary key, buyer_id uuid not null references public.buyers(id), product_id text references public.products(id),
 kind text not null check(kind in('note','contact','reply','reminder','draft')),
 channel text not null check(channel in('email','phone','other')),
 subject text not null default '' check(length(subject)<=200), body text not null check(length(btrim(body)) between 1 and 10000),
 occurred_at timestamptz not null, due_at timestamptz, status text not null default 'open' check(status in('open','done','cancelled')),
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid not null references public.profiles(id), updated_by uuid not null references public.profiles(id),
 check((kind='reminder')=(due_at is not null)), check(kind<>'draft' or status<>'done')
);
create index if not exists retention_buyer on public.retention_records(buyer_id,occurred_at);
create table if not exists public.retention_events (
 id uuid primary key default gen_random_uuid(), buyer_id uuid not null references public.buyers(id),
 source text not null, source_id text not null, kind text not null, occurred_at timestamptz,
 recorded_at timestamptz not null default now(), summary text not null, detail jsonb not null default '{}',
 dedupe_key text unique
);
create index if not exists retention_history on public.retention_events(buyer_id,recorded_at);
do $$ declare t text; begin
 foreach t in array array['retention_records','retention_events','retention_staff_access'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('drop policy if exists retention_read on public.%I',t);
  execute format('create policy retention_read on public.%I for select to authenticated using ((select public.can_manage_retention()))',t);
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;
create or replace function public.retention_access() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if coalesce(public.platform_role(),'') not in ('owner','staff') then raise exception 'Team access required' using errcode='42501'; end if;
 return jsonb_build_object('allowed',public.can_manage_retention(),'owner',public.platform_role()='owner','members',
 case when public.platform_role()='owner' then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'email',u.email,'allowed',coalesce(a.allowed,false)) order by u.email)
 from public.profiles p join auth.users u on u.id=p.id left join public.retention_staff_access a on a.id=p.id where p.role='staff'),'[]'::jsonb) else '[]'::jsonb end);
end $$;
create or replace function public.set_retention_access(user_id uuid, allowed boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from public.profiles where id=auth.uid() for share;
 if public.platform_role() is distinct from 'owner' then raise exception 'Owner access required' using errcode='42501'; end if;
 if $2 is null or not exists(select 1 from public.profiles where id=$1 and role='staff') then raise exception 'Choose a staff member' using errcode='22023'; end if;
 insert into public.retention_staff_access(id,allowed,updated_by) values($1,$2,auth.uid())
 on conflict(id) do update set allowed=excluded.allowed,updated_at=now(),updated_by=auth.uid();
end $$;
create or replace function public.save_retention_record(draft jsonb, expected_version integer default null) returns public.retention_records
language plpgsql security definer set search_path=public as $$
declare old public.retention_records; saved public.retention_records; rid uuid; at_time timestamptz; begin
 if not public.can_manage_retention() then raise exception 'Retention access required' using errcode='42501'; end if;
 if jsonb_typeof($1) is distinct from 'object' then raise exception 'Activity details required' using errcode='22023'; end if;
 rid:=($1->>'id')::uuid; at_time:=($1->>'occurred_at')::timestamptz;
 if rid is null or at_time is null or not isfinite(at_time) or at_time>now() then raise exception 'Choose an activity date that is not in the future' using errcode='22023'; end if;
 if nullif($1->>'due_at','') is not null and not isfinite(($1->>'due_at')::timestamptz) then raise exception 'Choose a valid reminder date' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(rid::text,0));
 select * into old from public.retention_records where id=rid for update;
 if found then
  -- Retried creates with identical content are safe after a lost acknowledgement.
  if $2 is null and (to_jsonb(old)-array['version','created_at','updated_at','created_by','updated_by']) =
    jsonb_build_object('id',rid,'buyer_id',($1->>'buyer_id')::uuid,'product_id',nullif($1->>'product_id',''),'kind',$1->>'kind','channel',$1->>'channel',
      'subject',btrim(coalesce($1->>'subject','')),'body',btrim($1->>'body'),'occurred_at',at_time,'due_at',nullif($1->>'due_at','')::timestamptz,'status',$1->>'status') then return old; end if;
  if old.version is distinct from $2 then raise exception 'This activity changed. Reload it before saving.' using errcode='22023'; end if;
  if old.buyer_id is distinct from ($1->>'buyer_id')::uuid or old.kind is distinct from $1->>'kind' then raise exception 'The customer and activity type cannot be changed' using errcode='22023'; end if;
  update public.retention_records set product_id=nullif($1->>'product_id',''),channel=$1->>'channel',subject=btrim(coalesce($1->>'subject','')),
   body=btrim($1->>'body'),occurred_at=at_time,due_at=nullif($1->>'due_at','')::timestamptz,status=$1->>'status',version=version+1,updated_at=now(),updated_by=auth.uid()
   where id=rid returning * into saved;
 else
  if $2 is not null then raise exception 'This activity is no longer available. Reload before saving.' using errcode='22023'; end if;
  insert into public.retention_records(id,buyer_id,product_id,kind,channel,subject,body,occurred_at,due_at,status,created_by,updated_by)
   values(rid,($1->>'buyer_id')::uuid,nullif($1->>'product_id',''),$1->>'kind',$1->>'channel',btrim(coalesce($1->>'subject','')),btrim($1->>'body'),at_time,
   nullif($1->>'due_at','')::timestamptz,$1->>'status',auth.uid(),auth.uid()) returning * into saved;
 end if;
 insert into public.retention_events(buyer_id,source,source_id,kind,occurred_at,summary,detail,dedupe_key)
 values(saved.buyer_id,'retention_records',saved.id::text,case when old.id is null then 'activity.created' else 'activity.updated' end,
 case when old.id is null then saved.occurred_at else now() end,case when old.id is null then 'Added ' else 'Updated ' end||saved.kind,
 to_jsonb(saved),saved.id::text||':'||saved.version);
 return saved;
end $$;

-- Capture only known customer relationships. Never infer an anonymous chat identity.
-- Source snapshots preserve changes without rewriting historical events.
create or replace function public.capture_retention_event() returns trigger
language plpgsql security definer set search_path=public as $$
declare r jsonb:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 bid uuid; d jsonb; happened timestamptz:=now(); label text; event_kind text; email_address text; match_count integer;
begin
 if TG_OP='UPDATE' and to_jsonb(old)=to_jsonb(new) then return new; end if;
 case TG_TABLE_NAME
 when 'orders' then
  d:=jsonb_build_object('order_id',r->'id','number',r->'number','status',r->'status','payment',r->'payment','total',r->'total','refunded',r->'refunded','paid_at',r->'paid_at');
  if TG_OP='UPDATE' and d=jsonb_build_object('order_id',old.id,'number',old.number,'status',old.status,'payment',old.payment,'total',old.total,'refunded',old.refunded,'paid_at',old.paid_at) then return new; end if;
  bid:=(r->>'buyer_id')::uuid; label:='Order '||(r->>'number')||' · '||(r->>'status'); event_kind:='order.'||lower(TG_OP);
  if TG_OP='INSERT' then happened:=(r->>'created_at')::timestamptz; end if;
 when 'order_lines' then
  select buyer_id into bid from public.orders where id=(r->>'order_id')::uuid;
  d:=r-'allocations'; label:='Order product '||lower(TG_OP); event_kind:='order.product';
 when 'order_events' then
  select buyer_id into bid from public.orders where id=(r->>'order_id')::uuid;
  d:=r; happened:=(r->>'at')::timestamptz; label:='Order '||(r->>'status'); event_kind:='order.status';
 when 'outbox' then
  select id into bid from public.buyers where user_id=(r->>'recipient_user')::uuid;
  if bid is null then return null; end if;
  d:=jsonb_build_object('order_id',r->'order_id','subject',r->'subject','body',r->'body_text','status',r->'status','provider',r->'provider','template',r->'template','channel',r->'channel');
  if TG_OP='UPDATE' and (to_jsonb(old)->>'status') is not distinct from (r->>'status') then return new; end if;
  label:='Email / SMS · '||(case when r->>'provider'='simulated' or r->>'provider'='simulator' then 'simulated' else r->>'status' end);
  event_kind:=case when r->>'status'='sent' and coalesce(r->>'provider','') not in('','simulated','simulator') then 'message.sent' else 'message.status' end;
  happened:=coalesce((r->>'sent_at')::timestamptz,now());
 when 'contact_messages' then
  email_address:=lower(btrim(r->>'email')); d:=jsonb_build_object('body',r->'message','status',r->'status','topic',r->'topic');
  label:='Contact form · sender email match, unverified'; event_kind:='contact.form'; happened:=(r->>'created_at')::timestamptz;
 when 'marketing_consent_events' then
  select email into email_address from public.marketing_contacts where id=(r->>'contact_id')::uuid;
  d:=r; label:='Marketing consent · '||(r->>'status'); event_kind:='consent.'||(r->>'status'); happened:=(r->>'created_at')::timestamptz;
 when 'marketing_deliveries' then
  select email into email_address from public.marketing_contacts where id=(r->>'contact_id')::uuid;
  d:=r; label:='Marketing · '||(r->>'status'); event_kind:='marketing.'||(r->>'status'); happened:=coalesce((r->>'processed_at')::timestamptz,(r->>'created_at')::timestamptz);
 when 'assistant_messages' then
  if r->>'role' not in('user','assistant') or jsonb_typeof(r->'content')<>'string' then return null; end if;
  select b.id into bid from public.assistant_threads t join public.buyers b on b.user_id=t.user_id where t.id=(r->>'thread_id')::uuid and t.mode='live' and t.persona='visitor';
  d:=jsonb_build_object('body',r->'content','role',r->'role','thread_id',r->'thread_id');
  label:=case when r->>'role'='user' then 'Customer chat message' else 'Assistant chat reply' end;
  event_kind:='chat.'||(r->>'role'); happened:=(r->>'created_at')::timestamptz;
 else return null;
 end case;
 if email_address is not null then
  select count(*) into match_count from public.buyers where lower(btrim(email))=email_address;
  if match_count=1 then select id into bid from public.buyers where lower(btrim(email))=email_address; end if;
 end if;
 if bid is not null then
  insert into public.retention_events(buyer_id,source,source_id,kind,occurred_at,summary,detail)
   values(bid,TG_TABLE_NAME,r->>'id',event_kind,happened,label,d);
 end if;
 return null;
end $$;
do $$ declare t text; begin
 foreach t in array array['orders','order_lines','order_events','outbox','contact_messages','marketing_consent_events','marketing_deliveries','assistant_messages'] loop
  execute format('drop trigger if exists retention_capture on public.%I',t);
  execute format('create trigger retention_capture after insert or update on public.%I for each row execute function public.capture_retention_event()',t);
 end loop;
end $$;
-- Import known history once. Unknown state-change timestamps stay unknown.
insert into public.retention_events(buyer_id,source,source_id,kind,occurred_at,summary,detail,dedupe_key)
 select o.buyer_id,'orders',o.id::text,'history.snapshot',null,'Existing order snapshot · '||o.number,
 jsonb_build_object('order_id',o.id,'number',o.number,'status',o.status,'payment',o.payment,'total',o.total,'refunded',o.refunded,
 'created_at',o.created_at,'lines',coalesce((select jsonb_agg(jsonb_build_object('product_id',l.product_id,'quantity',l.quantity,'unit_price',l.unit_price)) from public.order_lines l where l.order_id=o.id),'[]'::jsonb)),
 'backfill:orders:'||o.id from public.orders o on conflict(dedupe_key) do nothing;
insert into public.retention_events(buyer_id,source,source_id,kind,occurred_at,summary,detail,dedupe_key)
 select o.buyer_id,'order_events',e.id::text,'order.status',e.at,'Order '||e.status,to_jsonb(e),'backfill:order_events:'||e.id
 from public.order_events e join public.orders o on o.id=e.order_id on conflict(dedupe_key) do nothing;
insert into public.retention_events(buyer_id,source,source_id,kind,occurred_at,summary,detail,dedupe_key)
 select b.id,'marketing_consent_events',e.id::text,'consent.'||e.status,e.created_at,'Marketing consent · '||e.status,to_jsonb(e),'backfill:consent:'||e.id
 from public.marketing_consent_events e join public.marketing_contacts c on c.id=e.contact_id join public.buyers b on lower(btrim(b.email))=c.email
 where (select count(*) from public.buyers b2 where lower(btrim(b2.email))=c.email)=1 on conflict(dedupe_key) do nothing;
-- Preserve existing communication history; email matching is explicit and unique.
insert into public.retention_events(buyer_id,source,source_id,kind,occurred_at,summary,detail,dedupe_key)
 select b.id,'contact_messages',c.id::text,'contact.form',c.created_at,'Contact form · sender email match, unverified',
 jsonb_build_object('body',c.message,'status',c.status,'topic',c.topic),'backfill:contact:'||c.id
 from public.contact_messages c join public.buyers b on lower(btrim(b.email))=lower(btrim(c.email))
 where (select count(*) from public.buyers b2 where lower(btrim(b2.email))=lower(btrim(c.email)))=1 on conflict(dedupe_key) do nothing;
insert into public.retention_events(buyer_id,source,source_id,kind,occurred_at,summary,detail,dedupe_key)
 select b.id,'outbox',o.id::text,case when o.status='sent' and coalesce(o.provider,'') not in('','simulator','simulated') then 'message.sent' else 'message.status' end,
 o.sent_at,'Email / SMS snapshot · '||case when o.provider in('simulator','simulated') then 'simulated' else o.status end,
 jsonb_build_object('order_id',o.order_id,'subject',o.subject,'body',o.body_text,'status',o.status,'provider',o.provider,'channel',o.channel),'backfill:outbox:'||o.id
 from public.outbox o join public.buyers b on b.user_id=o.recipient_user on conflict(dedupe_key) do nothing;
insert into public.retention_events(buyer_id,source,source_id,kind,occurred_at,summary,detail,dedupe_key)
 select b.id,'marketing_deliveries',d.id::text,'marketing.'||d.status,coalesce(d.processed_at,d.created_at),'Marketing · '||d.status,to_jsonb(d),'backfill:delivery:'||d.id
 from public.marketing_deliveries d join public.marketing_contacts c on c.id=d.contact_id join public.buyers b on lower(btrim(b.email))=c.email
 where (select count(*) from public.buyers b2 where lower(btrim(b2.email))=c.email)=1 on conflict(dedupe_key) do nothing;
insert into public.retention_events(buyer_id,source,source_id,kind,occurred_at,summary,detail,dedupe_key)
 select b.id,'assistant_messages',m.id::text,'chat.'||m.role,m.created_at,case when m.role='user' then 'Customer chat message' else 'Assistant chat reply' end,
 jsonb_build_object('body',m.content,'role',m.role,'thread_id',m.thread_id),'backfill:chat:'||m.id
 from public.assistant_messages m join public.assistant_threads t on t.id=m.thread_id join public.buyers b on b.user_id=t.user_id
 where t.mode='live' and t.persona='visitor' and m.role in('user','assistant') and jsonb_typeof(m.content)='string' on conflict(dedupe_key) do nothing;
revoke all on function public.can_manage_retention(),public.retention_access(),public.set_retention_access(uuid,boolean),public.save_retention_record(jsonb,integer),public.capture_retention_event() from public,anon,authenticated,service_role;
grant execute on function public.can_manage_retention(),public.retention_access(),public.set_retention_access(uuid,boolean),public.save_retention_record(jsonb,integer) to authenticated;
commit;
