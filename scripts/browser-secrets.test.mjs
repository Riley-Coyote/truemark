import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertBrowserArtifact } from './lib/browser-secrets.mjs';

test('artifact audit rejects messaging, shipping and server secrets without echoing matches', () => {
  for (const marker of ['RESEND_API_KEY', 'OMNISEND_API_KEY', 'TWILIO_AUTH_TOKEN', 'TWILIO_ACCOUNT_SID',
    'SHIPSTATION_API_KEY', 'SHIPSTATION_API_SECRET', 'SHIPPING_WEBHOOK_KEY', 'SHIPPING_SIM_SECRET',
    'PAYMENTS_SIM_SECRET', 'FUNCTIONS_KEY', 'OPENROUTER_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    '-----BEGIN PRIVATE KEY-----']) {
    const content = JSON.stringify({ [marker]: 'fixture-sensitive-value' });
    assert.throws(() => assertBrowserArtifact(content), error =>
      error.message.includes('contents withheld') && !error.message.includes(marker) && !error.message.includes('fixture-sensitive-value'));
  }
});

test('artifact audit distinguishes public Supabase configuration from privileged JWTs', () => {
  const jwt = role => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.fixture';
  assert.doesNotThrow(() => assertBrowserArtifact(JSON.stringify({ url: 'https://fixture.test', key: 'sb_publishable_fixture', anon: jwt('anon') })));
  assert.throws(() => assertBrowserArtifact(jwt('service_role')), /privileged token/);
  assert.throws(() => assertBrowserArtifact('sb_secret_' + 'f'.repeat(24)), /contents withheld/);
});
