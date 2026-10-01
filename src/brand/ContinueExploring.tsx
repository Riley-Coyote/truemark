import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Compound } from "../shop/catalog";
import { usePrefersReducedMotion } from "../shop/motion";
import { ProductCard } from "./ProductCard";
import "./exploring.css";

export function ContinueExploring({ compounds }: { compounds: Compound[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; scroll: number; moved: boolean } | null>(null);
  const [ends, setEnds] = useState({ start: true, end: false });
  const reduced = usePrefersReducedMotion();
  const id = useId();
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const measure = () => setEnds({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || !window.matchMedia("(min-width: 761px)").matches || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientWidth : 1);
      if ((delta > 0 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) || (delta < 0 && el.scrollLeft <= 1)) return;
      event.preventDefault();
      el.scrollBy({ left: delta, behavior: "instant" });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    el.addEventListener("wheel", wheel, { passive: false });
    return () => { observer.disconnect(); el.removeEventListener("scroll", measure); el.removeEventListener("wheel", wheel); };
  }, [compounds]);
  const scroll = (direction: number) => {
    const el = rail.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: reduced ? "instant" : "smooth" });
  };
  return <>
    <header className="tm-section-head" data-reveal>
      <p className="tm-eyebrow">The collection</p>
      <h2 id="tm-more-title" className="tm-heading">Continue exploring.</h2>
      <div className="tm-section-tools tm-more-tools">
        <Link className="tm-textlink" to="/products">Shop all compounds <ArrowRight size={16} strokeWidth={1.6} /></Link>
        <div className="tm-rail-controls">
          <button aria-label="Previous compounds" aria-controls={id} disabled={ends.start} onClick={() => scroll(-1)}><ArrowLeft size={18} aria-hidden="true" /></button>
          <button aria-label="Next compounds" aria-controls={id} disabled={ends.end} onClick={() => scroll(1)}><ArrowRight size={18} aria-hidden="true" /></button>
        </div>
      </div>
    </header>
    <div className="tm-more-track" data-end={ends.end}>
      <div className="tm-rail" role="list" aria-label="Continue exploring compounds" id={id} ref={rail} tabIndex={0}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button !== 0 || (event.target as Element).closest("button, input")) return;
          drag.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft, moved: false };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const delta = event.clientX - drag.current.x;
          if (Math.abs(delta) > 6 && !drag.current.moved) {
            drag.current.moved = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            event.currentTarget.dataset.dragging = "true";
          }
          if (drag.current.moved) { event.preventDefault(); event.currentTarget.scrollLeft = drag.current.scroll - delta; }
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          delete event.currentTarget.dataset.dragging;
        }}
        onPointerCancel={(event) => { drag.current = null; delete event.currentTarget.dataset.dragging; }}
        onClickCapture={(event) => { if (drag.current?.moved) { event.preventDefault(); event.stopPropagation(); } drag.current = null; }}>
        {compounds.map((compound) => <ProductCard key={compound.key} compound={compound} listItem />)}
      </div>
    </div>
  </>;
}
