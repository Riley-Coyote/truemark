import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { productById, productCutout } from "../shop/catalog";
import { store, useResource } from "../platform/store";
import { usePrefersReducedMotion } from "../shop/motion";
import { canTurnShelf, SHELF_INTERVAL, SHELF_TOUCH_PAUSE, shelfOffset, wrapShelf } from "./carousel";
import type { Product } from "../data";
import { tone } from "../shop/ui";
import { sheenMask, useLight } from "./light";
import { rememberVial } from "../Navigation";
import { Trace } from "./Trace";
import "./hero.css";

/** The shelf, arranged by category colour as the brand guide asks for group shots. */
const shelfIds = [
  "ghk-cu-100-mg",
  "melanotan-ii-10-mg",
  "nad-500-mg",
  "bpc-157-10-mg",
  "semax-10-mg",
  "tesamorelin-10-mg",
  "retatrutide-10-mg",
];

const trust = [
  ["Research use only", "Supplied for laboratory research applications."],
  ["Not for human use", "Not for human or veterinary administration."],
  ["Independently tested", "Every lot tested on receipt at a contracted laboratory."],
  ["Cold chain", "Temperature-controlled storage, and transit when applicable."],
];

/** The logo's dot, used as a full stop: the one place the gradient touches type. */
export function BrandDot() {
  return (
    <>
      <span className="tm-brand-dot" aria-hidden="true" />
      <span className="sr-only">.</span>
    </>
  );
}

/** Always look up the displayed vial's own lot in the current world. */
function LotChip({ product }: { product: Product }) {
  const record = useResource(() => store.lots.get(product.lot), [product.lot]);
  const lot = record.data;
  const released = lot?.status === "released" && lot.results.length > 0;
  const purity = released ? lot.results.find((r) => r.method === "HPLC") : undefined;
  const identity = released ? lot.results.find((r) => r.method === "Mass spectrometry") : undefined;
  return (
    <span className="tm-lotchip">
      <span className="tm-lotchip-top">
        <span className="tm-lotchip-lot">{lot?.sample ? "Sample lot" : "Lot"} {product.lot}</span>
        <span className={`tm-lotchip-status${released ? "" : " is-pending"}`}>
          {released && <i />}
          {record.loading ? "Loading" : record.error || !lot ? "Unavailable" : released ? "Verified" : "In testing"}
        </span>
      </span>
      <span className="tm-lotchip-results">
        {released ? [purity && `HPLC ${purity.value}${purity.unit}`, identity && `MS ${identity.value.toLowerCase()}${identity.unit ? ` ${identity.unit}` : ""}`].filter(Boolean).join(" · ") : record.loading ? "Loading lot record" : record.error || !lot ? "Lot lookup unavailable" : "Certificate on release"}
      </span>
      {lot?.sample && <span className="tm-lotchip-sample">Sample record · illustrative values</span>}
    </span>
  );
}

export function HeroShelf() {
  const shelf = shelfIds.map(productById).filter((product): product is Product => Boolean(product));
  const middle = Math.max(0, Math.floor((shelf.length - 1) / 2));
  const scene = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 960px)").matches);
  const [front, setFront] = useState(middle);
  // Desktop: the vial a visitor points at (or focuses) is chosen; the lot card moves to it
  // and the trace's peak glides under it. `chosenYet` hands the first card's entrance over to that.
  const [chosen, setChosen] = useState(middle);
  const [chosenYet, setChosenYet] = useState(false);
  const choose = (i: number) => { setChosen(i); setChosenYet(true); };
  const lastPointer = useRef<string>("mouse");
  const [peak, setPeak] = useState(0.5);
  if (front >= shelf.length && front !== middle) setFront(middle);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [touchedUntil, setTouchedUntil] = useState(0);
  const pointer = useRef<{ x: number; y: number; swiped: boolean } | null>(null);
  const pause = () => setTouchedUntil(Date.now() + SHELF_TOUCH_PAUSE);
  const move = (direction: number) => { if (shelf.length < 2) return; pause(); setFront((value) => wrapShelf(value + direction, shelf.length)); };

  useEffect(() => {
    const media = window.matchMedia("(max-width: 960px)");
    const change = () => setMobile(media.matches);
    media.addEventListener("change", change);
    const visibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    if (track.current) observer.observe(track.current);
    return () => { media.removeEventListener("change", change); document.removeEventListener("visibilitychange", visibility); observer.disconnect(); };
  }, []);

  useEffect(() => {
    const state = { mobile, reduced, visible, hidden, focused, touchedUntil };
    if (shelf.length < 2 || !mobile || reduced || !visible || hidden || focused) return;
    const timer = window.setTimeout(() => {
      if (canTurnShelf(state, Date.now())) setFront((value) => wrapShelf(value + 1, shelf.length));
    }, Math.max(SHELF_INTERVAL, touchedUntil - Date.now()));
    return () => window.clearTimeout(timer);
  }, [mobile, reduced, visible, hidden, focused, touchedUntil, front, shelf.length]);

  useEffect(() => {
    if (mobile && reduced && track.current) {
      const item = track.current.children[middle] as HTMLElement | undefined;
      if (item) track.current.scrollLeft = item.offsetLeft - (track.current.clientWidth - item.offsetWidth) / 2;
    }
  }, [mobile, reduced, middle]);
  useEffect(() => {
    const section = scene.current;
    if (!section) return;
    const measure = () => {
      const trace = section.querySelector<HTMLElement>(".tm-bhero-trace");
      const target = mobile
        ? section.querySelector<HTMLElement>(".tm-bhero-title .tm-brand-dot")
        : (track.current?.children[chosen] as HTMLElement | undefined)?.querySelector<HTMLElement>(".tm-shelf-stage img") ?? null;
      if (!trace || !target) return;
      const box = trace.getBoundingClientRect(), at = target.getBoundingClientRect();
      if (box.width > 0) setPeak(Math.min(0.96, Math.max(0.04, (at.left + at.width / 2 - box.left) / box.width)));
    };
    measure();
    void document.fonts?.ready.then(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    return () => observer.disconnect();
  }, [mobile, chosen]);
  useLight(scene);
  return (
    <>
      <section className="tm tm-bhero" aria-labelledby="tm-bhero-title" ref={scene}>
        <div className="tm-bhero-head">
          <p className="tm-pill-eyebrow">
            <span className="tm-brand-dot" aria-hidden="true" />
            Lot-level traceability
          </p>
          <h1 id="tm-bhero-title" className="tm-bhero-title">
            <span className="tm-bhero-line" style={{ "--tm-i": 0 } as CSSProperties}>
              <span>True research.</span>
            </span>
            <span className="tm-bhero-line" style={{ "--tm-i": 1 } as CSSProperties}>
              <span>True precision.</span>
            </span>
            <span className="tm-bhero-line" style={{ "--tm-i": 2 } as CSSProperties}>
              <span>
                Verified
                <BrandDot />
              </span>
            </span>
          </h1>
        </div>
        <div className="tm-bhero-aside">
          <p className="tm-bhero-lead">
            Research compounds supplied as lyophilized powder, independently
            tested on receipt, quarantined until release, and traceable from the
            vial in your hand back to the source batch.
          </p>
          <div className="tm-actions">
            <Link className="tm-button tm-button-primary" to="/products">
              View catalog
            </Link>
            <Link className="tm-button tm-button-outline" to="/verify">
              Verify a lot
            </Link>
          </div>
        </div>

        <div className={`tm-shelf${mobile && !reduced ? " is-carousel" : ""}`} ref={track} role="list" aria-label="The collection, arranged by colour"
          data-chosen={!mobile && chosenYet ? "true" : undefined}
          onFocusCapture={(event) => { if (event.target.matches(":focus-visible")) setFocused(true); }}
          onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
          onPointerDown={(event) => { if (!mobile) return; pause(); pointer.current = { x: event.clientX, y: event.clientY, swiped: false }; }}
          onPointerMove={(event) => {
            if (!mobile || reduced || !pointer.current || pointer.current.swiped) return;
            const dx = event.clientX - pointer.current.x, dy = event.clientY - pointer.current.y;
            if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) { pointer.current.swiped = true; move(dx < 0 ? 1 : -1); }
          }}
          onPointerUp={() => { if (mobile) pause(); window.setTimeout(() => { pointer.current = null; }, 0); }}
          onPointerCancel={() => { pointer.current = null; }}
          onScroll={() => {
            if (!shelf.length || !mobile || !reduced || !track.current) return;
            const center = track.current.scrollLeft + track.current.clientWidth / 2;
            const distances = Array.from(track.current.children).map((el) => Math.abs((el as HTMLElement).offsetLeft + (el as HTMLElement).offsetWidth / 2 - center));
            setFront(distances.indexOf(Math.min(...distances)));
          }}
          onKeyDown={(event) => {
            if (shelf.length < 2 || !mobile || reduced || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault();
            setFocused(true);
            const next = wrapShelf(front + (event.key === "ArrowRight" ? 1 : -1), shelf.length);
            pause(); setFront(next); (track.current?.children[next] as HTMLElement | undefined)?.focus();
          }}>
          {shelf.map((product, i) => {
            const offset = shelfOffset(i, front, shelf.length);
            const hiddenVial = mobile && !reduced && Math.abs(offset) > 1;
            return (
            <Link
              key={product.id}
              role="listitem"
              className="tm-shelf-vial"
              data-front={mobile ? i === front : i === chosen}
              onPointerEnter={(event) => { if (!mobile && event.pointerType !== "touch") choose(i); }}
              onPointerDownCapture={(event) => { lastPointer.current = event.pointerType; }}
              onFocus={(event) => { if (!mobile && event.target.matches(":focus-visible")) choose(i); }}
              aria-hidden={hiddenVial || undefined}
              tabIndex={hiddenVial ? -1 : undefined}
              aria-label={mobile && !reduced && i !== front ? `Show ${product.name} ${product.size}` : undefined}
              to={`/product/${product.id}`}
              onClick={(event) => {
                rememberVial(product.id, event.currentTarget.querySelector<HTMLElement>(".tm-shelf-stage img"));
                if (!mobile) {
                  if (lastPointer.current === "touch" && i !== chosen) { event.preventDefault(); choose(i); }
                  return;
                }
                pause();
                if (pointer.current?.swiped) { event.preventDefault(); pointer.current = null; return; }
                if (!reduced && i !== front) { event.preventDefault(); setFront(i); }
              }}
              style={{ ...tone(product), "--tm-i": Math.abs(i - middle), "--tm-offset": offset } as CSSProperties}
            >
              <span className="tm-shelf-stage" data-sheen>
                <LotChip product={product} />
                <span className="tm-shelf-shadow" aria-hidden="true" />
                <img
                  src={productCutout(product, "lg")}
                  srcSet={`${productCutout(product, "sm")} 289w, ${productCutout(product, "lg")} 578w`}
                  sizes="(max-width: 960px) 34vw, 12vw"
                  alt={`${product.name}, ${product.size}`}
                  loading={Math.abs(i - middle) <= 1 ? "eager" : "lazy"}
                  draggable={false}
                  data-vial={product.id}
                />
                <span
                  className="tm-sheen"
                  aria-hidden="true"
                  style={sheenMask(productCutout(product, "sm"))}
                />
              </span>
              <span className="tm-shelf-name">
                {product.name}
                <span>{product.size}</span>
              </span>
            </Link>
          ); })}
        </div>
        <Trace className="tm-bhero-trace" peakAt={peak} height={mobile ? 88 : 104} pulse caption="≥99% purity specification · HPLC" />
      </section>

      <section className="tm tm-trust" aria-label="Our standard">
        {trust.map(([title, text]) => (
          <div key={title} className="tm-trust-item">
            <p className="tm-trust-title">{title}</p>
            <p className="tm-trust-text">{text}</p>
          </div>
        ))}
      </section>
    </>
  );
}
