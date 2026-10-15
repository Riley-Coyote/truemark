import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { compoundClasses } from "../data";
import { productById, productCutout } from "../shop/catalog";
import { collectionIds } from "./carousel";
import { useMotion } from "./Sequence";
import { createProcession } from "./procession-controller";
import type { ProcessionController, ProcessionStatus } from "./procession-controller";
import "./procession.css";

/** The chosen collection: the opening's real artwork, then all eight compound classes. */
export function Procession() {
  const root = useRef<HTMLElement>(null);
  const controller = useRef<ProcessionController | null>(null);
  const moving = useMotion();
  const classes = compoundClasses.filter(c => c.onHome && productById(c.vial ?? ""));
  const original = collectionIds.map(id => classes.findIndex(c => c.vial === id)).filter(i => i >= 0);
  const order = [...original, ...classes.map((_, i) => i).filter(i => !original.includes(i))];
  const initial = original[Math.floor(original.length / 2)] ?? 0;
  const [status, setStatus] = useState<ProcessionStatus>({ active: initial, paused: false, reduced: !moving, arrived: false, progress: 0 });
  const signature = classes.map(c => c.id).join("|");
  useEffect(() => {
    if (!root.current || !classes.length) return;
    controller.current = createProcession(root.current, order, initial, setStatus);
    return () => { controller.current?.destroy(); controller.current = null; };
    // A catalog refresh can change the collection; ordinary control updates cannot rebuild it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  useEffect(() => controller.current?.setMotion(moving), [moving, signature]);

  return (
    <section className="tm tm-index tm-procession" ref={root} aria-labelledby="tm-index-title" aria-roledescription="carousel">
      <header className="tm-procession-heading">
        <div><p className="tm-eyebrow">The research collection</p><h2 id="tm-index-title" className="tm-heading">Organized by<br />compound class.</h2></div>
        <div className="tm-procession-intro"><p>Eight classes. Full specification data.<br /> A clear place to begin your research.</p><Link className="tm-textlink" to="/products">View catalog <ArrowRight size={16} strokeWidth={1.6} /></Link></div>
      </header>
      <div className="tm-procession-stage" aria-label="Drag horizontally to explore the collection">
        <div className="tm-procession-light" aria-hidden="true" />
        {classes.map(c => {
          const product = productById(c.vial ?? "")!;
          return <div className="tm-procession-actor" key={c.id} data-product-id={product.id} aria-hidden="true">
            <span className="tm-procession-shadow" />
            <img src={productCutout(product)} width="578" height="1112" alt="" draggable={false} decoding="async" />
          </div>;
        })}
      </div>
      <div className="tm-procession-details">
        {classes.map((c, i) => <div className="tm-procession-caption" key={c.id} aria-hidden={i !== status.active} data-selected={i === status.active ? "" : undefined}>
          <p className="tm-eyebrow">Class {String(c.position).padStart(2, "0")} <span>/</span> {String(classes.length).padStart(2, "0")}</p>
          <h3>{c.name}</h3><p className="tm-procession-members">{c.members}</p>
          <Link className="tm-textlink" to={`/products?class=${c.id}`} tabIndex={i === status.active ? 0 : -1} onFocus={() => controller.current?.pauseAutoplay()} onPointerEnter={() => controller.current?.pauseAutoplay()}>Explore class <ArrowRight size={15} strokeWidth={1.6} /></Link>
        </div>)}
      </div>
      <div className="tm-procession-navigation">
        <p className="tm-procession-hint">Explore the collection <span aria-hidden="true">—</span> <span>drag or choose a class</span></p>
        <div className="tm-procession-controls" data-keep-clear="">
          <button type="button" aria-label="Previous class" onClick={() => controller.current?.step(-1)}><ArrowLeft size={18} strokeWidth={1.5} /></button>
          <button type="button" className="tm-procession-play" aria-label={status.reduced ? "Motion is off" : status.paused ? "Play collection" : "Pause collection"} disabled={status.reduced} onClick={() => controller.current?.toggle()}>{status.paused || status.reduced ? <Play size={14} /> : <Pause size={14} />}<span>{status.reduced ? "Still" : status.paused ? "Play" : "Pause"}</span></button>
          <button type="button" aria-label="Next class" onClick={() => controller.current?.step(1)}><ArrowRight size={18} strokeWidth={1.5} /></button>
        </div>
      </div>
      <nav className="tm-procession-index" aria-label="Compound classes">
        {classes.map((c, i) => <button type="button" key={c.id} aria-label={c.name} aria-pressed={i === status.active} onClick={() => controller.current?.select(i)}>
          <span className="tm-procession-number">{String(c.position).padStart(2, "0")}</span><span>{c.short}</span><i aria-hidden="true" />
        </button>)}
      </nav>
      <p className="tm-procession-specs">CAS number · Molecular formula &amp; weight · Sequence · Purity &amp; identity · Solubility · Storage</p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{status.paused ? `${classes[status.active]?.name}. ${classes[status.active]?.members}.` : ""}</p>
    </section>
  );
}
