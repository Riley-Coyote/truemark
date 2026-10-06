-- Round 12 foundation (Claude). Re-runnable on Supabase (PostgreSQL 15+).
-- Every outside service (payments, email, text messages, shipping) is reached
-- through a "connection" that is off, simulated or live. The server functions
-- that talk to providers record their health here, write order steps as the
-- system, and are woken by the database through pg_net. Run before 0005xx files.
begin;

-- Background helpers, where the platform has them. PGlite (the local proof
-- harness) has neither; it stubs what it needs.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
  end if;
end $$;

-- 1. Connections. `provider` names the real service used in live mode; the
-- simulator ignores it. Only the owner changes a mode; functions record health.
create table if not exists public.connections (
  id text primary key check (id in ('payments', 'email', 'sms', 'shipping')),
  mode text not null default 'simulated' check (mode in ('off', 'simulated', 'live')),
  provider text not null default '' check (provider ~ '^[a-z0-9-]{0,40}$'),
  last_ok_at timestamptz,
  last_error_at timestamptz,
  last_error text check (last_error is null or length(last_error) <= 500),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  check (mode <> 'live' or provider <> '')
);
insert into public.connections(id, mode, provider) values
  ('payments', 'simulated', ''), ('email', 'simulated', ''), ('sms', 'simulated', ''), ('shipping', 'simulated', '')
on conflict (id) do nothing;

alter table public.connections enable row level security;
revoke all on table public.connections from public, anon, authenticated, service_role;
grant select on table public.connections to authenticated, service_role;
drop policy if exists connections_team_read on public.connections;
create policy connections_team_read on public.connections for select to authenticated
  using ((select public.platform_role()) in ('owner', 'staff'));
drop policy if exists connections_service_read on public.connections;
create policy connections_service_read on public.connections for select to service_role using (true);

create or replace function public.set_connection_mode(connection text, mode text, provider text default null)
returns public.connections language plpgsql security definer set search_path = public
as $$
declare
  saved public.connections;
  chosen text;
begin
  if public.platform_role() is distinct from 'owner' then
    raise exception 'owner access required' using errcode = '42501';
  end if;
  if $2 is null or $2 not in ('off', 'simulated', 'live') then
    raise exception 'invalid connection mode' using errcode = '22023';
  end if;
  if $3 is not null and $3 !~ '^[a-z0-9-]{0,40}$' then
    raise exception 'invalid provider name' using errcode = '22023';
  end if;
  select coalesce($3, c.provider) into chosen from public.connections c where c.id = $1 for update;
  if not found then raise exception 'unknown connection' using errcode = 'P0002'; end if;
  if $2 = 'live' and chosen = '' then
    raise exception 'Choose the provider before going live.' using errcode = '22023';
  end if;
  update public.connections c set mode = $2, provider = chosen, updated_at = now(), updated_by = auth.uid()
    where c.id = $1 returning * into saved;
  return saved;
end;
$$;
revoke all on function public.set_connection_mode(text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.set_connection_mode(text, text, text) to authenticated;

-- 2. Owner alerts written by the system (a failing provider, an automatic refund).
create or replace function public.system_alert(title text, body text, href text default null)
returns void language sql security definer set search_path = public
as $$
  insert into public.notifications(audience, kind, title, body, href)
    values ('owner', 'system.alert', left(btrim($1), 200), left(btrim($2), 1000), $3);
$$;
revoke all on function public.system_alert(text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.system_alert(text, text, text) to service_role;

-- A function reports each call's outcome. The first failure after a success (or
-- the first ever) raises one owner alert; repeats while it stays broken do not.
create or replace function public.system_connection_status(connection text, ok boolean, error text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  existing public.connections;
  label text;
begin
  select * into existing from public.connections c where c.id = $1 for update;
  if not found then return; end if;
  if $2 then
    update public.connections c set last_ok_at = now() where c.id = $1;
    return;
  end if;
  update public.connections c set last_error_at = now(), last_error = left(coalesce(nullif(btrim($3), ''), 'Unknown error'), 500)
    where c.id = $1;
  if existing.last_error_at is null or (existing.last_ok_at is not null and existing.last_ok_at > existing.last_error_at) then
    label := case $1 when 'payments' then 'Payments' when 'email' then 'Email' when 'sms' then 'Text messages' else 'Shipping' end;
    perform public.system_alert(label || ' need attention',
      left(coalesce(nullif(btrim($3), ''), 'Unknown error'), 500), '/admin/settings?section=connections');
  end if;
end;
$$;
revoke all on function public.system_connection_status(text, boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.system_connection_status(text, boolean, text) to service_role;

-- 3. Every alert kind this round writes, in one place, so packages never race on it.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'order.placed', 'order.paid', 'order.packed', 'order.shipped', 'order.delivered', 'order.cancelled', 'order.refunded',
  'referral.created', 'commission.approved', 'payout.sent', 'partner.welcome',
  'payment.failed', 'application.submitted', 'application.approved', 'application.declined',
  'partner_application.submitted', 'partner.milestone', 'contact.received', 'system.alert'
));

-- 4. Order steps the system takes (a payment landing, a carrier scan) have no
-- person behind them. `source` says who acted; legacy rows leave it empty.
alter table public.order_events alter column actor_id drop not null;
alter table public.order_events add column if not exists source text;
alter table public.order_events drop constraint if exists order_events_source_check;
alter table public.order_events add constraint order_events_source_check
  check (source is null or source in ('team', 'buyer', 'payments', 'shipping', 'system'));
alter table public.order_events drop constraint if exists order_events_actor_or_system;
alter table public.order_events add constraint order_events_actor_or_system
  check (actor_id is not null or source in ('payments', 'shipping', 'system'));

-- 5. Checkout labels the shipping prices as samples until the owner saves them.
alter table public.settings add column if not exists shipping_rates_confirmed boolean not null default false;

-- 6. Server functions read with the service role, whose table privileges 000000
-- revoked. They identify callers by profile role and render from existing rows,
-- read-only; every write still goes through a system_* function.
grant select on table public.profiles, public.settings, public.orders, public.order_lines,
  public.order_events, public.buyers, public.partners, public.referrals, public.payouts,
  public.applications, public.shipping_methods, public.products, public.lots, public.discounts
  to service_role;

-- 7. The database wakes a server function. The base URL and the shared key live
-- in Vault (`tm_functions_url`, `tm_functions_key`), set once per project by
-- SQL; without them this quietly does nothing and the scheduled sweeps catch up.
create or replace function public.system_poke(path text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  base text;
  key text;
begin
  if $1 is null or $1 !~ '^/[a-z0-9/_-]{1,80}$' then return; end if;
  if to_regclass('vault.decrypted_secrets') is null or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    return;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into base using 'tm_functions_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into key using 'tm_functions_key';
  if base is null or key is null then return; end if;
  execute 'select net.http_post(url := $1, body := $2, params := $3, headers := $4, timeout_milliseconds := $5)'
    using rtrim(base, '/') || $1, '{}'::jsonb, '{}'::jsonb,
      jsonb_build_object('Content-Type', 'application/json', 'x-functions-key', key), 5000;
end;
$$;
revoke all on function public.system_poke(text) from public, anon, authenticated, service_role;
grant execute on function public.system_poke(text) to service_role;

commit;
