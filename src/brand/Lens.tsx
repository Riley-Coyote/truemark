import { useEffect, useRef } from "react";
import type { CSSProperties, RefObject } from "react";
import { productById, productCutout } from "../shop/catalog";
import { SCENE, POSE, LensPlayer, automaticFocus, newFocusSample, rackSeconds, circleOfConfusion, fitScale, inField, project } from "./lens-scene";
import type { KeepClear, LensLayout, LensReview, LotPhase } from "./lens-scene";

const products = SCENE.vials.map((vial) => productById(vial.id));
const sources = products.map((product) => ({ small: productCutout(product, "sm"), large: productCutout(product, "lg") }));

/** Rendered lines, including all five possible lot labels, measured only by the resize path. */
export function measureKeepClear(panel: HTMLElement, mobile: boolean): KeepClear[] {
  const bounds = panel.getBoundingClientRect();
  const obstacles: KeepClear[] = [];
  const rise = parseFloat(getComputedStyle(panel).getPropertyValue("--tm-space-4"));
  // The token is in rem. Resolve the actual entrance travel rather than assume the root size.
  const risePx = getComputedStyle(panel).getPropertyValue("--tm-space-4").trim().endsWith("rem")
    ? rise * parseFloat(getComputedStyle(document.documentElement).fontSize) : rise;
  const lines = (element: HTMLElement, moving: boolean) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.textContent?.trim()) continue;
      range.selectNodeContents(text);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        obstacles.push({ left: rect.left - bounds.left, top: rect.top - bounds.top,
          right: rect.right - bounds.left, bottom: rect.bottom - bounds.top + (moving ? risePx : 0), kind: "text" });
      }
    }
    // The statement's brand dot is an inline mark, not a text node.
    for (const dot of element.querySelectorAll<HTMLElement>(".tm-brand-dot")) {
      const rect = dot.getBoundingClientRect();
      obstacles.push({ left: rect.left - bounds.left, top: rect.top - bounds.top,
        right: rect.right - bounds.left, bottom: rect.bottom - bounds.top + (moving ? risePx : 0), kind: "text" });
    }
  };
  const measure = (selector: string, moving: boolean, lots = false) => {
    const original = panel.querySelector<HTMLElement>(selector);
    if (!original || !original.offsetHeight) return;
    // A hidden, inert layout clone removes the entrance transform. The live text never moves.
    const clone = original.cloneNode(true) as HTMLElement;
    clone.inert = true; clone.setAttribute("aria-hidden", "true");
    Object.assign(clone.style, { position: "absolute", visibility: "hidden", pointerEvents: "none",
      animation: "none", transform: "none", margin: "0", left: `${original.offsetLeft}px`,
      top: `${original.offsetTop}px`, width: `${original.offsetWidth}px` });
    panel.appendChild(clone);
    if (mobile) {
      const title = clone.querySelector<HTMLElement>(".tm-gate-title");
      if (title) lines(title, moving);
    } else if (lots) {
      const label = clone.querySelector<HTMLElement>(".tm-gate-lot-label");
      const number = clone.querySelector<HTMLElement>(".tm-gate-lot");
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        if (!SCENE.vials[i].focus || !product) continue;
        if (label) label.textContent = `Lot · ${product.name} ${product.size}`;
        if (number) number.textContent = product.lot;
        lines(clone, moving);
      }
    } else lines(clone, moving);
    clone.remove();
  };
  measure(".tm-gate-statement", true);
  if (!mobile) {
    measure(".tm-gate-lotline", true, true);
    measure(".tm-gate-legal", false);
    const trace = panel.querySelector<HTMLElement>(".tm-gate-trace");
    if (trace) {
      const top = trace.offsetTop + parseFloat(getComputedStyle(trace).paddingTop);
      const peak = trace.offsetLeft + trace.clientWidth * SCENE.clearance.peakAt;
      obstacles.push({ left: peak - SCENE.clearance.peakHalfWidth, right: peak + SCENE.clearance.peakHalfWidth,
        top, bottom: top + SCENE.clearance.traceHeight, kind: "trace" });
    }
  }
  return obstacles;
}

export function Lens({ panel, onFocus }: {
  panel: RefObject<HTMLElement | null>;
  onFocus: (index: number, phase: LotPhase) => void;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = panel.current, field = layer.current, surface = canvas.current;
    if (!root || !field || !surface) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const band = matchMedia(`(max-width: ${SCENE.mobile.breakpoint}px)`);
    const stillImages = field.querySelectorAll<HTMLImageElement>(".tm-lens-still img");
    const stillPoses = new Float64Array(SCENE.vials.length * POSE.stride);
    let player: LensPlayer | undefined;
    let lastLayout: LensLayout | undefined;
    let fontsReady = false, disposed = false, visible = false, resizeFrame = 0;
    let panelLeft = 0, panelTop = 0, paused = true;
    let mouseX = NaN, mouseY = NaN;
    let touchId = -1, touchX = 0, touchY = 0;
    let review: LensReview | undefined;
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search || window.location.hash.split("?")[1]);
      const mode = params.get("lens");
      if (mode === "still") {
        const time = Number(params.get("t") ?? 0);
        review = { time: Number.isFinite(time) ? Math.max(0, time) : 0 };
      } else if (mode?.startsWith("focus:")) {
        const index = SCENE.vials.findIndex((vial) => vial.id === mode.slice("focus:".length));
        if (index >= 0) review = { focus: index };
      } else if (mode === "hud") {
        const hud = document.createElement("div");
        hud.setAttribute("aria-hidden", "true");
        Object.assign(hud.style, { position: "fixed", left: "var(--tm-space-3)", bottom: "var(--tm-space-3)",
          padding: "var(--tm-space-2)", zIndex: "2147483647", pointerEvents: "none", background: "var(--tm-night)",
          color: "var(--tm-glow)", font: "var(--tm-type-micro) var(--tm-font-sans)" });
        document.body.appendChild(hud); review = { hud };
      }
    }
    const setPaused = (next: boolean) => {
      if (paused === next) return;
      paused = next; root.dataset.lensPaused = String(next);
    };
    root.dataset.lensPaused = "true";
    const resize = () => {
      resizeFrame = 0;
      if (disposed) return;
      const box = root.getBoundingClientRect();
      if (!box.width || !box.height) return;
      panelLeft = box.left + window.scrollX; panelTop = box.top + window.scrollY;
      const layout: LensLayout = { width: box.width, height: box.height, mobile: band.matches,
        dpr: Math.min(window.devicePixelRatio || 1, SCENE.dpr),
        scale: fitScale(box.width, box.height, band.matches, measureKeepClear(root, band.matches)) };
      project(0, layout, true, stillPoses);
      for (let i = 0; i < stillImages.length; i++) {
        const img = stillImages[i], p = i * POSE.stride, z = SCENE.vials[i].z;
        img.style.display = inField(i, layout.mobile) ? "block" : "none";
        img.style.left = `${stillPoses[p + POSE.x]}px`; img.style.top = `${stillPoses[p + POSE.y]}px`;
        img.style.width = `${stillPoses[p + POSE.width]}px`; img.style.height = `${stillPoses[p + POSE.height]}px`;
        img.style.filter = `blur(${circleOfConfusion(layout.width, z, SCENE.vials[0].z) / 2}px) brightness(${Math.max(SCENE.optics.toneFloor, 1 - SCENE.optics.toneSlope * Math.max(0, z - 1))})`;
      }
      if (!fontsReady) return;
      if (!player) {
        player = new LensPlayer(surface, sources, layout, motion.matches, {
          lot: (index, phase) => {
            let snapshot = false;
            if (import.meta.env.DEV && review?.time !== undefined) {
              snapshot = true;
              const sample = newFocusSample();
              automaticFocus(review.time, layout.mobile, sample);
              let since = 0;
              if (phase === "leave") since = review.time - sample.start;
              else if (phase === "enter") {
                since = review.time - sample.start - sample.duration * SCENE.focus.arrival;
                if (sample.duration === 0 && sample.start > SCENE.opening.rackAt + SCENE.opening.rackSeconds) {
                  const sequence = layout.mobile ? SCENE.mobile.sequence : SCENE.focus.sequence;
                  const previous = sequence[(sample.sequence + sequence.length - 1) % sequence.length].vial;
                  since += rackSeconds(previous, sample.to) * (1 - SCENE.focus.arrival);
                }
              }
              for (const element of root.querySelectorAll<HTMLElement>(".tm-gate-lot-label, .tm-gate-lot")) {
                element.style.animationDelay = `${-Math.max(0, since)}s`;
              }
            }
            if (phase === "leave" && !snapshot) {
              // If a visitor interrupts an arrival, depart from its current light/blur.
              for (const element of root.querySelectorAll<HTMLElement>(".tm-gate-lotline > .tm-gate-lot-label, .tm-gate-lotline > .tm-gate-lot")) {
                const style = getComputedStyle(element);
                element.style.setProperty("--tm-lens-lot-opacity", style.opacity);
                element.style.setProperty("--tm-lens-lot-filter", style.filter);
              }
            }
            onFocus(index, phase);
          },
          ready: () => { field.dataset.render = "webgl"; },
          fallback: () => { field.dataset.render = "fallback"; root.dataset.lensPaused = "false"; },
          paused: setPaused,
        }, review);
        player.setVisible(visible && !document.hidden);
      } else if (!lastLayout || layout.width !== lastLayout.width || layout.height !== lastLayout.height ||
        layout.scale !== lastLayout.scale || layout.dpr !== lastLayout.dpr || layout.mobile !== lastLayout.mobile) {
        player.resize(layout);
      }
      lastLayout = layout;
    };
    const scheduleResize = () => { if (!resizeFrame && !disposed) resizeFrame = requestAnimationFrame(resize); };
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(root);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      player?.setVisible(visible && !document.hidden);
    });
    intersection.observe(root);
    const visibility = () => player?.setVisible(visible && !document.hidden);
    const reduced = () => player?.setReduced(motion.matches);
    const pointerPosition = () => player?.pointer(mouseX + window.scrollX - panelLeft, mouseY + window.scrollY - panelTop);
    const move = (event: PointerEvent) => {
      if (event.pointerType === "mouse") { mouseX = event.clientX; mouseY = event.clientY; pointerPosition(); }
    };
    const leave = () => { mouseX = NaN; mouseY = NaN; player?.leave(); };
    const down = (event: PointerEvent) => {
      if (event.isPrimary && (event.pointerType === "touch" || event.pointerType === "pen")) {
        touchId = event.pointerId; touchX = event.clientX; touchY = event.clientY;
      }
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== touchId) return;
      touchId = -1;
      if (Math.hypot(event.clientX - touchX, event.clientY - touchY) <= SCENE.pointer.tapSlop) {
        player?.tap(event.clientX + window.scrollX - panelLeft, event.clientY + window.scrollY - panelTop);
      }
    };
    const cancel = () => { touchId = -1; };
    const lost = (event: Event) => { event.preventDefault(); player?.contextLost(); };
    root.addEventListener("pointermove", move); root.addEventListener("pointerleave", leave);
    root.addEventListener("pointerdown", down); root.addEventListener("pointerup", up); root.addEventListener("pointercancel", cancel);
    surface.addEventListener("webglcontextlost", lost);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("resize", scheduleResize);
    window.addEventListener("scroll", pointerPosition, { passive: true });
    motion.addEventListener("change", reduced); band.addEventListener("change", scheduleResize);
    document.fonts.addEventListener("loadingdone", scheduleResize);
    void document.fonts.ready.then(() => { if (!disposed) { fontsReady = true; scheduleResize(); } });
    scheduleResize();
    return () => {
      disposed = true;
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      observer.disconnect(); intersection.disconnect();
      root.removeEventListener("pointermove", move); root.removeEventListener("pointerleave", leave);
      root.removeEventListener("pointerdown", down); root.removeEventListener("pointerup", up); root.removeEventListener("pointercancel", cancel);
      surface.removeEventListener("webglcontextlost", lost);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("resize", scheduleResize);
      window.removeEventListener("scroll", pointerPosition);
      motion.removeEventListener("change", reduced); band.removeEventListener("change", scheduleResize);
      document.fonts.removeEventListener("loadingdone", scheduleResize);
      player?.dispose();
      if (import.meta.env.DEV) review?.hud?.remove();
      delete root.dataset.lensPaused;
    };
  }, [panel, onFocus]);

  return (
    <div className="tm-lens" data-render="loading" ref={layer} aria-hidden="true">
      <div className="tm-lens-still">
        {SCENE.vials.map((vial, i) => (
          <img key={vial.id} src={sources[i].small} alt="" draggable={false} decoding="async"
            style={{ left: `${vial.x * 100}%`, top: `${vial.y * 100}%`, width: `${SCENE.width / vial.z * 100}%`,
              "--tm-lens-roll": `${vial.roll}deg`, zIndex: Math.round(100 / vial.z) } as CSSProperties}
            onError={(event) => {
              // A failed small file can still leave a usable DOM fallback through its large peer.
              const img = event.currentTarget;
              if (!img.dataset.retried) { img.dataset.retried = "true"; img.src = sources[i].large; }
            }} />
        ))}
      </div>
      <canvas className="tm-lens-canvas" ref={canvas} aria-hidden="true" />
    </div>
  );
}
