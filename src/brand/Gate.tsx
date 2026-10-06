import { PasswordReset, useRecovery } from "../platform/PasswordReset";
import { LIVE } from "../platform/mode";
import { live } from "../platform/live/runtime";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BrandLogo } from "../BrandLogo";
import { store } from "../platform/store";
import { productById } from "../shop/catalog";
import { Lens } from "./Lens";
import { SCENE } from "./lens-scene";
import type { LotPhase } from "./lens-scene";
import { BrandDot } from "./HeroShelf";
import { Trace } from "./Trace";
import "./gate.css";

type Mode = "signin" | "create";
type Errors = Partial<Record<"name" | "institution" | "email" | "password" | "attest", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({
  label,
  error,
  children,
  aside,
}: {
  label: string;
  error?: string;
  children: (id: string, describedBy?: string) => ReactNode;
  aside?: ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={`tm-field${error ? " is-invalid" : ""}`}>
      <div className="tm-field-top">
        <label htmlFor={id}>{label}</label>
        {aside}
      </div>
      {children(id, error ? errorId : undefined)}
      {error && (
        <p className="tm-field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The front door. Every logged-out visitor lands here on the client's live site,
 * so it carries the brand at its most exact: the real lockup, their ink, their
 * copy, one real vial and its printed lot number (no invented results).
 */
export default function Gate() {
  const navigate = useNavigate();
  const recovery = useRecovery();
  const [reset, setReset] = useState(false);
  const location = useLocation();
  // Where the visitor was headed before the gate asked them to sign in.
  const from = (location.state as { from?: string } | null)?.from;
  const [mode, setMode] = useState<Mode>("signin");
  const [values, setValues] = useState({ name: "", institution: "", email: "", password: "" });
  const [attest, setAttest] = useState(false);
  const [keep, setKeep] = useState(true);
  const [reveal, setReveal] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [focusedLot, setFocusedLot] = useState<{ index: number; phase: LotPhase }>({ index: 0, phase: "opening" });
  const specimen = productById(SCENE.vials[focusedLot.index].id);
  const scene = useRef<HTMLElement>(null);
  const focusLot = useCallback((index: number, phase: LotPhase) => setFocusedLot({ index, phase }), []);

  useEffect(() => {
    document.title = `${mode === "signin" ? "Sign in" : "Create account"} — TrueMark BioLabs`;
  }, [mode]);

  const set = (key: keyof typeof values) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: event.target.value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function validate(): Errors {
    // Checked in the order the fields appear, so focus lands on the first problem.
    const next: Errors = {};
    if (mode === "create" && !values.name.trim()) next.name = "Enter your full name.";
    if (mode === "create" && !values.institution.trim()) next.institution = "Enter your institution or company.";
    if (!EMAIL.test(values.email.trim())) next.email = "Enter the email address you use for your lab.";
    if (mode === "signin" && !values.password) next.password = "Enter your password.";
    if (mode === "create" && values.password.length < 8) next.password = "Use at least 8 characters.";
    if (mode === "create" && !attest) next.attest = "Confirm that purchases are for laboratory research use only.";
    return next;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0];
      document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
      return;
    }
    setBusy(true);
    try {
      if (LIVE) await live().auth.signIn(values.email.trim(), values.password);
      else await store.session.signIn(values.email);
      navigate(LIVE ? (from?.startsWith("/") && !from.startsWith("//") ? from : "/") : from ?? "/", { replace: true });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Sign-in could not be completed.");
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    if (LIVE && next === "create") { navigate("/access/apply"); return; }
    setFailure(undefined);
    setMode(next);
    setErrors({});
  }

  return (
    <div className="brand-refinement">
      <div className="tm tm-gate">
        <section className="tm-gate-brand" aria-label="TrueMark BioLabs" ref={scene}>
          <Lens panel={scene} onFocus={focusLot} />
          <Link className="tm-gate-logo" to="/" aria-label="TrueMark BioLabs home">
            <BrandLogo variant="white" />
          </Link>
          <div className="tm-gate-statement">
            <h1 className="tm-gate-title">
              Research compounds,
              <br />
              verified by lot
              <BrandDot />
            </h1>
            <p className="tm-gate-lead">
              Accounts keep our catalog, pricing and certificates of analysis
              available only to registered researchers.
            </p>
          </div>
          <div className="tm-gate-lotline" data-lot-phase={focusedLot.phase}>
            <span className="tm-gate-lot-label">Lot · {specimen?.name} {specimen?.size}</span>
            {specimen && <span className="tm-gate-lot">{specimen.lot}</span>}
            <span className="tm-gate-lot-note">
              Every label carries one. Sign in to read the certificate for yours.
            </span>
            <Link className="tm-gate-verify" to="/verify">
              Or verify a lot now, no account needed
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <Trace theme="night" peakAt={0.64} height={72} className="tm-gate-trace" />
          <p className="tm-gate-legal">For research use only. Not for human consumption.</p>
        </section>

        <main className="tm-gate-panel">
          <div className="tm-gate-form">
            {reset || recovery ? <PasswordReset gate="shop" email={values.email} onBack={() => setReset(false)} /> : <>
            <h2 className="tm-gate-heading">{mode === "signin" ? "Sign in" : "Create account"}</h2>
            <p className="tm-gate-sub">
              {mode === "signin"
                ? "Sign in to browse products and place orders."
                : "Open a free research account to browse products and place orders."}
            </p>

            <div className="tm-segmented" role="group" aria-label="Account">
              <button type="button" aria-pressed={mode === "signin"} onClick={() => switchMode("signin")}>
                Sign in
              </button>
              <button type="button" aria-pressed={mode === "create"} onClick={() => switchMode("create")}>
                Create account
              </button>
            </div>

            <form noValidate onSubmit={submit}>
              {failure && <p className="tm-field-error" role="alert">{failure}</p>}
              {mode === "create" && (
                <>
                  <Field label="Full name" error={errors.name}>
                    {(id, describedBy) => (
                      <input id={id} data-field="name" autoComplete="name" value={values.name} onChange={set("name")} aria-invalid={!!errors.name} aria-describedby={describedBy} />
                    )}
                  </Field>
                  <Field label="Institution or company" error={errors.institution}>
                    {(id, describedBy) => (
                      <input id={id} data-field="institution" autoComplete="organization" value={values.institution} onChange={set("institution")} aria-invalid={!!errors.institution} aria-describedby={describedBy} />
                    )}
                  </Field>
                </>
              )}
              <Field label="Email address" error={errors.email}>
                {(id, describedBy) => (
                  <input
                    id={id}
                    data-field="email"
                    type="email"
                    inputMode="email"
                    name="email"
                    autoComplete="username"
                    placeholder="you@lab.org"
                    value={values.email}
                    onChange={set("email")}
                    aria-invalid={!!errors.email}
                    aria-describedby={describedBy}
                  />
                )}
              </Field>
              <Field
                label="Password"
                error={errors.password}
                aside={
                  mode === "signin" ? (
                    <button type="button" className="tm-gate-link" onClick={() => setReset(true)}>
                      Forgot password?
                    </button>
                  ) : undefined
                }
              >
                {(id, describedBy) => (
                  <span className="tm-password">
                    <input
                      id={id}
                      name="password"
                      data-field="password"
                      type={reveal ? "text" : "password"}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      value={values.password}
                      onChange={set("password")}
                      aria-invalid={!!errors.password}
                      aria-describedby={describedBy}
                    />
                    <button type="button" className="tm-password-toggle" aria-pressed={reveal} onClick={() => setReveal((r) => !r)}>
                      {reveal ? "Hide" : "Show"}
                    </button>
                  </span>
                )}
              </Field>

              {mode === "signin" ? (!LIVE && (
                <label className="tm-check">
                  <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
                  <span className="tm-check-box" aria-hidden="true" />
                  Keep me signed in
                </label>
              )) : (
                <div className={`tm-field${errors.attest ? " is-invalid" : ""}`}>
                  <label className="tm-check">
                    <input
                      type="checkbox"
                      data-field="attest"
                      checked={attest}
                      onChange={(e) => {
                        setAttest(e.target.checked);
                        if (errors.attest) setErrors((x) => ({ ...x, attest: undefined }));
                      }}
                      aria-invalid={!!errors.attest}
                    />
                    <span className="tm-check-box" aria-hidden="true" />
                    I purchase for laboratory research use only, not for human or veterinary use.
                  </label>
                  {errors.attest && <p className="tm-field-error">{errors.attest}</p>}
                </div>
              )}

              <button className="tm-button tm-button-primary tm-gate-submit" type="submit" disabled={busy}>
                {busy ? "One moment" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            <p className="tm-gate-switch">
              {mode === "signin" ? "New to TrueMark BioLabs? " : "Already registered? "}
              <button type="button" className="tm-gate-link" onClick={() => switchMode(mode === "signin" ? "create" : "signin")}>
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>
            {!LIVE && <p className="tm-gate-preview">Design preview: any details open the sample research account.</p>}
            </>}
          </div>
        </main>
      </div>
    </div>
  );
}
