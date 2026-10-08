import { useContext, useId, useMemo, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Undo2, Building2, Check, ChevronDown, ClipboardList, FileCheck2, FlaskConical, HelpCircle, LayoutGrid, Mail, Minus, PackageSearch, Plus, QrCode, Receipt, ShoppingBag, Tag, Truck, UserRoundPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { business, faqs, products } from "../data";
import { policies } from "../brand/policies";
import { routes } from "../brand/contact-routes";
import { aboutLead, principles, verbs, whoWeSupply } from "../brand/about-copy";
import { LIVE } from "../platform/mode";
import { live } from "../platform/live/runtime";
import { content } from "../platform/content";
import { store, useResource } from "../platform/store";
import type { Order } from "../platform/types";
import type { TrackedOrder } from "../platform/live/rows";
import { ShopContext } from "../shop/context";
import { productById, productCutout } from "../shop/catalog";
import { useBagCode } from "../shop/pages/checkout/Bag";
import { EMAIL, ORDER_NUMBER, lookUp, normaliseNumber } from "../shop/track-lookup";
import { USE_MAX, USE_MIN, attestations, giveDraft, institutionTypes, problem, type Key, type Values } from "../shop/pages/account/application";
import { chatContext } from "./chat-context";
import { OrderView } from "./LabDesk";
import type { OrderCard, Panel } from "./runtime";

/*
 * The desk's services: everything a visitor would otherwise click around the site for, each as a card
 * in the conversation. Tracking an order by its number and email, the bag, a discount code, the
 * policies and common questions, a message to the team, the research-account application (handed to
 * its page for the password and documents), the research blog and who TrueMark is. Each reads the
 * same data and words as its page, and a card's own fields never reach the model.
 */

const money = (value: number) => `$${value.toFixed(2)}`;
const go = <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />;

/** A labelled field in the desk's own style. */
function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="tm-desk-field" data-invalid={error ? "" : undefined}>
      <label htmlFor={id}>{label}</label>
      {children(id, error || hint ? `${id}-note` : undefined)}
      {(error || hint) && <p id={`${id}-note`} className={error ? "tm-desk-field-error" : "tm-desk-note"}>{error ?? hint}</p>}
    </div>
  );
}

/* ---------- Track an order, without signing in ---------- */

function cardOf(order: Order | TrackedOrder): OrderCard {
  return {
    id: order.number, number: order.number, status: order.status, placedAt: order.createdAt,
    events: order.events.slice(-7).map((e) => ({ status: e.status, at: e.at })),
    method: order.shipping.method, carrier: order.shipping.carrier, tracking: order.shipping.tracking, total: "total" in order ? order.total : 0,
    lines: order.lines.map((l) => { const p = products.find((x) => x.id === l.productId); return { id: l.productId, name: p?.name ?? l.productId, size: p?.size ?? "", quantity: l.quantity, lot: l.lot }; }),
    href: `/track/${encodeURIComponent(order.number)}`,
  };
}

function TrackPanel({ onNavigate }: { onNavigate: () => void }) {
  const [number, setNumber] = useState(""), [email, setEmail] = useState("");
  const [state, setState] = useState<{ status: "idle" | "busy" | "miss" | "failed"; error?: string; order?: OrderCard }>({ status: "idle" });
  async function find(event: FormEvent) {
    event.preventDefault();
    const n = normaliseNumber(number);
    if (!ORDER_NUMBER.test(n)) { setState({ status: "idle", error: "Order numbers look like TM-10478." }); return; }
    if (!EMAIL.test(email.trim())) { setState({ status: "idle", error: "Enter the email the order was placed with." }); return; }
    setState({ status: "busy" });
    try {
      const order = await lookUp(n, email);
      setState(order ? { status: "idle", order: cardOf(order) } : { status: "miss" });
    } catch { setState({ status: "failed" }); }
  }
  if (state.order) return <OrderView order={state.order} onNavigate={onNavigate} />;
  return (
    <form className="tm-desk-card tm-desk-form" onSubmit={find} noValidate aria-label="Track an order">
      <Field label="Order number">{(id, note) => <input id={id} className="tm-mono" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="TM-10478" autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-describedby={note} />}</Field>
      <Field label="Email it was placed with">{(id, note) => <input id={id} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@lab.org" autoComplete="email" aria-describedby={note} />}</Field>
      {state.error && <p className="tm-desk-field-error" role="alert">{state.error}</p>}
      {state.status === "miss" && <p className="tm-desk-field-error" role="alert">No order matches that number and email. Check both against your order confirmation.</p>}
      {state.status === "failed" && <p className="tm-desk-field-error" role="alert">The order couldn't be looked up just now. Try again in a moment.</p>}
      <div className="tm-desk-actions">
        <button type="submit" className="tm-desk-add" disabled={state.status === "busy"}>{state.status === "busy" ? "Looking it up" : "Track it"}</button>
        <Link className="tm-desk-link" to="/track" onClick={onNavigate}>Tracking page {go}</Link>
      </div>
    </form>
  );
}

/* ---------- The bag ---------- */

function BagPanel({ onNavigate, onAsk }: { onNavigate: () => void; onAsk?: (text: string) => void }) {
  const shop = useContext(ShopContext);
  const code = useBagCode();
  const settings = useResource(() => store.settings.get().catch(() => null), []);
  // Live, the bag and checkout open with a research account; the review site's sample bag is open to all.
  if (!shop || (LIVE && !chatContext()?.signedIn)) return (
    <div className="tm-desk-card">
      <p className="tm-desk-note">Your bag opens once you're signed in to a research account.</p>
      <div className="tm-desk-actions"><Link className="tm-desk-add" to="/access" onClick={onNavigate}>Sign in</Link></div>
    </div>
  );
  const lines = shop.cart.map((item) => ({ item, product: productById(item.id) })).filter((l) => l.product);
  if (!lines.length) return (
    <div className="tm-desk-card">
      <p className="tm-desk-note">Your bag is empty.</p>
      {onAsk && <div className="tm-chat-suggestions">
        <button type="button" className="tm-chat-chip" onClick={() => onAsk("Help me plan an order")}>Help me plan an order</button>
        <button type="button" className="tm-chat-chip" onClick={() => onAsk("What do you carry?")}>What do you carry?</button>
      </div>}
    </div>
  );
  const priced = lines.every((l) => l.product!.price != null);
  const subtotal = priced ? Math.round(lines.reduce((sum, l) => sum + l.product!.price! * l.item.quantity, 0) * 100) / 100 : null;
  const off = subtotal != null && code.discount ? Math.round(subtotal * code.discount.percent) / 100 : 0;
  const threshold = settings.data?.freeShippingThreshold ?? null;
  const remaining = threshold != null && subtotal != null ? Math.max(0, threshold - (subtotal - off)) : null;
  return (
    <article className="tm-desk-card tm-desk-bag" aria-label="Your bag">
      <ul className="tm-plan-lines">
        {lines.map(({ item, product }, i) => (
          <li key={item.id} style={{ "--tm-i": i } as CSSProperties}>
            <span className="tm-desk-thumb is-small"><img src={productCutout(product, "sm")} alt="" draggable={false} /></span>
            <span className="tm-plan-line-id">
              <span className="tm-desk-name">{product!.name} <span>{product!.size}</span></span>
              <span className="tm-desk-lot">Lot <span className="tm-mono">{product!.lot}</span></span>
            </span>
            <span className="tm-desk-stepper" role="group" aria-label={`Quantity of ${product!.name} ${product!.size}`}>
              <button type="button" aria-label="One fewer" onClick={() => shop.change(item.id, item.quantity - 1)}><Minus size={14} strokeWidth={2} aria-hidden="true" /></button>
              <output aria-live="polite">{item.quantity}</output>
              <button type="button" aria-label="One more" disabled={item.quantity >= 99} onClick={() => shop.change(item.id, item.quantity + 1)}><Plus size={14} strokeWidth={2} aria-hidden="true" /></button>
            </span>
            {priced && <span className="tm-plan-line-price">{money(product!.price! * item.quantity)}</span>}
          </li>
        ))}
      </ul>
      {subtotal != null && (
        <dl className="tm-plan-totals">
          {off > 0 && <div><dt>{code.discount!.code} · {code.discount!.percent}% off</dt><dd>−{money(off)}</dd></div>}
          <div className="tm-plan-total"><dt>Subtotal</dt><dd>{money(subtotal - off)}</dd></div>
        </dl>
      )}
      {remaining != null && <p className="tm-desk-note">{remaining > 0 ? `${money(remaining)} more ships it free.` : "It ships free."} Shipping and any tax are added at checkout.</p>}
      <div className="tm-desk-actions">
        <Link className="tm-desk-add" to="/checkout" onClick={onNavigate}>Check out</Link>
        <Link className="tm-desk-link" to="/cart" onClick={onNavigate}>Review the bag {go}</Link>
      </div>
    </article>
  );
}

/* ---------- A discount code ---------- */

function CodePanel() {
  const code = useBagCode();
  const [typed, setTyped] = useState("");
  return (
    <form className="tm-desk-card tm-desk-form" noValidate aria-label="Apply a discount code" onSubmit={(e) => { e.preventDefault(); void code.apply(typed).then((ok) => ok && setTyped("")); }}>
      {code.discount ? (
        <p className="tm-desk-done"><Check size={14} strokeWidth={2.2} aria-hidden="true" /><span><span className="tm-mono">{code.discount.code}</span> is applied: {code.discount.percent}% comes off at checkout.</span></p>
      ) : (
        <Field label="Discount or partner code" error={code.error ?? undefined}>
          {(id, note) => <input id={id} className="tm-mono" value={typed} onChange={(e) => { setTyped(e.target.value); code.clearError(); }} placeholder="FIRSTLOT" autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-describedby={note} />}
        </Field>
      )}
      <div className="tm-desk-actions">
        {code.discount
          ? <button type="button" className="tm-desk-quiet" onClick={code.remove}>Remove the code</button>
          : <button type="submit" className="tm-desk-add" disabled={code.checking || !typed.trim()}>{code.checking ? "Checking" : "Apply"}</button>}
      </div>
    </form>
  );
}

/* ---------- Policies and common questions ---------- */

type Section = { heading: string; blocks: { kind: string; text: string }[] };
const policyPath: Record<string, string> = { returns: "/refund_returns", refunds: "/refund_returns", shipping: "/shipping-policy", terms: "/terms", privacy: "/privacy-policy" };
const opensAt: Record<string, string> = { returns: "Eligible Returns", refunds: "Refunds", shipping: "Shipping Overview", terms: "Research Use Only", privacy: "Information We Collect" };

/** Sections that open and close in place, one at a time. */
function Accordion({ items, initial }: { items: { title: string; body: ReactNode }[]; initial: number }) {
  const [open, setOpen] = useState(initial);
  const id = useId();
  return (
    <div className="tm-desk-accordion">
      {items.map((item, i) => (
        <div key={item.title} data-open={open === i || undefined}>
          <h3><button type="button" aria-expanded={open === i} aria-controls={`${id}-${i}`} onClick={() => setOpen(open === i ? -1 : i)}>
            <span>{item.title}</span><ChevronDown size={16} strokeWidth={1.7} aria-hidden="true" />
          </button></h3>
          <div id={`${id}-${i}`} role="region" hidden={open !== i}>{item.body}</div>
        </div>
      ))}
    </div>
  );
}

function PolicyPanel({ topic, onNavigate }: { topic?: string; onNavigate: () => void }) {
  const policy = policies.find((p) => p.path === (policyPath[topic ?? ""] ?? topic)) ?? policies.find((p) => p.path === "/refund_returns")!;
  const sections = useMemo(() => {
    const list: Section[] = [];
    for (const block of policy.blocks) {
      if (block.kind === "heading") list.push({ heading: block.text, blocks: [] });
      else if (block.kind !== "signoff" && list.length) list.at(-1)!.blocks.push(block);
    }
    return list;
  }, [policy]);
  const want = opensAt[topic ?? ""];
  const initial = Math.max(0, sections.findIndex((s) => want && s.heading.includes(want)));
  return (
    <article className="tm-desk-card tm-desk-policy" aria-label={policy.title}>

      <Accordion initial={initial} items={sections.map((s) => ({
        title: s.heading.replace(/^\d+\.\s*/, ""),
        body: <>{s.blocks.map((b, i) => b.kind === "item" ? <p key={i} className="tm-desk-policy-item">{b.text}</p> : <p key={i}>{b.text}</p>)}</>,
      }))} />
      <div className="tm-desk-actions">
        <Link className="tm-desk-link" to={policy.path} onClick={onNavigate}>The full policy {go}</Link>
        <span className="tm-desk-note">Updated {policy.updated}</span>
      </div>
    </article>
  );
}

function FaqPanel({ topic }: { topic?: string }) {
  const asked = (topic ?? "").toLowerCase().replace(/[?’']/g, "");
  const initial = Math.max(0, faqs.findIndex(([q]) => asked && q.toLowerCase().replace(/[?’']/g, "").includes(asked)));
  return (
    <article className="tm-desk-card tm-desk-policy" aria-label="Common questions">
      <Accordion initial={topic ? initial : -1} items={faqs.map(([q, a]) => ({ title: q, body: <p>{a}</p> }))} />
    </article>
  );
}

/* ---------- A message to the team ---------- */

function ContactPanel({ topic, note, onNavigate }: { topic?: string; note?: string; onNavigate: () => void }) {
  const signedIn = Boolean(chatContext()?.signedIn);
  const [values, setValues] = useState({ topic: routes.some((r) => r.id === topic) ? topic! : "general-support", name: "", email: "", organization: "", message: note ?? "" });
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"name" | "email" | "message", string>>>({});
  const [state, setState] = useState<"idle" | "busy" | "sent" | "failed">("idle");
  const [failure, setFailure] = useState("");
  const route = routes.find((r) => r.id === values.topic) ?? routes[0];
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));
  async function send(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!values.name.trim()) next.name = "Enter your name.";
    if (!EMAIL.test(values.email.trim())) next.email = "Enter a full email address, like name@institution.edu.";
    if (!values.message.trim()) next.message = "Enter your message.";
    setErrors(next);
    if (Object.keys(next).length) return;
    // In the design preview nothing is transmitted, as on the Contact page.
    if (!LIVE) { setState("sent"); return; }
    setState("busy");
    try { await live().messages.sendContact({ ...values, website }); setState("sent"); }
    catch (error) { setFailure(error instanceof Error ? error.message : "Check the form and try again."); setState("failed"); }
  }
  if (state === "sent") return (
    <div className="tm-desk-card">
      <p className="tm-desk-done"><Check size={14} strokeWidth={2.2} aria-hidden="true" /><span>Sent to {route.label.toLowerCase()}. We'll reply to {values.email.trim()}.</span></p>
      {!LIVE && <p className="tm-desk-note">Design preview: nothing was transmitted.</p>}
    </div>
  );
  return (
    <form className="tm-desk-card tm-desk-form" onSubmit={send} noValidate aria-label="Message the TrueMark team">
      <fieldset className="tm-plan-step">
        <legend className="assistant-a11y">Topic</legend>
        <div className="tm-plan-body">
          <div className="tm-desk-classes tm-desk-topics" role="group">
            {routes.map((r) => <button key={r.id} type="button" aria-pressed={values.topic === r.id} onClick={() => setValues((v) => ({ ...v, topic: r.id }))}>{r.label}</button>)}
          </div>
          <p className="tm-desk-note">{route.text}</p>
        </div>
      </fieldset>
      <div className="tm-desk-field-row">
        <Field label="Name" error={errors.name}>{(id, d) => <input id={id} value={values.name} onChange={set("name")} autoComplete="name" aria-describedby={d} />}</Field>
        <Field label="Work email" error={errors.email}>{(id, d) => <input id={id} type="email" inputMode="email" value={values.email} onChange={set("email")} autoComplete="email" aria-describedby={d} />}</Field>
      </div>
      {!signedIn && <Field label="Institution or company" hint="Optional">{(id, d) => <input id={id} value={values.organization} onChange={set("organization")} autoComplete="organization" aria-describedby={d} />}</Field>}
      <Field label="Message" error={errors.message} hint={note ? "Your conversation so far is included; edit it as you like." : undefined}>
        {(id, d) => <textarea id={id} rows={5} value={values.message} onChange={set("message")} maxLength={4000} aria-describedby={d} />}
      </Field>
      {/* Left empty by people; filled only by bots. */}
      <input className="tm-desk-honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} />
      {state === "failed" && <p className="tm-desk-field-error" role="alert">{failure}</p>}
      <div className="tm-desk-actions">
        <button type="submit" className="tm-desk-add" disabled={state === "busy"}>{state === "busy" ? "Sending" : "Send to the team"}</button>
        <Link className="tm-desk-link" to="/contact" onClick={onNavigate}>Contact page {go}</Link>
      </div>
      <p className="tm-desk-note">Or write to <a href={`mailto:${route.email}`}>{route.email}</a>.</p>
    </form>
  );
}

/* ---------- The research-account application ---------- */

const applySteps: { title: string; keys: Key[] }[] = [
  { title: "About you", keys: ["name", "email", "role"] },
  { title: "Your institution", keys: ["institution", "institutionType", "website", "country"] },
  { title: "Research use", keys: ["researchArea", "intendedUse"] },
  { title: "Four confirmations", keys: ["attestations"] },
];
const blank: Values = { name: "", email: "", role: "", institution: "", institutionType: "", website: "", country: "", researchArea: "", intendedUse: "" };
const APPLY_KEY = "tm-desk-apply";
function readApply(): { step: number; values: Values; confirmed: string[] } {
  try { const saved = JSON.parse(sessionStorage.getItem(APPLY_KEY) ?? "null"); if (saved?.values) return saved; } catch { /* Start fresh. */ }
  return { step: 0, values: blank, confirmed: [] };
}

function ApplyPanel({ onNavigate }: { onNavigate: () => void }) {
  const signedIn = Boolean(chatContext()?.signedIn);
  const [state, setState] = useState(readApply);
  const [shown, setShown] = useState(false);
  const save = (next: typeof state) => { setState(next); try { sessionStorage.setItem(APPLY_KEY, JSON.stringify(next)); } catch { /* This visit still has it. */ } };
  const { step, values, confirmed } = state;
  const errorOf = (key: Key) => (shown ? problem(key, values, confirmed) : undefined);
  const set = (key: keyof Values) => (e: { target: { value: string } }) => save({ ...state, values: { ...values, [key]: e.target.value } });
  const next = () => {
    const keys = applySteps[step]?.keys ?? [];
    if (keys.some((key) => problem(key, values, confirmed))) { setShown(true); return; }
    setShown(false); save({ ...state, step: step + 1 });
  };
  if (signedIn) return <div className="tm-desk-card"><p className="tm-desk-note">You're signed in to a research account already.</p></div>;
  const field = (key: keyof Values, label: string, extra: Record<string, unknown> = {}, hint?: string) => (
    <Field label={label} error={errorOf(key)} hint={hint}>{(id, d) => <input id={id} value={values[key]} onChange={set(key)} aria-describedby={d} aria-invalid={Boolean(errorOf(key)) || undefined} {...extra} />}</Field>
  );
  return (
    <article className="tm-desk-card tm-desk-apply" aria-label="Research account application">
      <ol className="tm-desk-apply-rail" aria-label="Steps">
        {applySteps.map((s, i) => <li key={s.title} data-state={i < step ? "done" : i === step ? "current" : undefined} aria-current={i === step ? "step" : undefined}>{s.title}</li>)}
      </ol>
      <div className="tm-plan-current" key={step}>
        {step === 0 && <div className="tm-plan-body">
          {field("name", "Full name", { autoComplete: "name" })}
          {field("email", "Work email", { type: "email", inputMode: "email", autoComplete: "email" })}
          {field("role", "Your role", { autoComplete: "organization-title" }, "For example, research scientist or lab manager.")}
        </div>}
        {step === 1 && <div className="tm-plan-body">
          {field("institution", "Institution or company", { autoComplete: "organization" })}
          <fieldset className="tm-plan-step">
            <legend className="tm-desk-kicker">Type of institution</legend>
            <div className="tm-plan-body"><div className="tm-desk-classes tm-desk-topics" role="group">
              {institutionTypes.map((t) => <button key={t} type="button" aria-pressed={values.institutionType === t} onClick={() => save({ ...state, values: { ...values, institutionType: t } })}>{t}</button>)}
            </div>{errorOf("institutionType") && <p className="tm-desk-field-error">{errorOf("institutionType")}</p>}</div>
          </fieldset>
          {field("website", "Website", { type: "url", inputMode: "url", autoComplete: "url" })}
          {field("country", "Country", { autoComplete: "country-name" })}
        </div>}
        {step === 2 && <div className="tm-plan-body">
          {field("researchArea", "Research area")}
          <Field label="How the materials will be used in the lab" error={errorOf("intendedUse")} hint={`${values.intendedUse.trim().length} / ${USE_MAX} · at least ${USE_MIN} characters`}>
            {(id, d) => <textarea id={id} rows={4} maxLength={USE_MAX} value={values.intendedUse} onChange={set("intendedUse")} aria-describedby={d} />}
          </Field>
        </div>}
        {step === 3 && <fieldset className="tm-plan-step">
          <legend className="tm-desk-note">Confirm each statement.</legend>
          <div className="tm-plan-body tm-desk-checks">
            {attestations.map((a) => {
              const on = confirmed.includes(a.id);
              return <label key={a.id} className="tm-desk-check"><input type="checkbox" checked={on} onChange={() => save({ ...state, confirmed: on ? confirmed.filter((x) => x !== a.id) : [...confirmed, a.id] })} /><span className="tm-desk-check-box" aria-hidden="true"><Check size={12} strokeWidth={2.4} /></span><span>{a.label}</span></label>;
            })}
            {errorOf("attestations") && <p className="tm-desk-field-error">{errorOf("attestations")}</p>}
          </div>
        </fieldset>}
        {step === 4 && <div className="tm-plan-body">
          <p className="tm-desk-done"><Check size={14} strokeWidth={2.2} aria-hidden="true" /><span>That's everything the chat can take. {LIVE ? "On the application page, choose a password, add any supporting documents, check each step and submit." : "On the application page, check each step and submit."}</span></p>
        </div>}
      </div>
      <div className="tm-desk-actions">
        {step < 4
          ? <button type="button" className="tm-desk-add" onClick={next}>{step === 3 ? "Done" : "Continue"}</button>
          : <Link className="tm-desk-add" to="/access/apply" onClick={() => { giveDraft(values, confirmed); try { sessionStorage.removeItem(APPLY_KEY); } catch { /* Fine. */ } onNavigate(); }}>Finish on the application page</Link>}
        {step > 0 && <button type="button" className="tm-desk-quiet" onClick={() => { setShown(false); save({ ...state, step: step - 1 }); }}>Back</button>}
      </div>
      {step < 4 && <p className="tm-desk-note">Every application is reviewed before an account can order. Your answers stay in this browser until you send them.</p>}
    </article>
  );
}

/* ---------- The research blog ---------- */

function ArticlesPanel({ onNavigate }: { onNavigate: () => void }) {
  const list = useResource(() => content.articles.list().catch(() => []), []);
  if (list.loading) return <div className="tm-desk-card"><p className="tm-desk-note">Opening the research blog…</p></div>;
  const items = (list.data ?? []).filter((a) => a.status !== "draft");
  return (
    <ul className="tm-desk-card tm-desk-rows tm-desk-articles" aria-label="Research blog">
      {items.map((a, i) => (
        <li key={a.slug} style={{ "--tm-i": i } as CSSProperties}>
          <Link to={`/research-blog/${encodeURIComponent(a.slug)}`} onClick={onNavigate}>
            <span className="tm-desk-kicker">{a.kicker}{a.readingMinutes ? ` · ${a.readingMinutes} min read` : ""}</span>
            <span className="tm-desk-name">{a.title}</span>
            <span className="tm-desk-note">{a.excerpt}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Who TrueMark is ---------- */

function AboutPanel({ onNavigate }: { onNavigate: () => void }) {
  return (
    <article className="tm-desk-card tm-desk-about" aria-label="About TrueMark">
      <p className="tm-desk-profile-what">{aboutLead}</p>
      <ol className="tm-desk-steps">
        {verbs.map((v, i) => (
          <li key={v.verb} style={{ "--tm-i": i + 1 } as CSSProperties}>
            <span className="tm-desk-node" aria-hidden="true" />
            <div><p className="tm-desk-step-title"><span className="tm-desk-step-no">{v.number}</span>{v.verb}</p><p className="tm-desk-note">{v.text}</p></div>
          </li>
        ))}
      </ol>
      <ul className="tm-desk-principles">
        {principles.map((p) => <li key={p.title}><p className="tm-desk-step-title">{p.title}</p><p className="tm-desk-note">{p.text}</p></li>)}
        <li><p className="tm-desk-step-title">Who we supply</p><p className="tm-desk-note">{whoWeSupply}</p></li>
      </ul>
      <p className="tm-desk-note">{business.legalName ? `${business.legalName}, ` : ""}{business.mailingAddress.join(", ")}</p>
      <div className="tm-desk-actions">
        <Link className="tm-desk-link" to="/about" onClick={onNavigate}>About TrueMark {go}</Link>
        <Link className="tm-desk-link" to="/quality" onClick={onNavigate}>Our quality process {go}</Link>
      </div>
    </article>
  );
}

/* ---------- Everything the desk can do ---------- */

export const menu: { title: string; items: [string, LucideIcon][] }[] = [
  { title: "Find", items: [["Help me plan an order", ClipboardList], ["What do you carry?", LayoutGrid], ["What are your most popular compounds?", PackageSearch]] },
  { title: "Verify", items: [["Verify a lot", QrCode], ["Show me a real certificate", FileCheck2], ["How is every lot tested?", FlaskConical]] },
  { title: "Order", items: [["What's in my bag?", ShoppingBag], ["Apply a discount code", Tag], ["Track an order", Truck], ["How does shipping work?", Receipt]] },
  { title: "Help", items: [["Apply for an account", UserRoundPlus], ["What's your return policy?", Undo2], ["Common questions", HelpCircle], ["Talk to a person", Mail], ["Show me the research blog", BookOpen], ["About TrueMark", Building2]] },
];

function MenuPanel({ onAsk }: { onAsk?: (text: string) => void }) {
  return (
    <article className="tm-desk-card tm-desk-menu" aria-label="What I can help with">
      {menu.map((group) => (
        <section key={group.title}>
          <p className="tm-desk-kicker">{group.title}</p>
          <ul>
            {group.items.map(([text, Icon]) => (
              <li key={text}><button type="button" disabled={!onAsk} onClick={() => onAsk?.(text)}>
                <Icon size={15} strokeWidth={1.6} aria-hidden="true" /><span>{text}</span>
              </button></li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

/** One of the desk's services, as its card. */
export function PanelView({ panel, topic, note, onNavigate, onAsk }: { panel: Panel; topic?: string; note?: string; onNavigate: () => void; onAsk?: (text: string) => void }) {
  switch (panel) {
    case "track": return <TrackPanel onNavigate={onNavigate} />;
    case "bag": return <BagPanel onNavigate={onNavigate} onAsk={onAsk} />;
    case "code": return <CodePanel />;
    case "policy": return <PolicyPanel topic={topic} onNavigate={onNavigate} />;
    case "faq": return <FaqPanel topic={topic} />;
    case "contact": return <ContactPanel topic={topic} note={note} onNavigate={onNavigate} />;
    case "apply": return <ApplyPanel onNavigate={onNavigate} />;
    case "articles": return <ArticlesPanel onNavigate={onNavigate} />;
    case "about": return <AboutPanel onNavigate={onNavigate} />;
    case "menu": return <MenuPanel onAsk={onAsk} />;
  }
}
