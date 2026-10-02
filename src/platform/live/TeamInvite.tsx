import { useId, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../app-kit";
import { AppearanceProvider, useAppearance } from "../../admin/appearance";
import { assetUrl } from "../../assetUrl";
import { PasswordReset } from "../PasswordReset";
import { useResource } from "../store";
import { INVITE_UNAVAILABLE, teamRoleLabel } from "../team";
import { live } from "./runtime";
import "../../admin/admin.css";
import "./team.css";

export default function TeamInvite() {
  return <AppearanceProvider><AcceptanceCard /></AppearanceProvider>;
}

function AcceptanceCard() {
  const { theme } = useAppearance();
  const [search] = useSearchParams();
  const token = search.get("invite") ?? "";
  // A different link always gets a fresh form; passwords never carry between invites.
  return <div className="kit cc-gate" data-theme={theme}>
    <main className="cc-gate-card" aria-label="Join the TrueMark team">
      <img className="cc-gate-lockup" src={assetUrl(`images/brand/kit/lockup-${theme === "night" ? "white" : "black"}.svg`)} alt="TrueMark BioLabs" width="164" height="40" />
      <p className="kit-label">Command center</p>
      <InvitationForm key={token} token={token} />
    </main>
  </div>;
}

function InvitationForm({ token }: { token: string }) {
  const navigate = useNavigate();
  const resource = useResource(async () => {
    const [invitation, account] = await Promise.all([token ? live().team.previewInvite(token) : Promise.resolve(null), live().team.account()]);
    return { invitation, account };
  }, [token]);
  const [existing, setExisting] = useState(false);
  const [reset, setReset] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [received, setReceived] = useState(false);
  const [error, setError] = useState("");
  const emailId = useId();
  const passwordId = useId();
  const invitation = resource.data?.invitation;
  const account = resource.data?.account;
  const matching = account && invitation && account.email.toLowerCase() === invitation.email.toLowerCase();

  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      if (account) await live().team.acceptInvite(token);
      else if (existing) await live().team.signIn(token, password);
      else {
        const result = await live().team.signUp(token, password);
        if (result.confirmationRequired) { setReceived(true); setPassword(""); return; }
      }
      navigate("/admin", { replace: true });
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "The invitation could not be accepted. Try again.";
      setError(/invalid login credentials/i.test(message) ? "That email and password don't match. Try again." : /email not confirmed/i.test(message) ? "Confirm your email first, then sign in to accept." : message);
    } finally { setBusy(false); }
  }
  async function signOut() {
    if (busy) return;
    setBusy(true); setError("");
    try { await live().auth.signOut(); resource.reload(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Sign-out failed. Try again."); }
    finally { setBusy(false); }
  }

  if (reset) return <>
    <PasswordReset gate="team" email={invitation?.email} onBack={() => setReset(false)} />
    <p className="cc-gate-note">After resetting your password, open this invitation again.</p>
  </>;
  return <>
    <h1 className="cc-gate-title">Join the TrueMark team</h1>
    {received ? <>
      <p className="cc-gate-note" role="status">Confirm your email, then sign in to the command center.</p>
      <Link className="kit-button kit-button-primary" to="/admin">Sign in</Link>
    </> : resource.error ? <>
      <p className="kit-field-error" role="alert">{resource.error.message}</p>
      <Button onClick={resource.reload}>Try again</Button>
    </> : !resource.data && resource.loading ? <p className="cc-gate-note" role="status">Checking invitation…</p>
      : !invitation ? <>
        <p className="cc-gate-note">{INVITE_UNAVAILABLE}</p>
        <Link className="kit-button kit-button-quiet" to="/admin">Go to sign in</Link>
      </> : <>
        <p className="cc-gate-note">You've been invited as {teamRoleLabel(invitation.role)}.</p>
        {account && !matching ? <div className="cc-gate-form">
          <p className="cc-gate-note">This invitation is for {invitation.email}. You're signed in as {account.email}. Sign out to continue with the invited email.</p>
          <Button disabled={busy} onClick={signOut}>{busy ? "Signing out…" : "Sign out"}</Button>
        </div> : <form className="cc-gate-form" onSubmit={submit}>
          <div className="kit-field">
            <label className="kit-field-label" htmlFor={emailId}>Email</label>
            <div className="cc-control"><input id={emailId} className="cc-input" type="email" name="email" autoComplete="username" value={invitation.email} readOnly required /></div>
          </div>
          {!account && <div className="kit-field">
            <label className="kit-field-label" htmlFor={passwordId}>{existing ? "Password" : "Create a password"}</label>
            <div className="cc-control" data-disabled={busy ? "true" : undefined}><input id={passwordId} className="cc-input" type="password" name={existing ? "password" : "new-password"}
              autoComplete={existing ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={existing ? undefined : 10}
              aria-describedby={!existing ? `${passwordId}-hint` : undefined} required disabled={busy} /></div>
            {!existing && <p className="kit-field-hint" id={`${passwordId}-hint`}>Use at least 10 characters.</p>}
          </div>}
          <Button variant="primary" type="submit" disabled={busy || (!account && password.length < (existing ? 1 : 10))}>
            {busy ? "Joining…" : account ? "Accept invitation" : existing ? "Sign in and accept" : "Create account and join"}
          </Button>
          {!account && <>
            <Button variant="text" className="cc-team-gate-link" disabled={busy} onClick={() => { setExisting(!existing); setPassword(""); setError(""); }}>{existing ? "New to TrueMark? Create an account" : "Sign in to accept"}</Button>
            {existing && <Button variant="text" className="cc-team-gate-link" disabled={busy} onClick={() => setReset(true)}>Forgot password?</Button>}
          </>}
        </form>}
      </>}
    {error && <p className="kit-field-error" role="alert">{error}</p>}
  </>;
}
