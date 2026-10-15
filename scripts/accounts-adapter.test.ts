import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createLiveAdapter } from '../src/platform/live/adapter.ts';
import type { ApplicationForm } from '../src/platform/live/adapter.ts';
import { LINK_ELSEWHERE, RESET_SENT, passwordProblem, recoveryPath, suggestPartnerCode } from '../src/platform/accounts.ts';
import type { PartnerApplicationDraft, Profile, RecoveryGate } from '../src/platform/accounts.ts';
import * as map from '../src/platform/live/rows.ts';

const draft: PartnerApplicationDraft = { name: 'Fixture Jordan', email: 'fixture@example.test', channel: 'https://fixture.example/channel', otherChannels: ['https://fixture.example/other'], audience: 'Fixture researchers', feature: 'Fixture certificate walkthrough.', commitments: ['research-only', 'no-claims'] };
const application = { id: 'application-id', user_id: 'user-id', name: draft.name, email: draft.email, channel: draft.channel, other_channels: draft.otherChannels, audience: draft.audience, feature: draft.feature, commitments: draft.commitments, status: 'submitted', submitted_at: '2026-10-01T12:00:00Z' };
const researchDraft: ApplicationForm = { name: 'Fixture Researcher', email: 'researcher@example.test', role: 'Researcher', institution: 'Fixture Lab', institutionType: 'Laboratory', researchArea: 'Assays', intendedUse: 'Laboratory assay development.', attestations: ['research-only'], documents: [] };
function fixture(storage = new Map<string, string>()) {
  const calls: { name: string; args: unknown }[] = [];
  const tables: Record<string, map.Row[]> = { profiles: [{ id: 'user-id', role: 'buyer' }], partner_applications: [application], buyers: [], partners: [] };
  let error: { message: string; status?: number; code?: string } | null = null;
  let session: Session | null = { user: { id: 'user-id', email: draft.email } } as Session;
  let rpcResult: unknown = application;
  let signOut = async (): Promise<{ error: { message: string } | null }> => ({ error: null });
  let changes = 0, cleaned = 0;
  const routes: RecoveryGate[] = [];
  const client = {
    from(table: string) {
      const filters: Record<string, string> = {}; let start = 0, end = 999;
      const query = {
        select() { calls.push({ name: `select:${table}`, args: filters }); return query; },
        eq(key: string, value: string) { filters[key] = value; return query; }, order() { return query; },
        range(a: number, b: number) { start = a; end = b; return query; }, returns() { return query; },
        then(resolve: (value: unknown) => void) { return Promise.resolve({ data: (tables[table] ?? []).filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value)).slice(start, end + 1), error: null }).then(resolve); },
      }; return query;
    },
    auth: {
      async getSession() { return { data: { session }, error: null }; },
      async resetPasswordForEmail(email: string, options: unknown) { calls.push({ name: 'reset', args: { email, options } }); return { error }; },
      async updateUser(args: unknown) { calls.push({ name: 'updateUser', args }); return { data: { user: session?.user }, error }; },
      async signUp(args: unknown) { calls.push({ name: 'signUp', args }); return { data: { session }, error }; },
      async signInWithPassword(args: unknown) { calls.push({ name: 'signIn', args }); return { data: { session }, error }; },
      async signOut() { calls.push({ name: 'signOut', args: undefined }); const result = await signOut(); if (!result.error) session = null; return result; },
    },
    async rpc(name: string, args: unknown) { calls.push({ name, args }); return { data: rpcResult, error }; },
  };
  const adapter = createLiveAdapter(client as unknown as SupabaseClient, {
    redirectTo: () => 'https://fixture.example/live/', changed: () => changes++, onPasswordSaved: () => cleaned++, onRecovery: (gate) => routes.push(gate),
    recoveryStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); }, removeItem: (key) => { storage.delete(key); } },
  });
  return { adapter, calls, tables, routes, storage, changes: () => changes, cleaned: () => cleaned,
    setSignOut: (value: typeof signOut) => { signOut = value; },
    event: (event: Parameters<typeof adapter.auth.onAuthStateChange>[0]) => adapter.auth.onAuthStateChange(event, session),
    setError: (value: typeof error) => { error = value; }, setSession: (value: Session | null) => { session = value; }, setRpc: (value: unknown) => { rpcResult = value; } };
}

test('reset never reveals an account: success, unknown email, Auth failures and email-confirmation states share one message', async () => {
  const f = fixture();
  for (const error of [null, { message: 'User not found', status: 400 }, { message: 'Email not confirmed' }, { message: 'Network unavailable', status: 0 }]) {
    f.setError(error);
    assert.equal(await f.adapter.auth.requestPasswordReset(' unknown@example.test ', 'team'), RESET_SENT);
  }
  assert.deepEqual(f.calls.filter((call) => call.name === 'reset'), Array(4).fill({ name: 'reset', args: { email: 'unknown@example.test', options: { redirectTo: 'https://fixture.example/live/' } } }));
  assert.equal(f.storage.get('tm-live-recovery-gate'), 'team');
  assert.equal(f.adapter.auth.recovery(), null);
});

test('reset displays the rate-limit message plainly; it never turns into a false success', async () => {
  const f = fixture();
  for (const error of [{ status: 429, message: 'For security purposes, you can only request this after 60 seconds.' }, { code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' }]) {
    f.setError(error);
    await assert.rejects(f.adapter.auth.requestPasswordReset(draft.email, 'shop'), { message: error.message });
  }
});

test('PASSWORD_RECOVERY is synchronous, remembered before rendering, and delivered in the requesting gate', async () => {
  for (const gate of ['shop', 'partner', 'team'] as const) {
    const f = fixture(); await f.adapter.auth.requestPasswordReset(draft.email, gate);
    const returned = fixture(f.storage); let events = 0;
    const off = returned.adapter.auth.subscribeRecovery(() => events++);
    assert.equal(returned.event('PASSWORD_RECOVERY'), undefined, 'No Auth call is awaited inside the event callback');
    assert.deepEqual(returned.adapter.auth.recovery(), { userId: 'user-id', email: draft.email, gate });
    assert.deepEqual(returned.routes, [gate]); assert.equal(events, 1);
    assert.equal(recoveryPath(gate), gate === 'team' ? '/admin' : gate === 'partner' ? '/partners/sign-in' : '/access');
    off(); returned.event('SIGNED_OUT'); assert.equal(events, 1);
    assert.equal(returned.adapter.auth.recovery(), null); assert(!returned.storage.has('tm-live-recovery-user'));
  }
});

test('a reload resumes only this recovery user; ordinary initial sessions cannot open recovery', async () => {
  const f = fixture(); f.event('PASSWORD_RECOVERY');
  const returned = fixture(f.storage); returned.event('INITIAL_SESSION');
  assert.equal(returned.adapter.auth.recovery()?.userId, 'user-id');
  const normal = fixture(); normal.event('INITIAL_SESSION'); assert.equal(normal.adapter.auth.recovery(), null);
  normal.setSession(null); normal.event('INITIAL_SESSION'); assert.equal(normal.adapter.auth.recovery(), null);
  returned.setSession({ user: { id: 'other-user' } } as Session); returned.event('SIGNED_IN');
  assert.equal(returned.adapter.auth.recovery(), null);
  await assert.rejects(returned.adapter.auth.setNewPassword('new-password-123', 'new-password-123'), /Open your reset link/);
});

for (const [role, path] of [['owner', '/admin'], ['staff', '/admin'], ['partner', '/partners/app'], ['buyer', '/account']] as [Profile['role'], string][]) {
  test(`password recovery updates once, cleans the code and lands ${role} at ${path}`, async () => {
    const f = fixture(); f.tables.profiles[0].role = role; f.event('PASSWORD_RECOVERY');
    if (role === 'buyer') f.tables.partner_applications = [];
    assert.equal(await f.adapter.auth.setNewPassword('new-password-123', 'new-password-123'), path);
    assert.deepEqual(f.calls.filter((call) => call.name === 'updateUser'), [{ name: 'updateUser', args: { password: 'new-password-123' } }]);
    assert.equal(f.adapter.auth.recovery(), null); assert.equal(f.cleaned(), 1); assert.equal(f.changes(), 1);
    assert(!f.storage.has('tm-live-recovery-user')); assert(!f.storage.has('tm-live-recovery-gate'));
  });
}

for (const status of ['submitted', 'declined']) {
  test(`a ${status} partner applicant recovers into the portal despite a buyer profile`, async () => {
    const f = fixture(); f.tables.partner_applications = [{ ...application, status }];
    await f.adapter.auth.requestPasswordReset(draft.email, 'shop');
    f.event('PASSWORD_RECOVERY');
    assert.equal(await f.adapter.auth.setNewPassword('new-password-123', 'new-password-123'), '/partners/app');
    assert.deepEqual(f.calls.find((call) => call.name === 'select:partner_applications')?.args, { user_id: 'user-id' });
    assert.equal(f.adapter.auth.recovery(), null); assert.equal(f.cleaned(), 1);
  });
}

test('a buyer never follows another user\'s partner application after recovery', async () => {
  const f = fixture(); f.tables.partner_applications = [{ ...application, user_id: 'other-user' }];
  await f.adapter.auth.requestPasswordReset(draft.email, 'partner'); f.event('PASSWORD_RECOVERY');
  assert.equal(await f.adapter.auth.setNewPassword('new-password-123', 'new-password-123'), '/account');
});

test('new passwords require 10 characters, confirmation, and a recovery session; failed updates are retryable', async () => {
  const f = fixture(); f.event('PASSWORD_RECOVERY');
  await assert.rejects(f.adapter.auth.setNewPassword('123456789', '123456789'), /at least 10/);
  await assert.rejects(f.adapter.auth.setNewPassword('1234567890', 'different password'), /don't match/);
  assert.equal(f.calls.filter((call) => call.name === 'updateUser').length, 0);
  f.setError({ message: 'New password should be different from the old password.' });
  await assert.rejects(f.adapter.auth.setNewPassword('1234567890', '1234567890'), /different from the old/);
  assert(f.adapter.auth.recovery()); assert.equal(f.cleaned(), 0);
  f.setError(null); await f.adapter.auth.setNewPassword('a new password', 'a new password');
  const normal = fixture(); await assert.rejects(normal.adapter.auth.setNewPassword('1234567890', '1234567890'), /reset link/);
  assert.equal(passwordProblem('1234567890'), undefined);
});

test('partner signup sends exactly the application contract and handles email confirmation on and off', async () => {
  const f = fixture();
  assert.deepEqual(await f.adapter.auth.signUpPartner(draft, '1234567890'), { confirmationRequired: false });
  f.setSession(null);
  assert.deepEqual(await f.adapter.auth.signUpPartner(draft, '1234567890'), { confirmationRequired: true });
  const { email, ...partner_application } = draft;
  assert.deepEqual(f.calls.filter((call) => call.name === 'signUp'), Array(2).fill({ name: 'signUp', args: { email, password: '1234567890', options: { emailRedirectTo: 'https://fixture.example/live/', data: { partner_application } } } }));
  assert.equal(f.calls.some((call) => /buyers|applications/.test(call.name)), false, 'Auth trigger creates the rows');
  await assert.rejects(f.adapter.auth.signUpPartner(draft, 'short'), /at least 10/);
  f.setError({ message: 'Signup could not be completed.' }); await assert.rejects(f.adapter.auth.signUpPartner(draft, '1234567890'), /Signup could not/);
});

const signupFlows = {
  research: (f: ReturnType<typeof fixture>) => f.adapter.auth.signUp(researchDraft, '1234567890'),
  partner: (f: ReturnType<typeof fixture>) => f.adapter.auth.signUpPartner(draft, '1234567890'),
};
for (const [kind, signup] of Object.entries(signupFlows)) {
  test(`${kind} signup signs out only a returned session and clears cached account data`, async () => {
    for (const confirmationRequired of [false, true]) {
      const f = fixture();
      if (confirmationRequired) f.setSession(null);
      f.tables.notifications = [{ id: 'notice', audience: 'owner', kind: 'order.placed', at: application.submitted_at, read: false }];
      if (!confirmationRequired) await f.adapter.notices.load('owner');
      assert.deepEqual(await signup(f), { confirmationRequired });
      assert.deepEqual(f.calls.filter((call) => ['signUp', 'signOut'].includes(call.name)).map((call) => call.name), confirmationRequired ? ['signUp'] : ['signUp', 'signOut']);
      assert.equal(await f.adapter.auth.profile(), null);
      assert.deepEqual(f.adapter.notices.list('owner'), []);
    }
    const failed = fixture(); failed.setError({ message: 'Signup could not be completed.' });
    await assert.rejects(signup(failed), /Signup could not/);
    assert.equal(failed.calls.some((call) => call.name === 'signOut'), false);
  });

  test(`${kind} signup waits for sign-out and does not report success if it fails`, async () => {
    const f = fixture();
    let finish!: (value: { error: { message: string } | null }) => void;
    const pending = new Promise<{ error: { message: string } | null }>((resolve) => { finish = resolve; });
    f.setSignOut(() => pending);
    let settled = false;
    const receipt = signup(f).then((result) => { settled = true; return result; });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(f.calls.map((call) => call.name), ['signUp', 'signOut']);
    assert.equal(settled, false);
    finish({ error: null });
    assert.deepEqual(await receipt, { confirmationRequired: false });
    assert.equal(await f.adapter.auth.profile(), null);
    const failed = fixture(); failed.setSignOut(async () => ({ error: { message: 'Sign-out could not be completed.' } }));
    await assert.rejects(signup(failed), /Sign-out could not/);
    assert.equal(failed.changes(), 0);
  });
}

test('pending, declined and approved applicants read their own application; pending applicants have no buyer session', async () => {
  const f = fixture();
  for (const status of ['submitted', 'declined', 'approved']) {
    f.tables.partner_applications = [{ ...application, status }];
    assert.equal((await f.adapter.partnerApplications.mine())?.status, status);
    assert.equal(await f.adapter.store.session.get(), null);
  }
  assert.deepEqual(f.calls.find((call) => call.name === 'select:partner_applications')?.args, { user_id: 'user-id' });
  f.setSession(null); assert.equal(await f.adapter.partnerApplications.mine(), null);
});

test('review is RPC-only, preserves fractions/percentages and server failure messages, and maps audit data', async () => {
  const f = fixture();
  const reviewed = { ...application, status: 'approved', reviewed_at: '2026-10-02T12:00:00Z', reviewed_by: 'reviewer', partner_id: 'partner-id', approved_code: 'JORDAN10', approved_rate: '0.1', approved_percent: '10' };
  f.setRpc(reviewed);
  const result = await f.adapter.partnerApplications.approve(application.id, ' jordan10 ', .1, 10);
  assert.equal(result.approvedRate, .1); assert.equal(result.approvedPercent, 10); assert.equal(result.reviewedBy, 'reviewer');
  assert.deepEqual(f.calls[0], { name: 'approve_partner_application', args: { id: application.id, code: 'JORDAN10', rate: .1, percent: 10 } });
  f.setRpc({ ...application, status: 'declined', review_note: 'Fixture reason' });
  assert.equal((await f.adapter.partnerApplications.decline(application.id, ' Fixture reason ')).reviewNote, 'Fixture reason');
  assert.deepEqual(f.calls[1], { name: 'decline_partner_application', args: { id: application.id, note: 'Fixture reason' } });
  for (const message of ['Team access required.', 'That code is already in use. Choose another code.']) {
    f.setError({ message }); await assert.rejects(f.adapter.partnerApplications.approve(application.id, 'JORDAN10', .1, 10), { message });
    await assert.rejects(f.adapter.partnerApplications.decline(application.id, 'Fixture reason'), { message });
  }
  assert.equal(f.changes(), 2);
  assert.equal(suggestPartnerCode('Jordan Vale'), 'JORDAN10');
  assert.equal(suggestPartnerCode('  Éva Example '), 'EVA10');
  assert.equal(map.notice({ kind: 'partner.welcome', audience: 'partner:id', read: false })?.kind, 'partner.welcome');
});

test('an expired PKCE link opens a retryable reset request, never a password editor or account-existence error', async () => {
  const f = fixture();
  await f.adapter.auth.requestPasswordReset(draft.email, 'team');
  f.adapter.auth.recoveryFailed();
  assert.equal(f.adapter.auth.recovery()?.userId, '');
  assert.match(f.adapter.auth.recovery()?.error ?? '', /Request a new reset link/);
  f.setSession(null); f.event('INITIAL_SESSION');
  assert.match(f.adapter.auth.recovery()?.error ?? '', /Request a new reset link/);
  assert.deepEqual(f.routes, ['team']);
  await assert.rejects(f.adapter.auth.setNewPassword('1234567890', '1234567890'), /Open your reset link/);
  assert.equal(f.calls.some((call) => call.name === 'updateUser'), false);
  assert.equal(await f.adapter.auth.requestPasswordReset(draft.email, 'team'), RESET_SENT);
  f.adapter.auth.dismissRecoveryError(); assert.equal(f.adapter.auth.recovery(), null);
});

test('a link opened in another browser says so, and still offers a fresh request', async () => {
  const f = fixture();
  f.adapter.auth.recoveryFailed('elsewhere');
  assert.equal(f.adapter.auth.recovery()?.userId, '');
  assert.equal(f.adapter.auth.recovery()?.error, LINK_ELSEWHERE);
  assert.equal(f.calls.some((call) => call.name === 'updateUser'), false);
  assert.equal(await f.adapter.auth.requestPasswordReset(draft.email, 'shop'), RESET_SENT);
});
