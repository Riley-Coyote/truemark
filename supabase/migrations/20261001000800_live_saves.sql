-- WP-21: the remaining team edits persist through checked, audited RPCs.
-- Apply after 000700. Re-runnable; existing rows and RLS policies stay intact.
begin;

alter table public.partners add column if not exists updated_at timestamptz;
alter table public.partners add column if not exists updated_by uuid references public.profiles(id);
alter table public.lots add column if not exists updated_at timestamptz;
alter table public.lots add column if not exists updated_by uuid references public.profiles(id);
alter table public.discounts add column if not exists created_at timestamptz;
alter table public.discounts add column if not exists created_by uuid references public.profiles(id);
alter table public.discounts add column if not exists updated_at timestamptz;
alter table public.discounts add column if not exists updated_by uuid references public.profiles(id);
-- A creation request distinguishes a lost-response retry from a duplicate code.
alter table public.discounts add column if not exists create_request_id uuid;
alter table public.discounts add column if not exists create_input jsonb;
create unique index if not exists discounts_create_request_id on public.discounts(create_request_id);

create or replace function public.set_partner_status(partner_id uuid, status text)
returns public.partners language plpgsql security definer set search_path = public
as $$
declare person public.partners; discount public.discounts;
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'Team access required.' using errcode = '42501';
  end if;
  if status is null or status not in ('active', 'paused') then
    raise exception 'Choose active or paused.' using errcode = '22023';
  end if;
  select * into person from public.partners p where p.id = $1 for update;
  if not found then raise exception 'Partner not found.' using errcode = '22023'; end if;
  if person.status not in ('active', 'paused') then
    raise exception 'Approve new partners through Applications.' using errcode = '22023';
  end if;
  select * into discount from public.discounts d where d.partner_id = person.id and d.code = person.code for update;
  if not found then raise exception 'Partner discount not found.' using errcode = '22023'; end if;
  if person.status <> $2 then
    update public.partners p set status = $2, updated_at = now(), updated_by = auth.uid()
      where p.id = person.id returning * into person;
  end if;
  if discount.active is distinct from ($2 = 'active') then
    update public.discounts d set active = ($2 = 'active'), updated_at = now(), updated_by = auth.uid()
      where d.code = discount.code;
  end if;
  return person;
end $$;

create or replace function public.create_promo_code(code text, percent numeric, expires_at timestamptz, active boolean, request_id uuid)
returns public.discounts language plpgsql security definer set search_path = public
as $$
declare
  normalized text := upper(btrim(code));
  input jsonb;
  saved public.discounts;
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'Team access required.' using errcode = '42501';
  end if;
  if normalized is null or normalized !~ '^[A-Z0-9_-]{1,64}$' then
    raise exception 'Use 1 to 64 letters, numbers, underscores or hyphens for the code.' using errcode = '22023';
  end if;
  if percent is null or not (percent between 0 and 100) or percent <> round(percent, 2) then
    raise exception 'Enter a percent from 0 to 100 with up to two decimals.' using errcode = '22023';
  end if;
  if active is null or request_id is null or (expires_at is not null and not isfinite(expires_at)) then
    raise exception 'A valid expiry, active state and creation request are required.' using errcode = '22023';
  end if;
  -- Epoch makes the comparison independent of the caller's timestamp format/time zone.
  input := jsonb_build_object('code', normalized, 'percent', percent, 'expiresAt', extract(epoch from expires_at), 'active', active);
  perform pg_advisory_xact_lock(hashtextextended('promo:' || request_id::text, 0));
  select * into saved from public.discounts d where d.create_request_id = request_id;
  if found then
    if saved.created_by = auth.uid() and saved.create_input = input then return saved; end if;
    raise exception 'This creation request was already used. Start a new code.' using errcode = '22023';
  end if;
  if exists (select 1 from public.discounts d where d.code = normalized)
    or exists (select 1 from public.partners p where p.code = normalized) then
    raise exception 'That code is already in use. Choose another code.' using errcode = '23505';
  end if;
  insert into public.discounts(code, kind, percent, expires_at, active, created_at, created_by, updated_at, updated_by, create_request_id, create_input)
    values (normalized, 'promo', percent, expires_at, active, now(), auth.uid(), now(), auth.uid(), request_id, input)
    returning * into saved;
  return saved;
exception when unique_violation then
  raise exception 'That code is already in use. Choose another code.' using errcode = '23505';
end $$;

create or replace function public.set_promo_active(code text, active boolean)
returns public.discounts language plpgsql security definer set search_path = public
as $$
declare saved public.discounts;
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'Team access required.' using errcode = '42501';
  end if;
  if active is null then raise exception 'Choose an active state.' using errcode = '22023'; end if;
  select * into saved from public.discounts d where d.code = upper(btrim($1)) for update;
  if not found then raise exception 'Promo code not found.' using errcode = '22023'; end if;
  if saved.kind <> 'promo' then
    raise exception 'Partner codes are managed with their partner.' using errcode = '22023';
  end if;
  if saved.active is distinct from $2 then
    update public.discounts d set active = $2, updated_at = now(), updated_by = auth.uid()
      where d.code = saved.code returning * into saved;
  end if;
  return saved;
end $$;

create or replace function public.set_lot_status(lot text, status text)
returns public.lots language plpgsql security definer set search_path = public
as $$
declare saved public.lots;
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'Team access required.' using errcode = '42501';
  end if;
  select * into saved from public.lots l where l.lot = $1 for update;
  if not found then raise exception 'Lot not found.' using errcode = '22023'; end if;
  -- The platform calls the pre-testing state quarantine, not draft.
  if status is null or status not in ('testing', 'archived') then
    raise exception 'Only moving quarantine lots to testing or archiving released/rejected lots is allowed.' using errcode = '22023';
  end if;
  if saved.status = $2 then return saved; end if;
  if not ((saved.status = 'quarantine' and $2 = 'testing') or (saved.status in ('released', 'rejected') and $2 = 'archived')) then
    raise exception 'Only moving quarantine lots to testing or archiving released/rejected lots is allowed.' using errcode = '22023';
  end if;
  update public.lots l set status = $2, updated_at = now(), updated_by = auth.uid()
    where l.lot = saved.lot returning * into saved;
  return saved;
end $$;

revoke all on function public.set_partner_status(uuid, text), public.create_promo_code(text, numeric, timestamptz, boolean, uuid),
  public.set_promo_active(text, boolean), public.set_lot_status(text, text) from public, anon, authenticated, service_role;
grant execute on function public.set_partner_status(uuid, text), public.create_promo_code(text, numeric, timestamptz, boolean, uuid),
  public.set_promo_active(text, boolean), public.set_lot_status(text, text) to authenticated;

commit;
