import assert from 'node:assert/strict';

// Inspect generated public files only; never print a matching value.
const serverMarkers = /OPENROUTER_API_KEY|ASSISTANT_API_KEY|ASSISTANT_BASE_URL|ANTHROPIC_API_KEY|SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|OMNISEND_API_KEY|TWILIO_AUTH_TOKEN|TWILIO_ACCOUNT_SID|SHIPSTATION_API_KEY|SHIPSTATION_API_SECRET|SHIPPING_WEBHOOK_KEY|SHIPPING_SIM_SECRET|PAYMENTS_SIM_SECRET|FUNCTIONS_KEY|api\.anthropic\.com|openrouter\.ai\/api\/v1\/chat|sk-(?:ant|or)-[\w-]{16,}|sb_secret_[\w-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;

export function assertBrowserArtifact(source) {
  assert(!serverMarkers.test(source), 'A server-only credential marker reached a public artifact; contents withheld.');
  assert(!source.includes("You are the TrueMark owner's agent"), 'Server prompt reached a public artifact.');
  for (const match of source.matchAll(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g)) {
    let payload; try { payload = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString()); } catch { continue; }
    assert(payload.role !== 'service_role', 'A privileged token reached a public artifact; contents withheld.');
  }
}
