-- WP-28 (Riley, 2026-10-06): CJC (No DAC) / Ipamorelin is sold at the size its certificate tested,
-- 5 mg / 5 mg, lot TM-CJI5-2609-01 (KMD Analytical TB-20260924-QC6H-01), as the client's brand kit
-- lists it. The first listing's lot, TM-CJI10-2609-01, stays on file untouched. Safe to re-run: the
-- product moves only while it still points at the first listing's lot.
begin;

insert into public.lots (lot, product_id, status, results)
values ('TM-CJI5-2609-01', 'cjc-ipa-1010-mg', 'testing', '[]')
on conflict (lot) do nothing;

update public.products set size = '5 mg / 5 mg', lot = 'TM-CJI5-2609-01'
where id = 'cjc-ipa-1010-mg' and lot = 'TM-CJI10-2609-01';

commit;
