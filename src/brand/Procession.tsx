import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Pause, Play } from "lucide-react";
import { compoundClasses } from "../data";
import { productById, productCutout } from "../shop/catalog";
import { collectionIds } from "./carousel";
import { useMotion } from "./Sequence";
import { createProcession } from "./procession-controller";
import { createNativeProcession } from "./native-procession";
import { TOUCH_FIRST } from "./touch-first";
import { flightViews, flyToProduct, preloadProduct } from "./flight";
import { useFlightAllowed, useFlightSlot } from "./FlightViews";
import { rememberVial } from "../Navigation";
import type { ProcessionController, ProcessionStatus } from "./procession-controller";
import "./procession.css";

const shown = (img: HTMLElement) => img.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? true;

/** The chosen collection: the opening's real artwork, then all eight compound classes. */
export function Procession() {
  const root = useRef<HTMLElement>(null);
  const controller = useRef<ProcessionController | null>(null);
  const moving = useMotion();
  const movingNow = useRef(moving); movingNow.current = moving;
  const classes = compoundClasses.filter(c => c.onHome && productById(c.vial ?? ""));
  const original = collectionIds.map(id => classes.findIndex(c => c.vial === id)).filter(i => i >= 0);
  const order = [...original, ...classes.map((_, i) => i).filter(i => !original.includes(i))];
  const initial = original[Math.floor(original.length / 2)] ?? 0;
  const [status, setStatus] = useState<ProcessionStatus>({ active: initial, paused: false, reduced: !moving, arrived: false, progress: 0 });
  const signature = classes.map(c => c.id).join("|");
  const slot = useFlightSlot();
  const allowed = useFlightAllowed();
  const navigate = useNavigate();
  const press = useRef<{ x: number; y: number } | null>(null);
  const hover = useRef(0);

  /** The vial drawn at a point: the vials stand clear of the pointer (the stage takes every swipe), so it is found by
   *  where they are, a copy's included, since the strip goes round. */
  function vialAt(x: number, y: number) {
    let found: HTMLImageElement | null = null, gap = Infinity;
    for (const img of root.current?.querySelectorAll<HTMLImageElement>(".tm-procession-actor img") ?? []) {
      const box = img.getBoundingClientRect();
      if (x < box.left || x > box.right || y < box.top || y > box.bottom || !shown(img)) continue;
      const off = Math.abs(x - (box.left + box.right) / 2);
      if (off < gap) { found = img; gap = off; }
    }
    return found;
  }
  /** The class in front, for Enter: its vial nearest the middle of the stage. */
  function inFront() {
    const id = productById(classes[status.active]?.vial ?? "")?.id;
    const stage = root.current?.querySelector(".tm-procession-stage")?.getBoundingClientRect();
    if (!id || !stage) return null;
    const middle = (stage.left + stage.right) / 2;
    const off = (img: HTMLImageElement) => { const box = img.getBoundingClientRect(); return Math.abs((box.left + box.right) / 2 - middle); };
    return [...root.current!.querySelectorAll<HTMLImageElement>(`.tm-procession-actor[data-product-id="${CSS.escape(id)}"] img`)].sort((a, b) => off(a) - off(b))[0] ?? null;
  }
  const idOf = (img: HTMLImageElement) => img.closest<HTMLElement>(".tm-procession-actor")?.dataset.productId;
  /** A vial opens its product page, for every visitor: as the opening's own move, which keeps it for Back. */
  function open(img: HTMLImageElement) {
    const id = idOf(img);
    if (!id) return;
    if (allowed && flyToProduct(id, img, false)) return;
    rememberVial(id, img);
    navigate(`/product/${id}`);
  }
  useEffect(() => {
    if (!root.current || !classes.length) return;
    const native = matchMedia(TOUCH_FIRST);
    const mount = () => {
      controller.current?.destroy();
      controller.current = (native.matches ? createNativeProcession : createProcession)(root.current!, order, initial, setStatus);
      controller.current.setMotion(movingNow.current);
    };
    mount(); native.addEventListener('change', mount);
    // Put away because the opening is being parked under a product page (flight.ts): it keeps the collection's styling,
    // so it comes back with Back exactly as it was left.
    const parked = () => flightViews.snapshot().slots.some(s => s.id === slot && s.parked);
    return () => { native.removeEventListener('change', mount); controller.current?.destroy(parked()); controller.current = null; };
    // A catalog refresh can change the collection; ordinary control updates cannot rebuild it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  useEffect(() => controller.current?.setMotion(moving), [moving, signature]);

  return (
    <section className="tm tm-index tm-procession" ref={root} aria-labelledby="tm-index-title" aria-roledescription="carousel">
      <header className="tm-procession-heading">
        <div><p className="tm-eyebrow">The research collection</p><h2 id="tm-index-title" className="tm-heading">Organized by<br />compound class.</h2></div>
        <div className="tm-procession-intro"><p>Eight classes. Full specification data.<br /> A clear place to begin your research.</p><Link className="tm-textlink" to="/products">Shop peptides <ArrowRight size={16} strokeWidth={1.6} /></Link></div>
      </header>
      <div
        className="tm-procession-stage"
        role="group"
        tabIndex={0}
        aria-label="Compound collection"
        aria-describedby="tm-procession-gesture"
        onKeyDown={event => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); controller.current?.step(event.key === "ArrowRight" ? 1 : -1); }
          const front = event.key === "Enter" ? inFront() : null;
          if (front) { event.preventDefault(); open(front); }
        }}
        onPointerDown={event => {
          press.current = { x: event.clientX, y: event.clientY };
          const img = vialAt(event.clientX, event.clientY);
          if (img && allowed) preloadProduct(idOf(img)!);
        }}
        // A swipe with a mouse ends in a click as well: only a press that stayed where it began opens a vial.
        onClick={event => {
          const from = press.current;
          press.current = null;
          if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > 8) return;
          const img = vialAt(event.clientX, event.clientY);
          if (img) open(img);
        }}
        onPointerMove={event => {
          if (event.pointerType !== "mouse" || hover.current) return;
          const { clientX, clientY, buttons } = event, stage = event.currentTarget;
          hover.current = requestAnimationFrame(() => { hover.current = 0; stage.toggleAttribute("data-over-vial", !buttons && Boolean(vialAt(clientX, clientY))); });
        }}
        onPointerLeave={event => event.currentTarget.removeAttribute("data-over-vial")}
      >
        <div className="tm-procession-light" aria-hidden="true" />
        {classes.map(c => {
          const product = productById(c.vial ?? "")!;
          return <div className="tm-procession-actor" key={c.id} data-product-id={product.id} aria-hidden="true">
            <span className="tm-procession-plinth" />
            <span className="tm-procession-shadow" />
            <img src={productCutout(product)} width="578" height="1112" alt="" draggable={false} decoding="async" loading="lazy" fetchPriority="low" />
          </div>;
        })}
      </div>
      <div className="tm-procession-details">
        {classes.map((c, i) => <div className="tm-procession-caption" key={c.id} aria-hidden={i !== status.active} data-selected={i === status.active ? "" : undefined}>
          <p className="tm-eyebrow">Class {String(c.position).padStart(2, "0")} <span>/</span> {String(classes.length).padStart(2, "0")}</p>
          <h3>{c.name}</h3><p className="tm-procession-members">{c.members}</p>
          <Link className="tm-textlink" to={`/products?class=${c.id}`} tabIndex={i === status.active ? 0 : -1} onPointerEnter={event => { if (event.pointerType === "mouse") controller.current?.pauseAutoplay(); }}>Explore class <ArrowRight size={15} strokeWidth={1.6} /></Link>
        </div>)}
      </div>
      <div className="tm-procession-navigation">
        <p className="tm-procession-hint" id="tm-procession-gesture">Swipe to explore<span className="sr-only">. Or focus the collection, use the left and right arrow keys, and Enter to open the vial in front.</span></p>
        <div className="tm-procession-controls" data-keep-clear="">
          <button type="button" className="tm-procession-play" aria-label={status.reduced ? "Motion is off" : status.paused ? "Play collection" : "Pause collection"} disabled={status.reduced} onClick={() => controller.current?.toggle()}>{status.paused || status.reduced ? <Play size={14} /> : <Pause size={14} />}<span>{status.reduced ? "Still" : status.paused ? "Play" : "Pause"}</span></button>
        </div>
      </div>
      {/* The section's foot: what every product page carries, and the way on to the shop once the classes are seen. */}
      <div className="tm-procession-foot">
        <p className="tm-procession-specs">CAS number · Molecular formula &amp; weight · Sequence · Purity &amp; identity · Solubility · Storage</p>
        <Link className="tm-button tm-button-primary" to="/products" data-keep-clear="">Shop peptides</Link>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{status.paused ? `${classes[status.active]?.name}. ${classes[status.active]?.members}.` : ""}</p>
    </section>
  );
}
