-- WP-19. Accounts and partner application review, PostgreSQL 15.
-- Re-runnable; applied migrations and existing accounts are left intact.
begin;

create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id),
  name text not null,
  email text not null,
  channel text not null,
  other_channels jsonb not null default '[]' check (jsonb_typeof(other_channels) = 'array'),
  audience text not null,
  feature text not null,
  commitments jsonb not null default '[]' check (jsonb_typeof(commitments) = 'array'),
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'declined')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  review_note text,
  partner_id uuid unique references public.partners(id),
  approved_code text,
  approved_rate numeric(6,5) check (approved_rate between 0 and 1),
  approved_percent numeric(5,2) check (approved_percent between 0 and 100),
  check (
    (status = 'submitted' and reviewed_at is null and reviewed_by is null and partner_id is null)
    or (status = 'declined' and reviewed_at is not null and reviewed_by is not null and partner_id is null and review_note is not null and length(btrim(review_note)) > 0)
    or (status = 'approved' and reviewed_at is not null and reviewed_by is not null and partner_id is not null
      and approved_code is not null and approved_rate is not null and approved_percent is not null)
  )
);
create index if not exists partner_applications_submitted_idx on public.partner_applications(status, submitted_at desc);
alter table public.partner_applications enable row level security;
revoke all on public.partner_applications from public, anon, authenticated, service_role;
grant select on public.partner_applications to authenticated;
drop policy if exists platform_team_read on public.partner_applications;
create policy platform_team_read on public.partner_applications for select to authenticated
  using ((select public.platform_role()) in ('owner', 'staff'));
drop policy if exists platform_applicant_read on public.partner_applications;
create policy platform_applicant_read on public.partner_applications for select to authenticated
  using (user_id = (select auth.uid()));

-- The authenticated email and SQL defaults win over user-editable metadata.
-- A partner application takes precedence if both application objects are sent.
create or replace function public.platform_handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  form jsonb := new.raw_user_meta_data -> 'application';
  partner_form jsonb := new.raw_user_meta_data -> 'partner_application';
  buyer public.buyers;
begin
  insert into public.profiles(id, role) values (new.id, 'buyer');
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

-- A welcome is its own event, not a fictional sale or commission.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'order.placed', 'order.paid', 'order.packed', 'order.shipped', 'order.delivered', 'order.cancelled', 'order.refunded',
  'referral.created', 'commission.approved', 'payout.sent', 'partner.welcome'
));

create or replace function public.approve_partner_application(id uuid, code text, rate numeric, percent numeric)
returns public.partner_applications
language plpgsql security definer set search_path = public
as $$
declare
  application public.partner_applications;
  partner public.partners;
  normalized text := upper(btrim(code));
  applicant_role text;
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'Team access required.' using errcode = '42501';
  end if;
  select * into application from public.partner_applications a where a.id = approve_partner_application.id for update;
  if not found then raise exception 'Partner application not found.' using errcode = '22023'; end if;
  if application.status = 'approved' and application.approved_code = normalized
    and application.approved_rate = rate and application.approved_percent = percent then return application; end if;
  if application.status <> 'submitted' then raise exception 'This application has already been reviewed.' using errcode = '22023'; end if;
  if normalized is null or normalized !~ '^[A-Z0-9_-]{1,64}$' then
    raise exception 'Use 1 to 64 letters, numbers, underscores or hyphens for the code.' using errcode = '22023';
  end if;
  if rate is null or not (rate between 0 and 1) or rate <> round(rate, 5)
    or percent is null or not (percent between 0 and 100) or percent <> round(percent, 2) then
    raise exception 'Enter a commission from 0 to 100%% and a buyer discount from 0 to 100%%.' using errcode = '22023';
  end if;
  select p.role into applicant_role from public.profiles p where p.id = application.user_id for update;
  if applicant_role <> 'buyer' or exists (select 1 from public.buyers b where b.user_id = application.user_id)
    or exists (select 1 from public.partners p where p.user_id = application.user_id) then
    raise exception 'This account already has a different account setup. Review it before approving.' using errcode = '22023';
  end if;
  if exists (select 1 from public.discounts d where d.code = normalized)
    or exists (select 1 from public.partners p where p.code = normalized) then
    raise exception 'That code is already in use. Choose another code.' using errcode = '23505';
  end if;
  insert into public.partners(user_id, name, handle, email, code, rate, status, audience)
    values (application.user_id, application.name, application.channel, application.email, normalized, rate, 'active', application.audience)
    returning * into partner;
  insert into public.discounts(code, kind, percent, partner_id, active)
    values (normalized, 'partner', percent, partner.id, true);
  update public.profiles set role = 'partner' where profiles.id = application.user_id;
  update public.partner_applications a set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(),
    partner_id = partner.id, approved_code = normalized, approved_rate = rate, approved_percent = percent
    where a.id = application.id returning * into application;
  insert into public.notifications(audience, kind, title, body, href)
    values ('partner:' || partner.id::text, 'partner.welcome', 'Welcome to the partner program',
      'Your application is approved. Your code is ' || normalized || '. Your links and program details are in your portal.', '/partners/app');
  return application;
exception when unique_violation then
  -- The constraints also arbitrate simultaneous approvals competing for a code.
  raise exception 'That code is already in use. Choose another code.' using errcode = '23505';
end;
$$;

create or replace function public.decline_partner_application(id uuid, note text)
returns public.partner_applications
language plpgsql security definer set search_path = public
as $$
declare application public.partner_applications;
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'Team access required.' using errcode = '42501';
  end if;
  select * into application from public.partner_applications a where a.id = decline_partner_application.id for update;
  if not found then raise exception 'Partner application not found.' using errcode = '22023'; end if;
  if note is null or btrim(note) = '' then raise exception 'Enter a note before declining.' using errcode = '22023'; end if;
  if application.status = 'declined' and application.review_note = btrim(note) then return application; end if;
  if application.status <> 'submitted' then raise exception 'This application has already been reviewed.' using errcode = '22023'; end if;
  update public.partner_applications a set status = 'declined', reviewed_at = now(), reviewed_by = auth.uid(), review_note = btrim(note)
    where a.id = application.id returning * into application;
  return application;
end;
$$;

revoke all on function public.platform_handle_new_user() from public, anon, authenticated, service_role;
revoke all on function public.approve_partner_application(uuid, text, numeric, numeric) from public, anon, authenticated, service_role;
revoke all on function public.decline_partner_application(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.approve_partner_application(uuid, text, numeric, numeric) to authenticated;
grant execute on function public.decline_partner_application(uuid, text) to authenticated;
commit;
