import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createLiveAdapter } from '../src/platform/live/adapter.ts';
import { INVITE_UNAVAILABLE, teamInviteLink } from '../src/platform/team.ts';

const token = 'ab'.repeat(32);
const invitation = { email: 'invited@fixture.example', role: 'staff', expiresAt: '2026-10-08T00:00:00Z' };
function fixture() {
  const calls: { name: string; args?: unknown }[] = [];
  let session: Session | null = null;
  let returnedSession: Session | null = { user: { id: 'invited-user', email: invitation.email } } as Session;
  let profileRole = 'staff', changes = 0;
  let failure: string | null = null;
  const errors: Record<string, string> = {};
  const responses: Record<string, unknown> = {
    team_members: [{ user_id: 'owner-user', email: 'owner@fixture.example', role: 'owner', joined_at: '2026-01-01T00:00:00Z', last_sign_in_at: null }],
    team_invites: [{ id: 'invite-id', email: invitation.email, role: 'staff', expires_at: invitation.expiresAt }],
    team_invite_preview: invitation, create_team_invite: token, revoke_team_invite: true, accept_team_invite: 'staff', set_team_role: 'staff',
  };
  const error = (name = '') => errors[name] || failure ? { message: errors[name] || failure! } : null;
  const client = {
    auth: {
      async getSession() { calls.push({ name: 'getSession' }); return { data: { session }, error: error() }; },
      async signUp(args: unknown) { calls.push({ name: 'signUp', args }); if (!failure) session = returnedSession; return { data: { session: returnedSession }, error: error('signUp') }; },
      async signInWithPassword(args: unknown) { calls.push({ name: 'signIn', args }); if (!failure) session = returnedSession; return { data: { session: returnedSession }, error: error('signIn') }; },
      async signOut() { calls.push({ name: 'signOut' }); session = null; return { error: error() }; },
    },
    from(table: string) {
      const query = { select() { return query; }, eq() { return query; }, order() { return query; }, range() { return query; },
        async returns() { assert.equal(table, 'profiles'); return { data: [{ id: 'invited-user', role: profileRole }], error: error() }; } };
      return query;
    },
    async rpc(name: string, args: unknown) { calls.push({ name, args }); return { data: responses[name], error: error(name) }; },
  };
  const adapter = createLiveAdapter(client as unknown as SupabaseClient, { changed: () => changes++, redirectTo: () => 'https://fixture.example/live/' });
  return { adapter, calls, responses, errors, changes: () => changes,
    fail: (value: string | null) => { failure = value; }, role: (value: string) => { profileRole = value; },
    signedIn: (email = invitation.email) => { session = { user: { id: 'invited-user', email } } as Session; },
    confirmation: () => { returnedSession = null; },
  };
}

test('team reads use redacted RPCs, map authoritative dates and preserve nullable last sign-in', async () => {
  const f = fixture();
  assert.deepEqual(await f.adapter.team.members(), [{ id: 'owner-user', email: 'owner@fixture.example', role: 'owner', joinedAt: '2026-01-01T00:00:00Z', lastSignInAt: null }]);
  assert.deepEqual(await f.adapter.team.invites(), [{ id: 'invite-id', ...invitation }]);
  assert.deepEqual(await f.adapter.team.previewInvite(token), invitation);
  f.responses.team_invite_preview = null;
  assert.equal(await f.adapter.team.previewInvite('unknown'), null);
  assert.equal(f.changes(), 0);
  assert.deepEqual(f.calls.map((c) => c.name), ['team_members', 'team_invites', 'team_invite_preview', 'team_invite_preview']);
});

test('owner team writes use explicit RPC arguments, return server results and refresh resources only after success', async () => {
  const f = fixture();
  assert.equal(await f.adapter.team.createInvite(' Invited@Fixture.Example ', 'staff'), token);
  assert.equal(await f.adapter.team.revokeInvite('invite-id'), true);
  assert.equal(await f.adapter.team.setRole('member-id', 'staff'), 'staff');
  f.responses.set_team_role = 'buyer';
  assert.equal(await f.adapter.team.setRole('member-id', 'buyer'), 'buyer');
  assert.deepEqual(f.calls, [
    { name: 'create_team_invite', args: { email: invitation.email, role: 'staff' } },
    { name: 'revoke_team_invite', args: { invite_id: 'invite-id' } },
    { name: 'set_team_role', args: { user_id: 'member-id', role: 'staff' } },
    { name: 'set_team_role', args: { user_id: 'member-id', role: 'buyer' } },
  ]);
  assert.equal(f.changes(), 4);
});

test('every team RPC propagates denied access and transport failures without pretending a save succeeded', async () => {
  const f = fixture(); f.fail('Owner access required.');
  for (const call of [() => f.adapter.team.members(), () => f.adapter.team.invites(), () => f.adapter.team.previewInvite(token),
    () => f.adapter.team.createInvite(invitation.email, 'owner'), () => f.adapter.team.revokeInvite('invite-id'),
    () => f.adapter.team.setRole('owner-id', 'buyer'), () => f.adapter.team.acceptInvite(token)]) {
    await assert.rejects(call, /Owner access required/);
  }
  assert.equal(f.changes(), 0);
});

test('team signup locks email to the server invite, sends only the token metadata and uses the hash-free PKCE redirect', async () => {
  const f = fixture();
  assert.deepEqual(await f.adapter.team.signUp(token, 'new password 123'), { confirmationRequired: false });
  assert.deepEqual(f.calls.find((c) => c.name === 'signUp'), { name: 'signUp', args: { email: invitation.email, password: 'new password 123',
    options: { data: { team_invite: token }, emailRedirectTo: 'https://fixture.example/live/' } } });
  assert.equal(f.calls.filter((c) => c.name === 'signOut').length, 0, 'Unlike applications, an accepted team signup enters the command center');
  assert.equal(f.calls.filter((c) => c.name === 'accept_team_invite').length, 0, 'The trigger already consumed this token');
  assert.equal(f.changes(), 1);
});

test('team signup with confirmation on reports confirmation instead of requiring a session or accepting twice', async () => {
  const f = fixture(); f.confirmation();
  assert.deepEqual(await f.adapter.team.signUp(token, 'new password 123'), { confirmationRequired: true });
  assert.equal(f.calls.filter((c) => c.name === 'getSession').length, 1);
  assert(!f.calls.some((c) => c.name === 'accept_team_invite' || c.name === 'signOut'));
});

test('short passwords, invalid invites, active accounts and races cannot produce a false team signup success', async () => {
  const short = fixture();
  await assert.rejects(short.adapter.team.signUp(token, '123456789'), /at least 10/); assert.equal(short.calls.length, 0);
  const bad = fixture(); bad.responses.team_invite_preview = null;
  await assert.rejects(bad.adapter.team.signUp(token, 'new password 123'), { message: INVITE_UNAVAILABLE });
  assert(!bad.calls.some((c) => c.name === 'signUp'));
  const signedIn = fixture(); signedIn.signedIn('other@fixture.example');
  await assert.rejects(signedIn.adapter.team.signUp(token, 'new password 123'), /Sign out/);
  assert(!signedIn.calls.some((c) => c.name === 'signUp'));
  const raced = fixture(); raced.role('buyer');
  await assert.rejects(raced.adapter.team.signUp(token, 'new password 123'), { message: INVITE_UNAVAILABLE });
  assert(!raced.calls.some((c) => c.name === 'accept_team_invite'));
});

test('existing accounts sign in with the locked email before accepting as themselves, with no role or target-user argument', async () => {
  const f = fixture();
  assert.equal(await f.adapter.team.signIn(token, 'current password'), 'staff');
  assert.deepEqual(f.calls, [
    { name: 'team_invite_preview', args: { token } },
    { name: 'signIn', args: { email: invitation.email, password: 'current password' } },
    { name: 'accept_team_invite', args: { token } },
  ]);
  assert.equal(f.changes(), 1);
});

test('invalid existing-account invites stop before sign-in; signed-in acceptance checks the server and keeps refusal messages', async () => {
  const f = fixture(); f.responses.team_invite_preview = null;
  await assert.rejects(f.adapter.team.signIn(token, 'current password'), { message: INVITE_UNAVAILABLE });
  assert(!f.calls.some((c) => c.name === 'signIn'));
  f.fail('Sign in with the email this invitation was sent to.');
  await assert.rejects(f.adapter.team.acceptInvite(token), /email this invitation/);
  assert.equal(f.changes(), 0);
  f.fail('Keep at least one owner on the team.');
  await assert.rejects(f.adapter.team.setRole('owner-id', 'buyer'), /at least one owner/);
});

test('acceptance account identity handles anonymous sessions and keeps invite links on the running deployment', async () => {
  const f = fixture(); assert.equal(await f.adapter.team.account(), null);
  f.signedIn(); assert.deepEqual(await f.adapter.team.account(), { id: 'invited-user', email: invitation.email });
  assert.equal(teamInviteLink('https://fixture.example/live/?unused=1#/admin', token), `https://fixture.example/live/#/access/team?invite=${token}`);
  assert.equal(teamInviteLink('http://127.0.0.1:5174/', token), `http://127.0.0.1:5174/#/access/team?invite=${token}`);
});


test('Auth and post-sign-in RPC failures remain visible; neither failure accepts or grants a role locally', async () => {
  const signin = fixture(); signin.errors.signIn = 'Invalid login credentials';
  await assert.rejects(signin.adapter.team.signIn(token, 'mistyped password'), /Invalid login credentials/);
  assert(!signin.calls.some((call) => call.name === 'accept_team_invite'));
  assert.equal(signin.changes(), 0);
  const signup = fixture(); signup.errors.signUp = 'Email rate limit exceeded';
  await assert.rejects(signup.adapter.team.signUp(token, 'new password 123'), /Email rate limit exceeded/);
  assert.equal(signup.changes(), 0);
  const accepted = fixture(); accepted.errors.accept_team_invite = 'This invitation is no longer available.';
  await assert.rejects(accepted.adapter.team.signIn(token, 'current password'), /no longer available/);
  assert(accepted.calls.some((call) => call.name === 'signIn'));
  assert.equal(accepted.changes(), 0);
});
