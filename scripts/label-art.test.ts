/** "Label detail" says a lot is "as printed on the vial" only where the supplied art prints the lot the page sells (src/shop/label-art.ts). Run: npx tsx --test scripts/label-art.test.ts */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { products } from '../src/data.ts';
import { labelPrintsLot, printedLot } from '../src/shop/label-art.ts';

const sold = products.filter((p) => p.image?.startsWith('/images/products/'));

test('every supplied label has its printed lot read', () => {
  for (const product of sold) assert.ok(printedLot(product), `${product.id}: its art's lot has not been read`);
});

test('nineteen labels print the lot their page sells', () => {
  const printing = sold.filter(labelPrintsLot).map((p) => p.id);
  assert.equal(printing.length, 19, printing.join(' '));
});

test('CJC (No DAC) / Ipamorelin is not said to print its lot: its art is the 10 mg / 10 mg label', () => {
  const cjc = products.find((p) => p.id === 'cjc-ipa-1010-mg');
  assert.ok(cjc);
  assert.equal(cjc.lot, 'TM-CJI5-2609-01');
  assert.equal(printedLot(cjc), 'TM-CJI10-2609-01');
  assert.equal(labelPrintsLot(cjc), false);
});

test('art that has not been read is never said to print a lot', () => {
  assert.equal(labelPrintsLot({ ...sold[0], image: 'https://example.com/vial.png' }), false);
  assert.equal(labelPrintsLot({ ...sold[0], image: undefined }), false);
  assert.equal(labelPrintsLot({ ...sold[0], image: '/images/products/unknown.png' }), false);
});
