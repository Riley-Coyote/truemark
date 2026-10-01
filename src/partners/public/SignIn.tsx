import { PasswordReset, useRecovery } from "../../platform/PasswordReset";
import { LIVE } from "../../platform/mode";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { BrandDot } from "../../brand/HeroShelf";
import { signIn, signOut } from "../session";
import { VialTrio } from "../VialTrio";
import { Field } from "./fields";
import { useTitle } from "./title";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PORTAL = "/partners/app";

/** Signing out forgets the preview session and lands on the sign-in page. */
export function SignOut() {
  return LIVE ? <LiveSignOut /> : <PreviewSignOut />;
}
function LiveSignOut() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => { Promise.resolve(signOut()).then(() => setDone(true), (failure: Error) => setError(failure.message)); }, []);
  return done ? <Navigate to="/partners/sign-in" replace state={{ signedOut: true }} /> : <p className="pp-preview-note" role={error ? "alert" : "status"}>{error ?? "Signing out…"}</p>;
}
function PreviewSignOut() {
  useState(() => {
    signOut();
    return true;
  });
  return <Navigate to="/partners/sign-in" replace state={{ signedOut: true }} />;
}

/** The portal's front door: an email, and the same honest preview note as the shop. */
export default function SignIn() {
  useTitle("Partner sign in");
  const navigate = useNavigate();
  const recovery = useRecovery();
  const [reset, setReset] = useState(false);
  const location = useLocation();
  const state = location.state as { from?: string; signedOut?: boolean } | null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setError(email.trim() ? "Enter a full email address." : "Enter the email address you applied with.");
      document.getElementById("pp-signin-email")?.focus();
      return;
    }
    setBusy(true);
    try {
      if (LIVE) await signIn(email.trim(), password);
      else signIn(email.trim());
      const from = state?.from;
      navigate(from && from.startsWith(PORTAL) ? from : PORTAL, { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Sign-in could not be completed.");
      setBusy(false);
    }
  }

  return (
    <div className="tm-page">
      <section className="tm pp-signin" aria-label="Partner sign in">
        <div className="pp-signin-copy">
          {state?.signedOut && (
            <p className="pp-flash" role="status">
              You’re signed out of the partner portal.
            </p>
          )}
          <p className="tm-eyebrow">Partner portal</p>
          {reset || recovery ? <PasswordReset gate="partner" email={email} onBack={() => setReset(false)} /> : <>
          <h1 id="pp-signin-title" className="tm-heading">
            Sign in to
            <br />
            <span>
              your portal
              <BrandDot />
            </span>
          </h1>
          <p className="tm-section-note pp-signin-note">
            Your code and links, your referrals and payouts, and the asset library.
          </p>
          <form className="pp-signin-form" onSubmit={submit} noValidate>
            <Field
              id="pp-signin-email"
              label="Email"
              type="email"
              inputMode="email"
              name="email"
              autoComplete="username"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              error={error}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) setError(undefined);
              }}
            />
            {LIVE && <Field name="password" id="pp-signin-password" label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />}
            <button className="tm-button tm-button-primary" type="submit" disabled={busy}>
              {busy ? "One moment" : "Continue"}
            </button>
          </form>
          <p className="pp-signin-switch"><button type="button" className="tm-textlink" onClick={() => setReset(true)}>Forgot password?</button></p>
          {!LIVE && <p className="pp-preview-note">Design preview: any email opens the sample partner portal.</p>}
          <p className="pp-signin-switch">
            <span>Not a partner yet?</span>
            <Link className="tm-textlink" to="/partners/apply">
              Apply to the program <ArrowRight size={16} strokeWidth={1.6} />
            </Link>
          </p>
          </>}
        </div>
        <VialTrio className="pp-signin-trio" />
      </section>
    </div>
  );
}
