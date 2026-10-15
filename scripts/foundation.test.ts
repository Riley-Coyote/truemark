/** Round 12 foundation: the shared server helpers. Node only; no network. Run: npx tsx --test scripts/foundation.test.ts */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { route, body, isUuid } from '../supabase/functions/_shared/http.ts';
import { createDb, DbError, presentable } from '../supabase/functions/_shared/db.ts';
import { identify } from '../supabase/functions/_shared/identity.ts';
import { hasFunctionsKey, safeEqual, signedHeader, verifySignedHeader, sha256Hex } from '../supabase/functions/_shared/signing.ts';
import { readConnection, reportStatus } from '../supabase/functions/_shared/connections.ts';

globalThis.fetch = async () => { throw new Error('External network forbidden in foundation tests'); };

test('route reads the path after the function name, hosted or local', () => {
  assert.equal(route(new Request('http://x/functions/v1/payments/start'), 'payments'), '/start');
  assert.equal(route(new Request('http://x/payments/webhook?x=1'), 'payments'), '/webhook');
  assert.equal(route(new Request('http://x/functions/v1/payments'), 'payments'), '/');
  assert.equal(route(new Request('http://x/functions/v1/payments-old/start'), 'payments'), '/');
});

test('body accepts objects only and refuses oversize payloads', async () => {
  assert.deepEqual(await body(new Request('http://x', { method: 'POST', body: '{"a":1}' })), { a: 1 });
  await assert.rejects(body(new Request('http://x', { method: 'POST', body: '[1]' })), SyntaxError);
  await assert.rejects(body(new Request('http://x', { method: 'POST', body: 'x'.repeat(70_000) })), RangeError);
  assert.ok(isUuid('0b9c3f5e-2a4d-4c1e-9f3a-1b2c3d4e5f60'));
  assert.ok(!isUuid('0b9c3f5e'));
});

test('signed webhooks verify, and refuse tampering, staleness and malformed headers', async () => {
  const secret = 'whsec_fixture_only_0123456789abcdef';
  const now = Date.UTC(2026, 9, 5, 8, 0, 0);
  const payload = '{"id":"evt_1","type":"payment.succeeded"}';
  const header = await signedHeader(secret, payload, now);
  assert.match(header, /^t=\d+,v1=[0-9a-f]{64}$/);
  assert.equal(await verifySignedHeader(header, payload, secret, now), true);
  assert.equal(await verifySignedHeader(header, payload.replace('succeeded', 'failed'), secret, now), false);
  assert.equal(await verifySignedHeader(header, payload, 'other-secret', now), false);
  assert.equal(await verifySignedHeader(header, payload, secret, now + 301_000), false);
  assert.equal(await verifySignedHeader('t=1,v1=zz', payload, secret, now), false);
  assert.equal(await verifySignedHeader(null, payload, secret, now), false);
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('the functions key is compared in constant time and must be long', () => {
  const key = 'k'.repeat(48);
  assert.ok(safeEqual('abc', 'abc'));
  assert.ok(!safeEqual('abc', 'abd'));
  assert.ok(!safeEqual('abc', 'abcd'));
  assert.ok(hasFunctionsKey(new Request('http://x', { headers: { 'x-functions-key': key } }), key));
  assert.ok(!hasFunctionsKey(new Request('http://x', { headers: { 'x-functions-key': 'nope' } }), key));
  assert.ok(!hasFunctionsKey(new Request('http://x', { headers: { 'x-functions-key': 'short' } }), 'short'));
  assert.ok(!hasFunctionsKey(new Request('http://x'), ''));
});

function fakeFetch(routes: Record<string, (init?: RequestInit) => Response>) {
  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    for (const [prefix, respond] of Object.entries(routes)) if (url.includes(prefix)) return respond(init);
    return new Response('{"message":"missing fixture"}', { status: 404 });
  }) as typeof fetch;
  return { fetcher, calls };
}

test('database errors keep intended messages and hide the rest', async () => {
  const { fetcher } = fakeFetch({
    'rpc/place_order': () => new Response('{"code":"22023","message":"Only 2 left of BPC-157"}', { status: 400 }),
    'rpc/other': () => new Response('{"code":"XX000","message":"internal detail"}', { status: 500 }),
  });
  const db = createDb('https://db.fixture', 'service-fixture', fetcher);
  await assert.rejects(db.rpc('place_order'), (error: unknown) => error instanceof DbError && error.code === '22023');
  try { await db.rpc('place_order'); } catch (error) { assert.equal(presentable(error, 'fallback'), 'Only 2 left of BPC-157'); }
  try { await db.rpc('other'); } catch (error) { assert.equal(presentable(error, 'fallback'), 'fallback'); }
});

test('identify trusts the profile role, never token metadata, and refuses the service key as a caller', async () => {
  const user = '11111111-2222-4333-8444-555555555555';
  const { fetcher } = fakeFetch({
    '/auth/v1/user': () => new Response(JSON.stringify({ id: user, email: 'buyer@fixture.test', user_metadata: { role: 'owner' } })),
    'profiles?id=eq.': () => new Response(JSON.stringify([{ role: 'buyer' }])),
  });
  const db = createDb('https://db.fixture', 'service-fixture', fetcher);
  const caller = await identify(new Request('http://x', { headers: { authorization: 'Bearer user-token' } }), 'https://db.fixture', 'service-fixture', db, fetcher);
  assert.deepEqual(caller, { id: user, email: 'buyer@fixture.test', role: 'buyer' });
  assert.equal(await identify(new Request('http://x', { headers: { authorization: 'Bearer service-fixture' } }), 'https://db.fixture', 'service-fixture', db, fetcher), null);
  assert.equal(await identify(new Request('http://x'), 'https://db.fixture', 'service-fixture', db, fetcher), null);
});

test('a missing connection reads as off, and status reporting never throws', async () => {
  const { fetcher } = fakeFetch({
    'connections?id=eq.email': () => new Response('[]'),
    'rpc/system_connection_status': () => new Response('{"message":"down"}', { status: 503 }),
  });
  const db = createDb('https://db.fixture', 'service-fixture', fetcher);
  assert.deepEqual(await readConnection(db, 'email'), { id: 'email', mode: 'off', provider: '' });
  await reportStatus(db, 'email', false, 'x');
});
