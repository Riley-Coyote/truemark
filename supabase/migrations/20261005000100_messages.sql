-- WP-24: account preferences and database-owned message outbox.
begin;
create table if not exists public.outbox (
 id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
 channel text check(channel in ('email','sms')), template text not null,
 recipient_user uuid references public.profiles(id) on delete set null, recipient text not null,
 notification_id uuid references public.notifications(id) on delete set null,
 order_id uuid references public.orders(id), data jsonb not null default '{}', dedupe_key text not null unique,
 status text not null default 'queued' check(status in ('queued','sending','sent','failed','suppressed')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(), locked_until timestamptz,
 provider text, provider_message_id text, subject text, body_html text, body_text text,
 last_error text check(last_error is null or length(last_error)<=500), sent_at timestamptz
);
create index if not exists outbox_queue on public.outbox(status,next_attempt_at);
create index if not exists outbox_order on public.outbox(order_id);
create index if not exists outbox_created on public.outbox(created_at desc);
create table if not exists public.message_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 phone text check(phone is null or phone ~ '^\+1[2-9][0-9]{9}$'),
 sms_consent_at timestamptz, sms_consent_text text, sms_opted_out_at timestamptz,
 alerts jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table if not exists public.partner_milestones (
 partner_id uuid references public.partners(id), milestone text, reached_at timestamptz default now(),
 primary key(partner_id,milestone)
);
create table if not exists public.contact_routes(topic text primary key,label text,email text);
insert into public.contact_routes values
 ('account-verification','Account verification','accounts@truemarkbiolabs.com'),
 ('orders-shipping','Orders & shipping','orders@truemarkbiolabs.com'),
 ('testing-certificates','Testing & certificates','quality@truemarkbiolabs.com'),
 ('general-support','General support','help@truemarkbiolabs.com') on conflict(topic) do nothing;
create table if not exists public.contact_messages (
 id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),
 topic text references public.contact_routes(topic),name text not null check(length(name) between 1 and 200),
 email text not null check(length(email) between 3 and 320 and position('@' in email)>0),
 organization text check(length(organization)<=200),message text not null check(length(message) between 1 and 5000),
 status text default 'new' check(status in ('new','handled')),handled_at timestamptz,handled_by uuid references public.profiles(id)
);
create index if not exists contact_messages_hour on public.contact_messages(created_at,lower(email));

-- Earlier migrations revoke service_role table privileges. BYPASSRLS alone
-- does not grant SELECT; rendering needs these existing records, read-only.
grant select on public.orders,public.order_lines,public.order_events,public.buyers,
 public.partners,public.referrals,public.payouts,public.applications,
 public.partner_applications,public.shipping_methods,public.products,public.lots,
 public.discounts to service_role;

-- No browser writes. Service reads support the injected server adapter.
do $$ declare t text; begin
 foreach t in array array['outbox','message_preferences','partner_milestones','contact_routes','contact_messages'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on public.%I to authenticated,service_role',t);
 execute format('drop policy if exists messages_service on public.%I',t);
 execute format('create policy messages_service on public.%I for select to service_role using(true)',t);
 end loop;
 foreach t in array array['outbox','contact_routes','contact_messages'] loop
 execute format('drop policy if exists messages_team on public.%I',t);
 execute format('create policy messages_team on public.%I for select to authenticated using ((select public.platform_role()) in (''owner'',''staff''))',t);
 end loop;
end $$;
drop policy if exists messages_own on public.message_preferences;
create policy messages_own on public.message_preferences for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists milestones_read on public.partner_milestones;
create policy milestones_read on public.partner_milestones for select to authenticated using(
 (select public.platform_role()) in ('owner','staff') or partner_id in(select id from public.partners where user_id=(select auth.uid())));

create or replace function public.messages_preferences(uid uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r text; p public.message_preferences; defaults jsonb; k text; v jsonb; a jsonb;
begin
 select role into r from public.profiles where id=$1;
 select * into p from public.message_preferences where user_id=$1;
 defaults:=case when r='partner' then '{"newOrder":{"email":true,"text":false},"approved":{"email":true,"text":false},"payout":{"email":true,"text":false},"milestone":{"email":true,"text":false},"weekly":{"email":true,"text":false}}'::jsonb
 when r in ('owner','staff') then '{"newOrder":{"email":false,"text":false},"applications":{"email":false}}'::jsonb
 else '{"shipping":{"text":false}}'::jsonb end;
 a:=defaults;
 for k,v in select * from jsonb_each(defaults) loop a:=jsonb_set(a,array[k],v||coalesce(p.alerts->k,'{}'::jsonb)); end loop;
 return jsonb_build_object('phone',p.phone,'smsConsent',p.sms_consent_at is not null,'smsOptedOut',p.sms_opted_out_at is not null,'alerts',a);
end $$;
create or replace function public.my_message_preferences() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'account required' using errcode='42501'; end if;
 return public.messages_preferences(auth.uid());
end $$;
create or replace function public.save_message_preferences(alerts jsonb,phone text,sms_consent boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); r text; defaults jsonb; a jsonb; k text; v jsonb; c text; b jsonb; digits text; normal text; old public.message_preferences; sentence text;
begin
 if uid is null then raise exception 'account required' using errcode='42501'; end if;
 select role into r from public.profiles where id=uid;
 defaults:=public.messages_preferences(uid)->'alerts';
 if $1 is null or jsonb_typeof($1)<>'object' then raise exception 'invalid alert preferences' using errcode='22023'; end if;
 a:=defaults;
 for k,v in select * from jsonb_each($1) loop
 if not defaults ? k or jsonb_typeof(v)<>'object' then raise exception 'invalid alert preferences' using errcode='22023'; end if;
 for c,b in select * from jsonb_each(v) loop
 if not (defaults->k) ? c or jsonb_typeof(b)<>'boolean' then raise exception 'invalid alert preferences' using errcode='22023'; end if;
 end loop;
 a:=jsonb_set(a,array[k],(a->k)||v);
 end loop;
 if nullif(btrim($2),'') is not null then
 if $2 !~ '^[+0-9(). -]+$' then raise exception 'Enter a US mobile number.' using errcode='22023'; end if;
 digits:=regexp_replace($2,'[^0-9]','','g');
 if length(digits)=11 and left(digits,1)='1' then digits:=substr(digits,2); end if;
 if digits !~ '^[2-9][0-9]{9}$' then raise exception 'Enter a US mobile number.' using errcode='22023'; end if;
 normal:='+1'||digits;
 end if;
 select * into old from public.message_preferences where user_id=uid for update;
 -- Removing an existing phone/consent turns all text switches off. A new text
 -- request without consent is refused instead of silently accepted.
 if exists(select 1 from jsonb_each(a) x where x.value->'text'='true'::jsonb)
 and (normal is null or not coalesce($3,false)) and old.sms_consent_at is null then
 raise exception 'Add a mobile number and agree to texts to turn on text alerts.' using errcode='22023'; end if;
 if normal is null or not coalesce($3,false) then
 for k,v in select * from jsonb_each(a) loop
 if v ? 'text' then a:=jsonb_set(a,array[k,'text'],'false'::jsonb); end if;
 end loop;
 end if;
 sentence:=case when r='partner' then 'Text me TrueMark partner alerts at this number. Message and data rates may apply. Reply STOP to opt out.'
 when r in ('owner','staff') then 'Text me TrueMark team alerts at this number. Message and data rates may apply. Reply STOP to opt out.'
 else 'Text me when my orders ship and arrive. Message and data rates may apply. Reply STOP to opt out.' end;
 insert into public.message_preferences(user_id,phone,alerts,sms_consent_at,sms_consent_text,sms_opted_out_at)
 values(uid,normal,a,case when normal is not null and $3 then coalesce(old.sms_consent_at,now()) end,
 case when normal is not null and $3 then sentence end,
 case when $3 and old.sms_consent_at is null then null else old.sms_opted_out_at end)
 on conflict(user_id) do update set phone=excluded.phone,alerts=excluded.alerts,sms_consent_at=excluded.sms_consent_at,
 sms_consent_text=excluded.sms_consent_text,sms_opted_out_at=excluded.sms_opted_out_at,updated_at=now();
 return public.messages_preferences(uid);
end $$;
create or replace function public.team_alert_preferences()
returns table(user_id uuid,email text,role text,new_order_email boolean,new_order_text boolean,applications_email boolean)
language plpgsql security definer set search_path=public as $$
begin
 if coalesce(public.platform_role(),'') not in ('owner','staff') then raise exception 'team access required' using errcode='42501'; end if;
 return query select p.id,u.email::text,p.role,(a.prefs#>>'{alerts,newOrder,email}')::boolean,
 (a.prefs#>>'{alerts,newOrder,text}')::boolean,(a.prefs#>>'{alerts,applications,email}')::boolean
 from public.profiles p join auth.users u on u.id=p.id
 cross join lateral(select public.messages_preferences(p.id) prefs) a where p.role in ('owner','staff');
end $$;
create or replace function public.system_sms_opt(phone text,opted_out boolean) returns void
language sql security definer set search_path=public as $$
 update public.message_preferences set sms_opted_out_at=case when $2 then now() end,updated_at=now() where phone=$1;
$$;

create or replace function public.system_claim_outbox(batch integer default 25) returns setof public.outbox
language sql security definer set search_path=public as $$
 with selected as(select id from public.outbox where
 ((status='queued' and next_attempt_at<=now() and (locked_until is null or locked_until<now()))
 or (status='sending' and locked_until<now())) order by created_at,id for update skip locked limit greatest(0,$1)),
 claimed as(update public.outbox o set status='sending',locked_until=now()+interval '2 minutes',attempts=attempts+1
 from selected s where o.id=s.id returning o.*) select * from claimed order by created_at,id;
$$;
create or replace function public.system_finish_outbox(id uuid,ok boolean,provider text,provider_message_id text,subject text,body_html text,body_text text,error text) returns void
language sql security definer set search_path=public as $$
 update public.outbox o set status=case when $2 then 'sent' when attempts<5 then 'queued' else 'failed' end,
 provider=$3,provider_message_id=$4,subject=$5,body_html=$6,body_text=$7,
 sent_at=case when $2 then now() end,locked_until=null,last_error=case when $2 then null else left($8,500) end,
 next_attempt_at=case when not $2 and attempts<5 then now()+make_interval(mins=>case attempts when 1 then 1 when 2 then 5 when 3 then 15 else 60 end) else next_attempt_at end
 where o.id=$1 and o.status='sending';
$$;
-- off can be selected after enqueue and before a flush.
create or replace function public.system_suppress_outbox(id uuid) returns void
language sql security definer set search_path=public as $$
 update public.outbox set status='suppressed',locked_until=null where id=$1 and status='sending';
$$;

create or replace function public.messages_enqueue_for_notification() returns trigger
language plpgsql security definer set search_path=public as $$
declare uid uuid; email text; pref jsonb; event text; tpl text; oid uuid; rid uuid; pid uuid; mid uuid; aid uuid; data jsonb; target record; ch text; dest text; state text; queued boolean:=false;
begin
 -- Existing notifications carry order identifiers in hrefs and order numbers
 -- in referral bodies. Resolve them when enqueuing, keeping that snapshot's ids.
 select o.id into oid from public.orders o where new.href like '%'||o.id::text||'%'
 or o.number=substring(new.title from '(TM-[0-9]+)') or o.number=substring(new.body from '^Order (TM-[0-9]+)') order by o.created_at desc limit 1;
 data:=jsonb_build_object('notification_id',new.id,'order_id',oid,'title',new.title,'body',new.body,'amount',new.amount);
 if new.audience like 'buyer:%' then
 select b.user_id,b.email into uid,email from public.buyers b where b.id=substr(new.audience,7)::uuid;
 tpl:=case new.kind when 'order.placed' then 'buyer.order_confirmed' when 'order.shipped' then 'buyer.order_shipped'
 when 'order.delivered' then 'buyer.order_delivered' when 'order.cancelled' then 'buyer.order_cancelled'
 when 'order.refunded' then 'buyer.order_refunded' when 'payment.failed' then 'buyer.payment_failed'
 when 'application.approved' then 'buyer.account_approved' when 'application.declined' then 'buyer.account_declined' end;
 event:=case when new.kind in ('order.shipped','order.delivered') then 'shipping' end;
 elsif new.audience like 'partner:%' then
 pid:=substr(new.audience,9)::uuid;
 select p.user_id,p.email into uid,email from public.partners p where p.id=pid;
 tpl:=case new.kind when 'referral.created' then 'partner.new_order' when 'commission.approved' then 'partner.commission_approved'
 when 'payout.sent' then 'partner.payout_sent' when 'partner.milestone' then 'partner.milestone' when 'partner.welcome' then 'partner.welcome' end;
 event:=case new.kind when 'referral.created' then 'newOrder' when 'commission.approved' then 'approved' when 'payout.sent' then 'payout' when 'partner.milestone' then 'milestone' end;
 select id into rid from public.referrals where partner_id=pid and order_id=oid;
 if new.kind='payout.sent' then select id into mid from public.payouts where partner_id=pid and amount=new.amount order by created_at desc,id limit 1; end if;
 data:=data||jsonb_build_object('partner_id',pid,'referral_id',rid,'payout_id',mid);
 elsif new.audience='owner' then
 tpl:=case new.kind when 'order.placed' then 'team.new_order' when 'application.submitted' then 'team.application'
 when 'partner_application.submitted' then 'team.application' when 'contact.received' then 'team.contact' when 'system.alert' then 'team.system_alert' end;
 event:=case when new.kind='order.placed' then 'newOrder' when new.kind in ('application.submitted','partner_application.submitted') then 'applications' end;
 if new.kind='contact.received' then mid:=substring(new.href from 'message=([0-9a-f-]{36})')::uuid; end if;
 if new.kind='application.submitted' then select id into aid from public.applications where name||' '||chr(183)||' '||institution=new.body order by submitted_at desc,id limit 1;
 elsif new.kind='partner_application.submitted' then select id into aid from public.partner_applications where name=new.body order by submitted_at desc,id limit 1; end if;
 data:=data||jsonb_build_object('message_id',mid,'application_id',aid,'kind',new.kind);
 end if;
 if tpl is null then return new; end if;
 for target in
 select uid u,email e where new.audience<>'owner' and uid is not null
 union all select p.id,u.email::text from public.profiles p join auth.users u on u.id=p.id
 where new.audience='owner' and new.kind<>'contact.received' and
 (case when new.kind='system.alert' then p.role='owner' else p.role in ('owner','staff') end)
 union all select null::uuid,r.email from public.contact_messages m join public.contact_routes r on r.topic=m.topic where new.kind='contact.received' and m.id=mid
 loop
 pref:=public.messages_preferences(target.u);
 foreach ch in array array['email','sms'] loop
 if ch='email' and event is not null and new.audience not like 'buyer:%' and not coalesce((pref#>>array['alerts',event,'email'])::boolean,false) then continue; end if;
 if ch='sms' and (event is null or not coalesce((pref#>>array['alerts',event,'text'])::boolean,false)
 or pref->>'phone' is null or pref->>'smsConsent'<>'true' or pref->>'smsOptedOut'<>'false') then continue; end if;
 dest:=case when ch='email' then target.e else pref->>'phone' end;
 if dest is null then continue; end if;
 select case when mode='off' then 'suppressed' else 'queued' end into state from public.connections where id=ch;
 insert into public.outbox(channel,template,recipient_user,recipient,notification_id,order_id,data,dedupe_key,status)
 values(ch,tpl||case when ch='sms' then '_sms' else '' end,target.u,dest,new.id,oid,data,new.id||':'||ch||':'||dest,coalesce(state,'suppressed')) on conflict(dedupe_key) do nothing;
 if found and state='queued' then queued:=true; end if;
 end loop;
 end loop;
 if queued then perform public.system_poke('/messages/flush'); end if;
 return new;
end $$;
drop trigger if exists messages_notification on public.notifications;
create trigger messages_notification after insert on public.notifications for each row execute function public.messages_enqueue_for_notification();

create or replace function public.messages_application_notification() returns trigger
language plpgsql security definer set search_path=public as $$
declare notice_id uuid;
begin
 if tg_op='INSERT' then
 insert into public.notifications(audience,kind,title,body,href) values('owner',
 case when tg_table_name='applications' then 'application.submitted' else 'partner_application.submitted' end,
 case when tg_table_name='applications' then 'New research application' else 'New partner application' end,
 new.name||case when tg_table_name='applications' then ' '||chr(183)||' '||(to_jsonb(new)->>'institution') else '' end,
 case when tg_table_name='applications' then '/admin/applications' else '/admin/partners?view=applications' end) returning id into notice_id;
 -- Attach the triggering record, even when names and institutions are identical.
 update public.outbox o set data=o.data||jsonb_build_object('application_id',new.id) where o.notification_id=notice_id;
 elsif new.status is distinct from old.status and new.status in ('approved','declined') then
 insert into public.notifications(audience,kind,title,body,href) values('buyer:'||new.buyer_id,'application.'||new.status,
 case when new.status='approved' then 'Your research account is approved' else 'About your research account' end,
 case when new.status='approved' then 'You can now place orders.' else 'We couldn''t approve your application.' end,
 case when new.status='approved' then '/products' else '/contact' end);
 end if;
 return new;
end $$;
drop trigger if exists messages_application_insert on public.applications;
create trigger messages_application_insert after insert on public.applications for each row execute function public.messages_application_notification();
drop trigger if exists messages_application_status on public.applications;
create trigger messages_application_status after update of status on public.applications for each row execute function public.messages_application_notification();
drop trigger if exists messages_partner_application on public.partner_applications;
create trigger messages_partner_application after insert on public.partner_applications for each row execute function public.messages_application_notification();
create or replace function public.messages_milestones() returns trigger
language plpgsql security definer set search_path=public as $$
declare n integer; earned numeric; rule record;
begin
 perform 1 from public.partners where id=new.partner_id for update;
 select count(*),coalesce(sum(commission),0) into n,earned from public.referrals where partner_id=new.partner_id and status<>'void';
 for rule in select * from (values
 (1,'first-order','First referred order','orders',1),(2,'orders-10','10 referred orders','orders',10),
 (3,'earned-500','$500 earned','earned',500),(4,'orders-25','25 referred orders','orders',25),
 (5,'earned-1000','$1,000 earned','earned',1000)) r(position,id,title,kind,target) order by position loop
 if (case when rule.kind='orders' then n else earned end)>=rule.target then
 insert into public.partner_milestones(partner_id,milestone) values(new.partner_id,rule.id) on conflict do nothing;
 if found then insert into public.notifications(audience,kind,title,body,href) values('partner:'||new.partner_id,'partner.milestone',
 case when rule.kind='orders' then 'You reached '||lower(rule.title) else 'You passed '||rule.title end,
 'Thank you for everything you do for TrueMark.','/partners/app'); end if;
 end if;
 end loop;
 return new;
end $$;
drop trigger if exists messages_milestone on public.referrals;
create trigger messages_milestone after insert on public.referrals for each row execute function public.messages_milestones();

create or replace function public.system_queue_weekly_summaries() returns void
language plpgsql security definer set search_path=public as $$
declare start_date date:=(date_trunc('week',now() at time zone 'UTC')-interval '7 days')::date; p public.partners; pref jsonb; ch text; dest text; stats jsonb; state text;
begin
 for p in select * from public.partners where status='active' loop
 pref:=public.messages_preferences(p.user_id);
 select jsonb_build_object('partner_id',p.id,'week_start',start_date,'week_end',start_date+6,
 'orders',count(*),'earned',coalesce(sum(commission),0),'viaLink',count(*) filter(where via='link'),'viaCode',count(*) filter(where via='code'),
 'clicks',(select coalesce(sum(clicks),0) from public.visits where partner_id=p.id and date>=start_date and date<start_date+7)) into stats
 from public.referrals where partner_id=p.id and status<>'void' and created_at>=(start_date::timestamp at time zone 'UTC') and created_at<((start_date+7)::timestamp at time zone 'UTC');
 foreach ch in array array['email','sms'] loop
 if not coalesce((pref#>>array['alerts','weekly',case when ch='email' then 'email' else 'text' end])::boolean,false) then continue; end if;
 if ch='sms' and (pref->>'phone' is null or pref->>'smsConsent'<>'true' or pref->>'smsOptedOut'<>'false') then continue; end if;
 dest:=case when ch='email' then p.email else pref->>'phone' end;
 select case when mode='off' then 'suppressed' else 'queued' end into state from public.connections where id=ch;
 insert into public.outbox(channel,template,recipient_user,recipient,data,dedupe_key,status)
 values(ch,'partner.weekly'||case when ch='sms' then '_sms' else '' end,p.user_id,dest,stats,'weekly:'||p.id||':'||start_date||':'||ch,coalesce(state,'suppressed')) on conflict do nothing;
 end loop;
 end loop;
 perform public.system_poke('/messages/flush');
end $$;
create or replace function public.set_contact_route(topic text,email text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if public.platform_role() is distinct from 'owner' then raise exception 'owner access required' using errcode='42501'; end if;
 if $2 is null or length(btrim($2)) not between 3 and 320 or position('@' in $2)=0 or not exists(select 1 from public.contact_routes cr where cr.topic=$1) then raise exception 'Check the form and try again.' using errcode='22023'; end if;
 update public.contact_routes cr set email=btrim($2) where cr.topic=$1;
end $$;
create or replace function public.send_contact_message(topic text,name text,email text,organization text,message text,website text) returns boolean
language plpgsql security definer set search_path=public as $$
declare m public.contact_messages; label text;
begin
 if nullif(btrim($6),'') is not null then return true; end if;
 if $1 is null or not exists(select 1 from public.contact_routes cr where cr.topic=btrim($1))
 or $2 is null or length(btrim($2)) not between 1 and 200 or $3 is null or length(btrim($3)) not between 3 and 320 or position('@' in $3)=0
 or length(btrim($4))>200 or $5 is null or length(btrim($5)) not between 1 and 5000 then raise exception 'Check the form and try again.' using errcode='22023'; end if;
 -- Serialize the rolling counters so concurrent submissions cannot pass together.
 perform pg_advisory_xact_lock(24001);
 if (select count(*) from public.contact_messages cm where cm.created_at>now()-interval '1 hour' and lower(cm.email)=lower(btrim($3)))>=3
 or (select count(*) from public.contact_messages cm where cm.created_at>now()-interval '1 hour')>=100 then raise exception 'Too many messages just now. Please try again in an hour.' using errcode='22023'; end if;
 insert into public.contact_messages(topic,name,email,organization,message) values(btrim($1),btrim($2),btrim($3),nullif(btrim($4),''),btrim($5)) returning * into m;
 select r.label into label from public.contact_routes r where r.topic=m.topic;
 insert into public.notifications(audience,kind,title,body,href) values('owner','contact.received','Message from '||m.name,label||' '||chr(183)||' '||left(m.message,120),'/admin/inbox?message='||m.id);
 return true;
end $$;
create or replace function public.set_contact_status(id uuid,status text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if coalesce(public.platform_role(),'') not in ('owner','staff') then raise exception 'team access required' using errcode='42501'; end if;
 if $2 is null or $2 not in ('new','handled') then raise exception 'Check the form and try again.' using errcode='22023'; end if;
 update public.contact_messages cm set status=$2,handled_at=case when $2='handled' then now() end,handled_by=case when $2='handled' then auth.uid() end where cm.id=$1;
end $$;

-- Every function has explicit ACLs, including helpers callable only by definers.
revoke all on function public.messages_preferences(uuid) from public,anon,authenticated,service_role;
revoke all on function public.my_message_preferences() from public,anon,authenticated,service_role;
grant execute on function public.my_message_preferences() to authenticated;
revoke all on function public.save_message_preferences(jsonb,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.save_message_preferences(jsonb,text,boolean) to authenticated;
revoke all on function public.team_alert_preferences() from public,anon,authenticated,service_role;
grant execute on function public.team_alert_preferences() to authenticated;
revoke all on function public.system_sms_opt(text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.system_sms_opt(text,boolean) to service_role;
revoke all on function public.system_claim_outbox(integer) from public,anon,authenticated,service_role;
grant execute on function public.system_claim_outbox(integer) to service_role;
revoke all on function public.system_finish_outbox(uuid,boolean,text,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.system_finish_outbox(uuid,boolean,text,text,text,text,text,text) to service_role;
revoke all on function public.system_suppress_outbox(uuid) from public,anon,authenticated,service_role;
grant execute on function public.system_suppress_outbox(uuid) to service_role;
revoke all on function public.messages_enqueue_for_notification() from public,anon,authenticated,service_role;
revoke all on function public.messages_application_notification() from public,anon,authenticated,service_role;
revoke all on function public.messages_milestones() from public,anon,authenticated,service_role;
revoke all on function public.system_queue_weekly_summaries() from public,anon,authenticated,service_role;
grant execute on function public.system_queue_weekly_summaries() to service_role;
revoke all on function public.set_contact_route(text,text) from public,anon,authenticated,service_role;
grant execute on function public.set_contact_route(text,text) to authenticated;
revoke all on function public.send_contact_message(text,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.send_contact_message(text,text,text,text,text,text) to anon,authenticated;
revoke all on function public.set_contact_status(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.set_contact_status(uuid,text) to authenticated;
do $$ begin if to_regprocedure('cron.schedule(text,text,text)') is not null then
 perform cron.schedule('tm-messages-flush','* * * * *',$c$select public.system_poke('/messages/flush')$c$);
 perform cron.schedule('tm-partner-weekly','0 13 * * 1',$c$select public.system_queue_weekly_summaries()$c$);
end if; end $$;
commit;
