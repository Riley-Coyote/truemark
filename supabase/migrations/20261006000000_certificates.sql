-- WP-28. The release gate follows the client's certificates (KMD Analytical): HPLC purity of at
-- least 95.0 for every component, and identity that conforms (retention time and UV against a
-- reference standard). An MS identity "Confirmed" still counts, for older records. Content per vial
-- is recorded and shown, never gated. Signature, inputs, the PDF rule and the error style are
-- unchanged from 20261001000400_content.sql. Safe to re-run.
begin;

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
  select * into v_lot from public.lots l where l.lot = $1 for update;
  if not found or v_lot.status not in ('quarantine', 'testing') then
    raise exception 'Only quarantine or testing lots can be released' using errcode = '22023';
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
  if $4 is null or nullif(btrim($3), '') is null or $5 is distinct from v_lot.lot || '.pdf'
    or $5 !~ '^[A-Za-z0-9_-]+[.]pdf$' then
    raise exception 'Test date, reference and the lot certificate PDF are required' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'certificates' and o.name = $5) then
    raise exception 'Upload the certificate before releasing the lot' using errcode = '22023';
  end if;
  update public.lots l set status = 'released', results = $2, reference = btrim($3),
    tested_at = $4, coa_path = $5, released_at = now() where l.lot = v_lot.lot returning * into v_lot;
  return v_lot;
end $$;

revoke all on function public.release_lot(text, jsonb, text, date, text) from public, anon, authenticated, service_role;
grant execute on function public.release_lot(text, jsonb, text, date, text) to authenticated;

commit;
