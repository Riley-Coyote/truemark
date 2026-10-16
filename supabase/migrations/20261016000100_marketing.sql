-- Shared consent, campaigns, event flows and a provider-free delivery simulator.
-- Marketing is deliberately independent of transactional messages and cannot send externally.
begin;
create table if not exists public.marketing_contacts (
 id uuid primary key default gen_random_uuid(), email text not null unique check(email=lower(btrim(email)) and email~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(email)<=254),
 name text not null check(length(btrim(name)) between 1 and 200), status text not null default 'subscribed' check(status in('subscribed','suppressed')),
 consent_at timestamptz not null, source text not null check(length(btrim(source)) between 3 and 500),
 suppressed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table if not exists public.marketing_campaigns (
 id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name)) between 1 and 150),
 subject text not null check(length(btrim(subject)) between 1 and 200), body text not null check(length(btrim(body)) between 1 and 20000),
 segment text not null default 'all' check(segment in('all','buyers')), status text not null default 'draft' check(status in('draft','scheduled','completed','cancelled')),
 scheduled_at timestamptz, version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references public.profiles(id)
);
create table if not exists public.marketing_flows (
 id text primary key check(id in('welcome','post_purchase','abandoned','winback')),
 name text not null, subject text not null check(length(btrim(subject)) between 1 and 200),
 body text not null check(length(btrim(body)) between 1 and 20000), delay_hours integer not null check(delay_hours between 0 and 8760),
 active boolean not null default false, activated_at timestamptz, version integer not null default 1, updated_at timestamptz not null default now()
);
insert into public.marketing_flows(id,name,subject,body,delay_hours) values
 ('welcome','Welcome after opt-in','Welcome to TrueMark','Thank you for subscribing to TrueMark research updates.',0),
 ('post_purchase','After a captured order','Your research order','Thank you for your research order. Your account holds its documents and order status.',168),
 ('abandoned','Uncollected order follow-up','Your pending research order','Your research order is awaiting payment. Open your account to review its current status.',0),
 ('winback','Returning research customer','Research purchasing at TrueMark','Your research account is ready when you next need to review the collection.',1080)
on conflict do nothing;
create table if not exists public.marketing_deliveries (
 id uuid primary key default gen_random_uuid(), contact_id uuid not null references public.marketing_contacts(id),
 campaign_id uuid references public.marketing_campaigns(id), flow_id text references public.marketing_flows(id),
 order_id uuid references public.orders(id), event_key text not null unique,
 subject text not null, body text not null, due_at timestamptz not null,
 status text not null default 'queued' check(status in('queued','simulated','suppressed')),
 reason text, processed_at timestamptz, created_at timestamptz not null default now(),
 check((campaign_id is not null)::integer+(flow_id is not null)::integer=1)
);
create index if not exists marketing_delivery_due on public.marketing_deliveries(due_at) where status='queued';
create index if not exists marketing_delivery_campaign on public.marketing_deliveries(campaign_id);
create table if not exists public.marketing_consent_events (
 id uuid primary key default gen_random_uuid(), contact_id uuid not null references public.marketing_contacts(id),
 status text not null, source text not null, consent_at timestamptz, actor_id uuid references public.profiles(id), created_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['marketing_contacts','marketing_campaigns','marketing_flows','marketing_deliveries','marketing_consent_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated,service_role',t);
  execute format('drop policy if exists marketing_team_read on public.%I',t);
  execute format('create policy marketing_team_read on public.%I for select to authenticated using ((select public.platform_role()) in (''owner'',''staff''))',t);
  execute format('drop policy if exists marketing_service_read on public.%I',t);
  execute format('create policy marketing_service_read on public.%I for select to service_role using (true)',t);
 end loop;
end $$;
create or replace function public.import_marketing_contacts(drafts jsonb) returns integer
language plpgsql security definer set search_path=public as $$
declare d jsonb; saved public.marketing_contacts; n integer:=0; begin
 if coalesce(public.platform_role(),'') not in('owner','staff') then raise exception 'Team access required' using errcode='42501'; end if;
 if jsonb_typeof($1) is distinct from 'array' or jsonb_array_length($1) not between 1 and 1000 then raise exception 'Import 1 to 1000 consented contacts per batch' using errcode='22023'; end if;
 for d in select value from jsonb_array_elements($1) loop
  if jsonb_typeof(d->'email') is distinct from 'string' or jsonb_typeof(d->'name') is distinct from 'string' or jsonb_typeof(d->'source') is distinct from 'string' or jsonb_typeof(d->'consent_at') is distinct from 'string'
   or (d->>'consent_at')::timestamptz>now() then raise exception 'Every contact needs a past opt-in timestamp and source' using errcode='22023'; end if;
  insert into public.marketing_contacts(email,name,consent_at,source) values(lower(btrim(d->>'email')),btrim(d->>'name'),(d->>'consent_at')::timestamptz,btrim(d->>'source'))
    on conflict(email) do nothing returning * into saved;
  if found then
   insert into public.marketing_consent_events(contact_id,status,source,consent_at,actor_id) values(saved.id,'subscribed',saved.source,saved.consent_at,auth.uid()); n:=n+1;
  end if;
 end loop;
 return n;
end $$;
create or replace function public.suppress_marketing_contact(contact_id uuid, expected_version integer) returns void
language plpgsql security definer set search_path=public as $$
declare c public.marketing_contacts; begin
 perform pg_advisory_xact_lock(20261016,1);
 if coalesce(public.platform_role(),'') not in('owner','staff') then raise exception 'Team access required' using errcode='42501'; end if;
 update public.marketing_contacts set status='suppressed',suppressed_at=now(),version=version+1,updated_at=now() where id=$1 and version=$2 returning * into c;
 if not found then raise exception 'Contact changed. Reload before suppressing.' using errcode='22023'; end if;
 insert into public.marketing_consent_events(contact_id,status,source,actor_id) values(c.id,'suppressed','Team suppression',auth.uid());
 update public.marketing_deliveries set status='suppressed',reason='Consent withdrawn',processed_at=now() where marketing_deliveries.contact_id=c.id and status='queued';
end $$;
create or replace function public.my_marketing_consent() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare c public.marketing_contacts; begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into c from public.marketing_contacts where email=(select lower(btrim(email)) from auth.users where id=auth.uid());
 return jsonb_build_object('subscribed',coalesce(c.status='subscribed',false),'consentAt',c.consent_at,'source',c.source);
end $$;
create or replace function public.set_my_marketing_consent(subscribed boolean) returns void
language plpgsql security definer set search_path=public as $$
declare mail text; person_name text; c public.marketing_contacts; begin
 perform pg_advisory_xact_lock(20261016,1);
 if auth.uid() is null or $1 is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select lower(btrim(email)) into mail from auth.users where id=auth.uid();
 select name into person_name from public.buyers where user_id=auth.uid();
 insert into public.marketing_contacts(email,name,status,consent_at,source,suppressed_at) values(mail,coalesce(person_name,mail),case when $1 then 'subscribed' else 'suppressed' end,now(),'Account newsletter preference',case when $1 then null else now() end)
 on conflict(email) do update set status=excluded.status,consent_at=case when $1 then now() else marketing_contacts.consent_at end,source=case when $1 then excluded.source else marketing_contacts.source end,
 suppressed_at=excluded.suppressed_at,updated_at=now(),version=marketing_contacts.version+1 returning * into c;
 insert into public.marketing_consent_events(contact_id,status,source,consent_at,actor_id) values(c.id,c.status,'Account newsletter preference',c.consent_at,auth.uid());
 if not $1 then update public.marketing_deliveries set status='suppressed',reason='Consent withdrawn',processed_at=now() where contact_id=c.id and status='queued'; end if;
end $$;
create or replace function public.save_marketing_campaign(draft jsonb, expected_version integer default null) returns public.marketing_campaigns
language plpgsql security definer set search_path=public as $$
declare c public.marketing_campaigns; chosen uuid:=coalesce(nullif(draft->>'id','')::uuid,gen_random_uuid()); begin
 if coalesce(public.platform_role(),'') not in('owner','staff') then raise exception 'Team access required' using errcode='42501'; end if;
 if $2 is null then
  insert into public.marketing_campaigns(id,name,subject,body,segment,created_by) values(chosen,btrim(draft->>'name'),btrim(draft->>'subject'),btrim(draft->>'body'),coalesce(draft->>'segment','all'),auth.uid()) returning * into c;
 else
  update public.marketing_campaigns set name=btrim(draft->>'name'),subject=btrim(draft->>'subject'),body=btrim(draft->>'body'),segment=draft->>'segment',version=version+1,updated_at=now()
   where id=chosen and version=$2 and status='draft' returning * into c;
  if not found then raise exception 'Campaign changed or is already queued. Reload before editing.' using errcode='22023'; end if;
 end if;
 return c;
end $$;
create or replace function public.schedule_marketing_campaign(campaign_id uuid, scheduled_at timestamptz, expected_version integer) returns integer
language plpgsql security definer set search_path=public as $$
declare c public.marketing_campaigns; n integer; begin
 perform pg_advisory_xact_lock(20261016,1);
 if coalesce(public.platform_role(),'') not in('owner','staff') then raise exception 'Team access required' using errcode='42501'; end if;
 select * into c from public.marketing_campaigns where id=$1 for update;
 if not found or c.version is distinct from $3 or c.status<>'draft' then raise exception 'Campaign changed or was already queued. Reload first.' using errcode='22023'; end if;
 if $2 is null or $2>now()+interval '1 year' then raise exception 'Choose a schedule within the next year' using errcode='22023'; end if;
 insert into public.marketing_deliveries(contact_id,campaign_id,event_key,subject,body,due_at)
 select x.id,c.id,'campaign:'||c.id||':'||x.id,c.subject,c.body,greatest($2,now()) from public.marketing_contacts x
 where x.status='subscribed' and x.consent_at<=now() and (c.segment='all' or exists(select 1 from public.buyers b where lower(btrim(b.email))=x.email and b.status='verified'));
 get diagnostics n=row_count;
 if n=0 then raise exception 'No consented recipients match this audience' using errcode='22023'; end if;
 update public.marketing_campaigns set status='scheduled',scheduled_at=greatest($2,now()),version=version+1,updated_at=now() where id=c.id;
 return n;
end $$;
create or replace function public.cancel_marketing_campaign(campaign_id uuid, expected_version integer) returns void
language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(20261016,1);
 if coalesce(public.platform_role(),'') not in('owner','staff') then raise exception 'Team access required' using errcode='42501'; end if;
 update public.marketing_campaigns set status='cancelled',version=version+1,updated_at=now() where id=$1 and version=$2 and status in('draft','scheduled');
 if not found then raise exception 'Campaign changed or is complete. Reload first.' using errcode='22023'; end if;
 update public.marketing_deliveries set status='suppressed',reason='Campaign cancelled',processed_at=now() where marketing_deliveries.campaign_id=$1 and status='queued';
end $$;
create or replace function public.save_marketing_flow(draft jsonb, expected_version integer) returns public.marketing_flows
language plpgsql security definer set search_path=public as $$
declare f public.marketing_flows; begin
 perform pg_advisory_xact_lock(20261016,1);
 if coalesce(public.platform_role(),'') not in('owner','staff') then raise exception 'Team access required' using errcode='42501'; end if;
 if jsonb_typeof(draft->'active') is distinct from 'boolean' or jsonb_typeof(draft->'delay_hours') is distinct from 'number' or (draft->>'delay_hours')::numeric<>trunc((draft->>'delay_hours')::numeric)
 then raise exception 'Enter active state and whole delay hours' using errcode='22023'; end if;
 update public.marketing_flows set subject=btrim(draft->>'subject'),body=btrim(draft->>'body'),delay_hours=(draft->>'delay_hours')::integer,
 activated_at=case when (draft->>'active')::boolean and not active then now() else activated_at end,active=(draft->>'active')::boolean,updated_at=now(),version=version+1
 where id=draft->>'id' and version=$2 returning * into f;
 if not found then raise exception 'Flow changed. Reload first.' using errcode='22023'; end if;
 if not f.active then update public.marketing_deliveries set status='suppressed',reason='Flow paused',processed_at=now() where flow_id=f.id and status='queued'; end if;
 return f;
end $$;
create or replace function public.system_run_marketing() returns jsonb
language plpgsql security definer set search_path=public as $$
declare n integer; begin
 -- Serialize workers and schedule/cancellation operations at individual delivery rows.
 perform pg_advisory_xact_lock(20261016,1);
 insert into public.marketing_deliveries(contact_id,flow_id,event_key,subject,body,due_at)
 select c.id,f.id,'welcome:'||c.id||':'||c.consent_at,f.subject,f.body,c.consent_at+make_interval(hours=>f.delay_hours)
 from public.marketing_contacts c cross join public.marketing_flows f where f.id='welcome' and f.active and c.status='subscribed' and c.consent_at>=f.activated_at on conflict do nothing;
 insert into public.marketing_deliveries(contact_id,flow_id,order_id,event_key,subject,body,due_at)
 select c.id,f.id,o.id,f.id||':'||o.id,f.subject,f.body,
  (case when f.id='abandoned' then o.created_at else coalesce(o.paid_at,(select max(e.at) from public.order_events e where e.order_id=o.id and e.status='paid'),o.created_at) end)+make_interval(hours=>f.delay_hours)
 from public.orders o join public.buyers b on b.id=o.buyer_id join public.marketing_contacts c on c.email=lower(btrim(b.email)) cross join public.marketing_flows f
 where f.active and f.id in('post_purchase','abandoned','winback') and c.status='subscribed'
 and (case when f.id='abandoned' then o.created_at else coalesce(o.paid_at,(select max(e.at) from public.order_events e where e.order_id=o.id and e.status='paid'),o.created_at) end)>=f.activated_at
 and ((f.id='abandoned' and o.payment='pending' and o.status='placed' and o.payment_expires_at>now()) or
 (f.id in('post_purchase','winback') and o.payment in('captured','partially_refunded') and o.status<>'cancelled')) on conflict do nothing;
 with due as (select d.id from public.marketing_deliveries d where status='queued' and due_at<=now() order by due_at,id limit 500 for update skip locked)
 update public.marketing_deliveries d set processed_at=now(),status=case when
  c.status<>'subscribed' or (d.flow_id is not null and not exists(select 1 from public.marketing_flows f where f.id=d.flow_id and f.active))
  or (d.campaign_id is not null and exists(select 1 from public.marketing_campaigns x where x.id=d.campaign_id and x.status='cancelled'))
  or (d.flow_id='abandoned' and not exists(select 1 from public.orders o where o.id=d.order_id and o.payment='pending' and o.status='placed' and o.payment_expires_at>now()))
  or (d.flow_id in('post_purchase','winback') and not exists(select 1 from public.orders o where o.id=d.order_id and o.payment in('captured','partially_refunded') and o.status<>'cancelled'))
  or (d.flow_id='winback' and exists(select 1 from public.orders o join public.orders original on original.id=d.order_id where o.buyer_id=original.buyer_id and o.id<>original.id and o.payment in('captured','partially_refunded') and o.created_at>original.created_at))
  then 'suppressed' else 'simulated' end,reason=case when c.status<>'subscribed' then 'Consent withdrawn' else 'Simulator evaluated current consent, flow and order eligibility' end
 from due,public.marketing_contacts c where d.id=due.id and c.id=d.contact_id;
 get diagnostics n=row_count;
 update public.marketing_campaigns c set status='completed',version=version+1,updated_at=now() where status='scheduled'
 and not exists(select 1 from public.marketing_deliveries d where d.campaign_id=c.id and d.status='queued');
 return jsonb_build_object('processed',n,'transport','simulator');
end $$;
create or replace function public.run_marketing_test_queue() returns jsonb
language plpgsql security definer set search_path=public as $$ begin
 if coalesce(public.platform_role(),'') not in('owner','staff') then raise exception 'Team access required' using errcode='42501'; end if;
 return public.system_run_marketing();
end $$;
revoke all on function public.import_marketing_contacts(jsonb),public.suppress_marketing_contact(uuid,integer),public.my_marketing_consent(),public.set_my_marketing_consent(boolean),public.save_marketing_campaign(jsonb,integer),public.schedule_marketing_campaign(uuid,timestamptz,integer),public.cancel_marketing_campaign(uuid,integer),public.save_marketing_flow(jsonb,integer),public.system_run_marketing(),public.run_marketing_test_queue() from public,anon,authenticated,service_role;
grant execute on function public.import_marketing_contacts(jsonb),public.suppress_marketing_contact(uuid,integer),public.my_marketing_consent(),public.set_my_marketing_consent(boolean),public.save_marketing_campaign(jsonb,integer),public.schedule_marketing_campaign(uuid,timestamptz,integer),public.cancel_marketing_campaign(uuid,integer),public.save_marketing_flow(jsonb,integer),public.run_marketing_test_queue() to authenticated;
grant execute on function public.system_run_marketing() to service_role;
do $$ begin if to_regprocedure('cron.schedule(text,text,text)') is not null then perform cron.schedule('tm-marketing-test','* * * * *',$c$select public.system_run_marketing();$c$); end if; end $$;
notify pgrst,'reload schema';
commit;
