/** The home page's claim: every lot on the opening's pedestals tested at 99% or better, as the caption under its way in says. Run: npx tsx --test scripts/hero-shelf.test.ts */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectionIds } from '../src/brand/carousel.ts';
import { certificates } from '../src/platform/certificate-records.ts';
import { products } from '../src/data.ts';

test('every vial on the opening\'s pedestals is a live product whose lot tested at least 99% in every component', () => {
  for (const id of collectionIds) {
    const product = products.find((p) => p.id === id && p.active !== false);
    assert.ok(product, `${id} is not an active product`);
    const entry = certificates.find((c) => c.lot === product.lot);
    assert.ok(entry, `${id}'s lot ${product.lot} has no certificate`);
    for (const component of entry.components) {
      assert.ok(Number(component.purity) >= 99, `${id} (${product.lot}) ${component.name}: ${component.purity}% is under 99%`);
    }
  }
});
