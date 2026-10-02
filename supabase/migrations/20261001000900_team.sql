-- WP-22: real team membership and email-bound, one-use invitations.
-- PostgreSQL 15. Apply after 000800; safe to re-run without changing existing data.
begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.profiles add column if not exists role_updated_at timestamptz;
alter table public.profiles add column if not exists role_updated_by uuid references public.profiles(id);
create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 254),
  role text not null check (role in ('owner', 'staff')),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  used_by uuid references public.profiles(id),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id),
  check (expires_at > created_at),
  check ((used_at is null) = (used_by is null)),
  check ((revoked_at is null) = (revoked_by is null)),
  check (used_at is null or revoked_at is null)
);
alter table public.team_invites enable row level security;
-- Closed table: even team readers use redacted RPCs, never token hashes.
revoke all on public.team_invites from public, anon, authenticated, service_role;

create or replace function public.team_members()
returns table(user_id uuid, email text, role text, joined_at timestamptz, last_sign_in_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'Team access required.' using errcode = '42501';
  end if;
  return query select p.id, u.email::text, p.role, u.created_at, u.last_sign_in_at
    from public.profiles p join auth.users u on u.id = p.id
    where p.role in ('owner', 'staff') order by lower(u.email), p.id;
end $$;

create or replace function public.team_invites()
returns table(id uuid, email text, role text, expires_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'Team access required.' using errcode = '42501';
  end if;
  return query select i.id, i.email, i.role, i.expires_at from public.team_invites i
    where i.used_at is null and i.revoked_at is null and i.expires_at > now()
    order by i.created_at desc, i.id;
end $$;

create or replace function public.create_team_invite(email text, role text) returns text
language plpgsql security definer set search_path = public
as $$
declare normalized text := lower(btrim(email)); token text; crypto_schema text;
begin
  -- Serialize permission checks with demotions, so a demoted owner cannot issue a grant.
  perform pg_advisory_xact_lock(hashtextextended('platform-team-roles', 0));
  if coalesce(public.platform_role(), '') <> 'owner' then
    raise exception 'Owner access required.' using errcode = '42501';
  end if;
  if normalized is null or length(normalized) > 254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Enter an email address.' using errcode = '22023';
  end if;
  if role is null or role not in ('owner', 'staff') then
    raise exception 'Choose Owner or Staff.' using errcode = '22023';
  end if;
  -- Supabase normally installs pgcrypto in extensions; respect an existing install elsewhere.
  select n.nspname into crypto_schema from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
  execute format('select encode(%I.gen_random_bytes(32), ''hex'')', crypto_schema) into token;
  insert into public.team_invites(email, role, token_hash, created_by)
    values (normalized, role, sha256(convert_to(token, 'UTF8')), auth.uid());
  return token;
end $$;

create or replace function public.revoke_team_invite(invite_id uuid) returns boolean
language plpgsql security definer set search_path = public
as $$
declare changed integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('platform-team-roles', 0));
  if coalesce(public.platform_role(), '') <> 'owner' then
    raise exception 'Owner access required.' using errcode = '42501';
  end if;
  update public.team_invites i set revoked_at = now(), revoked_by = auth.uid()
    where i.id = invite_id and i.used_at is null and i.revoked_at is null;
  get diagnostics changed = row_count;
  return changed = 1;
end $$;

-- The locked email on the public acceptance card requires a token-scoped lookup.
-- No list, ids, hashes or account-existence details are exposed.
create or replace function public.team_invite_preview(token text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('email', i.email, 'role', i.role, 'expiresAt', i.expires_at)
    from public.team_invites i where i.token_hash = sha256(convert_to(token, 'UTF8'))
      and i.used_at is null and i.revoked_at is null and i.expires_at > now();
$$;

create or replace function public.accept_team_invite(token text) returns text
language plpgsql security definer set search_path = public
as $$
declare invitation public.team_invites; account_email text; previous_role text;
begin
  perform pg_advisory_xact_lock(hashtextextended('platform-team-roles', 0));
  select u.email into account_email from auth.users u where u.id = auth.uid();
  if account_email is null then raise exception 'Sign in to accept this invitation.' using errcode = '42501'; end if;
  select * into invitation from public.team_invites i
    where i.token_hash = sha256(convert_to(token, 'UTF8')) and i.used_at is null and i.revoked_at is null
      and i.expires_at > now() for update;
  if not found then raise exception 'This invitation is no longer available. Ask the owner for a new link.' using errcode = '22023'; end if;
  if invitation.email <> lower(btrim(account_email)) then
    raise exception 'Sign in with the email this invitation was sent to.' using errcode = '42501';
  end if;
  select p.role into previous_role from public.profiles p where p.id = auth.uid() for update;
  if previous_role is null then raise exception 'Account profile not found.' using errcode = '22023'; end if;
  if previous_role = 'owner' and invitation.role <> 'owner'
    and (select count(*) from public.profiles p where p.role = 'owner') <= 1 then
    raise exception 'Keep at least one owner on the team.' using errcode = '22023';
  end if;
  update public.profiles p set role = invitation.role, role_updated_at = now(), role_updated_by = auth.uid() where p.id = auth.uid();
  update public.team_invites i set used_at = now(), used_by = auth.uid() where i.id = invitation.id;
  return invitation.role;
end $$;

create or replace function public.set_team_role(user_id uuid, role text) returns text
language plpgsql security definer set search_path = public
as $$
declare previous_role text;
begin
  -- All team role changes take the same lock BEFORE reading the owner count.
  perform pg_advisory_xact_lock(hashtextextended('platform-team-roles', 0));
  if coalesce(public.platform_role(), '') <> 'owner' then
    raise exception 'Owner access required.' using errcode = '42501';
  end if;
  if role is null or role not in ('owner', 'staff', 'buyer') then
    raise exception 'Choose Owner, Staff or remove from the team.' using errcode = '22023';
  end if;
  select p.role into previous_role from public.profiles p where p.id = user_id for update;
  if not found then raise exception 'Account profile not found.' using errcode = '22023'; end if;
  if previous_role not in ('owner', 'staff') then
    raise exception 'Only team members can be changed here. Invite new members from Team.' using errcode = '22023';
  end if;
  if previous_role = role then return role; end if;
  if previous_role = 'owner' and role <> 'owner'
    and (select count(*) from public.profiles p where p.role = 'owner') <= 1 then
    raise exception 'Keep at least one owner on the team.' using errcode = '22023';
  end if;
  update public.profiles p set role = $2, role_updated_at = now(), role_updated_by = auth.uid() where p.id = $1;
  return role;
end $$;

create or replace function public.platform_handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  form jsonb := new.raw_user_meta_data -> 'application';
  partner_form jsonb := new.raw_user_meta_data -> 'partner_application';
  buyer public.buyers;
  invitation public.team_invites;
  invite_token text := new.raw_user_meta_data ->> 'team_invite';
begin
  insert into public.profiles(id, role) values (new.id, 'buyer');
  if new.raw_user_meta_data ? 'team_invite' then
    -- GoTrue writes its own copy of the metadata after this trigger, so the raw token stays in it
    -- (checked against a real local stack). That is safe because a token works once: a used,
    -- revoked, expired or mismatched invite grants nothing, here or in accept_team_invite.
    perform pg_advisory_xact_lock(hashtextextended('platform-team-roles', 0));
    select * into invitation from public.team_invites i
      where i.token_hash = sha256(convert_to(invite_token, 'UTF8'))
        and i.email = lower(btrim(new.email)) and i.used_at is null and i.revoked_at is null
        and i.expires_at > now() for update;
    if found then
      update public.profiles set role = invitation.role, role_updated_at = now(), role_updated_by = new.id where id = new.id;
      update public.team_invites set used_at = now(), used_by = new.id where id = invitation.id;
    end if;
    -- Invited sign-ups are profile-only, including invalid invitations.
    return new;
  end if;
  if jsonb_typeof(partner_form) = 'object' then
    insert into public.partner_applications(user_id, name, email, channel, other_channels, audience, feature, commitments)
      values (new.id, coalesce(partner_form ->> 'name', ''), coalesce(new.email, ''), coalesce(partner_form ->> 'channel', ''),
        coalesce(partner_form -> 'otherChannels', '[]'::jsonb), coalesce(partner_form ->> 'audience', ''),
        coalesce(partner_form ->> 'feature', ''), coalesce(partner_form -> 'commitments', '[]'::jsonb));
    return new;
  end if;
  if jsonb_typeof(form) is distinct from 'object' then return new; end if;
  insert into public.buyers(user_id, name, email, institution, role)
    values (new.id, coalesce(form ->> 'name', ''), coalesce(new.email, ''),
      coalesce(form ->> 'institution', ''), coalesce(form ->> 'role', '')) returning * into buyer;
  insert into public.applications(buyer_id, name, email, role, institution, institution_type,
    website, research_area, intended_use, attestations, documents)
    values (buyer.id, buyer.name, buyer.email, buyer.role, buyer.institution,
      coalesce(form ->> 'institutionType', ''), form ->> 'website',
      coalesce(form ->> 'researchArea', ''), coalesce(form ->> 'intendedUse', ''),
      coalesce(form -> 'attestations', '[]'::jsonb), coalesce(form -> 'documents', '[]'::jsonb));
  return new;
end;
$$;


revoke all on function public.platform_handle_new_user() from public, anon, authenticated, service_role;
revoke all on function public.team_members(), public.team_invites(), public.create_team_invite(text, text),
  public.revoke_team_invite(uuid), public.team_invite_preview(text), public.accept_team_invite(text), public.set_team_role(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.team_members(), public.team_invites(), public.create_team_invite(text, text),
  public.revoke_team_invite(uuid), public.accept_team_invite(text), public.set_team_role(uuid, text) to authenticated;
grant execute on function public.team_invite_preview(text) to anon, authenticated;
commit;
