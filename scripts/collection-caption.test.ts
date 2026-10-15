/** The opening's caption, "Every lot shown tested ≥99% by HPLC", is said only while every lot shown is released at 99% or better, read from the same records and the same figure as its plinth labels. Run: npx tsx --test scripts/collection-caption.test.ts */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectionIds } from '../src/brand/carousel.ts';
import { collectionVerified, plinthPurity } from '../src/brand/plinth.ts';
import { certificates, releasedFields } from '../src/platform/certificate-records.ts';
import { products } from '../src/data.ts';
import type { Lot } from '../src/platform/types.ts';

/** A shown lot's record as the store keeps it once its certificate is released (the preview seed does the same). */
function released(id: string): Lot {
  const product = products.find((p) => p.id === id);
  assert.ok(product, `${id} is not a product`);
  const entry = certificates.find((c) => c.lot === product.lot);
  assert.ok(entry, `${id}'s lot ${product.lot} has no certificate`);
  return { lot: product.lot, productId: id, status: 'testing', receivedAt: '2026-09-24T00:00:00Z', results: [], units: null, sample: false, ...releasedFields(entry) } as Lot;
}

const wide = collectionIds.map(released);
const tall = collectionIds.slice(1, 4).map(released);

test('the caption is said of the collection as it stands: all five lots, and the middle three a portrait screen shows', () => {
  assert.equal(collectionVerified(wide), true);
  assert.equal(collectionVerified(tall), true);
});

test('it reads the figure the plinth labels show: each lot\'s lowest HPLC purity', () => {
  for (const record of wide) {
    const purity = plinthPurity(record);
    assert.ok(purity, `${record.lot} shows no figure`);
    assert.ok(Number(purity.value) >= 99, `${record.lot}: ${purity.value}`);
  }
});

test('it is not said while any shown lot is unreleased, missing, still loading, or a sample', () => {
  const swap = (i: number, record: Lot | null | undefined) => wide.map((r, k) => (k === i ? record : r));
  assert.equal(collectionVerified(swap(3, { ...wide[3], status: 'testing', results: [], releasedAt: undefined })), false, 'a lot back in testing');
  assert.equal(collectionVerified(swap(0, { ...wide[0], status: 'quarantine' })), false, 'a lot in quarantine');
  assert.equal(collectionVerified(swap(2, { ...wide[2], status: 'rejected' })), false, 'a rejected lot');
  assert.equal(collectionVerified(swap(1, null)), false, 'a lot with no record');
  assert.equal(collectionVerified(swap(4, undefined)), false, 'a record still loading');
  assert.equal(collectionVerified(swap(1, { ...wide[1], sample: true })), false, 'illustrative sample evidence');
  assert.equal(collectionVerified([]), false, 'nothing shown');
});

test('it is not said once any shown lot, or any component of a blend, falls under 99%', () => {
  const under = (record: Lot, value: string): Lot => ({ ...record, results: record.results.map((r) => (r.label.startsWith('Purity') && r.method === 'HPLC' ? { ...r, value } : r)) });
  assert.equal(collectionVerified(wide.map((r, k) => (k === 2 ? under(r, '98.99') : r))), false, 'a lot at 98.99%');
  assert.equal(collectionVerified(wide.map((r, k) => (k === 2 ? under(r, '99.00') : r))), true, 'a lot at exactly 99.00%');
  const blend: Lot = { ...wide[0], results: [
    { label: 'Purity · Component A', method: 'HPLC', value: '99.80', unit: '%' },
    { label: 'Purity · Component B', method: 'HPLC', value: '98.40', unit: '%' },
  ] };
  assert.equal(collectionVerified([blend, ...wide.slice(1)]), false, 'a blend whose lowest component is under 99%');
  assert.equal(collectionVerified(wide.map((r, k) => (k === 0 ? { ...r, results: r.results.filter((x) => !(x.method === 'HPLC' && x.label.startsWith('Purity'))) } : r))), false, 'a released lot with no HPLC purity');
});
