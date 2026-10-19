import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QUICK_SCHEMAS, quickTurn } from '../src/assistant/quick.ts';
import { toolsFor } from '../supabase/functions/assistant/tools.ts';

const home = { page: '/', signedIn: false };
const viewing = { page: '/product/retatrutide-10-mg', product: { id: 'retatrutide-10-mg', name: 'Retatrutide', size: '10 mg', lot: 'TM-RET10-2609-01' }, signedIn: true };

test('the desk answers its own suggestions at once, and leaves everything else to the model', () => {
  const lotPrompt = quickTurn('Verify a lot', home);
  assert.equal(lotPrompt?.call, undefined);
  assert.equal(lotPrompt?.answer(null).artifact?.kind, 'lot-field');

  assert.deepEqual(quickTurn('Verify lot tm-bpc10-2609-01', home)?.call?.arguments, { lot: 'TM-BPC10-2609-01' });
  assert.deepEqual(quickTurn("Read lot TM-RET10-2609-01's certificate", viewing)?.call?.arguments, { lot: 'TM-RET10-2609-01' });
  assert.equal(quickTurn('Find a compound', home)?.call?.name, 'search_catalog');
  assert.equal(quickTurn('How does shipping work?', home)?.call?.name, 'shipping_info');
  assert.equal(quickTurn('how is it stored', viewing)?.answer(null).artifact?.kind, 'storage');
  // Someone new: how lots are tested, a real certificate, the catalog, how to start.
  assert.equal(quickTurn('How is every lot tested?', home)?.answer(null).artifact?.kind, 'process');
  assert.equal(quickTurn('Show me a real certificate', home)?.call?.name, 'lookup_lot');
  assert.equal(quickTurn('What do you carry?', home)?.call?.name, 'search_catalog');
  assert.equal(quickTurn('How do I start ordering?', home)?.answer(null).artifact?.kind, 'account');
  // Reading a certificate reads the one just shown, else the page's lot, else the example.
  assert.deepEqual(quickTurn('How do I read this certificate?', home, 'TM-KPV10-2609-01')?.call?.arguments, { lot: 'TM-KPV10-2609-01' });
  assert.deepEqual(quickTurn('What does HPLC purity measure?', viewing)?.call?.arguments, { lot: 'TM-RET10-2609-01' });
  // What a compound is goes to its profile; what's popular reads the catalog's own marks.
  const about = quickTurn('Tell me about Retatrutide 20 mg', home)?.call;
  assert.equal(about?.name, 'compound_profile'); assert.deepEqual(about?.arguments, { name: 'Retatrutide 20 mg' });
  assert.equal(quickTurn('What is BPC-157?', home)?.call?.name, 'compound_profile');
  const popular = quickTurn('What are your most popular compounds?', home)!;
  assert.equal(popular.call?.name, 'search_catalog');
  const tiles = [{ id: 'a', name: 'Alpha', size: '10 mg', sizes: 1, image: '', category: 'x' }, { id: 'b', name: 'BPC-157', size: '10 mg', sizes: 1, image: '', category: 'x', tag: 'Best seller' }, { id: 'g', name: 'GLOW', size: '70 mg', sizes: 1, image: '', category: 'x', tag: 'New' }];
  const said = popular.answer({ model: {}, artifact: { kind: 'catalog', tiles, query: '' } });
  assert.match(said.lead, /^Our best seller is BPC-157, and GLOW is new\./);
  assert.deepEqual(said.artifact?.kind === 'catalog' && said.artifact.tiles.map((t) => t.id), ['b', 'g', 'a']);

  // The order planner opens, continues, or takes a compound; a restock rebuilds an order as a plan.
  assert.deepEqual(quickTurn('Help me plan an order', home)?.answer(null).plan, { mode: 'continue' });
  assert.match(quickTurn('Continue my order plan', home, undefined, true)!.answer(null).lead, /right where you left it/);
  assert.deepEqual(quickTurn('Plan an order with Retatrutide', viewing)?.answer(null).plan, { mode: 'add', seed: { picks: ['Retatrutide'], step: 'amount' } });
  const restock = quickTurn('Restock order TM-10478', viewing)!;
  assert.deepEqual(restock.call?.arguments, { number: 'TM-10478' });
  const rebuilt = restock.answer({ model: {}, artifact: { kind: 'order', order: { lines: [{ id: 'retatrutide-10-mg', name: 'Retatrutide', size: '10 mg', quantity: 2, lot: 'x' }] } } as never });
  assert.deepEqual(rebuilt.plan?.seed, { why: 'restock', picks: ['Retatrutide'], amounts: { Retatrutide: 20 }, when: 'flexible', freezer: 'yes', step: 'plan' });
  assert.equal(quickTurn('Where is order TM-10478?', home)?.call?.name, 'order_status');
  assert.equal(quickTurn('Show me Retatrutide 20 mg again', home)?.call?.arguments.id, 'retatrutide-20-mg');

  // The desk's services open as cards, without the model.
  const opens = (text: string, signedIn = false) => { const a = quickTurn(text, { ...home, signedIn })?.answer(null).artifact; return a?.kind === 'panel' ? [a.panel, a.topic ?? null] : null; };
  assert.deepEqual(opens('What can you help with?'), ['menu', null]);
  assert.deepEqual(opens('Track an order'), ['track', null]);
  assert.deepEqual(opens('Where is my order?'), ['track', null]);
  assert.equal(opens('Where is my order?', true), null, 'a signed-in buyer\'s orders are the model\'s to find');
  assert.deepEqual(opens("What's in my cart?"), ['bag', null]);
  assert.deepEqual(opens("What's in my bag?"), ['bag', null]);
  assert.deepEqual(opens('Apply a discount code'), ['code', null]);
  assert.deepEqual(opens("What's your return policy?"), ['policy', 'returns']);
  assert.deepEqual(opens('Shipping policy'), ['policy', 'shipping']);
  assert.deepEqual(opens('Common questions'), ['faq', null]);
  assert.deepEqual(opens('What is a retest date?'), ['faq', 'What is a retest date?']);
  assert.deepEqual(opens('Talk to a person'), ['contact', null]);
  assert.deepEqual(opens('Create an account'), ['apply', null]);
  assert.deepEqual(opens('Start my application'), ['apply', null]);
  assert.deepEqual(opens('Show me the research blog'), ['articles', null]);
  assert.deepEqual(opens('Tell me about TrueMark'), ['about', null]);

  // A product page compares its own sizes, at most three.
  const sizes = quickTurn('Compare the sizes', viewing)?.call;
  assert.equal(sizes?.name, 'compare_products');
  assert.equal(sizes?.arguments.first, 'retatrutide-10-mg');
  assert.ok(sizes?.arguments.third);

  // Questions of its own go to the model.
  for (const text of ['What is the difference between BPC-157 and KPV?', 'Compare the sizes', 'Read its certificate', 'Tell me about something we do not sell']) assert.equal(quickTurn(text, home), null, text);

  // A lot that was not found says so plainly.
  assert.match(quickTurn('Verify lot TM-NOPE-01', home)!.answer({ model: {} }).lead, /couldn't find lot TM-NOPE-01/);
});

test("the desk's own calls use the server's visitor tools as the server defines them", () => {
  const server = toolsFor('visitor', 'anonymous');
  for (const local of QUICK_SCHEMAS) {
    const remote = server.find((tool) => tool.name === local.name);
    assert.ok(remote, local.name);
    assert.deepEqual(Object.keys(local.parameters.properties).sort(), Object.keys(remote.parameters.properties).sort(), local.name);
    assert.deepEqual([...local.parameters.required].sort(), [...remote.parameters.required].sort(), local.name);
  }
});
