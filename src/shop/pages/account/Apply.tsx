import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CircleAlert, Paperclip, X } from "lucide-react";
import { store } from "../../../platform/store";
import type { Application } from "../../../platform/types";
import { AreaField, Field, SelectField, useTitle } from "./parts";

const institutionTypes = [
  "University",
  "Contract research organization",
  "Biotechnology company",
  "Independent laboratory",
  "Other",
];

/** Ids match the sample applications in the store. */
const attestations = [
  { id: "research-only", label: "The materials are for laboratory research use only." },
  { id: "not-for-human-use", label: "They are not for human or veterinary use." },
  { id: "storage-sop", label: "They will be stored and handled under our laboratory’s procedures." },
  { id: "terms", label: "I accept TrueMark’s terms of sale." },
];

type Values = {
  name: string;
  email: string;
  role: string;
  institution: string;
  institutionType: string;
  website: string;
  country: string;
  researchArea: string;
  intendedUse: string;
};
type Key = keyof Values | "attestations";

const USE_MIN = 30;
const USE_MAX = 800;

const steps: { index: string; label: string; title: string; note: string; keys: Key[] }[] = [
  { index: "01", label: "You", title: "About you.", note: "The researcher the account is for.", keys: ["name", "email", "role"] },
  {
    index: "02",
    label: "Institution",
    title: "Your institution.",
    note: "Where the research happens.",
    keys: ["institution", "institutionType", "website", "country"],
  },
  {
    index: "03",
    label: "Research use",
    title: "Research use.",
    note: "How the materials will be used in the lab.",
    keys: ["researchArea", "intendedUse"],
  },
  {
    index: "04",
    label: "Attestations",
    title: "Attestations.",
    note: "Four confirmations, and any documents that support the application.",
    keys: ["attestations"],
  },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEBSITE = /^(https?:\/\/)?[^\s/$.?#]+\.[^\s]{2,}$/i;

function problem(key: Key, values: Values, confirmed: string[]): string | undefined {
  if (key === "attestations") {
    return confirmed.length === attestations.length ? undefined : "Confirm all four statements to continue.";
  }
  const v = values[key].trim();
  switch (key) {
    case "name":
      return v.length > 1 ? undefined : "Enter your full name.";
    case "email":
      return !v ? "Enter your email." : EMAIL.test(v) ? undefined : "Enter a full email address.";
    case "role":
      return v ? undefined : "Enter your role in the lab.";
    case "institution":
      return v ? undefined : "Enter the institution’s name.";
    case "institutionType":
      return v ? undefined : "Choose the type of institution.";
    case "website":
      return !v || WEBSITE.test(v) ? undefined : "Enter a full web address, or leave it blank.";
    case "country":
      return v ? undefined : "Enter the country.";
    case "researchArea":
      return v ? undefined : "Enter your research area.";
    case "intendedUse":
      return v.length >= USE_MIN ? undefined : `A sentence or two is enough, at least ${USE_MIN} characters.`;
    default:
      return undefined;
  }
}

export default function Apply() {
  useTitle("Apply for a research account");
  const [values, setValues] = useState<Values>({
    name: "",
    email: "",
    role: "",
    institution: "",
    institutionType: "",
    website: "",
    country: "",
    researchArea: "",
    intendedUse: "",
  });
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [documents, setDocuments] = useState<string[]>([]);
  const [touched, setTouched] = useState<Partial<Record<Key, boolean>>>({});
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [status, setStatus] = useState<"idle" | "busy" | "failed">("idle");
  const [received, setReceived] = useState<Application | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // After moving between steps, bring keyboard and screen reader focus to the new step.
  useEffect(() => {
    if (!moved.current) return;
    heading.current?.focus({ preventScroll: true });
    const top = heading.current?.closest("form")?.getBoundingClientRect().top ?? 0;
    if (top < 0) heading.current?.closest("form")?.scrollIntoView({ block: "start" });
  }, [step, received]);

  const error = (key: Key) => (touched[key] ? problem(key, values, confirmed) : undefined);
  const touch = (key: Key) => setTouched((t) => ({ ...t, [key]: true }));
  const bind = (key: keyof Values) => ({
    id: `tm-acct-apply-${key}`,
    name: key,
    value: values[key],
    error: error(key),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value })),
    onBlur: () => touch(key),
  });

  /** Validate the step on screen; focus the first problem if there is one. */
  function stepIsValid(): boolean {
    const { keys } = steps[step];
    setTouched((t) => ({ ...t, ...Object.fromEntries(keys.map((k) => [k, true])) }));
    const first = keys.find((k) => problem(k, values, confirmed));
    if (!first) return true;
    const target =
      first === "attestations"
        ? `tm-acct-attest-${attestations.find((a) => !confirmed.includes(a.id))?.id}`
        : `tm-acct-apply-${first}`;
    document.getElementById(target)?.focus();
    return false;
  }

  function goTo(target: number) {
    if (target === step) return;
    if (target > step && !stepIsValid()) return;
    moved.current = true;
    setStep(target);
    setFurthest((f) => Math.max(f, target));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!stepIsValid()) return;
    if (step < steps.length - 1) {
      goTo(step + 1);
      return;
    }
    setStatus("busy");
    const website = values.website.trim();
    const draft: Omit<Application, "id" | "submittedAt" | "status"> & { country: string } = {
      name: values.name.trim(),
      email: values.email.trim(),
      role: values.role.trim(),
      institution: values.institution.trim(),
      institutionType: values.institutionType,
      website: website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : undefined,
      country: values.country.trim(),
      researchArea: values.researchArea.trim(),
      intendedUse: values.intendedUse.trim(),
      attestations: attestations.map((a) => a.id).filter((id) => confirmed.includes(id)),
      documents,
    };
    try {
      const application = await store.applications.submit(draft);
      moved.current = true;
      setReceived(application);
    } catch {
      setStatus("failed");
    }
  }

  function addDocuments(event: ChangeEvent<HTMLInputElement>) {
    const names = Array.from(event.target.files ?? [], (file) => file.name);
    setDocuments((list) => [...list, ...names.filter((n) => !list.includes(n))]);
    event.target.value = "";
  }

  const current = steps[step];
  const last = step === steps.length - 1;
  const attestError = error("attestations");

  return (
    <div className="tm-page tm-acct">
      <section className="tm tm-acct-apply" aria-labelledby="tm-acct-apply-title">
        <header className="tm-acct-apply-head">
          <p className="tm-eyebrow">Research account</p>
          <h1 id="tm-acct-apply-title" className="tm-display">
            Apply for an account.
            <br />
            <span>Four short steps.</span>
          </h1>
        </header>
        <p className="tm-section-note tm-acct-apply-note">
          Research accounts are for laboratories and research institutions. Every application is reviewed before an
          account can order.
        </p>

        <nav className="tm-acct-rail" aria-label="Application steps" data-review="account-approval">
          <ol>
            {steps.map((s, i) => {
              const state = received || i < step ? "done" : i === step ? "current" : "upcoming";
              return (
                <li key={s.index} data-state={state}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    disabled={Boolean(received) || i > furthest}
                    aria-current={!received && i === step ? "step" : undefined}
                  >
                    <i aria-hidden="true" />
                    <span className="tm-acct-rail-index tm-mono">{s.index}</span>
                    <span className="tm-acct-rail-label">{s.label}</span>
                    {state === "done" && <span className="sr-only">, complete</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {received ? (
          <div className="tm-acct-step tm-acct-received tm-acct-rise">
            <p className="tm-eyebrow">
              Application <span className="tm-mono">{received.id}</span>
            </p>
            <h2 className="tm-heading" tabIndex={-1} ref={heading}>
              Application received.
              <br />
              <span>We’ll email you when your account has been reviewed.</span>
            </h2>
            <dl className="tm-acct-dl is-compact">
              <div>
                <dt>Name</dt>
                <dd>{received.name}</dd>
              </div>
              <div>
                <dt>Institution</dt>
                <dd>{received.institution}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{received.email}</dd>
              </div>
            </dl>
            <div className="tm-acct-actions">
              <Link className="tm-button tm-button-primary" to="/products">
                Explore the collection
              </Link>
              <Link className="tm-textlink" to="/verify">
                Verify a vial <ArrowRight size={16} strokeWidth={1.6} />
              </Link>
            </div>
          </div>
        ) : (
          <form className="tm-acct-step" onSubmit={submit} noValidate aria-labelledby="tm-acct-step-title" key={step}>
            <div className="tm-acct-step-head tm-acct-rise">
              <p className="tm-acct-step-count">
                <span className="tm-mono">{current.index}</span> of <span className="tm-mono">04</span>
              </p>
              <h2 id="tm-acct-step-title" className="tm-acct-step-title" tabIndex={-1} ref={heading}>
                {current.title}
              </h2>
              <p className="tm-acct-intro">{current.note}</p>
            </div>

            <div className="tm-acct-form-grid tm-acct-rise">
              {step === 0 && (
                <>
                  <Field {...bind("name")} label="Full name" wide autoComplete="name" />
                  <Field {...bind("email")} label="Work email" wide type="email" autoComplete="email" inputMode="email" spellCheck={false} />
                  <Field {...bind("role")} label="Role" hint="For example, principal investigator or lab manager." wide autoComplete="organization-title" />
                </>
              )}
              {step === 1 && (
                <>
                  <Field {...bind("institution")} label="Institution" wide autoComplete="organization" />
                  <SelectField {...bind("institutionType")} label="Type of institution" wide>
                    <option value="" disabled>
                      Choose one
                    </option>
                    {institutionTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </SelectField>
                  <Field {...bind("website")} label="Website" optional wide type="url" autoComplete="url" inputMode="url" spellCheck={false} />
                  <Field {...bind("country")} label="Country" wide autoComplete="country-name" />
                </>
              )}
              {step === 2 && (
                <>
                  <Field {...bind("researchArea")} label="Research area" hint="For example, cell signalling or assay development." wide />
                  <AreaField
                    {...bind("intendedUse")}
                    label="How the materials will be used in the lab"
                    hint="Describe the laboratory work, such as the assays or analyses planned."
                    wide
                    rows={5}
                    maxLength={USE_MAX}
                  />
                  <p className="tm-acct-count" aria-hidden="true">
                    {values.intendedUse.trim().length} / {USE_MAX}
                  </p>
                </>
              )}
              {step === 3 && (
                <>
                  <fieldset className="tm-acct-attest is-wide" aria-describedby={attestError ? "tm-acct-attest-error" : undefined}>
                    <legend>I confirm that</legend>
                    {attestations.map((a) => {
                      const checked = confirmed.includes(a.id);
                      return (
                        <label className={`tm-acct-check${attestError && !checked ? " is-invalid" : ""}`} key={a.id}>
                          <input
                            id={`tm-acct-attest-${a.id}`}
                            type="checkbox"
                            checked={checked}
                            aria-invalid={attestError && !checked ? true : undefined}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setConfirmed((list) => (on ? [...list, a.id] : list.filter((id) => id !== a.id)));
                            }}
                          />
                          <span>{a.label}</span>
                        </label>
                      );
                    })}
                    {attestError && (
                      <p id="tm-acct-attest-error" className="tm-acct-error">
                        <CircleAlert size={14} strokeWidth={1.8} aria-hidden="true" />
                        {attestError}
                      </p>
                    )}
                  </fieldset>

                  <div className="tm-acct-docs is-wide">
                    <p className="tm-acct-docs-title" id="tm-acct-docs-title">
                      Supporting documents <span>(optional)</span>
                    </p>
                    <p className="tm-acct-hint" id="tm-acct-docs-hint">
                      For example, an institutional letter or a purchasing approval. In this preview only the file names
                      are recorded; nothing is uploaded.
                    </p>
                    <div className="tm-acct-file">
                      <input
                        id="tm-acct-docs"
                        type="file"
                        multiple
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="sr-only"
                        aria-describedby="tm-acct-docs-hint"
                        onChange={addDocuments}
                      />
                      <label htmlFor="tm-acct-docs" className="tm-acct-quiet">
                        <Paperclip size={15} strokeWidth={1.6} aria-hidden="true" />
                        Add documents
                      </label>
                    </div>
                    {documents.length > 0 && (
                      <ul className="tm-acct-doclist" aria-labelledby="tm-acct-docs-title">
                        {documents.map((doc) => (
                          <li key={doc}>
                            <span>{doc}</span>
                            <button
                              type="button"
                              className="tm-acct-icon"
                              aria-label={`Remove ${doc}`}
                              onClick={() => setDocuments((list) => list.filter((d) => d !== doc))}
                            >
                              <X size={14} strokeWidth={1.8} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="tm-acct-step-nav">
              <button type="submit" className="tm-button tm-button-primary" disabled={status === "busy"}>
                {last ? (status === "busy" ? "Submitting…" : "Submit application") : `Next: ${steps[step + 1].label}`}
              </button>
              {step > 0 && (
                <button type="button" className="tm-acct-quiet" onClick={() => goTo(step - 1)}>
                  Back
                </button>
              )}
            </div>
            {status === "failed" && (
              <p className="tm-acct-error" role="alert">
                The application could not be sent. Your answers are kept; try again.
              </p>
            )}
          </form>
        )}
      </section>
    </div>
  );
}
