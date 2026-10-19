import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLiveAdapter } from '../src/platform/live/adapter.ts';
import type { Row } from '../src/platform/live/rows.ts';
import type { ArticleInput } from '../src/platform/types.ts';

function fixture() {
  const tables: Record<string, Row[]> = { lots: [], articles: [], released_lots: [] };
  const calls: { type: string; name: string; args: unknown }[] = [];
  let result: unknown; let error: { message: string } | null = null; let uploadError: { message: string } | null = null; let changes = 0;
  const fake = {
    from(table: string) {
      const filters: Record<string, string> = {}; let start = 0, end = 999;
      const query = {
        select() { calls.push({ type: 'select', name: table, args: filters }); return query; },
        eq(key: string, value: string) { filters[key] = value; return query; },
        order() { return query; }, range(a: number, b: number) { start = a; end = b; return query; }, returns() { return query; },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: tables[table].filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value)).slice(start, end + 1), error }).then(resolve); },
      }; return query;
    },
    // A set-returning function (released_lots) is paged like a table; any other call answers with the set result.
    rpc(name: string, args: unknown) {
      calls.push({ type: 'rpc', name, args }); let start = 0, end = Infinity;
      const call = {
        range(a: number, b: number) { start = a; end = b; calls.push({ type: 'range', name, args: [a, b] }); return call; },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: name === 'released_lots' ? tables.released_lots.slice(start, end + 1) : result, error }).then(resolve); },
      }; return call;
    },
    storage: { from(bucket: string) { return {
      getPublicUrl(path: string) { return { data: { publicUrl: `https://fixture.test/storage/v1/object/public/${bucket}/${path}` } }; },
      async upload(path: string, file: File, options: unknown) { calls.push({ type: 'upload', name: bucket, args: { path, type: file.type, options } }); return { data: { path }, error: uploadError }; },
    }; } },
  };
  const adapter = createLiveAdapter(fake as unknown as SupabaseClient, { changed: () => changes++ });
  return { content: adapter.content, store: adapter.store, tables, calls, changes: () => changes,
    result: (value: unknown) => { result = value; error = null; }, fail: (message: string) => { error = { message }; }, uploadFail: () => { uploadError = { message: 'Fixture upload denied' }; } };
}
const pdf = () => new File(['%PDF fixture'], 'fixture.pdf', { type: 'application/pdf' });
const release = { testedAt: '2026-09-29', reference: 'Fixture reference', results: [
  { label: 'Purity', method: 'HPLC', value: '99.0', unit: '%' },
  { label: 'Identity', method: 'Mass spectrometry', value: 'Confirmed', unit: '' },
] };
const released = { lot: 'FIXTURE', product_id: 'compound', status: 'released', released_at: '2026-10-01T12:00:00Z', tested_at: '2026-09-29', coa_path: 'FIXTURE.pdf', results: release.results };

test('certificate library reads released_lots, paginates and returns public PDF URLs newest first', async () => {
  const f = fixture();
  f.tables.released_lots = Array.from({ length: 1001 }, (_, i) => ({ ...released, lot: `FIXTURE-${i}`, released_at: i === 1000 ? '2026-10-02' : '2026-10-01' }));
  const lots = await f.content.library();
  assert.equal(lots.length, 1001); assert.equal(lots[0].lot, 'FIXTURE-1000');
  assert(lots.every((lot) => lot.status === 'released' && lot.coaUrl?.endsWith('/certificates/FIXTURE.pdf')));
  assert.deepEqual(f.calls.filter((call) => call.type === 'range').map((call) => call.args), [[0, 999], [1000, 1999]]);
  // The lots table is the team's: the public library never reads it.
  assert.equal(f.calls.some((call) => call.type === 'select' && call.name === 'lots'), false);
});
test('a public lot record carries no stock, notes, staff or bookkeeping, even if a row did', async () => {
  const f = fixture();
  f.tables.released_lots = [{ ...released, lot_number: 'FIXTURE-N', testing_status: 'passed', reference: 'CERT-1', inventory_id: 'private-id', version: 7,
    units: 40, reserved_units: 3, received_units: 40, expected_units: 50, expected_at: '2026-11-01', received_at: '2026-09-01',
    hold_reason: 'PRIVATE HOLD', rejection_note: 'PRIVATE NOTE', updated_by: 'staff-id' }];
  const [lot] = await f.store.lots.released();
  assert.deepEqual(lot, { lot: 'FIXTURE', number: 'FIXTURE-N', productId: 'compound', status: 'released', testingStatus: 'passed', testedAt: '2026-09-29',
    releasedAt: '2026-10-01T12:00:00Z', results: release.results, reference: 'CERT-1', coaPath: 'FIXTURE.pdf',
    coaUrl: 'https://fixture.test/storage/v1/object/public/certificates/FIXTURE.pdf', receivedAt: null, units: null, sample: false });
});
test('team lot read uses RLS for every status and the public lookup keeps early PDF URLs hidden', async () => {
  const f = fixture(); f.tables.lots = [{ ...released, status: 'archived' }];
  assert.equal((await f.content.lot('FIXTURE'))?.status, 'archived');
  f.result({ ...released, status: 'testing', coaUrl: 'private' });
  assert.equal((await f.store.lots.get('FIXTURE'))?.coaUrl, undefined);
  f.result({ ...released, productId: 'compound', coaUrl: 'https://fixture.test/PDF' });
  assert.equal((await f.store.lots.get('FIXTURE'))?.coaUrl, 'https://fixture.test/PDF');
});
test('release uploads the required PDF first, then sends the exact results to the release RPC', async () => {
  const f = fixture(); f.result(released);
  const result = await f.content.releaseLot('FIXTURE', release, pdf());
  assert.deepEqual(f.calls.map((call) => call.type), ['upload', 'rpc']);
  const path=(f.calls[0].args as {path:string}).path;
  assert.match(path,/^FIXTURE-[a-f0-9-]{36}\.pdf$/);
  assert.deepEqual(f.calls[0].args, { path, type: 'application/pdf', options: { upsert: false, contentType: 'application/pdf', cacheControl: '60' } });
  assert.deepEqual(f.calls[1], { type: 'rpc', name: 'release_lot', args: { lot: 'FIXTURE', results: release.results, reference: release.reference, tested_at: release.testedAt, coa_path: path } });
  assert.equal(result.testedAt, '2026-09-29'); assert.equal(f.changes(), 1);
});
test('certificate replacement uses only its RPC; upload and RPC failures propagate without success events', async () => {
  const f = fixture(); f.result(released);
  await f.content.replaceCertificate('FIXTURE', pdf());
  assert.equal(f.calls[1].name, 'set_lot_certificate');
  const failedUpload = fixture(); failedUpload.uploadFail();
  await assert.rejects(failedUpload.content.releaseLot('FIXTURE', release, pdf()), /upload denied/);
  assert.equal(failedUpload.calls.length, 1); assert.equal(failedUpload.changes(), 0);
  const failedRPC = fixture(); failedRPC.fail('Fixture release refused');
  await assert.rejects(failedRPC.content.releaseLot('FIXTURE', release, pdf()), /release refused/);
  assert.equal(failedRPC.changes(), 0);
  failedRPC.result(released);
  await failedRPC.content.releaseLot('FIXTURE', release, pdf());
  const uploads = failedRPC.calls.filter((call) => call.type === 'upload');
  assert.equal(uploads.length, 2); assert.notEqual((uploads[0].args as {path:string}).path, (uploads[1].args as {path:string}).path);
  assert.deepEqual(failedRPC.calls.map((call) => call.type), ['upload', 'rpc', 'upload', 'rpc']);
  assert.equal(failedRPC.changes(), 1);
});
test('reject sends the note through its RPC without a file upload and refreshes only after success', async () => {
  const f = fixture(); f.result({ ...released, status: 'rejected', rejection_note: 'Fixture below specification' });
  const rejected = await f.content.rejectLot('FIXTURE', 'Fixture below specification');
  assert.deepEqual(f.calls, [{ type: 'rpc', name: 'reject_lot', args: { lot: 'FIXTURE', note: 'Fixture below specification' } }]);
  assert.equal(rejected.status, 'rejected'); assert.equal(rejected.rejectionNote, 'Fixture below specification');
  assert.equal(rejected.coaUrl, undefined); assert.equal(rejected.coaPath, 'FIXTURE.pdf');
  assert.equal(f.changes(), 1);
  f.fail('Fixture rejection refused');
  await assert.rejects(f.content.rejectLot('FIXTURE', 'Fixture note'), /rejection refused/);
  assert.equal(f.changes(), 1);
});
test('invalid upload type, size, empty file and unsafe certificate path are refused before upload', async () => {
  const f = fixture();
  for (const file of [new File(['x'], 'x.html', { type: 'text/html' }), new File([], 'empty.pdf', { type: 'application/pdf' }), new File([new Uint8Array(10485761)], 'large.pdf', { type: 'application/pdf' })])
    await assert.rejects(f.content.releaseLot('FIXTURE', release, file), /PDF up to 10 MB/);
  await assert.rejects(f.content.replaceCertificate('../escape', pdf()), /lot number/);
  await assert.rejects(f.content.articles.uploadCover(new File(['x'], 'vector.svg', { type: 'image/svg+xml' })), /JPG, PNG or WebP/);
  await assert.rejects(f.content.articles.uploadCover(new File([new Uint8Array(5242881)], 'large.png', { type: 'image/png' })), /5 MB/);
  assert.equal(f.calls.length, 0);
});
const input: ArticleInput = { slug: 'fixture', title: 'Fixture', kicker: 'Fixture', excerpt: 'Fixture', bodyMd: '## Fixture', readingMinutes: 2, status: 'published', publishedAt: '2026-09-01T00:00:00Z', author: 'Fixture author', coverPath: 'fixture.webp' };
const article = { id: 'fixture-id', slug: input.slug, title: input.title, kicker: input.kicker, excerpt: input.excerpt, body_md: input.bodyMd, reading_minutes: input.readingMinutes, status: input.status, published_at: input.publishedAt, updated_at: '2026-09-02', author: input.author, cover_path: input.coverPath };
test('public article reads explicitly select published rows, with drafts available only to the admin read path', async () => {
  const f = fixture(); f.tables.articles = [article, { ...article, id: 'draft-id', slug: 'draft', status: 'draft' }, { ...article, id: 'newer', slug: 'newer', published_at: '2026-09-03' }];
  assert.deepEqual((await f.content.articles.list()).map((item) => item.slug), ['newer', 'fixture']);
  assert.equal((await f.content.articles.list(true)).length, 3);
  assert.equal(await f.content.articles.get('draft'), null);
  const entry = await f.content.articles.get('fixture');
  assert.equal(entry?.coverUrl, 'https://fixture.test/storage/v1/object/public/journal/fixture.webp');
  assert.equal(entry?.bodyMd, input.bodyMd);
});
test('article writes use explicit RPC fields, cover uploads use image storage and cannot overwrite another cover', async () => {
  const f = fixture(); f.result(article);
  const saved = await f.content.articles.save({ ...input, coverImage: 'images/scenes/lab.webp' });
  assert.equal(saved.id, article.id);
  assert.deepEqual(f.calls[0], { type: 'rpc', name: 'upsert_article', args: { article: { id: undefined, slug: input.slug, title: input.title, kicker: input.kicker, excerpt: input.excerpt, body_md: input.bodyMd, cover_path: input.coverPath, cover_image: null, reading_minutes: input.readingMinutes, status: input.status, published_at: input.publishedAt, author: input.author } } });
  const path = await f.content.articles.uploadCover(new File(['image fixture'], 'fixture.png', { type: 'image/png' }));
  assert.match(path, /^[a-f\d-]+\.png$/);
  assert.equal((f.calls.at(-1)?.args as { options: { upsert: boolean } }).options.upsert, false);
  f.result(true); assert.equal(await f.content.articles.remove(saved.id), true);
  assert.equal(f.calls.at(-1)?.name, 'delete_article'); assert.equal(f.changes(), 2);
  f.fail('Fixture permission denied');
  await assert.rejects(f.content.articles.save(input), /permission denied/);
  await assert.rejects(f.content.articles.remove(saved.id), /permission denied/);
  assert.equal(f.changes(), 2);
});
