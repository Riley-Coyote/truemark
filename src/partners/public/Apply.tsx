import { LIVE } from "../../platform/mode";
import { passwordProblem } from "../../platform/accounts";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { BrandDot } from "../../brand/HeroShelf";
import { submitApplication } from "../applications";
import type { PartnerApplication } from "../applications";
import { SAMPLE_TERMS, commitments, ordinal, percent } from "../program";
import { AreaField, Field, FieldError } from "./fields";
import { useTitle } from "./title";

type Values = {
  name: string;
  email: string;
  password: string;
  channel: string;
  otherChannels: string;
  audience: string;
  feature: string;
};
type Key = keyof Values | "commitments";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEB = /^(https?:\/\/)?[^\s/$.?#]+\.[^\s]{2,}$/i;
const FEATURE_MIN = 30;
const FEATURE_MAX = 800;

/** Checked in the order the fields appear, so focus lands on the first problem. */
const ORDER: Key[] = ["name", "email", ...(LIVE ? ["password" as const] : []), "channel", "otherChannels", "audience", "feature", "commitments"];

function problem(key: Key, values: Values, confirmed: string[]): string | undefined {
  if (key === "commitments") {
    return confirmed.length === commitments.length ? undefined : "Confirm all four commitments to apply.";
  }
  const v = values[key].trim();
  switch (key) {
    case "name":
      return v.length > 1 ? undefined : "Enter your full name.";
    case "email":
      return !v ? "Enter your email." : EMAIL.test(v) ? undefined : "Enter a full email address.";
    case "password":
      return LIVE ? passwordProblem(values.password) : undefined;
    case "channel":
      return !v
        ? "Enter the address of your main channel."
        : WEB.test(v)
          ? undefined
          : "Enter a full web address, such as https://example.com/you.";
    case "audience":
      return v ? undefined : "Describe your audience in a few words.";
    case "feature":
      return v.length >= FEATURE_MIN ? undefined : `A sentence or two is enough, at least ${FEATURE_MIN} characters.`;
    default:
      return undefined;
  }
}

const withScheme = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

/** The application: who you are, where you publish, how you'd feature TrueMark, and four commitments. */
export default function Apply() {
  useTitle("Apply to the partner program");
  const [values, setValues] = useState<Values>({
    name: "",
    email: "",
    password: "",
    channel: "",
    otherChannels: "",
    audience: "",
    feature: "",
  });
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [touched, setTouched] = useState<Partial<Record<Key, boolean>>>({});
  const [status, setStatus] = useState<"idle" | "busy" | "failed">("idle");
  const [failure, setFailure] = useState("");
  const [received, setReceived] = useState<PartnerApplication | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!received) return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "center" });
  }, [received]);

  const error = (key: Key) => (touched[key] ? problem(key, values, confirmed) : undefined);
  const bind = (key: keyof Values) => ({
    id: `pp-apply-${key}`,
    name: key,
    value: values[key],
    error: error(key),
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: event.target.value })),
    onBlur: () => setTouched((t) => ({ ...t, [key]: true })),
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(Object.fromEntries(ORDER.map((k) => [k, true])));
    const first = ORDER.find((k) => problem(k, values, confirmed));
    if (first) {
      const target =
        first === "commitments"
          ? `pp-apply-commit-${commitments.find((c) => !confirmed.includes(c.id))?.id}`
          : `pp-apply-${first}`;
      document.getElementById(target)?.focus();
      return;
    }
    setStatus("busy");
    setFailure("");
    try {
      const application = await submitApplication({
        name: values.name.trim(),
        email: values.email.trim(),
        channel: withScheme(values.channel.trim()),
        otherChannels: values.otherChannels
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        audience: values.audience.trim(),
        feature: values.feature.trim(),
        commitments: commitments.map((c) => c.id).filter((id) => confirmed.includes(id)),
      }, values.password);
      setReceived(application);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "The application could not be sent. Your answers are kept; try again.");
      setStatus("failed");
    }
  }

  const commitError = error("commitments");

  return (
    <div className="tm-page">
      <section className="tm pp-apply" aria-labelledby="pp-apply-title">
        <header className="pp-apply-head">
          <p className="tm-eyebrow">Partner program</p>
          <h1 id="pp-apply-title" className="tm-display">
            Apply to partner.
            <br />
            <span>
              One short form
              <BrandDot />
            </span>
          </h1>
        </header>
        <p className="tm-section-note pp-apply-note">
          The program is for educators, reviewers and publishers who cover laboratory research. Tell us where you
          publish; we review your channels against the guidelines before a code is issued.
        </p>

        {received ? (
          <div className="pp-received">
            <p className="tm-eyebrow">Application</p>
            <h2 className="tm-heading" tabIndex={-1} ref={heading}>
              {LIVE ? (received.confirmationRequired ? "Confirm your email." : "Application received.") : <>Application received.<br /><span>We’ll email you once it has been reviewed.</span></>}
            </h2>
            {LIVE && <>
              {received.confirmationRequired && <p className="tm-section-note">Use the link in your email to confirm your account.</p>}
              <p className="tm-section-note">{received.confirmationRequired ? "Application received. " : ""}We review every application; you'll hear from us by email. Sign in once you're approved.</p>
            </>}
            <dl className="pp-received-facts">
              <div>
                <dt>Name</dt>
                <dd>{received.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{received.email}</dd>
              </div>
              <div>
                <dt>Main channel</dt>
                <dd>{received.channel}</dd>
              </div>
            </dl>
            {!LIVE && <p className="pp-preview-note">Design preview: this application stays on this page; nothing was sent.</p>}
            <div className="tm-actions">
              <Link className="tm-button tm-button-primary" to={LIVE ? "/partners/sign-in" : "/partners"}>
                {LIVE ? "Sign in to the portal" : "Back to the partner program"}
              </Link>
              <Link className="tm-textlink" to="/verify">
                See how a lot is verified <ArrowRight size={16} strokeWidth={1.6} />
              </Link>
            </div>
          </div>
        ) : (
          <form className="pp-apply-form" onSubmit={submit} noValidate aria-labelledby="pp-apply-title">
            <fieldset className="pp-form-section">
              <legend>
                <span className="pp-form-index">01</span>
                About you
              </legend>
              <div className="pp-fields is-pair">
                <Field {...bind("name")} label="Full name" autoComplete="name" />
                <Field {...bind("email")} label="Email" type="email" autoComplete={LIVE ? "username" : "email"} inputMode="email" spellCheck={false} />
                {LIVE && <Field {...bind("password")} label="Password" type="password" autoComplete="new-password" minLength={10} hint="Use at least 10 characters." />}
              </div>
            </fieldset>

            <fieldset className="pp-form-section">
              <legend>
                <span className="pp-form-index">02</span>
                Where you publish
              </legend>
              <div className="pp-fields">
                <Field
                  {...bind("channel")}
                  label="Main channel"
                  hint="The web address of the place you publish most: a newsletter, site, channel or profile."
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  placeholder="https://"
                />
                <AreaField
                  {...bind("otherChannels")}
                  label="Other channels"
                  optional
                  hint="One web address per line."
                  rows={3}
                  spellCheck={false}
                />
                <Field
                  {...bind("audience")}
                  label="Audience"
                  hint="Who reads, watches or listens. For example, graduate researchers and lab managers."
                />
              </div>
            </fieldset>

            <fieldset className="pp-form-section">
              <legend>
                <span className="pp-form-index">03</span>
                How you would feature TrueMark
              </legend>
              <div className="pp-fields">
                <AreaField
                  {...bind("feature")}
                  label="Your idea"
                  hint="For example, a walkthrough of reading a certificate of analysis, or a look at how a lot is released."
                  rows={5}
                  maxLength={FEATURE_MAX}
                />
                <p className="pp-count" aria-hidden="true">
                  {values.feature.trim().length} / {FEATURE_MAX}
                </p>
              </div>
            </fieldset>

            <fieldset className="pp-form-section" aria-describedby={commitError ? "pp-apply-commit-error" : undefined}>
              <legend>
                <span className="pp-form-index">04</span>
                Your commitments
              </legend>
              <p className="pp-field-hint">All four are required. They are the heart of the partner guidelines.</p>
              <div className="pp-checks">
                {commitments.map((c) => {
                  const checked = confirmed.includes(c.id);
                  return (
                    <label className={`pp-check${commitError && !checked ? " is-invalid" : ""}`} key={c.id}>
                      <input
                        id={`pp-apply-commit-${c.id}`}
                        type="checkbox"
                        checked={checked}
                        aria-invalid={commitError && !checked ? true : undefined}
                        onChange={(event) => {
                          const on = event.target.checked;
                          setConfirmed((list) => (on ? [...list, c.id] : list.filter((id) => id !== c.id)));
                          setTouched((t) => ({ ...t, commitments: true }));
                        }}
                      />
                      <span>{c.label}</span>
                    </label>
                  );
                })}
              </div>
              {commitError && <FieldError id="pp-apply-commit-error">{commitError}</FieldError>}
            </fieldset>

            <div className="pp-form-submit">
              <button type="submit" className="tm-button tm-button-primary" disabled={status === "busy"}>
                {status === "busy" ? "Submitting…" : "Submit application"}
              </button>
              {!LIVE && <p className="pp-preview-note">Design preview: applications are kept on this page and not sent.</p>}
            </div>
            {status === "failed" && (
              <p className="pp-field-error" role="alert">
                {LIVE ? failure : "The application could not be sent. Your answers are kept; try again."}
              </p>
            )}
          </form>
        )}

        <aside className="pp-apply-aside" aria-label="About the program">
          <p className="tm-eyebrow">Sample terms</p>
          <dl className="pp-apply-terms">
            <div>
              <dt>Commission</dt>
              <dd>{percent(SAMPLE_TERMS.rate)} of the order subtotal after discount</dd>
            </div>
            <div>
              <dt>Your audience</dt>
              <dd>{percent(SAMPLE_TERMS.discount)} off, with your code or link</dd>
            </div>
            <div>
              <dt>Payouts</dt>
              <dd>Monthly, on the {ordinal(SAMPLE_TERMS.payoutDay)}</dd>
            </div>
          </dl>
          <p className="tm-eyebrow">What happens next</p>
          <ol className="pp-apply-next">
            <li>We review your application and your channels against the guidelines.</li>
            <li>{LIVE ? "If it is approved, sign in to your portal to find your code and links." : "If it is approved, your code and your portal sign-in arrive by email."}</li>
            <li>You share TrueMark as the guidelines describe, and earn on every referred order.</li>
          </ol>
          <Link className="tm-textlink" to="/partners#guidelines">
            Read the guidelines <ArrowRight size={16} strokeWidth={1.6} />
          </Link>
        </aside>
      </section>
    </div>
  );
}
