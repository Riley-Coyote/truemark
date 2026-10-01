import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { X } from "lucide-react";
import { productById, productCutout } from "./catalog";
import { useShop } from "./context";
import { usePrefersReducedMotion } from "./motion";
import { discountOn, roundMoney, useBagCode, useBagLines } from "./pages/checkout/Bag";
import { ShippingProgress, useShipping } from "./ShippingProgress";
import "./mobile-add.css";

type Added = { id: string; origin?: { left: number; top: number; width: number; height: number } };
const ADD_EVENT = "tm-mobile-add";

export function announceMobileAdd(id: string, image?: HTMLImageElement | null) {
  const rect = image?.getBoundingClientRect();
  window.dispatchEvent(new CustomEvent<Added>(ADD_EVENT, { detail: { id,
    origin: rect && { left: rect.left, top: rect.top, width: rect.width, height: rect.height } } }));
}

export function MobileAdd() {
  const [entry, setEntry] = useState<(Added & { sequence: number }) | null>(null);
  const [dockRoom, setDockRoom] = useState(0);
  const bar = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { openCart } = useShop();
  const { subtotal, count } = useBagLines();
  const code = useBagCode();
  const shipping = useShipping();
  const base = roundMoney(subtotal - (code.discount ? discountOn(subtotal, code.discount) : 0));
  const product = entry ? productById(entry.id) : undefined;

  useEffect(() => {
    let sequence = 0;
    const added = (event: Event) => setEntry({ ...(event as CustomEvent<Added>).detail, sequence: ++sequence });
    window.addEventListener(ADD_EVENT, added);
    return () => window.removeEventListener(ADD_EVENT, added);
  }, []);

  useEffect(() => {
    if (!entry) return;
    const deadline = Date.now() + 5000;
    const dismiss = () => {
      if (Date.now() < deadline || bar.current?.contains(document.activeElement)) return;
      setEntry(null);
    };
    const timer = window.setTimeout(dismiss, 5000);
    const el = bar.current;
    const blur = () => window.setTimeout(dismiss, 0);
    el?.addEventListener("focusout", blur);
    return () => { window.clearTimeout(timer); el?.removeEventListener("focusout", blur); };
  }, [entry]);

  useEffect(() => {
    if (!entry || !product || !entry.origin || reduced) return;
    const target = document.querySelector<HTMLElement>("[data-cart-target]");
    if (!target) return;
    const end = target.getBoundingClientRect();
    const start = entry.origin;
    const width = Math.min(64, start.width);
    const height = width * start.height / Math.max(1, start.width);
    const left = start.left + (start.width - width) / 2;
    const top = start.top + (start.height - height) / 2;
    const x = end.left + end.width / 2 - left - width / 2;
    const y = end.top + end.height / 2 - top - height / 2;
    const vial = document.createElement("img");
    vial.className = "tm-add-flight";
    vial.src = productCutout(product, "sm");
    vial.alt = "";
    vial.setAttribute("aria-hidden", "true");
    Object.assign(vial.style, { width: `${width}px`, height: `${height}px`, left: `${left}px`, top: `${top}px` });
    document.body.append(vial);
    // Sample a quadratic curve so the flight follows an arc without a corner at its peak.
    const arc = Array.from({ length: 13 }, (_, index) => {
      const t = index / 12;
      const dx = 2 * (1 - t) * t * x * 0.35 + t * t * x;
      const dy = 2 * (1 - t) * t * (Math.min(y, 0) - 64) + t * t * y;
      return { transform: `translate(${dx}px, ${dy}px) scale(${1 - 0.92 * t})`, opacity: 0.9 * (1 - t), offset: t };
    });
    const flight = vial.animate(arc, { duration: 600, easing: "cubic-bezier(0.2, 0.7, 0.1, 1)" });
    let pulse: Animation | undefined;
    flight.onfinish = () => {
      vial.remove();
      pulse = target.animate([{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: 240 });
    };
    return () => { flight.cancel(); pulse?.cancel(); vial.remove(); };
  }, [entry, product, reduced]);

  useEffect(() => {
    if (!entry) return;
    // Measure the existing review dock without modifying its layout or styles.
    const measure = () => {
      const docks = document.querySelectorAll<HTMLElement>(".rl-dock, .rl-dock-pill");
      const room = Array.from(docks).reduce((max, dock) => {
        const rect = dock.getBoundingClientRect();
        return rect.height && getComputedStyle(dock).visibility !== "hidden" ? Math.max(max, window.innerHeight - rect.top) : max;
      }, 0);
      setDockRoom(room);
    };
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "data-drawer"] });
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [entry]);

  if (!entry || !product || !count) return null;
  const close = () => {
    if (bar.current?.contains(document.activeElement)) document.querySelector<HTMLElement>("[data-cart-target]")?.focus();
    setEntry(null);
  };
  return (
    <div className="tm tm-addbar" ref={bar} onKeyDown={(event) => { if (event.key === "Escape") close(); }} style={{ "--tm-add-dock-room": `${dockRoom}px` } as CSSProperties}>
      <img className="tm-addbar-thumb" src={productCutout(product, "sm")} alt="" />
      <p className="tm-addbar-title" role="status" key={entry.sequence}>Added · {product.name} {product.size}</p>
      <button className="tm-addbar-view" onClick={() => { close(); openCart(); }}>View bag</button>
      <button className="tm-addbar-close" aria-label="Close added-to-bag message" onClick={close}><X size={18} aria-hidden="true" /></button>
      <ShippingProgress base={base} count={count} settings={shipping.data?.settings} />
      {shipping.error && <button className="tm-addbar-retry" disabled={shipping.loading} onClick={shipping.reload}>Retry shipping</button>}
    </div>
  );
}
