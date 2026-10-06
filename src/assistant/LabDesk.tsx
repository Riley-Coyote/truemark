import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { Certificate } from "../brand/Certificate";
import { Markdown } from "../brand/Markdown";
import { usePrefersReducedMotion } from "../shop/motion";
import { LotTrace } from "../brand/LotTrace";
import { store, useResource } from "../platform/store";
import { lotPeaks } from "./lot-lines";
import { productById, productCutout } from "../shop/catalog";
import type { ChatContext } from "./chat-context";
import type { Artifact, OrderCard, ProductCard, ShippingCard, Source } from "./runtime";
import "./lab-desk.css";

/*
 * The storefront chat as TrueMark's lab desk: it answers from the records and shows them. Each
 * answer arrives as the record itself (a certificate with its lot's own line, a product, a side by
 * side, an order's progress, shipping), followed by where its facts came from.
 */

const money = (value: number | null) => (value == null ? "Price on request" : `$${value.toFixed(2)}`);
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
          <p className="tm-desk-price" key={size.id} data-switched={switched || undefined}>{money(size.price)}</p>
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
    { label: "Price", values: products.map((p) => money(p.price)) },
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

function OrderView({ order, onNavigate }: { order: OrderCard; onNavigate: () => void }) {
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

/** One answer's record, in the storefront chat's own language. Returns null for kinds it does not show. */
export function DeskRecord({ artifact, onAdd, onNavigate }: { artifact: Artifact; onAdd?: (id: string, quantity: number) => void; onNavigate: () => void }) {
  switch (artifact.kind) {
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
export function DeskText({ text, live }: { text: string; live: boolean }) {
  const reduced = usePrefersReducedMotion();
  const words = useMemo(() => text.match(/\s*\S+/g) ?? [], [text]);
  const total = useRef(words.length); total.current = words.length;
  const going = useRef(live); going.current = live;
  const [writing, setWriting] = useState(live && !reduced);
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
export function followUpsFor(kinds: Artifact["kind"][], asked: string, context: ChatContext | null): string[] {
  const has = (kind: Artifact["kind"]) => kinds.includes(kind);
  const lot = context?.product?.lot;
  const ideas = has("order") ? ["Get its certificates", "When will it arrive?", "How should I store it on arrival?"]
    : has("compare") ? ["Read their certificates", "How are they shipped?", "How should they be stored?"]
    : has("certificate") ? ["How do I read this certificate?", "How should it be stored?", "Which sizes are there?"]
    : has("product") ? [lot ? `Read lot ${lot}'s certificate` : "Read its certificate", "How is it stored?", "When would it arrive?"]
    : has("shipping") ? ["How is it kept cold?", "When would it arrive?", "What is your returns policy?"]
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

/** Suggestions that fit the page and the person: a product's own lot, a bag's shipping, an order. */
export function suggestionsFor(context: ChatContext | null, lastOrder?: string | null): string[] {
  const page = context?.page ?? "/";
  if (context?.product) {
    const siblings = productById(context.product.id);
    return [`Read lot ${context.product.lot}'s certificate`, siblings ? "Compare the sizes" : "Which sizes are there?", "How is it stored?"];
  }
  if (page.startsWith("/verify")) return ["How do I read a certificate?", "What does HPLC purity measure?", "Verify a lot"];
  if (page.startsWith("/account") && lastOrder) return [`Where is order ${lastOrder}?`, `Get the certificates for ${lastOrder}`, "Reorder my last order"];
  if (page.startsWith("/cart") || (context?.bag?.items ?? 0) > 0) return ["How far am I from free shipping?", "When would it arrive?", "How is it kept cold?"];
  if (lastOrder) return [`Where is order ${lastOrder}?`, "Verify a lot", "Find a compound"];
  return ["Verify a lot", "Find a compound", "How does shipping work?"];
}

/** The desk's first line: where the reader is, and what to ask. Once the conversation starts it stays
 *  as the conversation's opening, without its suggestions. */
export const Welcome = memo(function Welcome({ context, onAsk, disabled, started = false }: { context: ChatContext | null; onAsk: (text: string) => void; disabled: boolean; started?: boolean }) {
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
  const first = orders.data?.name?.split(/\s+/)[0];
  const suggestions = suggestionsFor(context, last?.number ?? null);

  return (
    <div className="tm-desk-welcome">
      {viewing ? (
        <div className="tm-desk-here">
          <p className="tm-desk-kicker">You're looking at</p>
          <div className="tm-desk-here-row">
            <span className="tm-desk-thumb">{<img src={productCutout(viewing, "sm")} alt="" draggable={false} />}</span>
            <div>
              <p className="tm-desk-name">{viewing.name} <span>{viewing.size}</span></p>
              <p className="tm-desk-lot">Lot <span className="tm-mono">{viewing.lot}</span>{purity && <> · HPLC {purity.value}{purity.unit}</>}</p>
            </div>
          </div>
          {peaks.length > 0 && <LotTrace peaks={peaks} height={92} className="tm-desk-trace" />}
          <p className="tm-chat-sub">Ask about its certificate, its sizes, storage or shipping.</p>
        </div>
      ) : last ? (
        <div className="tm-desk-here">
          <p className="tm-chat-hello">Welcome back{first ? `, ${first}` : ""}.</p>
          <p className="tm-chat-sub">Your last order, <span className="tm-mono">{last.number}</span>, {lastOrderLine(last.status, last.events.at(-1)?.at)}.</p>
        </div>
      ) : (
        <>
          <p className="tm-chat-hello">How can we help?</p>
          <p className="tm-chat-sub">Ask about a compound, a lot's certificate, shipping or your order. Every answer comes with its record.</p>
        </>
      )}
      {!started && (
        <div className="tm-chat-suggestions">
          {suggestions.map((text, i) => <button key={text} type="button" className="tm-chat-chip" style={{ "--tm-i": i } as CSSProperties} disabled={disabled} onClick={() => onAsk(text)}>{text}</button>)}
        </div>
      )}
    </div>
  );
});
