import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { productById, productCutout } from "./catalog";
import { useShop } from "./context";
import { usePrefersReducedMotion, usePresence } from "./motion";
import { discountOn, roundMoney, useBagCode, useBagLines, useFreeBacWater } from "./pages/checkout/Bag";
import { ShippingProgress, useShipping } from "./ShippingProgress";
import { useReviewDockRoom } from "./dock";
import "./mobile-add.css";

type Added = { id: string; origin?: { left: number; top: number; width: number; height: number } };
export const ADD_EVENT = "tm-mobile-add";

export function announceMobileAdd(id: string, image?: HTMLImageElement | null) {
  const rect = image?.getBoundingClientRect();
  window.dispatchEvent(new CustomEvent<Added>(ADD_EVENT, { detail: { id,
    origin: rect && { left: rect.left, top: rect.top, width: rect.width, height: rect.height } } }));
}

export function MobileAdd() {
  // What was added last stays with the bar as it goes, so it leaves as it was.
  const [entry, setEntry] = useState<(Added & { sequence: number }) | null>(null);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const reduced = usePrefersReducedMotion();
  const { openCart } = useShop();
  const { subtotal, count } = useBagLines();
  const code = useBagCode();
  const shipping = useShipping();
  const base = roundMoney(subtotal - (code.discount ? discountOn(subtotal, code.discount) : 0));
  const free = useFreeBacWater(base, shipping.data?.settings);
  const product = entry ? productById(entry.id) : undefined;
  // A change of page puts it away in the same step, so it never stands over the next page's own buttons (the cart's
  // Check out); it leaves the way it rose, or on a phone goes with the page it was on (motion.ts). It is closed in the
  // very render the page changes in, or it would be drawn leaving on the page arriving, fading as that page glides in.
  const [shownOn, setShownOn] = useState(pathname);
  const moved = shownOn !== pathname;
  if (moved) {
    setShownOn(pathname);
    setOpen(false);
  }
  const presence = usePresence<HTMLDivElement>(open && !moved && Boolean(product) && count > 0, pathname);
  const bar = presence.exit;
  const dockRoom = useReviewDockRoom(presence.shown);

  useEffect(() => {
    let sequence = 0;
    const added = (event: Event) => {
      setEntry({ ...(event as CustomEvent<Added>).detail, sequence: ++sequence });
      setOpen(true);
    };
    window.addEventListener(ADD_EVENT, added);
    return () => window.removeEventListener(ADD_EVENT, added);
  }, []);

  useEffect(() => {
    if (!entry || !open) return;
    const el = bar.current;
    if (!el) return;
    let timer = 0, disposed = false;
    let hovered = window.matchMedia("(hover: hover) and (pointer: fine)").matches && el.matches(":hover");
    let touching = false;
    const pause = () => window.clearTimeout(timer);
    const resume = () => {
      pause();
      if (disposed || document.hidden || hovered || touching || el.contains(document.activeElement)) return;
      // A full reading interval after returning to the tab or leaving a control. The
      // message never expires under a finger, keyboard focus, or a hovering pointer.
      timer = window.setTimeout(() => setOpen(false), 5000);
    };
    const enter = (event: PointerEvent) => { if (event.pointerType === "mouse") { hovered = true; pause(); } };
    const leave = () => { hovered = false; resume(); };
    const down = () => { touching = true; pause(); };
    const up = () => { if (touching) { touching = false; resume(); } };
    const blur = () => queueMicrotask(resume);
    const listeners = new AbortController();
    const options = { signal: listeners.signal };
    el.addEventListener("pointerenter", enter, options);
    el.addEventListener("pointerleave", leave, options);
    el.addEventListener("pointerdown", down, options);
    el.addEventListener("focusin", pause, options);
    el.addEventListener("focusout", blur, options);
    window.addEventListener("pointerup", up, options);
    window.addEventListener("pointercancel", up, options);
    document.addEventListener("visibilitychange", resume, options);
    resume();
    return () => { disposed = true; pause(); listeners.abort(); };
  }, [entry, bar, open]);

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

  if (!presence.shown || !entry || !product) return null;
  const close = () => {
    if (bar.current?.contains(document.activeElement)) document.querySelector<HTMLElement>("[data-cart-target]")?.focus();
    setOpen(false);
  };
  return (
    <div
      className="tm tm-addbar"
      ref={bar}
      data-state={presence.closing ? "closing" : undefined}
      inert={presence.closing}
      onKeyDown={(event) => { if (event.key === "Escape") close(); }}
      style={{ "--tm-add-dock-room": `${dockRoom}px` } as CSSProperties}
    >
      <img className="tm-addbar-thumb" src={productCutout(product, "sm")} alt="" />
      <p className="tm-addbar-title" role="status" key={entry.sequence}>Added · {product.name} {product.size}</p>
      <button className="tm-addbar-view" onClick={() => { close(); openCart(); }}>View cart</button>
      <button className="tm-addbar-close" aria-label="Close added-to-cart message" onClick={close}><X size={18} aria-hidden="true" /></button>
      <ShippingProgress base={base} count={count} settings={shipping.data?.settings} bacWater={free.offered} />
      {shipping.error && <button className="tm-addbar-retry" disabled={shipping.loading} onClick={shipping.reload}>Retry shipping</button>}
    </div>
  );
}
