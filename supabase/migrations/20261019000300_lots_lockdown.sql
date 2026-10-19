-- A released lot's public record, and nothing more. Until now the public read the lots table itself
-- (platform_public_lots: released, with results), and so every column of those rows: stock counts, hold and
-- rejection notes, the staff member who last saved the lot and internal bookkeeping. The table is now the
-- team's alone through platform_team_read, unchanged. Visitors and signed-in customers read released_lots(),
-- which returns only the fields the storefront shows. lot_lookup (the Verify page) is unchanged: it already
-- returns only public fields. Safe to re-run.
begin;

drop policy if exists platform_public_lots on public.lots;
-- Visitors never read the table. Signed-in users keep the table grant only so platform_team_read can apply;
-- with no other policy left, a customer or partner reads no rows of it.
revoke all on table public.lots from anon;

-- SECURITY DEFINER: this runs with its owner's rights, so the lots table's row security does not filter it.
-- Its WHERE clause is therefore the row filter, kept exactly as platform_public_lots had it.
create or replace function public.released_lots()
returns table (lot text, lot_number text, product_id text, status text, testing_status text,
  tested_at date, released_at timestamptz, results jsonb, reference text, coa_path text)
language sql stable security definer set search_path = public
as $$
  select l.lot, l.lot_number, l.product_id, l.status, l.testing_status,
    l.tested_at, l.released_at, l.results, l.reference, l.coa_path
  from public.lots l
  where l.status = 'released' and jsonb_array_length(l.results) > 0
  order by l.lot;
$$;
revoke all on function public.released_lots() from public, anon, authenticated, service_role;
grant execute on function public.released_lots() to anon, authenticated;

commit;
