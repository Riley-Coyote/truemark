import { LIVE } from "../../../platform/mode";
import { live } from "../../../platform/live/runtime";
import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, FocusEvent, FormEvent, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useReveal } from "../../motion";
import "../../../brand/contact.css";

/*
 * The client's Contact page, in their order and words
 * (reference-study/wordpress-2026-09-24/contact.txt): four routes, each to its
 * own inbox, the hours, and a form. In this design preview the form never
 * transmits anything; its sent state says so.
 */

const routes = [
  {
    id: "account-verification",
    label: "Account verification",
    text: "Opening an account for your institution, or documents for an existing one.",
    email: "accounts@truemarkbiolabs.com",
  },
  {
    id: "orders-shipping",
    label: "Orders & shipping",
    text: "Order status, cold-chain shipments, receiving questions, and returns.",
    email: "orders@truemarkbiolabs.com",
  },
  {
    id: "testing-certificates",
    label: "Testing & certificates",
    text: "Reading a CoA, lot lookups that don’t resolve, or specification questions.",
    email: "quality@truemarkbiolabs.com",
  },
  {
    id: "general-support",
    label: "General support",
    text: "Anything else — we’ll route it to the right person.",
    email: "help@truemarkbiolabs.com",
  },
];

type Key = "name" | "organization" | "email" | "message";
type Values = Record<Key, string> & { topic: string };
type Errors = Partial<Record<Key, string>>;

/** The fields in the order they appear, so the first problem named is the first one met. */
const order: Key[] = ["name", "organization", "email", "message"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function check(key: Key, raw: string): string | undefined {
  const value = raw.trim();
  if (key === "name") return value ? undefined : "Enter your name.";
  if (key === "organization") return LIVE || value ? undefined : "Enter your institution or company.";
  if (key === "email") {
    if (!value) return "Enter your work email.";
    return EMAIL.test(value) ? undefined : "Enter a full email address, like name@institution.edu.";
  }
  return value ? undefined : "Enter your message.";
}

/**
 * Move focus without letting the sticky header cover what received it. The frame's scroll
 * margin marks the clear zone below the header; the page scrolls only when the frame is
 * outside it. (A plain focus() or scrollIntoView "nearest" counts an element under the
 * header as visible and leaves it there.)
 */
function focusInView(target?: HTMLElement | null, frame?: HTMLElement | null) {
  if (!target) return;
  target.focus({ preventScroll: true });
  const box = frame ?? target;
  const { top, bottom } = box.getBoundingClientRect();
  const style = getComputedStyle(box);
  const clearTop = parseFloat(style.scrollMarginTop) || 0;
  const clearBottom = window.innerHeight - (parseFloat(style.scrollMarginBottom) || 0);
  if (top >= clearTop && bottom <= clearBottom) return;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  box.scrollIntoView({ block: top < clearTop ? "start" : "end", behavior: still ? "instant" : "smooth" });
}

function Field({
  id,
  label,
  hint,
  error,
  half = false,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  half?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`tm-contact-field${half ? " is-half" : ""}${error ? " is-invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p className="tm-contact-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p className="tm-contact-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export default function Contact() {
  const root = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const sentTitle = useRef<HTMLHeadingElement>(null);
  const returning = useRef(false);
  const focusNext = useRef<Key | null>(null);
  const uid = useId();
  const [values, setValues] = useState<Values>({
    name: "",
    organization: "",
    email: "",
    topic: routes[0].id,
    message: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState("");
  const [website, setWebsite] = useState("");
  const [sent, setSent] = useState(false);
  useReveal(root);

  // Focus follows the swap: to the plain notice when "sent", back to the first field on return.
  useEffect(() => {
    if (sent) focusInView(sentTitle.current);
    else if (returning.current) {
      returning.current = false;
      focusField("name");
    }
  }, [sent]);

  // Once the problems have rendered, bring the first one into view and focus it.
  useEffect(() => {
    const key = focusNext.current;
    if (!key) return;
    focusNext.current = null;
    focusField(key);
  }, [errors]);

  function focusField(key: Key) {
    const input = form.current?.querySelector<HTMLElement>(`[data-field="${key}"]`);
    focusInView(input, input?.closest<HTMLElement>(".tm-contact-field"));
  }

  const fieldId = (key: string) => `${uid}-${key}`;
  const describedBy = (key: Key, hint = false) =>
    [hint && `${fieldId(key)}-hint`, errors[key] && `${fieldId(key)}-error`].filter(Boolean).join(" ") || undefined;

  const change = (key: Key) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    // A field that is showing a problem re-checks as you type, so the message leaves once it is fixed.
    if (errors[key]) setErrors((e) => ({ ...e, [key]: check(key, value) }));
  };

  const leave = (key: Key) => (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    // Leaving a field you have typed in checks it; an empty one waits until you send.
    if (value.trim() || attempted) setErrors((e) => ({ ...e, [key]: check(key, value) }));
  };

  async function send(event: FormEvent<HTMLFormElement>) {
    // Design preview: nothing is transmitted. There is no action, no request, no storage.
    event.preventDefault();
    setAttempted(true);
    const next: Errors = {};
    for (const key of order) {
      const problem = LIVE && key === "organization" ? undefined : check(key, values[key]);
      if (problem) next[key] = problem;
    }
    const first = order.find((key) => next[key]);
    focusNext.current = first ?? null;
    setErrors(next);
    if (!first) {
      if (!LIVE) { setSent(true); return; }
      setBusy(true); setSendError("");
      try { await live().messages.sendContact({...values, website}); setSent(true); }
      catch (error) { setSendError(error instanceof Error ? error.message : "Check the form and try again."); }
      finally { setBusy(false); }
    }
  }

  function backToForm() {
    returning.current = true;
    setSent(false);
  }

  const route = routes.find((r) => r.id === values.topic) ?? routes[0];

  return (
    <div className="tm-page tm-contact" ref={root}>
      <section className="tm tm-contact-open" aria-labelledby="tm-contact-title">
        <div className="tm-contact-open-head">
          <p className="tm-eyebrow">Contact</p>
          <h1 id="tm-contact-title" className="tm-contact-title">
            Talk to a person
          </h1>
        </div>
        <p className="tm-contact-lead">
          Account verification, orders, shipping, or a question about a
          certificate — send it over and we’ll answer within one business day.
        </p>
      </section>

      <section className="tm tm-contact-main">
        <div className="tm-contact-directory">
          <ul className="tm-contact-routes">
            {routes.map((item, i) => (
              <li key={item.id} className="tm-contact-route" data-reveal style={{ "--tm-i": i } as CSSProperties}>
                <h2 className="tm-contact-route-title">{item.label}</h2>
                <p className="tm-contact-route-text">{item.text}</p>
                <a className="tm-contact-email" href={`mailto:${item.email}`}>
                  {item.email}
                </a>
              </li>
            ))}
          </ul>
          <p className="tm-contact-hours" data-reveal>
            <span className="tm-contact-hours-time">Mon–Fri · 9:00–17:00 ET</span>
            <span className="tm-contact-hours-reply">Response within 1 business day</span>
          </p>
        </div>

        <div className="tm-contact-compose" data-reveal style={{ "--tm-i": 1 } as CSSProperties}>
          {sent ? (
            <div className="tm-contact-sent">
              <h2 ref={sentTitle} tabIndex={-1} className="tm-contact-sent-title">
                {LIVE ? "Message sent." : "Design preview: messages are not sent."}
              </h2>
              {LIVE ? <p className="tm-contact-note">We'll reply within one business day at {values.email.trim()}.</p> : <div className="tm-contact-sent-route">
                <p className="tm-contact-route-title">{route.label}</p>
                <a className="tm-contact-email" href={`mailto:${route.email}`}>
                  {route.email}
                </a>
              </div>}
              <button type="button" className="tm-button tm-button-outline" onClick={backToForm}>
                Back to the form
              </button>
            </div>
          ) : (
            <>
            <h2 className="tm-contact-route-title tm-contact-compose-title">Send a message</h2>
            <form ref={form} className="tm-contact-form" noValidate onSubmit={send} aria-label="Send a message">
              {LIVE && <input name="website" style={{position:"absolute",width:1,height:1,padding:0,border:0,clipPath:"inset(50%)",overflow:"hidden",whiteSpace:"nowrap"}} aria-hidden="true" tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/>}
              <Field id={fieldId("name")} label="Name" error={errors.name} half>
                <input
                  id={fieldId("name")}
                  data-field="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={values.name}
                  onChange={change("name")}
                  onBlur={leave("name")}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={describedBy("name")}
                />
              </Field>
              <Field id={fieldId("organization")} label="Organization" error={errors.organization} half>
                <input
                  id={fieldId("organization")}
                  data-field="organization"
                  type="text"
                  autoComplete="organization"
                  placeholder="Institution or company"
                  required={!LIVE}
                  value={values.organization}
                  onChange={change("organization")}
                  onBlur={leave("organization")}
                  aria-invalid={errors.organization ? true : undefined}
                  aria-describedby={describedBy("organization")}
                />
              </Field>
              <Field id={fieldId("email")} label="Work email" error={errors.email}>
                <input
                  id={fieldId("email")}
                  data-field="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  spellCheck={false}
                  placeholder="name@institution.edu"
                  required
                  value={values.email}
                  onChange={change("email")}
                  onBlur={leave("email")}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={describedBy("email")}
                />
              </Field>
              <Field id={fieldId("topic")} label="Topic">
                <span className="tm-contact-select">
                  <select
                    id={fieldId("topic")}
                    value={values.topic}
                    onChange={(event) => setValues((v) => ({ ...v, topic: event.target.value }))}
                  >
                    {routes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} strokeWidth={1.6} aria-hidden="true" />
                </span>
              </Field>
              <Field
                id={fieldId("message")}
                label="Message"
                hint="Include a lot number if your question is about a specific vial."
                error={errors.message}
              >
                <textarea
                  id={fieldId("message")}
                  data-field="message"
                  rows={6}
                  required
                  value={values.message}
                  onChange={change("message")}
                  onBlur={leave("message")}
                  aria-invalid={errors.message ? true : undefined}
                  aria-describedby={describedBy("message", true)}
                />
              </Field>
              <div className="tm-contact-send">
                <button className="tm-button tm-button-primary" type="submit" disabled={busy}>
                  Send message
                </button>
                {sendError && <p className="tm-contact-error" role="alert">{sendError}</p>}
                <p className="tm-contact-note">Accounts are opened to verified research organizations only.</p>
              </div>
            </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
