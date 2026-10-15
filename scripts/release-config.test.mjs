import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateLiveConfig } from './lib/release-config.mjs';
const valid = () => ({ VITE_REVIEW_SUPABASE_URL: 'https://project.supabase.co', VITE_REVIEW_SUPABASE_ANON_KEY: 'sb_publishable_fixture' });
test('live builds require a public configuration and refuse server keys without printing them', () => {
  assert.throws(() => validateLiveConfig({}), /public Supabase project URL/);
  for (const key of ['', 'sb_secret_never-print-this', 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from('{"role":"service_role"}').toString('base64url') + '.signature']) {
    assert.throws(() => validateLiveConfig({ ...valid(), VITE_REVIEW_SUPABASE_ANON_KEY: key }), (error) => error.message.includes('public Supabase publishable/anon key') && !error.message.includes('never-print-this'));
  }
  validateLiveConfig(valid());
  validateLiveConfig({ ...valid(), VITE_REVIEW_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from('{"role":"anon"}').toString('base64url') + '.signature' });
});
test('search indexing cannot accidentally point the launch site at the review host', () => {
  assert.throws(() => validateLiveConfig({ ...valid(), VITE_INDEX: '1' }), /confirmed production origin/);
  assert.throws(() => validateLiveConfig({ ...valid(), VITE_SITE_ORIGIN: 'https://example.test/path' }), /without a path/);
  const config = { ...valid(), VITE_SITE_ORIGIN: 'https://example.test/', VITE_INDEX: '1' };
  validateLiveConfig(config);
  assert.equal(config.VITE_SITE_ORIGIN, 'https://example.test');
});
