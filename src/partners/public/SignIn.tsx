import { useState } from "react";
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
  const location = useLocation();
  const state = location.state as { from?: string; signedOut?: boolean } | null;
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setError(email.trim() ? "Enter a full email address." : "Enter the email address you applied with.");
      document.getElementById("pp-signin-email")?.focus();
      return;
    }
    setBusy(true);
    signIn(email.trim());
    const from = state?.from;
    navigate(from && from.startsWith(PORTAL) ? from : PORTAL, { replace: true });
  }

  return (
    <div className="tm-page">
      <section className="tm pp-signin" aria-labelledby="pp-signin-title">
        <div className="pp-signin-copy">
          {state?.signedOut && (
            <p className="pp-flash" role="status">
              You’re signed out of the partner portal.
            </p>
          )}
          <p className="tm-eyebrow">Partner portal</p>
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
              autoComplete="email"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              error={error}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) setError(undefined);
              }}
            />
            <button className="tm-button tm-button-primary" type="submit" disabled={busy}>
              {busy ? "One moment" : "Continue"}
            </button>
          </form>
          <p className="pp-preview-note">Design preview: any email opens the sample partner portal.</p>
          <p className="pp-signin-switch">
            <span>Not a partner yet?</span>
            <Link className="tm-textlink" to="/partners/apply">
              Apply to the program <ArrowRight size={16} strokeWidth={1.6} />
            </Link>
          </p>
        </div>
        <VialTrio className="pp-signin-trio" />
      </section>
    </div>
  );
}
