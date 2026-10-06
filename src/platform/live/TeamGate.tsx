import { useId, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Button } from "../../app-kit";
import { useAppearance } from "../../admin/appearance";
import { assetUrl } from "../../assetUrl";
import { useResource } from "../store";
import { PasswordReset, useRecovery } from "../PasswordReset";
import { live } from "./runtime";

const TEAM = new Set(["owner", "staff"]);

/** Supabase's own words for a failed sign-in are terse; say it plainly. */
function plain(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match a team account.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first, then sign in.";
  return message;
}

/**
 * The command center's door in the live platform. It signs a team member in
 * where they are, in the command center's own theme, and never sends them to
 * the customer gate.
 */
export function TeamGate({ children }: { children: ReactNode }) {
  const { theme } = useAppearance();
  const recovery = useRecovery();
  const [reset, setReset] = useState(false);
  const profile = useResource(() => live().auth.profile(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const emailId = useId();
  const passwordId = useId();

  if (!recovery && !reset && profile.data && TEAM.has(profile.data.role)) return children;

  const outsider = profile.data && !TEAM.has(profile.data.role);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const signedIn = await live().auth.signIn(email.trim(), password);
      if (!signedIn || !TEAM.has(signedIn.role)) setError("This account isn't on the TrueMark team.");
      profile.reload();
    } catch (failure) {
      setError(plain(failure instanceof Error ? failure.message : "Sign-in failed. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await live().auth.signOut();
    } finally {
      setBusy(false);
      profile.reload();
    }
  }

  return (
    <div className="kit cc-gate" data-theme={theme}>
      <main className="cc-gate-card" aria-label="Command center sign in">
        <img
          className="cc-gate-lockup"
          src={assetUrl(`images/brand/kit/lockup-${theme === "day" ? "black" : "white"}.svg`)}
          alt="TrueMark BioLabs"
          width="164"
          height="40"
        />
        <p className="kit-label">Command center</p>
        {reset || recovery ? <PasswordReset gate="team" email={email} onBack={() => setReset(false)} /> : <>
        <h1 id="cc-gate-title" className="cc-gate-title">
          Sign in
        </h1>
        <p className="cc-gate-note">This area is for the TrueMark team.</p>
        {profile.loading ? (
          <p className="cc-gate-note" role="status">
            Checking team access…
          </p>
        ) : outsider ? (
          <div className="cc-gate-form">
            <p className="cc-gate-note">
              You're signed in with an account that isn't on the team. Sign out to use a team account.
            </p>
            <Button variant="primary" onClick={signOut} disabled={busy}>
              {busy ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        ) : (
          <form className="cc-gate-form" onSubmit={signIn}>
            <div className="kit-field">
              <label className="kit-field-label" htmlFor={emailId}>
                Email
              </label>
              <div className="cc-control">
                <input
                  id={emailId}
                  className="cc-input"
                  type="email"
                  name="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="kit-field">
              <label className="kit-field-label" htmlFor={passwordId}>
                Password
              </label>
              <div className="cc-control">
                <input
                  id={passwordId}
                  className="cc-input"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
            </div>
            {(error ?? profile.error?.message) && (
              <p className="kit-field-error" role="alert">
                {error ?? profile.error?.message}
              </p>
            )}
            <Button variant="text" onClick={() => setReset(true)} disabled={busy}>Forgot password?</Button>
            <Button type="submit" variant="primary" disabled={busy || !email.trim() || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        )}
        </>}
      </main>
    </div>
  );
}
