import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compoundsOf, fill, planFromLines, rangeOf, shippingFor } from '../src/assistant/planner.ts';
import type { Product } from '../src/data.ts';

const vial = (id: string, name: string, size: string, price?: number): Product => ({ id, name, size, price, category: 'fixture', lot: `LOT-${id}`, form: 'Lyophilized powder', color: '#777777', colorInk: '#333333' } as Product);
const catalog = [vial('r10', 'Retatrutide', '10 mg', 100), vial('r20', 'Retatrutide', '20 mg', 180), vial('r30', 'Retatrutide', '30 mg', 250), vial('r60', 'Retatrutide', '60 mg', 450),
  vial('blend', 'BPC-157 / TB-500', '10 mg / 10 mg', 120), { ...vial('old', 'Retired', '10 mg', 10), active: false }];

test('the planner groups the catalog by compound and fills an amount with the cheapest mix of sizes', () => {
  const [ret, blend, ...rest] = compoundsOf(catalog);
  assert.equal(rest.length, 0, 'inactive products stay out');
  assert.deepEqual(rangeOf(ret), { min: 10, max: 240, step: 10, unit: 'mg' });
  assert.deepEqual(rangeOf(blend), { min: 1, max: 10, step: 1, unit: 'vials' });

  const forty = fill(ret, 40);
  assert.deepEqual(forty.lines.map((l) => [l.size.id, l.quantity]), [['r30', 1], ['r10', 1]]);
  assert.equal(forty.cost, 350); assert.equal(forty.saves, 50); assert.equal(forty.mg, 40);
  assert.deepEqual(fill(ret, 50).lines.map((l) => [l.size.id, l.quantity]), [['r30', 1], ['r20', 1]]);
  assert.equal(fill(ret, 10).saves, null, 'one small vial saves nothing');

  // Without prices it takes the fewest vials.
  const [open] = compoundsOf(catalog.map((p) => ({ ...p, price: undefined })));
  const unpriced = fill(open, 120);
  assert.equal(unpriced.vials, 2); assert.equal(unpriced.cost, null); assert.equal(unpriced.saves, null);
  assert.equal(fill(open, 40).mg, 40, 'never past the amount for want of prices');
  assert.equal(fill(open, 40).vials, 2);

  // A blend is counted in vials.
  assert.deepEqual(fill(blend, 3), { lines: [{ size: blend.sizes[0], quantity: 3 }], vials: 3, mg: null, cost: 360, saves: null });
});

test('a past order becomes a plan at today\'s sizes, and shipping follows the date and the free threshold', () => {
  const compounds = compoundsOf(catalog);
  assert.deepEqual(planFromLines([{ name: 'Retatrutide', size: '20 mg', quantity: 2 }, { id: 'r10', name: 'Retatrutide', size: '10 mg', quantity: 1 }, { name: 'BPC-157 / TB-500', size: '10 mg / 10 mg', quantity: 2 }, { name: 'Gone', size: '5 mg', quantity: 1 }], compounds),
    { picks: ['Retatrutide', 'BPC-157 / TB-500'], amounts: { Retatrutide: 50, 'BPC-157 / TB-500': 2 } });

  const methods = [{ id: 'cold-overnight', label: 'Cold chain · overnight', detail: '', price: 42 }, { id: 'cold-2day', label: 'Cold chain · 2 business days', detail: '', price: 24 }] as never;
  const settings = { freeShippingThreshold: 150, freeShippingMethod: 'cold-2day' } as never;
  assert.equal(shippingFor('soon', 400, methods, settings)?.method.id, 'cold-overnight');
  assert.equal(shippingFor('soon', 400, methods, settings)?.price, 42, 'free shipping is the standard method only');
  assert.equal(shippingFor('week', 400, methods, settings)?.price, 0);
  assert.deepEqual(shippingFor('flexible', 100, methods, settings) && { price: shippingFor('flexible', 100, methods, settings)!.price, remaining: shippingFor('flexible', 100, methods, settings)!.remaining }, { price: 24, remaining: 50 });
  assert.equal(shippingFor('week', null, methods, settings)?.remaining, null, 'no prices, no distance to free shipping');
});
