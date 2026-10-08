import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ClipboardList, FileCheck2, History, Repeat2, FlaskConical, LayoutGrid, QrCode, Scale, Snowflake, Truck, UserRoundPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Certificate, resultValue } from "../brand/Certificate";
import { Markdown } from "../brand/Markdown";
import { usePrefersReducedMotion } from "../shop/motion";
import { LotTrace } from "../brand/LotTrace";
import { store, useResource } from "../platform/store";
import { lotPeaks } from "./lot-lines";
import { firstOrderOffer, productById, productCutout } from "../shop/catalog";
import { LIVE } from "../platform/mode";
import { process, specification } from "../brand/quality-copy";
import { handlingCopy } from "./copy";
import type { LotRecord } from "../shop/records";
import type { CompoundProfile } from "./profiles";
import { chatContext as chatContextNow, type ChatContext } from "./chat-context";
import type { Artifact, CatalogTile, OrderCard, Peak, ProductCard, ShippingCard, Source } from "./runtime";
import { categories, products } from "../data";
import { PlannerView } from "./PlannerCard";
import { PanelView } from "./DeskServices";
import { usePlan } from "./planner-store";
import { returningProduct } from "./recent";
import "./lab-desk.css";

/*
 * The storefront chat as TrueMark's lab desk: it answers from the records and shows them. Each
 * answer arrives as the record itself (a certificate with its lot's own line, a product, a side by
 * side, an order's progress, shipping), followed by where its facts came from.
 */

const money = (value: number | null) => (value == null ? "Price on request" : `$${value.toFixed(2)}`);
const categoryName = (id: string) => { const c = categories.find((x) => x.id === id); return c?.short ?? c?.name ?? id; };
const statusWord: Record<string, string> = { placed: "Placed", paid: "Paid", packed: "Packed", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded" };
const day = (iso?: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
};

/* ---------- Answers as records ---------- */

function ProductView({ card, onAdd, onNavigate }: { card: ProductCard; onAdd?: (id: string, quantity: number) => void; onNavigate: () => void }) {
  const [chosen, setChosen] = useState(card.id);
  const [added, setAdded] = useState<string | null>(null);
  // A size chosen here: its price arrives softly in the old one's place.
  const [switched, setSwitched] = useState(false);
  const size = card.sizes.find((s) => s.id === chosen) ?? { id: card.id, size: card.size, price: card.price };
  // The lot and its purity belong to the size that was asked about; other sizes have their own lots.
  const own = size.id === card.id;
  return (
    <article className="tm-desk-card tm-desk-product" aria-label={`${card.name} ${size.size}`}>
      <div className="tm-desk-product-top">
        <span className="tm-desk-thumb">{card.image && <img src={card.image} alt="" draggable={false} />}</span>
        <div className="tm-desk-product-id">
          <p className="tm-desk-name">{card.name} <span>{size.size}</span></p>
          {size.price == null
            ? <p className="tm-desk-price"><Link className="tm-desk-signin" to="/access" onClick={onNavigate}>Sign in for pricing</Link></p>
            : <p className="tm-desk-price" key={size.id} data-switched={switched || undefined}>{money(size.price)}</p>}
          {own && <p className="tm-desk-lot">Lot <span className="tm-mono">{card.lot}</span>{card.purity && <> · HPLC {card.purity}</>}</p>}
        </div>
      </div>
      {card.sizes.length > 1 && (
        <div className="tm-desk-sizes" role="group" aria-label="Size">
          {card.sizes.map((s) => (
            <button key={s.id} type="button" aria-pressed={s.id === chosen} onClick={() => { setChosen(s.id); setSwitched(true); }}>{s.size}</button>
          ))}
        </div>
      )}
      <dl className="tm-desk-spec">
        {card.spec.slice(0, 4).map((row, i) => <div key={row.label} style={{ "--tm-i": i + 2 } as CSSProperties}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
      </dl>
      <div className="tm-desk-actions">
        {onAdd && size.price != null && (
          <button type="button" className="tm-desk-add" data-added={added === size.id || undefined} onClick={() => { onAdd(size.id, 1); setAdded(size.id); }}>
            {added === size.id ? <><Check size={14} strokeWidth={2.2} aria-hidden="true" /> Added to your bag</> : "Add to bag"}
          </button>
        )}
        <Link className="tm-desk-link" to={`/product/${encodeURIComponent(size.id)}`} onClick={onNavigate}>View <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" /></Link>
      </div>
    </article>
  );
}

/** Price per milligram, when every size is one plain amount of the same compound ("10 mg"). */
function perMilligram(products: ProductCard[]) {
  if (!products.every((p) => p.name === products[0].name)) return null;
  const each = products.map((p) => {
    const mg = /^(\d+(?:\.\d+)?)\s*mg$/i.exec(p.size.trim());
    return mg && p.price != null ? p.price / Number(mg[1]) : null;
  });
  return each.every((value) => value != null) ? each.map((value) => `$${value!.toFixed(2)}`) : null;
}

/* Side by side: a column per product. Each fact's name spans the columns above its values, so the
   columns keep the card's whole width, and a value they all share is said once. */
function CompareView({ products, onNavigate }: { products: ProductCard[]; onNavigate: () => void }) {
  const id = useId();
  const sizes = products.every((p) => p.name === products[0].name);
  const spec = (p: ProductCard, label: string) => p.spec.find((row) => row.label === label)?.value ?? "—";
  const perMg = perMilligram(products);
  const facts: { label: string; values: string[]; mono?: boolean }[] = [
    ...(products.some((p) => p.price != null) ? [{ label: "Price", values: products.map((p) => money(p.price)) }] : []),
    ...(perMg ? [{ label: "Per milligram", values: perMg }] : []),
    { label: "Current lot", values: products.map((p) => p.lot), mono: true },
    { label: "HPLC purity", values: products.map((p) => p.purity ?? "Not published") },
    ...["Form", "Storage", "Molecular weight", "CAS"]
      .filter((label) => products.some((p) => p.spec.some((row) => row.label === label)))
      .map((label) => ({ label, values: products.map((p) => spec(p, label)) })),
  ];
  const columns = products.map((_, i) => `${id}-p${i}`);
  const all = products.length === 2 ? "both" : `all ${products.length === 3 ? "three" : products.length}`;
  return (
    <article className="tm-desk-card tm-desk-compare" aria-label="Side by side">
      <p className="tm-desk-kicker">{sizes ? `${products[0].name} · ${products.length === 2 ? "two" : "three"} sizes` : "Side by side"}</p>
      <table>
        <thead>
          <tr>
            {products.map((p, i) => (
              <th key={p.id} id={columns[i]} scope="col" style={{ "--tm-i": i } as CSSProperties}>
                <Link to={p.href} onClick={onNavigate}>
                  <span className="tm-desk-thumb is-small">{p.image && <img src={p.image} alt="" draggable={false} />}</span>
                  {sizes
                    ? <span className="tm-desk-compare-size">{p.size}</span>
                    : <span className="tm-desk-name">{p.name} <span>{p.size}</span></span>}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        {facts.map((fact, f) => {
          const shared = fact.values.every((v) => v === fact.values[0]);
          const value = (v: string) => (fact.mono ? <span className="tm-mono">{v}</span> : v);
          return (
            <tbody key={fact.label} style={{ "--tm-i": f + 2 } as CSSProperties}>
              <tr className="tm-desk-fact"><th id={`${id}-f${f}`} colSpan={products.length}>{fact.label}</th></tr>
              <tr>
                {shared
                  ? <td colSpan={products.length} headers={[...columns, `${id}-f${f}`].join(" ")}>{value(fact.values[0])} <span className="tm-desk-note">· {all}</span></td>
                  : fact.values.map((v, i) => <td key={columns[i]} headers={`${columns[i]} ${id}-f${f}`}>{value(v)}</td>)}
              </tr>
            </tbody>
          );
        })}
      </table>
    </article>
  );
}

const STEPS = ["placed", "paid", "packed", "shipped", "delivered"] as const;

export function OrderView({ order, onNavigate }: { order: OrderCard; onNavigate: () => void }) {
  const stopped = order.status === "cancelled" || order.status === "refunded";
  const reached = stopped ? -1 : STEPS.indexOf(order.status as (typeof STEPS)[number]);
  const at = (status: string) => order.events.find((e) => e.status === status)?.at ?? (status === "placed" ? order.placedAt : undefined);
  return (
    <article className="tm-desk-card tm-desk-order" aria-label={`Order ${order.number}`}>
      <header className="tm-desk-order-head">
        <p className="tm-desk-name">Order <span className="tm-mono">{order.number}</span></p>
        <span className="tm-desk-status" data-stopped={stopped || undefined}>{statusWord[order.status] ?? order.status}</span>
      </header>
      {!stopped && (
        <ol className="tm-desk-track" style={{ "--tm-desk-reached": Math.max(0, reached) } as CSSProperties}>
          {STEPS.map((step, i) => (
            <li key={step} className={i <= reached ? "is-done" : undefined} aria-current={i === reached ? "step" : undefined} style={{ "--tm-i": i + 1 } as CSSProperties}>
              <span className="tm-desk-node" aria-hidden="true" />
              <span className="tm-desk-step">{statusWord[step]}</span>
              <span className="tm-desk-when">{i <= reached ? day(at(step)) : ""}</span>
            </li>
          ))}
        </ol>
      )}
      {order.carrier && order.tracking && <p className="tm-desk-note">{order.carrier} · <span className="tm-mono">{order.tracking}</span></p>}
      <ul className="tm-desk-lines">
        {order.lines.map((line, i) => (
          <li key={`${line.name}-${line.size}-${line.lot}`} style={{ "--tm-i": i + 6 } as CSSProperties}>
            <span>{line.quantity} × {line.name} {line.size}</span>
            <Link to={`/verify?lot=${encodeURIComponent(line.lot)}`} onClick={onNavigate}>Certificate · <span className="tm-mono">{line.lot}</span></Link>
          </li>
        ))}
      </ul>
      <Link className="tm-desk-link" to={order.href} onClick={onNavigate}>Open the order <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" /></Link>
    </article>
  );
}

function ShippingView({ shipping, onNavigate }: { shipping: ShippingCard; onNavigate: () => void }) {
  const progress = shipping.freeThreshold && shipping.bagSubtotal != null ? Math.min(1, shipping.bagSubtotal / shipping.freeThreshold) : null;
  return (
    <article className="tm-desk-card tm-desk-shipping" aria-label="Shipping">
      {progress != null && shipping.remaining != null && (
        <div className="tm-desk-free">
          <p>{shipping.remaining > 0 ? <>Your bag is <strong>{money(shipping.remaining)}</strong> from free shipping.</> : <>Your bag ships free.</>}</p>
          <span className="tm-desk-bar" aria-hidden="true"><i style={{ "--tm-desk-fill": progress } as CSSProperties} /></span>
        </div>
      )}
      <ul className="tm-desk-methods">
        {shipping.methods.map((m, i) => (
          <li key={m.label} style={{ "--tm-i": i + 1 } as CSSProperties}>
            <span><span className="tm-desk-method">{m.label}</span><span className="tm-desk-note">{m.detail}</span></span>
            <span className="tm-desk-method-price">{m.price === 0 ? "Free" : money(m.price)}</span>
          </li>
        ))}
      </ul>
      {shipping.freeThreshold != null && progress == null && <p className="tm-desk-note">Free shipping on orders over {money(shipping.freeThreshold)}.</p>}
      <Link className="tm-desk-link" to={shipping.policy} onClick={onNavigate}>Shipping policy <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" /></Link>
    </article>
  );
}

/* The shelf: one vial per compound, by class. A vial asks about itself. */
function CatalogView({ tiles, onAsk }: { tiles: CatalogTile[]; onAsk?: (text: string) => void }) {
  // The catalog's own class order, its supplies last.
  const ordered = useMemo(() => {
    // The catalog's marked compounds (best sellers, new) first, then by class.
    const rank = (t: CatalogTile) => (t.tag ? -1 : t.category === "lab-supplies" ? 1000 : (categories.findIndex((c) => c.id === t.category) + 1000) % 1000);
    return [...tiles].sort((a, b) => rank(a) - rank(b));
  }, [tiles]);
  const classes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of ordered) if (!seen.has(t.category)) seen.set(t.category, categoryName(t.category));
    return [...seen];
  }, [ordered]);
  const [shown, setShown] = useState<string | null>(null);
  const list = shown ? ordered.filter((t) => t.category === shown) : ordered;
  const shelf = useRef<HTMLUListElement>(null);
  return (
    <article className="tm-desk-card tm-desk-catalog" aria-label="Catalog">
      {classes.length > 1 && (
        <div className="tm-desk-classes" role="group" aria-label="Class">
          <button type="button" aria-pressed={shown == null} onClick={() => { setShown(null); shelf.current?.scrollTo({ left: 0 }); }}>All</button>
          {classes.map(([id, name]) => <button key={id} type="button" aria-pressed={shown === id} onClick={() => { setShown(id); shelf.current?.scrollTo({ left: 0 }); }}>{name}</button>)}
        </div>
      )}
      <ul className="tm-desk-shelf" ref={shelf}>
        {list.map((t, i) => (
          <li key={t.id} style={{ "--tm-i": Math.min(i, 6) } as CSSProperties}>
            <button type="button" disabled={!onAsk} onClick={() => onAsk?.(`Tell me about ${t.name} ${t.size}`)}>
              <span className="tm-desk-shelf-vial">{t.image && <img src={t.image} alt="" draggable={false} loading="lazy" />}{t.tag && <span className="tm-desk-shelf-tag">{t.tag}</span>}</span>
              <span className="tm-desk-shelf-name">{t.name}</span>
              <span className="tm-desk-note">{t.sizes > 1 ? `${t.sizes} sizes` : t.size}</span>
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

/* In place of "which lot?": a field for the number printed on the label. */
function LotField({ onAsk }: { onAsk?: (text: string) => void }) {
  const [lot, setLot] = useState("");
  const id = useId();
  const example = products.find((p) => p.active !== false && p.tag === "Best seller")?.lot ?? products[0]?.lot;
  const ready = /^[a-z0-9][a-z0-9-]{3,40}$/i.test(lot.trim());
  return (
    <form className="tm-desk-card tm-desk-lotfield" onSubmit={(event) => { event.preventDefault(); if (ready) onAsk?.(`Verify lot ${lot.trim().toUpperCase()}`); }}>
      <label className="tm-desk-kicker" htmlFor={id}>Lot number</label>
      <div className="tm-desk-lotfield-row">
        <input id={id} className="tm-mono" value={lot} onChange={(e) => setLot(e.target.value)} placeholder={example ? `e.g. ${example}` : "TM-…"}
          autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="go" maxLength={40} />
        <button type="submit" className="tm-desk-add" disabled={!ready || !onAsk}>Verify</button>
      </div>
    </form>
  );
}

/* ---------- The desk's own explainers ---------- */

/* How a lot is made ready: the Quality page's five stations, and the standard each lot is held to. */
function ProcessView({ onNavigate }: { onNavigate: () => void }) {
  return (
    <article className="tm-desk-card tm-desk-process" aria-label="How every lot is made ready">
      <ol className="tm-desk-steps">
        {process.map((step, i) => (
          <li key={step.title} className={step.release ? "is-release" : undefined} style={{ "--tm-i": i + 1 } as CSSProperties}>
            <span className="tm-desk-node" aria-hidden="true" />
            <div>
              <p className="tm-desk-step-title"><span className="tm-desk-step-no">{String(i + 1).padStart(2, "0")}</span>{step.title}</p>
              <p className="tm-desk-note">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="tm-desk-release">
        <p className="tm-desk-kicker">Release specification</p>
        <dl className="tm-desk-spec">
          {specification.map(([test, method, requirement], i) => (
            <div key={test} style={{ "--tm-i": i + 7 } as CSSProperties}><dt>{test} <span>· {method}</span></dt><dd>{requirement}</dd></div>
          ))}
        </dl>
      </div>
      <Link className="tm-desk-link" to="/quality" onClick={onNavigate}>Our quality process <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" /></Link>
    </article>
  );
}

/* How an account opens: the application's own steps, and the first-order offer when it is on. */
function AccountView({ onNavigate, onAsk }: { onNavigate: () => void; onAsk?: (text: string) => void }) {
  const signedIn = Boolean(chatContextNow()?.signedIn);
  const offer = useResource(() => (LIVE ? store.catalog.validateCode("FIRSTLOT") : Promise.resolve(firstOrderOffer)).catch(() => null), []);
  const steps = [
    ["Apply", "Four short steps: about you, your institution, your research use, and four attestations."],
    ["We review it", "Every application is reviewed before an account can order. You'll hear from us by email."],
    ["Sign in and order", "Once you're approved, sign in to see pricing and place orders."],
  ];
  return (
    <article className="tm-desk-card tm-desk-account" aria-label="Opening a research account">
      <ol className="tm-desk-steps">
        {steps.map(([title, text], i) => (
          <li key={title} className={i === steps.length - 1 ? "is-release" : undefined} style={{ "--tm-i": i + 1 } as CSSProperties}>
            <span className="tm-desk-node" aria-hidden="true" />
            <div>
              <p className="tm-desk-step-title"><span className="tm-desk-step-no">{String(i + 1).padStart(2, "0")}</span>{title}</p>
              <p className="tm-desk-note">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      {offer.data?.percent ? (
        <p className="tm-desk-offer"><span className="tm-desk-presence" aria-hidden="true" /><span>{offer.data.percent}% off your first order with <span className="tm-mono">FIRSTLOT</span></span></p>
      ) : null}
      <div className="tm-desk-actions">
        {signedIn
          ? <Link className="tm-desk-add" to="/products" onClick={onNavigate}>Browse the catalog</Link>
          : <>{onAsk ? <button type="button" className="tm-desk-add" onClick={() => onAsk("Start my application")}>Start my application</button>
              : <Link className="tm-desk-add" to="/access/apply" onClick={onNavigate}>Apply for an account</Link>}
            <Link className="tm-desk-link" to="/access" onClick={onNavigate}>Sign in <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" /></Link></>}
      </div>
    </article>
  );
}

/* How vials are kept, by temperature, in the Handling page's own sentences. */
function StorageView({ onNavigate }: { onNavigate: () => void }) {
  const [frozen, transit] = handlingCopy[1].split(/(?<=\.) /);
  const opening = handlingCopy[3].split(/(?<=\.) /)[1];
  const rows: [string, string, string][] = [
    ["−20 °C", "Storage", frozen],
    ["2–8 °C", "Transit and receiving", transit],
    ["Room temp.", "Before opening", opening],
  ];
  return (
    <article className="tm-desk-card tm-desk-storage" aria-label="Storage">
      <ul className="tm-desk-temps">
        {rows.map(([temperature, when, text], i) => (
          <li key={when} style={{ "--tm-i": i + 1 } as CSSProperties}>
            <span className="tm-desk-temp" data-band={i}>{temperature}</span>
            <span><span className="tm-desk-method">{when}</span><span className="tm-desk-note">{text}</span></span>
          </li>
        ))}
      </ul>
      <p className="tm-desk-note">{handlingCopy[2]} {handlingCopy[4]}</p>
      <Link className="tm-desk-link" to="/handling" onClick={onNavigate}>Storage and handling <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" /></Link>
    </article>
  );
}

/** What each line of a certificate measures, in the words the desk is given for it. */
function meaningOf(label: string) {
  const l = label.toLowerCase();
  if (l.includes("purity")) return "The share of the main peak among everything the instrument detected.";
  if (l.includes("identity")) return "The peak's retention time and UV spectrum, compared with a reference standard.";
  if (l.includes("content") || l.includes("amount") || l.includes("quantity")) return "The measured amount in the vial, against the label claim.";
  return null;
}

/* A real certificate, read line by line: its own HPLC line, then each result with what it measures. */
function ExplainView({ record, peaks, focus, onNavigate }: { record: LotRecord; peaks?: Peak[]; focus: "certificate" | "purity"; onNavigate: () => void }) {
  const rows = record.results.map((r) => ({ ...r, meaning: meaningOf(r.label) })).filter((r) => r.meaning);
  const shown = focus === "purity" ? rows.filter((r) => r.label.toLowerCase().includes("purity")) : rows;
  return (
    <article className="tm-desk-card tm-desk-explain" aria-label={`How to read lot ${record.lot}'s certificate`}>
      <p className="tm-desk-kicker">Lot {record.lot} · {record.product.name} {record.product.size}</p>
      {peaks && peaks.length > 0 && (
        <figure className="tm-desk-explain-trace">
          <LotTrace peaks={peaks} height={96} className="tm-desk-trace" />
          <figcaption className="tm-desk-note">The tall peak is the compound itself; anything else the instrument detects would show as smaller peaks.</figcaption>
        </figure>
      )}
      <dl className="tm-desk-readings">
        {shown.map((r, i) => (
          <div key={`${r.label}-${r.method}`} style={{ "--tm-i": i + 2 } as CSSProperties}>
            <dt><span>{r.label}</span><span className="tm-desk-reading">{resultValue(r.value, r.unit)}</span></dt>
            <dd>{r.meaning}</dd>
          </div>
        ))}
      </dl>
      <Link className="tm-desk-link" to={`/verify?lot=${encodeURIComponent(record.lot)}`} onClick={onNavigate}>The full certificate <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" /></Link>
    </article>
  );
}

/* What a compound is: its profile, in the order a reference reads, with its current lot. */
function ProfileView({ profile, product, onNavigate, onAsk }: { profile: CompoundProfile; product: ProductCard | null; onNavigate: () => void; onAsk?: (text: string) => void }) {
  const rows: [string, ReactNode][] = [
    ...(profile.target ? [["Acts on", profile.target] as [string, ReactNode]] : []),
    ["Studied in", <ul className="tm-desk-fields">{profile.fields.map((f) => <li key={f}>{f}</li>)}</ul>],
    ...(profile.sequence ? [["Sequence", <span className="tm-mono tm-desk-sequence">{profile.sequence}</span>] as [string, ReactNode]] : []),
  ];
  return (
    <article className="tm-desk-card tm-desk-profile" aria-label={`${profile.name}, what it is`}>
      <div className="tm-desk-product-top">
        {product?.image && <span className="tm-desk-thumb is-small"><img src={product.image} alt="" draggable={false} /></span>}
        <div className="tm-desk-product-id">
          <p className="tm-desk-name">{profile.name}</p>
          {product && <p className="tm-desk-lot">Current lot <span className="tm-mono">{product.lot}</span>{product.purity && <> · HPLC {product.purity}</>}</p>}
        </div>
      </div>
      <p className="tm-desk-profile-what">{profile.what}{profile.origin ? ` ${profile.origin}` : ""}</p>
      <dl className="tm-desk-spec tm-desk-profile-rows">
        {rows.map(([label, value], i) => <div key={label} style={{ "--tm-i": i + 2 } as CSSProperties}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      {profile.references.length > 0 && (
        <div className="tm-desk-refs">
          <p className="tm-desk-kicker">Published research</p>
          <ol>
            {profile.references.map((r) => (
              <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer">{r.title}</a><span className="tm-desk-note">{r.author} et al., {r.year}</span></li>
            ))}
          </ol>
        </div>
      )}
      <p className="tm-desk-note">{profile.reviewed ? "" : "Draft profile, pending TrueMark's review. "}Supplied for laboratory research use only.</p>
      <div className="tm-desk-actions">
        {product && <Link className="tm-desk-link" to={product.href} onClick={onNavigate}>View {product.name} <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" /></Link>}
        {onAsk && <button type="button" className="tm-desk-quiet" onClick={() => onAsk(`Plan an order with ${profile.name}`)}>Plan an order with it</button>}
      </div>
    </article>
  );
}

/** One answer's record, in the storefront chat's own language. Returns null for kinds it does not show. */
export function DeskRecord({ artifact, onAdd, onNavigate, onAsk }: { artifact: Artifact; onAdd?: (id: string, quantity: number) => void; onNavigate: () => void; onAsk?: (text: string) => void }) {
  switch (artifact.kind) {
    case "catalog": return <CatalogView tiles={artifact.tiles} onAsk={onAsk} />;
    case "lot-field": return <LotField onAsk={onAsk} />;
    case "process": return <ProcessView onNavigate={onNavigate} />;
    case "account": return <AccountView onNavigate={onNavigate} onAsk={onAsk} />;
    case "storage": return <StorageView onNavigate={onNavigate} />;
    case "explain": return <ExplainView record={artifact.record} peaks={artifact.peaks} focus={artifact.focus} onNavigate={onNavigate} />;
    case "planner": return <PlannerView card={artifact.card} onNavigate={onNavigate} onAdd={onAdd} />;
    case "panel": return <PanelView panel={artifact.panel} topic={artifact.topic} note={artifact.note} onNavigate={onNavigate} onAsk={onAsk} />;
    case "profile": return <ProfileView profile={artifact.profile} product={artifact.product} onNavigate={onNavigate} onAsk={onAsk} />;
    case "certificate":
      return (
        <div className="tm-desk-cert">
          {artifact.peaks && artifact.peaks.length > 0 && (
            <div className="tm-desk-card tm-desk-trace-card">
              <p className="tm-desk-kicker">Lot {artifact.record.lot} · HPLC line</p>
              <LotTrace peaks={artifact.peaks} height={120} className="tm-desk-trace" />
            </div>
          )}
          <Certificate record={artifact.record} className="assistant-certificate-compact" />
          {artifact.coaUrl && <a className="tm-desk-link" href={artifact.coaUrl} target="_blank" rel="noreferrer">The laboratory's PDF <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" /></a>}
        </div>
      );
    case "product": return <ProductView card={artifact.product} onAdd={onAdd} onNavigate={onNavigate} />;
    case "compare": return <CompareView products={artifact.products} onNavigate={onNavigate} />;
    case "order": return <OrderView order={artifact.order} onNavigate={onNavigate} />;
    case "shipping": return <ShippingView shipping={artifact.shipping} onNavigate={onNavigate} />;
    case "done":
      return (
        <p className="tm-desk-done">
          <Check size={14} strokeWidth={2.2} aria-hidden="true" />
          <span>{artifact.text}{artifact.href && <> · <Link to={artifact.href} onClick={onNavigate}>{artifact.link ?? "View"}</Link></>}</span>
        </p>
      );
    case "rows":
      return (
        <ul className="tm-desk-card tm-desk-rows">
          {artifact.rows.map((row, i) => (
            <li key={row.href} style={{ "--tm-i": i } as CSSProperties}><Link to={row.href} onClick={onNavigate}><span>{row.label}</span><span className="tm-desk-note">{row.detail}</span></Link></li>
          ))}
        </ul>
      );
    default: return null;
  }
}

/* ---------- An answer being written ---------- */

/**
 * The answer as the desk writes it: whole words, at a reader's steady pace that quickens with whatever
 * is still to come (so the words never trail the answer by much), each word settling into ink, and the
 * brand's dot at the writing edge where the sentence's period will land. A finished answer is shown
 * whole, and an answer from earlier never writes itself again.
 */
export function DeskText({ text, live, arrive = false }: { text: string; live: boolean; arrive?: boolean }) {
  const reduced = usePrefersReducedMotion();
  const words = useMemo(() => text.match(/\s*\S+/g) ?? [], [text]);
  const total = useRef(words.length); total.current = words.length;
  const going = useRef(live); going.current = live;
  // An answer that arrived whole (one the desk answers itself) writes in once, at the finished pace.
  const [writing, setWriting] = useState((live || arrive) && !reduced);
  const count = useRef(writing ? 0 : words.length);
  const [shown, setShown] = useState(count.current);
  useEffect(() => {
    if (!writing) return;
    let frame = 0, last = performance.now(), carry = 0;
    const step = (now: number) => {
      const seconds = Math.min(0.05, (now - last) / 1000); last = now;
      const backlog = total.current - count.current;
      if (backlog > 0) {
        // Words a second: a fast reader's pace while the answer arrives, brisker once it is complete.
        carry += (going.current ? 14 + backlog * 4 : 36 + backlog * 6) * seconds;
        const add = Math.floor(carry);
        if (add) { carry -= add; count.current = Math.min(total.current, count.current + add); setShown(count.current); }
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [writing]);
  // Written: the answer is complete and every word is down. The dot lifts away as the last words settle.
  const down = writing && !live && shown >= words.length;
  useEffect(() => {
    if (!down) return;
    const done = window.setTimeout(() => setWriting(false), 300);
    return () => window.clearTimeout(done);
  }, [down]);
  const visible = writing ? words.slice(0, shown).join("") : text;
  // A bold figure still being written is already bold, not a pair of asterisks.
  const source = writing && (visible.match(/\*\*/g)?.length ?? 0) % 2 ? `${visible}**` : visible;
  return <div className="assistant-message-text" data-writing={writing ? (down ? "settling" : "") : undefined}><Markdown source={source} variant="chat" words={writing} /></div>;
}

/* ---------- Where it came from, and where to go next ---------- */

export function Sources({ sources, onNavigate }: { sources: Source[]; onNavigate: () => void }) {
  const unique = sources.filter((s, i) => sources.findIndex((x) => x.href === s.href) === i);
  if (!unique.length) return null;
  return (
    <p className="tm-desk-sources">
      <span className="tm-desk-sources-label">From</span>
      {unique.map((s) => <Link key={s.href} to={s.href} onClick={onNavigate}>{s.label}</Link>)}
    </p>
  );
}

/** Next questions that follow from what the answer showed: never the one just asked, at most three. */
export function followUpsFor(kinds: Artifact["kind"][], asked: string, context: ChatContext | null, shown?: string): string[] {
  const has = (kind: Artifact["kind"]) => kinds.includes(kind);
  // The lot of the product the answer showed, else the one on the page.
  const lot = shown ?? context?.product?.lot;
  const ideas = has("order") ? ["Get its certificates", "When will it arrive?", "How should I store it on arrival?"]
    : has("compare") ? ["Read their certificates", "How are they shipped?", "How should they be stored?"]
    : has("certificate") ? ["How do I read this certificate?", "How should it be stored?", "Which sizes are there?"]
    : has("product") ? [lot ? `Read lot ${lot}'s certificate` : "Read its certificate", "How is it stored?", "When would it arrive?"]
    : has("shipping") ? ["How is it kept cold?", "When would it arrive?", "What is your returns policy?"]
    : has("catalog") ? ["How is every lot tested?", "Show me a real certificate", "How does shipping work?"]
    : has("process") ? ["Show me a real certificate", "What does HPLC purity measure?", "What do you carry?"]
    : has("explain") ? ["How do I read a certificate?", "What does HPLC purity measure?", "How is every lot tested?", "Verify a lot"]
    : has("account") ? ["What do you carry?", "How is every lot tested?", "How does shipping work?"]
    : has("storage") ? ["How does shipping work?", "Verify a lot", "What do you carry?"]
    : has("planner") ? []
    : has("panel") ? ["What can you help with?"]
    : has("profile") ? [lot ? `Read lot ${lot}'s certificate` : "Show me a real certificate", "How is every lot tested?", "What do you carry?"]
    : [];
  const said = asked.trim().toLowerCase();
  return ideas.filter((idea) => idea.toLowerCase() !== said).slice(0, 3);
}

export function FollowUps({ items, onAsk, disabled }: { items: string[]; onAsk: (text: string) => void; disabled: boolean }) {
  if (!items.length) return null;
  return (
    <div className="tm-chat-suggestions tm-desk-followups">
      {items.map((text, i) => <button key={text} type="button" className="tm-chat-chip" style={{ "--tm-i": i } as CSSProperties} disabled={disabled} onClick={() => onAsk(text)}>{text}</button>)}
    </div>
  );
}

/** What the desk is reading while it works: the brand's dot, breathing, and the record's name. */
export function Activity({ label }: { label: string }) {
  return (
    <div className="tm-desk-activity" aria-hidden="true">
      <span className="tm-desk-presence is-working" />
      <span key={label} className="tm-desk-activity-label">{label}…</span>
    </div>
  );
}

/* ---------- The first thing it says: where you are ---------- */

/** "was shipped on Oct 6", or "is paid" when the record has no date. */
function lastOrderLine(status: string, iso?: string) {
  const word = (statusWord[status] ?? status).toLowerCase(), when = day(iso);
  return when ? `was ${word} on ${when}` : `is ${word}`;
}

/** A question the desk offers, with the mark of the record it opens. */
export type Starter = { text: string; icon: LucideIcon };
const ask = (text: string, icon: LucideIcon): Starter => ({ text, icon });

/** How a conversation began: the page, and whether a plan was in progress and which product was offered back. */
export type Opening = ChatContext & { planned: boolean; recent: string | null };

/** What the desk knows of this reader beyond the page: a plan in progress, the product from last time. */
export type Returning = { planned?: boolean; recent?: { name: string; size: string } };

/** Suggestions that fit the page and the person: a product's own lot, a bag's shipping, an order, and
 *  for someone new, the planner and the four things that say most about the shop. */
export function startersFor(context: ChatContext | null, lastOrder?: string | null, back: Returning = {}): Starter[] {
  const page = context?.page ?? "/";
  const plan = back.planned ? ask("Continue my order plan", ClipboardList) : ask("Help me plan an order", ClipboardList);
  if (context?.product) {
    const siblings = productById(context.product.id);
    return [ask(`Read lot ${context.product.lot}'s certificate`, FileCheck2), ask(siblings ? "Compare the sizes" : "Which sizes are there?", Scale),
      ask(`Plan an order with ${context.product.name}`, ClipboardList), ask("How is it stored?", Snowflake)];
  }
  if (page.startsWith("/verify")) return [ask("Verify a lot", QrCode), ask("How do I read a certificate?", FileCheck2), ask("What does HPLC purity measure?", FlaskConical), ask("Show me a real certificate", FileCheck2)];
  const orderFirst = lastOrder && !page.startsWith("/cart");
  if (!orderFirst && (page.startsWith("/cart") || (context?.bag?.items ?? 0) > 0)) return [ask("How far am I from free shipping?", Truck), ask("When would it arrive?", Truck), ask("How should I store it on arrival?", Snowflake)];
  if (lastOrder) return [ask(`Restock order ${lastOrder}`, Repeat2), ask(`Where is order ${lastOrder}?`, Truck), plan, ask(`Get the certificates for ${lastOrder}`, FileCheck2)];
  if (page.startsWith("/access")) return [ask("How do I start ordering?", UserRoundPlus), plan, ask("What do you carry?", LayoutGrid), ask("Show me a real certificate", FileCheck2)];
  if (back.recent) return [ask(`Show me ${back.recent.name} ${back.recent.size} again`, History), plan, ask("How is every lot tested?", FlaskConical), ask("What do you carry?", LayoutGrid)];
  return [plan, ask("How is every lot tested?", FlaskConical), ask("Show me a real certificate", FileCheck2), ask("What do you carry?", LayoutGrid),
    context?.signedIn ? ask("How does shipping work?", Truck) : ask("How do I start ordering?", UserRoundPlus)];
}
/** The suggestions' words alone. */
export const suggestionsFor = (context: ChatContext | null, lastOrder?: string | null, back: Returning = {}) => startersFor(context, lastOrder, back).map((s) => s.text);

/** What the desk says first: where the reader is, in a sentence or two, and what it can show them. */
export function greetingFor(context: ChatContext | null, product?: { name: string; size: string }, returning?: { first?: string; number: string; line: string }, back: Returning = {}) {
  const page = context?.page ?? "/";
  if (product) return `This is ${product.name} ${product.size}, with its current lot below. Ask me about its certificate, its sizes, storage or shipping.`;
  const inBag = context?.bag?.items ?? 0;
  if (page.startsWith("/cart") && inBag > 0) return `Your bag holds ${inBag} ${inBag === 1 ? "vial" : "vials"}. I can tell you how far you are from free shipping, when it would arrive, or how it's kept cold.`;
  if (returning) return `Welcome back${returning.first ? `, ${returning.first}` : ""}. Your last order, ${returning.number}, ${returning.line}. What can I help with?`;
  if (page.startsWith("/verify")) return "Every TrueMark label carries a lot number. Give me yours and I'll open its certificate, or ask me what any line on a certificate means.";
  const items = context?.bag?.items ?? 0;
  if (page.startsWith("/cart") || items > 0) return `Your bag holds ${items} ${items === 1 ? "vial" : "vials"}. I can tell you how far you are from free shipping, when it would arrive, or how it's kept cold.`;
  if (back.planned && !page.startsWith("/access")) return "Welcome back. Your order plan is right where you left it, whenever you're ready to pick it up again.";
  if (back.recent && !page.startsWith("/access")) return `Welcome back. Last time you were looking at ${back.recent.name} ${back.recent.size}. Want to pick up where you left off, or start something new?`;
  if (page.startsWith("/access")) return "Hi, welcome to TrueMark BioLabs. Pricing and ordering open with a research account, but you're welcome to look around first: I can show you what we carry, how every lot is tested, or a real certificate.";
  return "Hi, welcome to TrueMark BioLabs. Every vial we ship traces back to its lot, and every lot to its own certificate of analysis. Ask me anything, and I'll show you the record behind the answer.";
}

/** The desk's first line: where the reader is, and what to ask. Once the conversation starts it stays
 *  as the conversation's opening, without its suggestions. */
export const Welcome = memo(function Welcome({ context, onAsk, disabled, started = false }: { context: ChatContext | Opening | null; onAsk: (text: string) => void; disabled: boolean; started?: boolean }) {
  const viewing = context?.product ? productById(context.product.id) : undefined;
  const lot = useResource(() => (viewing ? store.lots.get(viewing.lot) : Promise.resolve(null)), [viewing?.lot]);
  const signedIn = Boolean(context?.signedIn);
  const orders = useResource(async () => {
    if (!signedIn) return null;
    const buyer = await store.session.get();
    if (!buyer) return null;
    const list = await store.orders.listForBuyer(buyer.id);
    const last = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return { name: buyer.name, last };
  }, [signedIn]);
  const record = lot.data;
  const released = record?.status === "released" && record.results.length > 0;
  const purity = released ? record!.results.find((r) => r.method === "HPLC") : undefined;
  const peaks = released ? lotPeaks(record?.reference) : [];
  const last = orders.data?.last;
  // The first name, past any title ("Dr. Ana Reyes" is Ana).
  const first = orders.data?.name?.split(/\s+/).find((word) => !/^(dr|mr|mrs|ms|mx|prof)\.?$/i.test(word));
  // A signed-in reader's greeting waits for their last order, so it is said once, whole.
  const settled = !signedIn || !orders.loading;
  // A plan in progress, or the product from an earlier visit.
  const plan = usePlan();
  const planned = Boolean(plan && !plan.added && plan.picks.length);
  const earlier = useMemo(() => { const id = returningProduct(); return id ? productById(id) : undefined; }, []);
  // Once the conversation has begun, its opening stays as it was said: what the desk knew then.
  const then = started && context && "planned" in context ? context as Opening : null;
  const recalled = then?.recent ? productById(then.recent) : earlier;
  const back: Returning = { planned: then ? then.planned : planned, recent: recalled && { name: recalled.name, size: recalled.size } };
  const greeting = greetingFor(context, viewing, last ? { first, number: last.number, line: lastOrderLine(last.status, last.events.at(-1)?.at) } : undefined, back);
  const starters = startersFor(context, last?.number ?? null, back);

  return (
    <div className="tm-desk-welcome">
      {settled && (
        <div className="tm-chat-msg is-assistant tm-desk-greeting">
          <span className="assistant-a11y">TrueMark said</span>
          <DeskText key={greeting} text={greeting} live={false} arrive={!started} />
        </div>
      )}
      {viewing && (
        <div className="tm-desk-here">
          <div className="tm-desk-here-row">
            <span className="tm-desk-thumb">{<img src={productCutout(viewing, "sm")} alt="" draggable={false} />}</span>
            <div>
              <p className="tm-desk-name">{viewing.name} <span>{viewing.size}</span></p>
              <p className="tm-desk-lot">Lot <span className="tm-mono">{viewing.lot}</span>{purity && <> · HPLC {purity.value}{purity.unit}</>}</p>
            </div>
          </div>
          {peaks.length > 0 && <LotTrace peaks={peaks} height={92} className="tm-desk-trace" />}
        </div>
      )}
      {!started && settled && (
        <ul className="tm-desk-starters" aria-label="Suggested questions">
          {starters.map(({ text, icon: Icon }, i) => (
            <li key={text} style={{ "--tm-i": i } as CSSProperties}>
              <button type="button" disabled={disabled} data-featured={Icon === ClipboardList || undefined} onClick={() => onAsk(text)}>
                <span className="tm-desk-starter-icon" aria-hidden="true"><Icon size={16} strokeWidth={1.6} /></span>
                <span className="tm-desk-starter-text">{text}</span>
                <ArrowRight className="tm-desk-starter-go" size={14} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!started && settled && <button type="button" className="tm-desk-more" disabled={disabled} onClick={() => onAsk("What can you help with?")}>See everything I can help with</button>}
    </div>
  );
});
