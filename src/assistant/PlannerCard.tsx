import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { categories, products } from "../data";
import { LIVE } from "../platform/mode";
import { store, useResource } from "../platform/store";
import { firstOrderOffer, productCutout } from "../shop/catalog";
import { usePrefersReducedMotion } from "../shop/motion";
import { shippingCopy } from "./copy";
import { STEPS, amountLabel, compoundsOf, defaultAmount, fill, rangeOf, shippingFor, type Compound, type Plan, type PlanStep } from "./planner";
import { startPlan, updatePlan, usePlan } from "./planner-store";

/*
 * The order planner, as one card in the conversation: each question in turn, the answers kept above
 * it (each can be changed), and at the end the order itself, built from the catalog's sizes, prices,
 * lots and shipping. It asks about the order, never about a body.
 */

const money = (value: number) => `$${value.toFixed(2)}`;
const reasons: Record<NonNullable<Plan["why"]>, string> = { new: "Starting a new study", restock: "Restocking", first: "My first order with TrueMark" };
const timing: Record<NonNullable<Plan["when"]>, string> = { soon: "As soon as possible", week: "Within a week", flexible: "No rush" };
const storage: Record<NonNullable<Plan["freezer"]>, string> = { yes: "Yes, it's ready", later: "Not yet" };
const classOf = (id: string) => { const c = categories.find((x) => x.id === id); return c?.short ?? c?.name ?? id; };
const cutout = (id: string) => productCutout(products.find((p) => p.id === id), "sm");

/** The choices for one question, each a button; choosing one answers the question. */
function Choices<T extends string>({ legend, note, options, value, onChoose, children }: { legend: string; note?: string; options: [T, string, string?][]; value?: T; onChoose: (value: T) => void; children?: ReactNode }) {
  return (
    <fieldset className="tm-plan-step">
      <legend className="tm-plan-q" tabIndex={-1}>{legend}</legend>
      <div className="tm-plan-body">
      {note && <p className="tm-desk-note">{note}</p>}
      <div className="tm-plan-choices">
        {options.map(([key, label, detail], i) => (
          <button key={key} type="button" aria-pressed={value === key} style={{ "--tm-i": i } as CSSProperties} onClick={() => onChoose(key)}>
            <span>{label}</span>{detail && <span className="tm-desk-note">{detail}</span>}
          </button>
        ))}
      </div>
      {children}
      </div>
    </fieldset>
  );
}

/* Which compounds: the shelf, by class, each vial a toggle. */
function Pick({ compounds, plan }: { compounds: Compound[]; plan: Plan }) {
  const classes = useMemo(() => [...new Set(compounds.map((c) => c.category))], [compounds]);
  const [shown, setShown] = useState<string | null>(null);
  const list = shown ? compounds.filter((c) => c.category === shown) : compounds;
  const toggle = (name: string) => updatePlan((p) => ({ picks: p.picks.includes(name) ? p.picks.filter((x) => x !== name) : [...p.picks, name] }));
  return (
    <fieldset className="tm-plan-step tm-plan-pick">
      <legend className="tm-plan-q" tabIndex={-1}>Which compounds are you after?</legend>
      <div className="tm-plan-body">
      <p className="tm-desk-note">Choose one or several.</p>
      <div className="tm-desk-classes" role="group" aria-label="Class">
        <button type="button" aria-pressed={shown == null} onClick={() => setShown(null)}>All</button>
        {classes.map((id) => <button key={id} type="button" aria-pressed={shown === id} onClick={() => setShown(id)}>{classOf(id)}</button>)}
      </div>
      <ul className="tm-desk-shelf">
        {list.map((c) => {
          const chosen = plan.picks.includes(c.name);
          return (
            <li key={c.name}>
              <button type="button" aria-pressed={chosen} onClick={() => toggle(c.name)}>
                <span className="tm-desk-shelf-vial"><img src={cutout(c.sizes[0].id)} alt="" draggable={false} loading="lazy" />
                  <span className="tm-plan-tick" aria-hidden="true"><Check size={12} strokeWidth={2.4} /></span></span>
                <span className="tm-desk-shelf-name">{c.name}</span>
                <span className="tm-desk-note">{c.sizes.length > 1 ? `${c.sizes.length} sizes` : c.sizes[0].size}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className="tm-desk-add tm-plan-next" disabled={!plan.picks.length} onClick={() => updatePlan(() => ({ step: "amount" }))}>
        {plan.picks.length ? `Continue with ${plan.picks.length}` : "Choose a compound"}
      </button>
      </div>
    </fieldset>
  );
}

/* How much: a slider for each compound, and the vials that make it up. */
function Amounts({ chosen, plan }: { chosen: Compound[]; plan: Plan }) {
  const id = useId();
  return (
    <fieldset className="tm-plan-step">
      <legend className="tm-plan-q" tabIndex={-1}>How much do you need?</legend>
      <div className="tm-plan-body">
      <p className="tm-desk-note">Set the total, and I'll work out the vials.</p>
      <ul className="tm-plan-amounts">
        {chosen.map((c, i) => {
          const range = rangeOf(c), amount = plan.amounts[c.name] ?? defaultAmount(c), made = fill(c, amount);
          return (
            <li key={c.name}>
              <div className="tm-plan-amount-head">
                <label htmlFor={`${id}-${i}`} className="tm-desk-name">{c.name}</label>
                <output htmlFor={`${id}-${i}`} className="tm-plan-amount">{amountLabel(c, amount)}</output>
              </div>
              <input id={`${id}-${i}`} type="range" min={range.min} max={range.max} step={range.step} value={amount}
                aria-valuetext={amountLabel(c, amount)} style={{ "--tm-plan-fill": (amount - range.min) / (range.max - range.min) } as CSSProperties}
                onChange={(e) => { const value = Number(e.target.value); updatePlan((p) => ({ amounts: { ...p.amounts, [c.name]: value } })); }} />
              <p className="tm-plan-made">
                <span>{made.lines.map((l) => `${l.quantity} × ${l.size.size}`).join(" + ")}{made.mg != null && made.mg > amount ? ` · ${made.mg} mg in all` : ""}</span>
                {made.cost != null ? <span>{money(made.cost)}{made.saves ? <span className="tm-plan-saves"> · saves {money(made.saves)}</span> : null}</span> : null}
              </p>
            </li>
          );
        })}
      </ul>
      <button type="button" className="tm-desk-add tm-plan-next" onClick={() => updatePlan(() => ({ step: "when" }))}>Continue</button>
      </div>
    </fieldset>
  );
}

/** A lot's own HPLC purity, read from its record. */
function Purity({ lot }: { lot: string }) {
  const record = useResource(() => store.lots.get(lot), [lot]);
  const hplc = record.data?.status === "released" ? record.data.results.find((r) => r.method === "HPLC") : undefined;
  return <>Lot <span className="tm-mono">{lot}</span>{hplc && <> · HPLC {hplc.value}{hplc.unit}</>}</>;
}

/* The order itself. */
function Summary({ chosen, plan, onNavigate, onAdd }: { chosen: Compound[]; plan: Plan; onNavigate: () => void; onAdd?: (id: string, quantity: number) => void }) {
  const shipping = useResource(async () => { const [methods, settings] = await Promise.all([store.catalog.shippingMethods(), store.settings.get()]); return { methods, settings }; }, []);
  const offer = useResource(() => (plan.why === "first" ? (LIVE ? store.catalog.validateCode("FIRSTLOT") : Promise.resolve(firstOrderOffer)).catch(() => null) : Promise.resolve(null)), [plan.why]);
  const lines = chosen.flatMap((c) => fill(c, plan.amounts[c.name] ?? defaultAmount(c)).lines.map((l) => ({ ...l, name: c.name })));
  const priced = lines.every((l) => l.size.price != null);
  const subtotal = priced ? Math.round(lines.reduce((sum, l) => sum + l.size.price! * l.quantity, 0) * 100) / 100 : null;
  const ship = shipping.data ? shippingFor(plan.when, subtotal, shipping.data.methods, shipping.data.settings) : null;
  const vials = lines.reduce((n, l) => n + l.quantity, 0);
  const tooMany = lines.some((l) => l.quantity > 99);
  return (
    <div className="tm-plan-step tm-plan-summary">
      <p className="tm-plan-q" tabIndex={-1}>Your order plan</p>
      <ul className="tm-plan-lines">
        {lines.map((l, i) => (
          <li key={l.size.id} style={{ "--tm-i": i } as CSSProperties}>
            <span className="tm-desk-thumb is-small"><img src={cutout(l.size.id)} alt="" draggable={false} /></span>
            <span className="tm-plan-line-id">
              <span className="tm-desk-name">{l.name} <span>{l.size.size}</span></span>
              <span className="tm-desk-lot"><Purity lot={l.size.lot} /></span>
            </span>
            <span className="tm-plan-line-qty">× {l.quantity}</span>
            {priced && <span className="tm-plan-line-price">{money(l.size.price! * l.quantity)}</span>}
          </li>
        ))}
      </ul>
      <dl className="tm-plan-totals">
        {ship && <div><dt>{ship.method.label}</dt><dd>{ship.price === 0 ? "Free" : money(ship.price)}</dd></div>}
        {subtotal != null && ship && <div className="tm-plan-total"><dt>Total, {vials} {vials === 1 ? "vial" : "vials"}</dt><dd>{money(subtotal + ship.price)}</dd></div>}
      </dl>
      {ship && ship.remaining != null && ship.remaining > 0 && ship.method.id === shipping.data?.settings.freeShippingMethod && <p className="tm-desk-note">{money(ship.remaining)} more ships it free.</p>}
      {plan.freezer === "later" && <p className="tm-plan-heads-up">{shippingCopy[2]}</p>}
      {offer.data?.percent ? <p className="tm-desk-offer"><span className="tm-desk-presence" aria-hidden="true" /><span>{offer.data.percent}% off your first order with <span className="tm-mono">FIRSTLOT</span></span></p> : null}
      {tooMany && <p className="tm-desk-note">The bag takes up to 99 of a vial; lower an amount to add this plan.</p>}
      <div className="tm-desk-actions">
        {!priced ? <>
          <Link className="tm-desk-add" to="/access/apply" onClick={onNavigate}>Apply for an account</Link>
          <Link className="tm-desk-link" to="/access" onClick={onNavigate}>Sign in for pricing <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" /></Link>
        </> : plan.added ? <>
          <p className="tm-desk-add" data-added=""><Check size={14} strokeWidth={2.2} aria-hidden="true" /> In your bag</p>
          <Link className="tm-desk-link" to="/cart" onClick={onNavigate}>Review your bag <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" /></Link>
        </> : onAdd ? (
          <button type="button" className="tm-desk-add" disabled={tooMany} onClick={() => { for (const l of lines) onAdd(l.size.id, l.quantity); updatePlan(() => ({ added: true })); }}>Add all to bag</button>
        ) : <Link className="tm-desk-link" to="/products" onClick={onNavigate}>Go to the shop <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" /></Link>}
      </div>
      {!priced && <p className="tm-desk-note">Your plan stays on this device, ready for when you sign in.</p>}
      <button type="button" className="tm-desk-quiet tm-plan-restart" onClick={() => startPlan({ card: plan.card })}>Start over</button>
    </div>
  );
}

/** What each answered question says, kept above the one being asked. */
function answerOf(step: PlanStep, plan: Plan, chosen: Compound[]): string | null {
  switch (step) {
    case "why": return plan.why ? reasons[plan.why] : null;
    case "what": return chosen.length ? chosen.map((c) => c.name).join(", ") : null;
    case "amount": return chosen.length ? chosen.map((c) => amountLabel(c, plan.amounts[c.name] ?? defaultAmount(c))).join(" · ") : null;
    case "when": return plan.when ? timing[plan.when] : null;
    case "storage": return plan.freezer ? storage[plan.freezer] : null;
    default: return null;
  }
}
const asked: Record<PlanStep, string> = { why: "What brings you in", what: "Compounds", amount: "Amounts", when: "Needed", storage: "−20 °C storage", plan: "" };

export function PlannerView({ card, onNavigate, onAdd }: { card: string; onNavigate: () => void; onAdd?: (id: string, quantity: number) => void }) {
  const plan = usePlan();
  const reduced = usePrefersReducedMotion();
  const compounds = useMemo(() => compoundsOf(products), []);
  const methods = useResource(() => store.catalog.shippingMethods().catch(() => []), []);
  const current = useRef<HTMLDivElement>(null);
  const shown = useRef<PlanStep | null>(null);
  // A new question comes into view, and the reader's place moves to it; the first one stays where it arrived.
  useEffect(() => {
    if (!plan || plan.card !== card) return;
    if (shown.current && shown.current !== plan.step) {
      current.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
      current.current?.querySelector<HTMLElement>(".tm-plan-q")?.focus({ preventScroll: true });
    }
    shown.current = plan.step;
  }, [plan?.step, plan?.card, card, reduced, plan]);

  if (!plan || plan.card !== card) return <p className="tm-desk-done"><span>This plan continues further down.</span></p>;
  const chosen = plan.picks.map((name) => compounds.find((c) => c.name === name)).filter((c): c is Compound => Boolean(c));
  const at = STEPS.indexOf(plan.step);
  const open = [...(methods.data ?? [])].filter((m) => m.active !== false).sort((a, b) => a.price - b.price);
  const go = (step: PlanStep) => updatePlan(() => ({ step }));

  return (
    <article className="tm-desk-card tm-desk-planner" aria-label="Order planner">
      {at > 0 && (
        <dl className="tm-plan-answers">
          {STEPS.slice(0, at).map((step) => {
            const answer = answerOf(step, plan, chosen);
            return answer && <div key={step}><dt>{asked[step]}</dt><dd><span>{answer}</span><button type="button" className="tm-plan-change" onClick={() => go(step)} aria-label={`Change ${asked[step].toLowerCase()}`}>Change</button></dd></div>;
          })}
        </dl>
      )}
      <div ref={current} key={plan.step} className="tm-plan-current">
        {plan.step === "why" && <Choices legend="What brings you in?" options={[["new", reasons.new], ["restock", reasons.restock], ["first", reasons.first]]} value={plan.why}
          onChoose={(why) => updatePlan((p) => ({ why, step: p.picks.length ? "amount" : "what" }))} />}
        {plan.step === "what" && <Pick compounds={compounds} plan={plan} />}
        {plan.step === "amount" && (chosen.length ? <Amounts chosen={chosen} plan={plan} /> : <Pick compounds={compounds} plan={plan} />)}
        {plan.step === "when" && <Choices legend="When do you need it?" value={plan.when}
          options={[["soon", timing.soon, open.at(-1)?.label], ["week", timing.week, open[0]?.label], ["flexible", timing.flexible, open[0]?.label]]}
          onChoose={(when) => updatePlan(() => ({ when, step: "storage" }))} />}
        {plan.step === "storage" && <Choices legend="Will −20 °C storage be ready when it arrives?" value={plan.freezer}
          options={[["yes", storage.yes], ["later", storage.later]]} onChoose={(freezer) => updatePlan(() => ({ freezer, step: "plan" }))} />}
        {plan.step === "plan" && <Summary chosen={chosen} plan={plan} onNavigate={onNavigate} onAdd={onAdd} />}
      </div>
    </article>
  );
}
