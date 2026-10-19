import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { createHandler, selectPersona, type Repository, type Thread, type Message, type Identity } from '../supabase/functions/assistant/server.ts';
import { anthropicStream, type Accounting, type ModelRequest } from '../supabase/functions/assistant/providers.ts';
import { DEFAULT_MODELS } from '../supabase/functions/assistant/models.ts';
import { toolsFor } from '../supabase/functions/assistant/tools.ts';
import { REFUSAL, SYSTEM_PROMPTS, type Persona } from '../supabase/functions/assistant/prompts.ts';
import { createTransport } from '../src/assistant/client.ts';
import { runTurn, type TurnCallbacks } from '../src/assistant/engine.ts';
import { createToolRuntime, type RuntimeDependencies, type Scope } from '../src/assistant/runtime.ts';
import { checkClaims } from '../src/assistant/claims.ts';
import { businessSummary, reorder, trend } from '../src/assistant/metrics.ts';
import type { AssistantStore } from '../src/assistant/store.ts';
import type { ToolCall, ToolSchema } from '../src/assistant/protocol.ts';
import type { Order } from '../src/platform/types.ts';

// Guard against an accidental external transport in every test in this process.
globalThis.fetch = async () => { throw new Error('External network forbidden in WP-17 tests'); };
// Bundle the site's renderer as the other rendering suites do: CSS is not a Node module.
globalThis.window = new EventTarget() as unknown as Window & typeof globalThis;
globalThis.BroadcastChannel = undefined as never;
const renderDirectory = await mkdtemp('/private/tmp/wp17-chat-render-');
const renderFile = join(renderDirectory, 'renderer.cjs');
await build({ stdin: { contents: `
  import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
  import { MemoryRouter } from 'react-router-dom';
  import { MessageText } from './src/assistant/MessageText';
  import { ConfirmationDetails } from './src/assistant/ConfirmationDetails';
  export const message = (text) => renderToStaticMarkup(<MemoryRouter><MessageText text={text}/></MemoryRouter>);
  export const details = (action) => renderToStaticMarkup(<ConfirmationDetails action={action}/>);
`, resolveDir: resolve(import.meta.dirname, '..'), loader: 'tsx' }, outfile: renderFile, bundle: true, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.css': 'empty' }, logLevel: 'silent',
  define: { 'import.meta.env': JSON.stringify({ VITE_PLATFORM: 'preview', BASE_URL: '/', PROD: true }), 'process.env.NODE_ENV': '"production"' } });
const render = createRequire(import.meta.url)(renderFile) as { message: (text: string) => string; details: (action: unknown) => string };
after(() => rm(renderDirectory, { recursive: true, force: true }));
const hash = async (s: string) => createHash('sha256').update(s).digest('hex');
const now = '2026-10-01T12:00:00Z';
const user = '00000000-0000-4000-8000-000000000001';
const jwt = (role: string) => `${Buffer.from('{"alg":"fixture"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user, role, user_metadata: { role: 'owner' } })).toString('base64url')}.fixture-signature`;
type Block = { type: 'text'; text: string } | ToolCall;
const stream = (blocks: Block[], complete = true) => {
  const events = [{ type: 'message_start', message: { id: 'fixture', role: 'assistant', content: [] } }];
  blocks.forEach((block, index) => {
    events.push({ type: 'content_block_start', index, content_block: block.type === 'text' ? { type: 'text', text: '' } : { type: "tool_use", name: block.name, id: block.id, input: {} } } as never);
    const text = block.type === 'text' ? block.text : JSON.stringify(block.arguments);
    const middle = Math.floor(text.length / 2);
    for (const chunk of [text.slice(0, middle), text.slice(middle)]) events.push({ type: 'content_block_delta', index, delta: block.type === 'text' ? { type: 'text_delta', text: chunk } : { type: 'input_json_delta', partial_json: chunk } } as never);
    events.push({ type: 'content_block_stop', index } as never);
  });
  if (complete) events.push({ type: 'message_stop' } as never);
  const bytes = new TextEncoder().encode(events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''));
  return new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 17) controller.enqueue(bytes.slice(i, i + 17)); controller.close(); } }), { headers: { 'content-type': 'text/event-stream' } });
};
function serverFixture(identity: Identity | null = null, replies: Block[][] = [[{ type: 'text', text: 'Fixture answer.' }]]) {
  const threads = new Map<string, Thread & { busy?: boolean }>(), history = new Map<string, Message[]>();
  const requests: ModelRequest[] = []; const accounting: Accounting[] = []; let available = true, limit = false, incomplete = false;
  const token = identity ? jwt(identity.role) : undefined;
  const repository = {
    async identify(value) { return value === token ? identity : null; }, async review(value) { return value === 'fixture-review'; },
    async usage() { return { allowed: !limit, retryAfter: 100 }; },
    async thread(id) { return threads.get(id) ?? null; }, async messages(id) { return structuredClone(history.get(id) ?? []); },
    async reserve(t, content, round) {
      const old = threads.get(t.id); if (old?.busy || (old && old.revision !== t.revision)) throw new Error('Fixture conflict');
      const next = { ...t, revision: t.revision + 1, tool_rounds: round, busy: true }; threads.set(t.id, next);
      history.set(t.id, [...(history.get(t.id) ?? []), ...content]); return next.revision;
    },
    async finish(id, revision, content, usage) {
      const t = threads.get(id); if (!t || t.revision !== revision || !t.busy) return false;
      t.busy = false; if (content) { history.set(id, [...history.get(id)!, content]); if (usage) accounting.push(usage); } return true;
    },
  } as Repository;
  repository.models = async () => ({ ...DEFAULT_MODELS });
  repository.spend = async () => ({ month: '2026-10', cost: 0, unpricedMessages: 0, messages: 0, promptTokens: 0, completionTokens: 0 });
  const deps = { repository, hash, catalog: async () => [], get provider() { return available ? { name: 'Anthropic' as const, async *stream(body: ModelRequest) {
    requests.push(body); yield* anthropicStream(stream(replies[Math.min(requests.length - 1, replies.length - 1)], !incomplete));
  } } : null; } };
  const handler = createHandler(deps);
  const fetcher = (async (_url: unknown, init?: RequestInit) => handler(new Request('https://fixture.invalid/assistant', init))) as typeof fetch;
  const headers = async () => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });
  const transport = (context: Record<string, unknown> = { mode: 'live' }) => createTransport({ endpoint: 'https://fixture.invalid/assistant', context: () => context, headers, fetch: fetcher });
  return { threads, history, requests, accounting, handler, transport, token, offline: () => available = false, rateLimit: () => limit = true, incomplete: () => incomplete = true };
}
const callbacks = (): TurnCallbacks => ({ text() {}, artifact() {}, status() {}, async confirm() { return false; } });
const tools = (p: Persona, role = p) => toolsFor(p, role) as unknown as ToolSchema[];
const call = (name: string, input: Record<string, unknown> = {}, id = 'tool-1'): ToolCall => ({ type: 'tool_call', name, arguments: input, id });
const order: Order = { id: 'order-a', number: 'TM-10512', buyerId: 'buyer-a', createdAt: '2026-09-20T12:00:00Z', status: 'paid', payment: 'captured', subtotal: 100, total: 124,
  lines: [{ productId: 'compound', quantity: 2, unitPrice: 50, lot: 'LOT-1' }], events: [{ status: 'paid', at: '2026-09-20' }],
  shipping: { method: 'cold-2day', price: 24 }, address: { id: 'a', label: 'Lab', institution: 'Fixture lab', attention: 'Fixture buyer', line1: 'Fixture address', city: 'Fixture', region: 'TX', postal: '00000', country: 'US' } };
function runtimeFixture(persona: Persona = 'owner') {
  let writes = 0, scope: Scope = { persona, role: persona, id: 'fixture', sample: false };
  const orders = [structuredClone(order), { ...structuredClone(order), id: 'order-b', buyerId: 'buyer-b', number: 'TM-10513' }];
  const reads: string[] = [];
  const p = { id: 'partner-a', name: 'Fixture partner', code: 'FIXTURE', rate: .12, codeDiscount: .1, status: 'active', handle: '@fixture' };
  const product = { id: 'compound', name: 'Fixture compound', size: '10 mg', category: 'fixture', price: 50, active: true, stock: null, description: null, form: 'Lyophilized powder', lot: 'LOT-1' };
  const refs = [{ id: 'r', partnerId: p.id, orderId: 'order-a', orderNumber: 'TM-10512', createdAt: '2026-09-01T12:00:00Z', commission: 12, orderSubtotal: 100, status: 'pending', via: 'link', buyerName: 'MUST NOT LEAK', buyerEmail: 'secret@example.test', address: 'PRIVATE' },
    { id: 'approved', partnerId: p.id, orderId: 'order-a', orderNumber: 'TM-10512', createdAt: '2026-09-01T12:00:00Z', commission: 12, orderSubtotal: 100, status: 'approved', via: 'link' }];
  const s = {
    assistant: { async products() { return [product]; }, async capabilities() { return { updateProduct: false }; }, async journal() { return []; } },
    session: { async get() { return { id: 'buyer-a', status: 'verified' }; } },
    orders: { async list() { reads.push('orders'); return orders; }, async listForBuyer(id: string) { reads.push(`buyer:${id}`); return orders.filter((o) => o.buyerId === id); }, async get(id: string) { return orders.find((o) => o.id === id || o.number === id) ?? null; }, async advance(id: string, status: Order['status']) { writes++; const o = orders.find((o) => o.id === id)!; o.status = status; return o; } },
    buyers: { async list() { reads.push('buyers'); return []; } },
    applications: { async list() { return [{ id: 'application-a', name: 'Fixture applicant', institution: 'Fixture lab', status: 'submitted' }]; }, async review(id: string, status: string) { writes++; return { id, status }; } },
    lots: { async list() { reads.push('lots'); return [{ lot: 'LOT-1', productId: 'compound', status: 'released', receivedAt: '2026-09-01', units: 40, holdReason: 'PRIVATE HOLD', results: [], sample: false }]; },
      async released() { reads.push('released'); return [{ lot: 'LOT-1', productId: 'compound', status: 'released', receivedAt: null, units: null, results: [{ label: 'Purity', method: 'HPLC', value: '99.1', unit: '%' }], sample: false }]; },
      async get() { return null; } },
    partners: { async me() { return p; }, async get() { return p; }, async list() { return [p]; }, async referrals(id: string) { reads.push(`referrals:${id}`); return refs; }, async payouts(id: string) { reads.push(`payouts:${id}`); return []; }, async visits(id: string) { reads.push(`visits:${id}`); return []; } },
    actions: { async approveCommissions() { writes++; return 1; }, async recordPayout() { writes++; return { id: 'payout', amount: 12 }; }, async updateProduct() { writes++; return { id: 'compound' }; }, async saveDraft(input: unknown) { writes++; return { ...(input as object), id: 'draft-id' }; }, async createDiscount(input: unknown) { writes++; return input; } },
  } as unknown as AssistantStore;
  const disclosure = (code: string) => `I'm a TrueMark BioLabs partner and earn a commission on orders placed with my code ${code}. For research use only. Not for human consumption.`;
  const deps: RuntimeDependencies = { store: s, scope: async () => scope, now: () => now, addToBag() { writes++; }, verify: () => null,
    siteAnswers: () => ({}), shippingCopy: [], program: { disclosure, link: (_path, code) => `https://fixture.invalid/?ref=${code}`, rules: [] }, goal: () => 250, milestones: () => ({}), qr: async () => 'data:image/png;base64,fixture' };
  return { prepare: createToolRuntime(deps), writes: () => writes, reads, orders, product, deps, changeScope: (next: Scope) => scope = next, disclosure };
}

test('fixture JWTs are verified and database roles select all personas; client persona and JWT metadata cannot elevate', async () => {
  for (const [role, hasPartner, expected] of [['owner', false, 'owner'], ['staff', false, 'owner'], ['partner', true, 'partner'], ['partner', false, 'visitor'], ['buyer', false, 'visitor']] as const) {
    const f = serverFixture({ id: user, role, hasPartner });
    const reply = await f.transport({ mode: 'live', persona: 'owner' })({ text: 'Fixture' }, () => {}, new AbortController().signal);
    assert.equal(reply.meta.persona, expected);
    assert.equal(f.requests[0].model, DEFAULT_MODELS[expected]);
    assert.equal(f.requests[0].max_tokens, expected === 'visitor' ? 700 : 1600);
    if (role === 'staff') assert(!reply.meta.tools.some((t) => ['create_discount_code', 'approve_commissions', 'record_payout'].includes(t.name)));
  }
  assert.equal(selectPersona(null), 'visitor');
  // The storefront's chat asks for the shop's desk: every account gets it there, and asking never raises one.
  for (const [role, hasPartner] of [['owner', false], ['partner', true], ['buyer', false]] as const) {
    const shop = serverFixture({ id: user, role, hasPartner });
    const reply = await shop.transport({ mode: 'live', surface: 'visitor' })({ text: 'Fixture' }, () => {}, new AbortController().signal);
    assert.equal(reply.meta.persona, 'visitor', role);
    assert.deepEqual(reply.meta.tools.map((t) => t.name), toolsFor('visitor', role).map((t) => t.name));
  }
  const anonymous = await serverFixture(null).transport({ mode: 'live', surface: 'owner' })({ text: 'Fixture' }, () => {}, new AbortController().signal);
  assert.equal(anonymous.meta.persona, 'visitor');
  const f = serverFixture({ id: user, role: 'buyer', hasPartner: false });
  const forged = await f.handler(new Request('https://fixture.invalid', { method: 'POST', headers: { authorization: `Bearer ${jwt('owner')}` }, body: JSON.stringify({ mode: 'live', text: 'Fixture' }) }));
  assert.equal(forged.status, 401); assert.equal(f.requests.length, 0);
});
test('preview needs a valid review key for every persona; missing model returns 503 with a validated gate for the offline UI', async () => {
  const f = serverFixture();
  for (const key of [undefined, 'invalid']) await assert.rejects(f.transport({ mode: 'preview', persona: 'owner', reviewKey: key })({ text: 'Fixture' }, () => {}, new AbortController().signal), (e: unknown) => (e as { status: number }).status === 403);
  for (const persona of ['visitor', 'owner', 'partner']) {
    const reply = await f.transport({ mode: 'preview', persona, reviewKey: 'fixture-review' })({ text: 'Fixture' }, () => {}, new AbortController().signal);
    assert.equal(reply.meta.persona, persona);
  }
  f.offline();
  const gate = await f.handler(new Request('https://fixture.invalid', { method: 'POST', body: JSON.stringify({ mode: 'preview', persona: 'visitor', reviewKey: 'fixture-review', action: 'gate' }) }));
  assert.equal(gate.status, 503); assert.equal((await gate.json()).allowed, true);
});
test('missing model secret and rate limits become calm offline/rate-limited states, without model calls', async () => {
  for (const [setup, status] of [['offline', 503], ['rateLimit', 429]] as const) {
    const f = serverFixture(); f[setup]();
    await assert.rejects(f.transport()({ text: 'Fixture' }, () => {}, new AbortController().signal), (error: unknown) => (error as { status: number }).status === status);
    assert.equal(f.requests.length, 0); assert.equal(f.threads.size, 0);
  }
});
test('mocked Anthropic SSE drives the complete browser loop: tool use -> exact confirm card -> store write -> saved result -> streamed answer', async () => {
  const tool = call('advance_order', { id: 'order-a', status: 'shipped', carrier: 'UPS', tracking: '1Z-FIXTURE' });
  const server = serverFixture({ id: user, role: 'owner', hasPartner: false }, [[tool], [{ type: 'text', text: 'TM-10512 is shipped — recorded.' }]]);
  const runtime = runtimeFixture(); const seen: string[] = [];
  const cb = callbacks(); cb.text = (s) => seen.push(s);
  cb.confirm = async (action) => { assert.equal(runtime.writes(), 0); assert.equal(action.kind, 'pending_action'); assert.match(action.title, /TM-10512 shipped with UPS 1Z-FIXTURE/); return true; };
  const answer = await runTurn('Ship this order', server.transport(), runtime.prepare, cb, new AbortController().signal);
  assert.equal(runtime.writes(), 1); assert.match(answer, /recorded/); assert(seen.length >= 2);
  const second = server.requests[1].messages as Message[];
  assert.equal(second.at(-1)?.role, 'tool'); assert.equal(second.at(-1)?.tool_call_id, 'tool-1'); assert.match(JSON.stringify(second.at(-1)), /shipped/);
  assert.equal([...server.history.values()][0].length, 4);
});
test('chat Markdown renders body-sized headings, emphasis, lists, links and code while escaping HTML', () => {
  const html = render.message('**TM-BPC10-2609-01**\n\n*Italic* and `inline code`. [Verify](/verify) [Certificate](https://fixture.invalid/certificate.pdf)\n\n- First\n- Second\n\n1. One\n2. Two\n\n' + Array.from({ length: 6 }, (_, i) => `${'#'.repeat(i + 1)} Heading ${i + 1}`).join('\n\n'));
  for (const expected of ['<strong>TM-BPC10-2609-01</strong>', '<em>Italic</em>', '<code>inline code</code>', 'href="/verify"', 'href="https://fixture.invalid/certificate.pdf"', '<ul><li>First</li>', '<ol><li>One</li>', '<p><strong>Heading 6</strong></p>']) assert(html.includes(expected), expected);
  assert.doesNotMatch(html, /<h[1-6]|\*\*TM-|tm-article-/);
  const unsafe = render.message('<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n[Unsafe](javascript:alert%281%29) [Data](data:text/html,fixture)\n\n![No remote image](https://fixture.invalid/image.png)');
  assert(unsafe.includes('&lt;script&gt;')); assert(unsafe.includes('&lt;img'));
  assert.doesNotMatch(unsafe, /<script|<img|href=|<h[1-6]/);
  assert(unsafe.includes('No remote image'));
});
test('confirmation cards name records and format statuses, money, dates and booleans without changing write IDs', async () => {
  const f = runtimeFixture();
  f.deps.store.assistant.capabilities = async () => ({ updateProduct: true, productArgument: 'draft' });
  const cases = [
    [call('advance_order', { id: 'order-a', status: 'shipped', carrier: 'UPS', tracking: '1Z-FIXTURE' }), ['Order</dt><dd>TM-10512', 'New status</dt><dd>Shipped', 'Current status</dt><dd>Paid', 'Carrier</dt><dd>UPS', 'Tracking</dt><dd>1Z-FIXTURE']],
    [call('review_application', { id: 'application-a', status: 'approved', note: 'Fixture note' }), ['Application</dt><dd>Fixture applicant', 'Note</dt><dd>Fixture note']],
    [call('record_payout', { partnerId: 'partner-a', start: '2026-09-01', end: '2026-09-30', method: 'Fixture transfer' }), ['Partner</dt><dd>Fixture partner', 'From</dt><dd>1 Sep 2026', 'To</dt><dd>30 Sep 2026', 'Method</dt><dd>Fixture transfer']],
    [call('update_product', { id: 'compound', price: 40, active: false, description: 'For research use only.' }), ['Product</dt><dd>Fixture compound 10 mg', 'Price</dt><dd>$50.00 → $40.00', 'Shown in store</dt><dd>Yes → No', 'Description</dt><dd>Not set → For research use only.']],
    [call('create_discount_code', { code: 'FIXTURE', percent: 10, active: true, expiresAt: '2026-10-31T12:00:00Z' }), ['Code</dt><dd>FIXTURE', 'Percent off</dt><dd>10%', 'Shown in store</dt><dd>Yes', 'Expires</dt><dd>31 Oct 2026, 12:00 UTC']],
    [call('draft_journal_post', { title: 'Fixture title', slug: 'fixture-title', excerpt: 'For research use only.', body: 'Read the lot certificate.', author: 'Fixture author' }), ['Title</dt><dd>Fixture title', 'Slug</dt><dd>fixture-title', 'Excerpt</dt><dd>For research use only.', 'Author</dt><dd>Fixture author', 'Publishes</dt><dd>No']],
  ] as const;
  for (const [tool, expected] of cases) {
    const proposal = await f.prepare(tool, tools('owner'), 'owner'); assert(proposal.pending);
    const html = render.details(proposal.pending);
    for (const text of expected) assert(html.includes(text), `${tool.name}: ${text}`);
    assert.doesNotMatch(html, /order-a|application-a|partner-a|<dt>id<|currentStatus|partnerId|expiresAt|\{&quot;/);
    assert.equal(f.writes(), 0); proposal.pending.cancel();
  }
  const originalAdvance = f.deps.store.orders.advance;
  f.deps.store.orders.advance = async (id, ...args) => { assert.equal(id, 'order-a'); return originalAdvance(id, ...args); };
  const orderAction = await f.prepare(call('advance_order', { id: 'order-a', status: 'packed' }), tools('owner'), 'owner');
  await orderAction.pending!.confirm(); assert.equal(f.writes(), 1);
  const originalProduct = f.deps.store.actions.updateProduct;
  f.deps.store.actions.updateProduct = async (id, ...args) => { assert.equal(id, 'compound'); return originalProduct(id, ...args); };
  const productAction = await f.prepare(call('update_product', { id: 'compound', price: 40 }), tools('owner'), 'owner');
  await productAction.pending!.confirm(); assert.equal(f.writes(), 2);
  const visitor = runtimeFixture('visitor');
  const bag = await visitor.prepare(call('add_to_bag', { id: 'compound', quantity: 2 }), tools('visitor'), 'visitor');
  assert.match(render.details(bag.pending), /Product<\/dt><dd>Fixture compound 10 mg/);
  assert.match(render.details(bag.pending), /Price per item<\/dt><dd>\$50\.00/);
  assert.equal(visitor.writes(), 0); await bag.pending!.confirm(); assert.equal(visitor.writes(), 1);
});
test('Cancel and closing the panel produce no writes; Confirm is single-use and rechecks the identity and record', async () => {
  const tool = call('advance_order', { id: 'order-a', status: 'packed' });
  const server = serverFixture({ id: user, role: 'owner', hasPartner: false }, [[tool], [{ type: 'text', text: 'Cancelled.' }]]);
  const runtime = runtimeFixture();
  await runTurn('Pack', server.transport(), runtime.prepare, callbacks(), new AbortController().signal);
  assert.equal(runtime.writes(), 0); assert.match(JSON.stringify(server.requests[1]), /cancelled/);
  const prepared = await runtime.prepare(tool, tools('owner'), 'owner');
  prepared.pending!.cancel(); await assert.rejects(prepared.pending!.confirm(), /already/);
  const changed = await runtime.prepare(tool, tools('owner'), 'owner'); runtime.orders[0].status = 'shipped';
  await assert.rejects(changed.pending!.confirm(), /record changed/); assert.equal(runtime.writes(), 0);
  runtime.orders[0].status = 'paid';
  const switched = await runtime.prepare(tool, tools('owner'), 'owner'); runtime.changeScope({ persona: 'visitor', role: 'buyer', id: 'other', sample: false });
  await assert.rejects(switched.pending!.confirm(), /account changed/);
  const aborted = runtimeFixture(); const controller = new AbortController(); const cb = callbacks();
  cb.confirm = async () => { controller.abort(); return true; };
  await assert.rejects(runTurn('Pack', serverFixture({ id: user, role: 'owner', hasPartner: false }, [[tool]]).transport(), aborted.prepare, cb, controller.signal), /Cancelled/);
  assert.equal(aborted.writes(), 0);
});
test('visitor orders are selected by session, partner results omit buyer identity, forbidden tools never touch store', async () => {
  const visitor = runtimeFixture('visitor');
  const mine = await visitor.prepare(call('my_orders'), tools('visitor'), 'visitor');
  assert.match(JSON.stringify(mine.model), /TM-10512/); assert.doesNotMatch(JSON.stringify(mine.model), /TM-10513/);
  await assert.rejects(visitor.prepare(call('order_status', { number: 'TM-10513' }), tools('visitor'), 'visitor'), /belongs/);
  await assert.rejects(visitor.prepare(call('customers'), tools('owner'), 'visitor'), /cannot use/);
  const partner = runtimeFixture('partner');
  const result = await partner.prepare(call('my_referrals'), tools('partner'), 'partner');
  assert.doesNotMatch(JSON.stringify(result), /MUST NOT LEAK|secret@example|PRIVATE|buyerName|buyerEmail/);
  assert.deepEqual(partner.reads, ['referrals:partner-a']);
  await assert.rejects(partner.prepare(call('orders'), tools('owner'), 'partner'), /cannot use/);
  const staff = runtimeFixture(); staff.changeScope({ persona: 'owner', role: 'staff', id: 'staff', sample: false });
  await assert.rejects(staff.prepare(call('create_discount_code', { code: 'NEW', percent: 10, active: true }), tools('owner'), 'owner'), /requires the owner/);
});
test('partner released lots come from the public records, without unit counts; the owner lots tool reads the team table', async () => {
  const partner = runtimeFixture('partner');
  const released = await partner.prepare(call('released_lots'), tools('partner'), 'partner');
  assert.deepEqual(partner.reads, ['released']);
  const [item] = (released.model as { data: { items: Record<string, unknown>[] } }).data.items;
  assert.deepEqual(Object.keys(item).sort(), ['lot', 'productId', 'results', 'sample', 'status']);
  assert.doesNotMatch(JSON.stringify(released.model), /units|PRIVATE HOLD/);
  const owner = runtimeFixture();
  const lots = await owner.prepare(call('lots'), tools('owner'), 'owner');
  assert.deepEqual(owner.reads, ['lots']);
  assert.equal((lots.model as { data: { items: { units: number }[] } }).data.items[0].units, 40);
});
test('catalog write is feature-detected and never tries an absent upsert; bag changes require Confirm', async () => {
  const owner = runtimeFixture(); const result = await owner.prepare(call('update_product', { id: 'compound', price: 45 }), tools('owner'), 'owner');
  assert.match(JSON.stringify(result.model), /Catalog editing arrives with the next update\./); assert.equal(result.pending, undefined); assert.equal(owner.writes(), 0);
  const visitor = runtimeFixture('visitor'); const added = await visitor.prepare(call('add_to_bag', { id: 'compound', quantity: 2 }), tools('visitor'), 'visitor');
  assert.equal(visitor.writes(), 0); await added.pending!.confirm(); assert.equal(visitor.writes(), 1);
  await assert.rejects(added.pending!.confirm(), /already/);
  await assert.rejects(visitor.prepare(call('add_to_bag', { id: 'compound', quantity: -1 }), tools('visitor'), 'visitor'), /quantity/);
});
test('partner link and QR use the own code and catalog/product route, without writes', async () => {
  const f = runtimeFixture('partner');
  f.deps.program.link = (path, code) => `https://fixture.invalid${path}?ref=${code}`;
  let encoded = ''; f.deps.qr = async (url) => { encoded = url; return 'data:image/png;base64,fixture'; };
  const catalog = await f.prepare(call('make_link'), tools('partner'), 'partner');
  assert.equal(catalog.artifact?.kind, 'link');
  assert.equal(encoded, 'https://fixture.invalid/products?ref=FIXTURE');
  await f.prepare(call('make_link', { product: 'compound' }), tools('partner'), 'partner');
  assert.equal(encoded, 'https://fixture.invalid/product/compound?ref=FIXTURE');
  await assert.rejects(f.prepare(call('make_link', { product: 'missing' }), tools('partner'), 'partner'), /Product not found/);
  assert.equal(f.writes(), 0);
});
test('every owner mutation is a single-use pending action; Cancel never dispatches a write', async () => {
  const cases = [
    call('advance_order', { id: 'order-a', status: 'packed' }),
    call('review_application', { id: 'application-a', status: 'approved' }),
    call('approve_commissions'),
    call('record_payout', { partnerId: 'partner-a', start: '2026-09-01', end: '2026-09-30', method: 'Fixture transfer' }),
    call('update_product', { id: 'compound', price: 40 }),
    call('draft_journal_post', { title: 'Fixture', slug: 'fixture', excerpt: 'For research use only.', body: 'Read the lot certificate.', author: 'Fixture author' }),
    call('create_discount_code', { code: 'FIXTURE', percent: 10, active: true }),
  ];
  for (const tool of cases) {
    const runtime = runtimeFixture(); runtime.deps.store.assistant.capabilities = async () => ({ updateProduct: true, productArgument: 'product' });
    const proposal = await runtime.prepare(tool, tools('owner'), 'owner');
    assert(proposal.pending, tool.name); assert.equal(runtime.writes(), 0, tool.name);
    proposal.pending.cancel(); assert.equal(runtime.writes(), 0, tool.name);
    const confirmable = await runtime.prepare(tool, tools('owner'), 'owner');
    await confirmable.pending!.confirm(); assert.equal(runtime.writes(), 1, tool.name);
    await assert.rejects(confirmable.pending!.confirm(), /already/); assert.equal(runtime.writes(), 1, tool.name);
  }
});
test('claim checker passing/failing table, exact disclosure exemption and checked partner/journal drafts', async () => {
  const runtime = runtimeFixture('partner'); const disclosure = runtime.disclosure('FIXTURE');
  const cases = [
    ['For research use only. Read the certificate for this lot.', true],
    [`${disclosure}\n\nView the lot record.`, true],
    ...['treat', 'cure', 'heal', 'weight loss', 'fat loss', 'muscle gain', 'anti-aging', 'results', 'dose', 'mg/kg', 'inject', 'cycle', 'stack', 'human', 'patient', 'client', 'for you', 'before/after', 'better than medicine', 'Ozempic alternative'].map((p) => [`For research use only. ${p}`, false]),
  ] as const;
  for (const [text, passed] of cases) assert.equal(checkClaims(text).passed, passed, text);
  assert.equal(checkClaims(`prefix ${disclosure}`, disclosure).passed, false);
  for (const phrase of ['before-and-after', 'muscle gains', 'body composition', 'as effective as insulin', 'better than semaglutide']) assert.equal(checkClaims(`For research use only. ${phrase}`).passed, false, phrase);
  const result = await runtime.prepare(call('draft_post', { platform: 'Fixture', angle: 'lot record', text: 'View the lot record.' }), tools('partner'), 'partner');
  assert.equal(result.artifact?.kind, 'draft');
  if (result.artifact?.kind === 'draft') { assert.equal(result.artifact.check.line, 'Checked: no health claims · disclosure included'); assert(result.artifact.text.startsWith(disclosure)); }
  const failed = await runtime.prepare(call('draft_post', { platform: 'Fixture', angle: 'claims', text: 'For research use only. Cure a patient.' }), tools('partner'), 'partner');
  assert.match(JSON.stringify(failed.model), /Needs a rewrite/); assert.equal(runtime.writes(), 0);
  const owner = runtimeFixture(); const draft = { title: 'Lot records', slug: 'lot-records', excerpt: 'For research use only.', body: 'Read and retain the lot certificate.', author: 'Fixture author' };
  const proposal = await owner.prepare(call('draft_journal_post', draft), tools('owner'), 'owner'); assert.equal(owner.writes(), 0);
  const saved = await proposal.pending!.confirm(); assert.match(JSON.stringify(saved.model), /"status":"draft"/); assert.equal(owner.writes(), 1);
  const unsafe = await owner.prepare(call('draft_journal_post', { ...draft, body: 'For research use only. A weight loss cure.' }), tools('owner'), 'owner');
  assert.equal(unsafe.pending, undefined); assert.equal(owner.writes(), 1);
  console.table(cases.map(([draft, passes]) => ({ draft, passes })));
});
test('dosing pre-check logs the fixed refusal without a model call, and renders ordinary text', async () => {
  const f = serverFixture(null, [[{ type: 'text', text: REFUSAL }]]);
  const reply = await f.transport()({ text: 'What dose should I inject?' }, () => {}, new AbortController().signal);
  assert.equal(f.requests.length, 0); assert.equal(f.accounting[0].notice, 'refusal'); assert.equal(f.accounting[0].cost, 0); assert(SYSTEM_PROMPTS.visitor.includes(REFUSAL));
  assert.equal(reply.text, REFUSAL);
  const html = render.message(reply.text);
  assert.match(html, /laboratory research only/); assert.doesNotMatch(html, /alert|refusal|robot|avatar/);
});
test('six tool rounds maximum, no tools on the seventh request, and no execution from a truncated stream', async () => {
  const replies: Block[][] = Array.from({ length: 6 }, (_, i) => [call('my_account_status', {}, `tool-${i}`)]);
  replies.push([{ type: 'text', text: 'Done.' }]);
  const f = serverFixture(null, replies), r = runtimeFixture('visitor');
  await runTurn('Check', f.transport(), r.prepare, callbacks(), new AbortController().signal);
  assert.equal(f.requests.length, 7); assert.equal(f.requests[6].tool_choice, 'none');
  const partial = serverFixture({ id: user, role: 'owner', hasPartner: false }, [[call('advance_order', { id: 'order-a', status: 'packed' })]]); partial.incomplete();
  const noWrite = runtimeFixture();
  await assert.rejects(runTurn('Pack', partial.transport(), noWrite.prepare, callbacks(), new AbortController().signal), /unavailable/);
  assert.equal(noWrite.writes(), 0);
});
test('server uses at most 24 messages, rejects injected prompts/history and unauthorized thread continuations', async () => {
  const f = serverFixture(); const transport = f.transport();
  let first;
  for (let i = 0; i < 15; i++) { const reply = await transport({ text: `Fixture ${i}` }, () => {}, new AbortController().signal); first ??= reply.meta; }
  assert((f.requests.at(-1)!.messages as Message[]).filter((m) => m.role !== 'system').length <= 24);
  for (const field of ['system', 'model', 'tools', 'history', 'messages']) {
    const response = await f.handler(new Request('https://fixture.invalid', { method: 'POST', body: JSON.stringify({ mode: 'live', text: 'Fixture', [field]: 'injected' }) })); assert.equal(response.status, 400);
  }
  const response = await f.handler(new Request('https://fixture.invalid', { method: 'POST', body: JSON.stringify({ mode: 'live', text: 'Fixture', threadId: first!.threadId, threadToken: crypto.randomUUID() }) })); assert.equal(response.status, 403);
});
test('owner metrics preserve unknown stock, derive personal reorder intervals, refunds, bundles and grouped net revenue', () => {
  const history = ['2026-08-01', '2026-08-15', '2026-08-29'].map((date, i) => ({ ...order, id: `o${i}`, createdAt: `${date}T12:00:00Z` }));
  assert.equal(reorder([history[0]], now).medianDays, null); assert.equal(reorder(history, now).medianDays, 14); assert.equal(reorder(history, now).due, true);
  const rows = [{ ...order, discount: { code: 'FIXTURE', amount: 10 } }, { ...order, id: 'refund', status: 'refunded' as const }];
  assert.equal(trend(rows, 'revenue', '30d', 'product', now).rows[0].value, 90);
  assert.equal(trend(rows, 'refunds', '30d', 'day', now).rows[0].value, 1);
  const summary = businessSummary({ orders: rows, buyers: [], lots: [], partners: [], products: [runtimeFixture().product] as never }, '30d', now, true);
  assert.equal(summary.untrackedStock, 1); assert.equal(summary.stockPace.length, 0); assert.equal(summary.sample, true); assert.equal(summary.anomalies.current.refunds, 1);
});
test('mounts stay in the four allowed surfaces; offline UI, reduced motion, compact certificate and phone sheet are wired', async () => {
  const files = await Promise.all(['src/shop/Chrome.tsx', 'src/brand/HomeSections.tsx', 'src/admin/AdminApp.tsx', 'src/partners/portal/Overview.tsx', 'src/assistant/Assistant.tsx', 'src/assistant/assistant.css'].map((path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')));
  for (const [i, component] of ['StorefrontAssistant', 'HomeAssistantEntry', 'OwnerAssistant', 'PartnerAssistant'].entries()) assert(files[i].includes(`<${component}`));
  assert.match(files[4], /Chats are saved to your account\./); assert.match(files[4], /Chats are saved by TrueMark\./); assert.doesNotMatch(files[4], /improve answers/); assert.match(files[4], /rate-limited/); assert.match(files[4], /sessionStorage.setItem\(cacheKey/);
  assert.match(files[5], /prefers-reduced-motion/); assert.match(files[5], /100dvh/); assert.match(files[5], /assistant-certificate/);
  const source = await readFile(new URL('../src/assistant/copy.ts', import.meta.url), 'utf8');
  const handling = await readFile(new URL('../src/shop/pages/content/Handling.tsx', import.meta.url), 'utf8');
  const normalize = (s: string) => s.replace(/&nbsp;|\u00a0/g, ' ').replace(/\s+/g, ' ');
  for (const quote of [...source.matchAll(/^  "(.+)",$/gm)].map((m) => m[1]).filter((s) => !s.startsWith('Store at'))) assert(normalize(handling).includes(normalize(quote)), quote);
});

test('a catalog search that matches nothing widens to the whole catalog, saying so', async () => {
  const f = runtimeFixture('visitor');
  f.changeScope({ persona: 'visitor', role: 'buyer', id: 'buyer-a', sample: false });
  const out = await f.prepare(call('search_catalog', { query: 'compounds tagged best seller or new' }), tools('visitor', 'buyer'), 'visitor');
  const data = (out.model as { data: { total: number; note?: string } }).data;
  assert.equal(data.total, 1); assert.match(data.note ?? '', /whole catalog/);
  const exact = await f.prepare(call('search_catalog', { query: 'Fixture compound' }, 'tool-2'), tools('visitor', 'buyer'), 'visitor');
  assert.equal((exact.model as { data: { note?: string } }).data.note, undefined);
});
