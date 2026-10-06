-- WP-27. Locked catalog, public tracking and private application documents.
begin;

drop policy if exists platform_public_products on public.products;
drop policy if exists shop_signed_in_products on public.products;
create policy shop_signed_in_products on public.products for select to authenticated using (active);
revoke select on public.products from anon;

create or replace function public.catalog_showcase() returns setof jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'name', name, 'size', size, 'category', category,
    'image', image, 'color', color, 'color_ink', color_ink, 'form', form, 'lot', lot, 'tag', tag)
  from public.products where active order by id;
$$;
revoke all on function public.catalog_showcase() from public, anon, authenticated, service_role;
grant execute on function public.catalog_showcase() to anon, authenticated;

create table if not exists public.track_lookups (number_hash text not null, at timestamptz not null default now());
create index if not exists track_lookups_hour on public.track_lookups(number_hash, at);
alter table public.track_lookups enable row level security;
revoke all on public.track_lookups from public, anon, authenticated, service_role;

create or replace function public.track_order(number text, email text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h text := encode(sha256(convert_to(upper($1), 'UTF8')), 'hex'); result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(h, 27));
  delete from public.track_lookups t where t.number_hash = h and t.at <= now() - interval '1 hour';
  if (select count(*) from public.track_lookups where number_hash = h and at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many lookups for this order. Try again in an hour.' using errcode = '22023';
  end if;
  insert into public.track_lookups(number_hash) values (h);
  select jsonb_build_object('number', o.number, 'status', o.status, 'createdAt', o.created_at,
    'events', coalesce((select jsonb_agg(jsonb_build_object('status', e.status, 'at', e.at, 'note', e.note) order by e.at) from public.order_events e where e.order_id = o.id), '[]'::jsonb),
    'shipping', jsonb_build_object('method', o.shipping_method_id, 'carrier', o.carrier, 'tracking', o.tracking),
    'lines', coalesce((select jsonb_agg(jsonb_build_object('productId', l.product_id, 'quantity', l.quantity, 'lot', l.lot) order by l.id) from public.order_lines l where l.order_id = o.id), '[]'::jsonb),
    'city', o.address ->> 'city', 'region', o.address ->> 'region') into result
  from public.orders o join public.buyers b on b.id = o.buyer_id
  where o.number = upper($1) and lower(btrim(b.email)) = lower(btrim($2));
  return result;
end;
$$;
revoke all on function public.track_order(text, text) from public, anon, authenticated, service_role;
grant execute on function public.track_order(text, text) to anon, authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('application-files', 'application-files', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists application_files_team_read on storage.objects;
create policy application_files_team_read on storage.objects for select to authenticated
  using (bucket_id = 'application-files' and public.platform_role() in ('owner', 'staff'));

create table if not exists public.application_uploads (
  id uuid primary key, path text not null unique, name text not null check (length(name) between 1 and 200),
  size integer not null check (size between 0 and 10485760),
  type text not null check (type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  claim_hash text not null, created_at timestamptz not null default now(),
  application_id uuid references public.applications(id), claimed_at timestamptz
);
alter table public.application_uploads enable row level security;
revoke all on public.application_uploads from public, anon, authenticated, service_role;
grant select on public.application_uploads to authenticated, service_role;
drop policy if exists application_uploads_team_read on public.application_uploads;
create policy application_uploads_team_read on public.application_uploads for select to authenticated
  using (public.platform_role() in ('owner', 'staff'));
drop policy if exists application_uploads_service_read on public.application_uploads;
create policy application_uploads_service_read on public.application_uploads for select to service_role using (true);

create table if not exists public.upload_usage(subject_hash text not null, at timestamptz not null default now());
create index if not exists upload_usage_hour on public.upload_usage(subject_hash, at);
alter table public.upload_usage enable row level security;
revoke all on public.upload_usage from public, anon, authenticated, service_role;

create or replace function public.system_take_upload_quota(subject_hash text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended($1, 28));
  delete from public.upload_usage u where u.subject_hash = $1 and u.at <= now() - interval '1 hour';
  if (select count(*) from public.upload_usage u where u.subject_hash = $1 and at > now() - interval '1 hour') >= 10 then return false; end if;
  insert into public.upload_usage(subject_hash) values ($1);
  return true;
end;
$$;
revoke all on function public.system_take_upload_quota(text) from public, anon, authenticated, service_role;
grant execute on function public.system_take_upload_quota(text) to service_role;

-- Server writes are RPC-only, including upload metadata and sweep cleanup.
create or replace function public.system_create_application_uploads(files jsonb, claim_hash text) returns void
language sql security definer set search_path = public as $$
  insert into public.application_uploads(id, path, name, size, type, claim_hash)
  select (f ->> 'id')::uuid, f ->> 'path', f ->> 'name', (f ->> 'size')::integer, f ->> 'type', $2
  from jsonb_array_elements($1) f;
$$;
revoke all on function public.system_create_application_uploads(jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.system_create_application_uploads(jsonb, text) to service_role;

create or replace function public.system_delete_application_upload(upload_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.application_uploads where id = $1 and claimed_at is null and created_at < now() - interval '24 hours';
$$;
revoke all on function public.system_delete_application_upload(uuid) from public, anon, authenticated, service_role;
grant execute on function public.system_delete_application_upload(uuid) to service_role;

create or replace function public.claim_application_uploads(claim text, email text, upload_ids uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare application uuid; linked integer; names jsonb;
begin
  select a.id into application from public.applications a
  where lower(btrim(a.email)) = lower(btrim($2)) and a.submitted_at > now() - interval '1 hour'
  order by a.submitted_at desc limit 1 for update;
  if application is null then return 0; end if;
  with saved as (
    update public.application_uploads u set application_id = application, claimed_at = now()
    where u.id = any($3) and u.claim_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex') and u.claimed_at is null
    returning u.name
  ) select count(*)::integer, jsonb_agg(name) into linked, names from saved;
  if linked > 0 then update public.applications set documents = documents || names where id = application; end if;
  return linked;
end;
$$;
revoke all on function public.claim_application_uploads(text, text, uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.claim_application_uploads(text, text, uuid[]) to anon, authenticated;

do $$ begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('tm-uploads-sweep', '0 * * * *', $c$select public.system_poke('/uploads/sweep');$c$);
    -- Rate-limit records only matter for an hour; keys never seen again are trimmed daily.
    perform cron.schedule('tm-rate-limit-trim', '17 4 * * *',
      $c$delete from public.track_lookups where at < now() - interval '1 day'; delete from public.upload_usage where at < now() - interval '1 day';$c$);
  end if;
end $$;
commit;
