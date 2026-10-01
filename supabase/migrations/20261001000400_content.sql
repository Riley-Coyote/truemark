-- WP-16. Independent of WP-14's settings migration; safe to re-run.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificates', 'certificates', true, 10485760, array['application/pdf']),
       ('journal', 'journal', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Public downloads use public buckets. Team SELECT also permits Storage upserts.
-- Do not change Storage's schema, grants, or policies for any other bucket.
drop policy if exists platform_content_read on storage.objects;
create policy platform_content_read on storage.objects for select to anon, authenticated
  using (bucket_id in ('certificates', 'journal'));
drop policy if exists platform_content_insert on storage.objects;
create policy platform_content_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('certificates', 'journal') and (select public.platform_role()) in ('owner', 'staff'));
drop policy if exists platform_content_update on storage.objects;
create policy platform_content_update on storage.objects for update to authenticated
  using (bucket_id in ('certificates', 'journal') and (select public.platform_role()) in ('owner', 'staff'))
  with check (bucket_id in ('certificates', 'journal') and (select public.platform_role()) in ('owner', 'staff'));
drop policy if exists platform_content_delete on storage.objects;
create policy platform_content_delete on storage.objects for delete to authenticated
  using (bucket_id in ('certificates', 'journal') and (select public.platform_role()) in ('owner', 'staff'));

alter table public.lots add column if not exists coa_path text;
alter table public.lots add column if not exists rejection_note text;
-- Phase A already has tested_at as timestamptz. Preserve its UTC calendar date.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'lots' and column_name = 'tested_at' and data_type = 'timestamp with time zone') then
    alter table public.lots alter column tested_at type date using (tested_at at time zone 'UTC')::date;
  end if;
end $$;
alter table public.lots add column if not exists tested_at date;

create or replace function public.release_lot(lot text, results jsonb, reference text, tested_at date, coa_path text)
returns public.lots language plpgsql security definer set search_path = public
as $$
declare v_lot public.lots; item jsonb; has_purity boolean := false; has_identity boolean := false;
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
    if lower(btrim(item->>'label')) = 'purity' and lower(btrim(item->>'method')) = 'hplc' then
      -- LotResult values are strings. Check before casting; NaN/Infinity are not measurements.
      if btrim(item->>'value') !~ '^[0-9]+([.][0-9]+)?$' then
        raise exception 'HPLC purity must be a number at least 99.0' using errcode = '22023';
      end if;
      if (item->>'value')::numeric < 99.0 then
        raise exception 'HPLC purity must be at least 99.0' using errcode = '22023';
      end if;
      has_purity := true;
    end if;
    if lower(btrim(item->>'label')) = 'identity' and lower(btrim(item->>'method')) in ('ms', 'mass spectrometry') then
      if item->>'value' <> 'Confirmed' then
        raise exception 'MS identity must be Confirmed' using errcode = '22023';
      end if;
      has_identity := true;
    end if;
  end loop;
  if not has_purity or not has_identity then
    raise exception 'Release needs HPLC purity at least 99.0 and confirmed MS identity' using errcode = '22023';
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

create or replace function public.reject_lot(lot text, note text)
returns public.lots language plpgsql security definer set search_path = public
as $$
declare v_lot public.lots;
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'Team access required' using errcode = '42501';
  end if;
  select * into v_lot from public.lots l where l.lot = $1 for update;
  if not found or v_lot.status not in ('quarantine', 'testing') then
    raise exception 'Only quarantine or testing lots can be rejected' using errcode = '22023';
  end if;
  if nullif(btrim($2), '') is null then
    raise exception 'A rejection note is required' using errcode = '22023';
  end if;
  update public.lots l set status = 'rejected', rejection_note = btrim($2)
    where l.lot = v_lot.lot returning * into v_lot;
  return v_lot;
end $$;

create or replace function public.set_lot_certificate(lot text, coa_path text)
returns public.lots language plpgsql security definer set search_path = public
as $$
declare v_lot public.lots;
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'Team access required' using errcode = '42501';
  end if;
  select * into v_lot from public.lots l where l.lot = $1 for update;
  if not found or v_lot.status <> 'released' or $2 is distinct from v_lot.lot || '.pdf'
    or $2 !~ '^[A-Za-z0-9_-]+[.]pdf$' then
    raise exception 'A released lot and its certificate PDF are required' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'certificates' and o.name = $2) then
    raise exception 'Upload the certificate first' using errcode = '22023';
  end if;
  update public.lots l set coa_path = $2 where l.lot = v_lot.lot returning * into v_lot;
  return v_lot;
end $$;

-- The public project URL is not a credential. This avoids depending on WP-14
-- settings or trusting a request Host header to construct certificate links.
create or replace function public.lot_lookup(lot text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'lot', l.lot, 'productId', l.product_id, 'status', l.status,
    'releasedAt', l.released_at,
    'testedAt', case when l.status = 'released' then l.tested_at else null end,
    'reference', case when l.status = 'released' then l.reference else null end,
    'results', case when l.status = 'released' then l.results else '[]'::jsonb end,
    'coaUrl', case when l.status = 'released' and l.coa_path is not null then
      'https://gydihnfzmuqmbnykaihg.supabase.co/storage/v1/object/public/certificates/' || l.coa_path else null end
  ) from public.lots l
  where upper(regexp_replace(l.lot, '[[:space:]]+', '', 'g')) = upper(regexp_replace($1, '[[:space:]]+', '', 'g'))
    and l.status in ('quarantine', 'testing', 'released');
$$;

-- Seed only on initial creation: reruns must not resurrect deleted client posts.
select set_config('platform.wp16_seed', (to_regclass('public.articles') is null)::text, true);
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) between 1 and 240),
  kicker text not null default '',
  excerpt text not null default '',
  body_md text not null default '',
  cover_path text,
  cover_image text,
  reading_minutes integer not null default 1 check (reading_minutes between 1 and 240),
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  author text not null default '',
  check (status <> 'published' or published_at is not null),
  check (cover_path is null or cover_image is null)
);
alter table public.articles enable row level security;
revoke all on public.articles from public, anon, authenticated, service_role;
grant select on public.articles to anon, authenticated;
drop policy if exists platform_articles_public on public.articles;
create policy platform_articles_public on public.articles for select to anon, authenticated
  using (status = 'published');
drop policy if exists platform_articles_team on public.articles;
create policy platform_articles_team on public.articles for select to authenticated
  using ((select public.platform_role()) in ('owner', 'staff'));

create or replace function public.upsert_article(article jsonb) returns public.articles
language plpgsql security definer set search_path = public
as $$
declare v_article public.articles; v_id uuid;
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'Team access required' using errcode = '42501';
  end if;
  if $1 is null or jsonb_typeof($1) <> 'object' then
    raise exception 'Article must be an object' using errcode = '22023';
  end if;
  v_id := nullif($1->>'id', '')::uuid;
  if v_id is not null then
    select * into v_article from public.articles a where a.id = v_id for update;
    if not found then raise exception 'Article not found' using errcode = '22023'; end if;
  end if;
  if coalesce($1->>'slug', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or length(btrim(coalesce($1->>'title', ''))) not between 1 and 240
    or coalesce($1->>'status', '') not in ('draft', 'published') then
    raise exception 'Title, URL slug and status are required' using errcode = '22023';
  end if;
  if $1->>'status' = 'published' and (nullif($1->>'published_at', '') is null or nullif(btrim($1->>'body_md'), '') is null) then
    raise exception 'Published articles need a body and publish date' using errcode = '22023';
  end if;
  if nullif($1->>'cover_path', '') is not null and
    not exists (select 1 from storage.objects o where o.bucket_id = 'journal' and o.name = $1->>'cover_path') then
    raise exception 'Upload the journal cover first' using errcode = '22023';
  end if;
  if nullif($1->>'cover_image', '') is not null and
    ($1->>'cover_image' !~ '^/?images/[A-Za-z0-9_./-]+[.](jpg|jpeg|png|webp)$' or position('..' in ($1->>'cover_image')) > 0) then
    raise exception 'Site covers must be image paths' using errcode = '22023';
  end if;
  insert into public.articles(id, slug, title, kicker, excerpt, body_md, cover_path, cover_image, reading_minutes, status, published_at, author)
  values (coalesce(v_id, gen_random_uuid()), $1->>'slug', btrim($1->>'title'), coalesce($1->>'kicker', ''),
    coalesce($1->>'excerpt', ''), coalesce($1->>'body_md', ''), nullif($1->>'cover_path', ''), nullif($1->>'cover_image', ''),
    coalesce(nullif($1->>'reading_minutes', '')::integer, 1), $1->>'status', nullif($1->>'published_at', '')::timestamptz,
    coalesce($1->>'author', v_article.author, ''))
  on conflict (id) do update set slug = excluded.slug, title = excluded.title, kicker = excluded.kicker,
    excerpt = excluded.excerpt, body_md = excluded.body_md, cover_path = excluded.cover_path, cover_image = excluded.cover_image,
    reading_minutes = excluded.reading_minutes, status = excluded.status, published_at = excluded.published_at,
    updated_at = now(), author = excluded.author returning * into v_article;
  return v_article;
end $$;

create or replace function public.delete_article(id uuid) returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'Team access required' using errcode = '42501';
  end if;
  delete from public.articles a where a.id = $1;
  return found;
end $$;

revoke all on function public.release_lot(text, jsonb, text, date, text), public.reject_lot(text, text), public.set_lot_certificate(text, text),
  public.upsert_article(jsonb), public.delete_article(uuid), public.lot_lookup(text) from public, anon, authenticated, service_role;
grant execute on function public.release_lot(text, jsonb, text, date, text), public.reject_lot(text, text), public.set_lot_certificate(text, text),
  public.upsert_article(jsonb), public.delete_article(uuid) to authenticated;
grant execute on function public.lot_lookup(text) to anon, authenticated;

-- BEGIN GENERATED JOURNAL SEED
-- Generated by node scripts/gen-journal-seed.mjs from src/brand/articles.ts.
-- Seed once; reruns preserve edits, drafts and deletions.
do $journal_seed$ begin
if current_setting('platform.wp16_seed') = 'true' then
insert into public.articles (slug, title, kicker, excerpt, body_md, cover_image, reading_minutes, status, published_at, author) values
  ('how-to-read-a-certificate-of-analysis', 'How to read a Certificate of Analysis', 'Quality & Testing', 'Every released lot ships with a CoA. Here is what each line means, and what to check before you log a vial into inventory.', 'A Certificate of Analysis is the laboratory record for one specific lot of material. It is not a marketing document: every value on it comes from an analytical instrument, and the certificate is only issued after the lot passes its release specification. At TrueMark, the CoA for any released lot is retrievable by its lot number, with no account required.

## The four results that matter

| | |
| --- | --- |
| Purity (HPLC) | Fraction of the sample that is the stated compound |
| Identity (MS) | Molecular mass matches the stated sequence |
| Endotoxin (LAL) | Bacterial endotoxin, reported in EU per milligram |
| Sterility | No viable microbial growth in sampled vials |

Purity and identity answer different questions. A sample can be 99% pure and still be the wrong compound; it can also be the right compound heavily diluted with impurities. A certificate needs both.

> If a value is not on the certificate, treat it as untested. A CoA documents what was measured — nothing more.

## Checking a vial against its CoA

Before logging a delivery into inventory:

- Match the printed lot number on the label to the lot number on the certificate — character for character.
- Confirm the compound name and strength match the label claim.
- Check the test date and that the status reads Approved.
- Retain the certificate with your laboratory records, alongside the lot number.

## References

1. United States Pharmacopeia. General Chapter \<85\> Bacterial Endotoxins Test.
2. United States Pharmacopeia. General Chapter \<71\> Sterility Tests.
3. ICH Q6A: Specifications — Test Procedures and Acceptance Criteria for New Drug Substances.', 'images/scenes/trio.webp', 1, 'published', '2026-08-22T00:00:00Z', 'TrueMark Quality Team'),
  ('what-hplc-purity-actually-measures', 'What HPLC purity actually measures', 'Quality & Testing', 'High-performance liquid chromatography separates a sample into its components. What the ≥99% figure on a spec sheet does and does not tell you.', 'High-performance liquid chromatography (HPLC) is one of the most common analytical techniques used to evaluate peptide preparations. A result such as ≥99% is useful, but it is often misunderstood. It describes how much of the detected chromatographic signal belongs to the main peak under the stated test conditions. It does not, by itself, prove identity, biological activity, sterility, or the absence of every possible contaminant.

## What the chromatogram shows

During an HPLC run, the sample travels through a column whose chemistry interacts differently with different components. Those components leave the column at different retention times and are recorded as peaks. For many peptides, reversed-phase HPLC is used with a water–organic solvent gradient and ultraviolet detection.

The main peak normally represents the target compound. Smaller peaks may represent truncated sequences, deletion products, oxidation products, residual starting material, or other related substances. The reported purity is commonly calculated by dividing the area of the main peak by the total integrated peak area.

![Illustration of a chromatogram, not a result for any lot.](#chromatogram)

## Why ≥99% is not the whole composition

HPLC area percentage is a relative measurement of compounds detected by that method. Counterions, water, inorganic salts, and compounds with weak response at the selected wavelength may not be represented proportionally. A vial can therefore report high chromatographic purity while its gross mass also contains water, counterion, or other non-peptide material.

The result also depends on method details: column type, mobile phase, gradient, flow rate, temperature, detection wavelength, injection amount, and integration settings. Purity values are most meaningful when the certificate identifies the method and includes the chromatogram.

## What to check on a certificate

- Confirm that the sample or lot identifier matches the vial.
- Check the HPLC method and detection wavelength.
- Review the main peak retention time and integration.
- Look for unresolved shoulders or unexpected secondary peaks.
- Compare the result with the stated release specification.

## Use HPLC with an identity test

HPLC answers a separation and relative-purity question. Mass spectrometry answers a different question: whether the observed molecular mass agrees with the expected compound. Strong release documentation uses complementary tests rather than treating one number as complete proof.', 'images/scenes/caustics.webp', 2, 'published', '2026-08-15T00:00:00Z', 'TrueMark Quality Team'),
  ('mass-spectrometry-and-peptide-identity', 'Mass spectrometry and peptide identity', 'Quality & Testing', 'Why purity alone is not enough: how MS confirms that the compound in the vial is the sequence on the label.', 'A clean HPLC chromatogram can show that one component dominates a sample, but it cannot establish what that component is. Mass spectrometry (MS) provides the complementary identity check by measuring mass-to-charge ratios and comparing the observed result with the mass expected from the peptide sequence.

## From sequence to expected mass

Every amino acid contributes a defined residue mass to a peptide. The complete sequence, terminal groups, disulfide bonds, labels, and other modifications determine the theoretical molecular mass. The analyst compares this calculated value with the mass derived from the spectrum.

Two common ionization approaches are electrospray ionization (ESI) and matrix-assisted laser desorption/ionization (MALDI). ESI often produces several charge states. The software deconvolutes that series into a neutral molecular mass. MALDI commonly produces a simpler spectrum dominated by singly charged ions.

## How to read the reported result

A certificate may list a calculated mass and a found mass, or it may include the spectrum itself. Small differences can arise from instrument resolution, calibration, isotope selection, adducts, or the way average versus monoisotopic mass is reported. The appropriate tolerance depends on the method and specification.

Look for clear labeling of the sample and lot, the ionization method, the principal ion or deconvoluted mass, and the acceptance criterion. Sodium or potassium adducts and multiple charge states should be interpreted within the method rather than mistaken automatically for separate compounds.

## What MS can reveal

A matching mass supports identity. Unexpected masses can point to deletion sequences, oxidation, deamidation, incomplete deprotection, adduct formation, or other modifications. Some different sequences can share the same nominal mass, however, so a mass match is not always complete sequence proof.

## Why orthogonal testing matters

MS is highly informative for identity but does not replace chromatographic purity testing. A sample can have the expected molecular mass and still contain significant related impurities. Conversely, a dominant HPLC peak can belong to the wrong compound. Reviewing HPLC and MS together provides a stronger assessment than either result alone.', 'images/scenes/powder-blue.webp', 2, 'published', '2026-08-08T00:00:00Z', 'TrueMark Quality Team'),
  ('storing-lyophilized-peptides-correctly', 'Storing lyophilized peptides correctly', 'Handling & Storage', 'Temperature, light, moisture, and cycling — the four variables that preserve or degrade a lyophilized cake in storage.', 'Lyophilization removes water under controlled conditions to improve the storage stability of many research peptides. The dry cake is generally more stable than a solution, but it is not immune to degradation. Temperature, light, moisture, and repeated environmental cycling all affect how well a stored material retains its original characteristics.

## Follow the product-specific documentation

There is no single storage temperature suitable for every peptide. Sequence, formulation, counterion, residual moisture, container closure, and planned storage duration all matter. Use the storage condition stated on the product label, certificate, or handling documentation. Where instructions differ, clarify the requirement before placing the lot into inventory.

## Control moisture

A lyophilized cake can absorb water from humid air. Moisture may increase molecular mobility and accelerate chemical changes. Keep the vial sealed until it has reached an appropriate working temperature, because opening a cold container can encourage condensation. Minimize the time the closure is exposed and avoid unnecessary repeated access.

## Limit temperature cycling

Moving a vial repeatedly between cold storage and room conditions can create condensation risk and impose physical stress. Organize inventory so the primary stock remains under its specified conditions. When the workflow permits, use planned aliquots or dedicated working material to reduce repeated handling of the original container.

## Protect from light

Some residues and modifications are sensitive to light. Store vials in the supplied secondary packaging or another suitable light-protective container when the documentation calls for it. Do not assume that ordinary room lighting is harmless for every compound.

## Maintain traceable storage records

- Record receipt date, lot number, and storage location.
- Log transfers between storage units.
- Monitor and retain temperature records where required.
- Document excursions and assess them against approved procedures.
- Use clear labels to prevent repeated searching and door-open time.

Before use, inspect the vial for a damaged closure, unexpected discoloration, collapse, or other visible change. Appearance alone cannot establish quality, but an unusual observation should be documented and reviewed before the material enters a study.', 'images/scenes/frost.webp', 2, 'published', '2026-08-01T00:00:00Z', 'TrueMark Quality Team'),
  ('from-source-batch-to-shipped-vial', 'From source batch to shipped vial', 'Traceability', 'A walkthrough of lot-level traceability: what a lot number encodes, and how one number links receipt, testing, release, and distribution records.', 'Traceability is the documented connection between a shipped vial and the records used to receive, test, release, package, and distribute its source material. The visible link is usually the lot or batch number. The strength of the system depends not on the number alone, but on the records and controls connected to it.

## Receiving the source batch

When material is received, the organization records the supplier identifier, internal lot identifier, quantity, condition, date, and storage requirement. Packaging and documentation are checked for consistency. Any discrepancy or damage should enter a controlled review rather than being resolved informally.

## Sampling and testing

Samples used for analytical testing must remain linked to the correct batch. The chain of custody identifies who collected or transferred the sample, when it moved, and which method or laboratory generated each result. HPLC, mass spectrometry, endotoxin, and other applicable reports should all reference the same lot or a clearly documented derivative.

## Review and release

Release is a documented decision that the available results and records meet the defined specification. A certificate of analysis summarizes selected outcomes, but it should be backed by controlled source records. The approval date and authorized reviewer help distinguish released material from material that is still quarantined or under investigation.

## Filling, labeling, and reconciliation

When a source batch is divided into individual vials, the packaging record connects the bulk quantity with the vial count and label information. Reconciliation accounts for units filled, sampled, rejected, damaged, retained, and released. This step helps prevent label mix-ups and unexplained inventory differences.

## Distribution history

Shipment records connect released units with order and destination information. If a question later arises, the lot number can be used to identify the test package, release record, packaging run, remaining inventory, and affected shipments.

## What researchers should verify on receipt

- Match the vial lot number to the certificate.
- Confirm that the product name and quantity agree with the order.
- Inspect the packaging and closure condition.
- Record receipt and storage promptly.
- Retain the certificate with the study or inventory record.

Good traceability turns a printed code into a navigable history. It supports investigation, inventory control, and reproducible laboratory documentation.', 'images/scenes/collection.webp', 2, 'published', '2026-07-25T00:00:00Z', 'TrueMark Quality Team'),
  ('endotoxin-testing-with-the-lal-assay', 'Endotoxin testing with the LAL assay', 'Quality & Testing', 'What EU/mg means, where endotoxin comes from, and why release specifications set an upper bound for research materials.', 'Bacterial endotoxins are lipopolysaccharide components associated with the outer membrane of Gram-negative bacteria. They can remain after viable organisms are no longer present, which is why endotoxin testing answers a different question from a sterility or bioburden test.

## What the LAL assay detects

The Limulus amebocyte lysate (LAL) assay uses a biological reagent that responds to endotoxin. Common formats include gel-clot, chromogenic, and turbidimetric methods. Each format has its own detection and calculation approach, but the reported result is usually expressed in endotoxin units (EU) relative to a reference standard.

## Understanding EU/mg

A result in EU/mg normalizes the measured endotoxin amount to the mass of material tested. This allows a result to be compared with a release limit stated on the same basis. Some reports may use EU/mL or EU/vial instead; the unit, sample preparation, dilution, and calculation must be reviewed together.

## Why sample interference matters

The test article can enhance or inhibit the assay response. Method suitability work is used to establish a dilution or preparation at which the assay can recover a known endotoxin challenge acceptably. A numerical result without evidence that interference was controlled may be difficult to interpret.

## Where endotoxin can enter a process

Potential sources include water, raw materials, equipment, containers, handling, and the processing environment. Because endotoxin can be persistent, a process can require both preventive controls and an appropriate final test rather than relying on one measure alone.

## Reading an endotoxin result

- Verify the sample and lot identification.
- Confirm the reporting unit and specification limit.
- Check the assay format and sensitivity.
- Review dilution, recovery, and validity controls.
- Distinguish a quantified result from a result reported below a detection or quantitation limit.

An upper release specification defines the maximum acceptable result for the material and intended research context. The LAL result should be interpreted with the method record and other quality data; it is not a substitute for identity, purity, or sterility testing.', 'images/scenes/lab.webp', 2, 'published', '2026-07-18T00:00:00Z', 'TrueMark Quality Team'),
  ('peptide-chemistry-a-primer-for-the-lab', 'Peptide chemistry: a primer for the lab', 'Chemistry', 'Amino acids, peptide bonds, sequences, and molecular weight — the vocabulary printed on every spec sheet, explained.', 'Peptides are chains of amino-acid residues joined by peptide bonds. A specification sheet compresses a large amount of chemistry into a sequence, molecular formula, molecular mass, purity result, and notes about terminal groups or other modifications. Understanding those fields makes analytical documentation easier to evaluate.

## Amino acids and sequence direction

Most peptide sequences are written from the amino terminus (N-terminus) on the left to the carboxyl terminus (C-terminus) on the right. One-letter or three-letter abbreviations identify each residue. Sequence order matters: two peptides containing the same amino acids in a different order are different compounds even if their overall elemental composition or nominal mass is similar.

## How peptide bonds form

A peptide bond links the carboxyl group of one amino acid with the amino group of the next. The formal condensation relationship removes the elements of water as residues become part of the chain. That is why calculating a peptide’s mass is not simply a matter of adding the masses of free amino acids.

## Terminal groups and modifications

The ends of a peptide may be unmodified or may carry groups such as N-terminal acetylation or C-terminal amidation. Other possibilities include labels, linkers, phosphorylation, lipidation, cyclization, or disulfide bonds. These features change the molecular formula, mass, charge behavior, and sometimes chromatographic retention. They should be included in the identity documentation.

## Molecular mass and counterions

A specification may report average molecular weight or monoisotopic mass. These values are calculated differently and should not be compared without checking the convention. Peptides are also commonly supplied as salts containing counterions. The theoretical mass of the peptide molecule is therefore not necessarily the same as the total mass composition of the lyophilized material.

## Purity, content, and identity are different

- **Identity** asks whether the material matches the expected compound.
- **Chromatographic purity** describes the relative main-peak area under a defined method.
- **Peptide content** addresses how much of the sample mass is peptide rather than water, counterion, or other components.

No single field replaces the others. A useful certificate connects the exact lot with complementary analytical results and clearly stated specifications.

## A practical review

Start with the sequence and terminal modifications, calculate or confirm the expected mass, compare it with the identity result, then review chromatographic purity and any content-related information. Finally, confirm that every page and attachment refers to the same lot.', 'images/scenes/powder.webp', 2, 'published', '2026-07-11T00:00:00Z', 'TrueMark Quality Team')
on conflict (slug) do nothing;
end if;
end $journal_seed$;
-- END GENERATED JOURNAL SEED

commit;
