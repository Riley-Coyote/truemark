import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { transform } from 'esbuild';

const source = await readFile(new URL('../src/platform/random-uuid.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'iife' });
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('a plain-http page, without crypto.randomUUID, gets version 4 UUIDs from getRandomValues', () => {
  // Browsers leave randomUUID out on insecure origins (the demo over Wi-Fi); getRandomValues is always there.
  const crypto = { getRandomValues: (bytes) => webcrypto.getRandomValues(bytes) };
  runInNewContext(code, { crypto });
  assert.equal(typeof crypto.randomUUID, 'function');
  const ids = new Set(Array.from({ length: 200 }, () => crypto.randomUUID()));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.match(id, V4);
});

test('a secure page keeps the browser’s own randomUUID', () => {
  const own = () => '00000000-0000-4000-8000-000000000000';
  const crypto = { getRandomValues: (bytes) => webcrypto.getRandomValues(bytes), randomUUID: own };
  runInNewContext(code, { crypto });
  assert.equal(crypto.randomUUID, own);
});
