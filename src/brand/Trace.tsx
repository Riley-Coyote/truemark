import { useEffect, useId, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../shop/motion";
import "./trace.css";

/** How long the peak takes to glide to a new place. */
const GLIDE_MS = 720;
/** How quickly a stretch of lit line cools back to ink once the light has crossed it. */
const LIT_COOL_MS = 900;
/** The light's soft leading edge, in px. */
const LIT_EDGE = 22;
/** The brand gradient as light: warm where the line begins, cool where it ends. */
const LIT_STOPS = ["#e9284c", "#b3146b", "#7a2aa0", "#2f1492", "#0a2ea9"];
/** Room above and below the line for the lit peak's bloom, which the light's mask would otherwise cut. */
const LIT_BLEED = 28;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The brand's wave motif read as what it is in a lab: an HPLC trace.
 * Illustrative only: it is a motif, not a result for any lot. A new `peakAt`
 * glides the peak there; reduced motion moves it without travel.
 *
 * The line is one ink, a little stronger as it rises into the peak; no colour is
 * held on it. Colour arrives only as light: `lit` sets the line in its scene's
 * light (useLight), so when the studio light passes over the scene it runs along
 * the line too, writing the brand's colours across it; the peak blooms as the
 * light reaches it, and each stretch cools back to ink behind the light, as
 * phosphor does.
 */
export function Trace({
  peakAt = 0.5,
  height = 104,
  theme = "light",
  className = "",
  caption,
  lit = false,
}: {
  peakAt?: number;
  height?: number;
  theme?: "light" | "night";
  className?: string;
  caption?: string;
  lit?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const litLayer = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const id = useId().replace(/:/g, "");
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(peakAt);
  const shownRef = useRef(peakAt);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Glide from wherever the peak is now, so a quick change of mind never jumps.
  useEffect(() => {
    const from = shownRef.current;
    if (reduced || Math.abs(from - peakAt) < 0.0005) {
      shownRef.current = peakAt;
      setShown(peakAt);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / GLIDE_MS);
      const value = from + (peakAt - from) * easeInOutCubic(t);
      shownRef.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [peakAt, reduced]);

  // In the scene's light: on each pass, follow the light's edge along the line and let every
  // point it has crossed cool from the moment it was crossed. The colours live in a layer whose
  // mask is drawn here, one stop every few dozen pixels; between passes the layer is masked away.
  const drawn = width > 0;
  useEffect(() => {
    const el = root.current;
    const layer = litLayer.current;
    const scene = el?.closest<HTMLElement>("[data-light]");
    if (!lit || reduced || !drawn || !el || !layer || !scene) return;
    let frame = 0;
    let marks: { x: number; t: number }[] = [];
    let offset = 0;
    let span = 0;
    let moved = 0;
    const setMask = (value: string | null) => {
      for (const property of ["mask-image", "-webkit-mask-image"]) {
        if (value) layer.style.setProperty(property, value);
        else layer.style.removeProperty(property);
      }
    };
    /** When the light crossed the point p, between the marks either side of it. */
    const crossedAt = (p: number) => {
      const after = marks.findIndex((mark) => mark.x >= p);
      if (after <= 0) return marks[Math.max(0, after)].t;
      const a = marks[after - 1], b = marks[after];
      return a.t + ((p - a.x) / (b.x - a.x)) * (b.t - a.t);
    };
    const paint = (now: number) => {
      frame = 0;
      const x = parseFloat(scene.style.getPropertyValue("--lx")) - offset;
      const last = marks[marks.length - 1];
      // The light only ever advances along the line; its return to rest is not a crossing.
      if (Number.isFinite(x) && (!last || x > last.x)) {
        marks.push({ x, t: now });
        moved = now;
      }
      const lead = marks.length ? marks[marks.length - 1].x : -Infinity;
      const stops: string[] = [];
      let glowing = false;
      const step = Math.max(24, span / 28);
      for (let p = 0; p < Math.min(lead, span); p += step) {
        const alpha = Math.exp(-(now - crossedAt(p)) / LIT_COOL_MS);
        if (alpha > 0.01) glowing = true;
        stops.push(`rgb(0 0 0 / ${alpha.toFixed(3)}) ${p.toFixed(1)}px`);
      }
      if (lead > 0 && lead < span + LIT_EDGE) {
        glowing = true;
        stops.push(`rgb(0 0 0 / 1) ${lead.toFixed(1)}px`, `rgb(0 0 0 / 0) ${(lead + LIT_EDGE).toFixed(1)}px`);
      } else if (lead >= span + LIT_EDGE) {
        const alpha = Math.exp(-(now - crossedAt(span)) / LIT_COOL_MS);
        stops.push(`rgb(0 0 0 / ${alpha.toFixed(3)}) ${span}px`);
      }
      setMask(stops.length > 1 ? `linear-gradient(90deg, ${stops.join(", ")})` : null);
      // Done once the light has left and the line has cooled (or, if a pass is cut short, soon after it stalls).
      const done = !glowing && (lead >= span + LIT_EDGE || now - moved > 2400);
      if (done) setMask(null);
      else frame = requestAnimationFrame(paint);
    };
    const onPass = () => {
      const box = el.getBoundingClientRect();
      offset = box.left - scene.getBoundingClientRect().left;
      span = box.width;
      marks = [];
      moved = performance.now();
      if (!frame) frame = requestAnimationFrame(paint);
    };
    scene.addEventListener("tm-light-pass", onPass);
    return () => {
      scene.removeEventListener("tm-light-pass", onPass);
      if (frame) cancelAnimationFrame(frame);
      setMask(null);
    };
  }, [lit, reduced, drawn]);

  const baseline = height - 18;
  const peakX = width * shown;
  const peakH = height * 0.74;
  const sigma = 9;
  // Deterministic, small, lab-like noise; two minor peaks keep it honest-looking.
  let seed = 7;
  const noise = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280 - 0.5;
  };
  const bump = (x: number, c: number, h: number, w: number) => h * Math.exp(-((x - c) ** 2) / (2 * w * w));
  let d = "";
  for (let x = 0; x <= width; x += 2) {
    const y =
      baseline -
      (bump(x, peakX, peakH, sigma) +
        bump(x, width * 0.18, 5, 7) +
        bump(x, width * 0.74, 3.5, 6) +
        bump(x, peakX + 34, 3, 5) +
        noise() * 1.1);
    d += `${x === 0 ? "M" : "L"}${x},${y.toFixed(1)}`;
  }

  // Beyond the peak's right side the caption runs out of room; it then sits to the left.
  const captionLeftOfPeak = peakX > width * 0.72;

  return (
    <div
      ref={root}
      className={`tm-trace tm-trace-${theme} ${className}`}
      style={{ height }}
      data-lit={lit ? "true" : undefined}
      aria-hidden="true"
    >
      {drawn && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <defs>
            {/* One ink, stronger as the line rises, so the peak carries its weight without colour. */}
            <linearGradient id={`v${id}`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={baseline} y2={baseline - peakH}>
              <stop offset="0" style={{ stopColor: "var(--tm-trace-ink)" }} />
              <stop offset="1" style={{ stopColor: "var(--tm-trace-peak-ink)" }} />
            </linearGradient>
          </defs>
          <path className="tm-trace-line" d={d} stroke={`url(#v${id})`} pathLength={1} />
        </svg>
      )}
      {drawn && lit && (
        <div ref={litLayer} className="tm-trace-lit" style={{ top: -LIT_BLEED, bottom: -LIT_BLEED }}>
          <svg width={width} height={height + LIT_BLEED * 2} viewBox={`0 ${-LIT_BLEED} ${width} ${height + LIT_BLEED * 2}`}>
            <defs>
              <linearGradient id={`h${id}`} gradientUnits="userSpaceOnUse" x1="0" x2={width} y1="0" y2="0">
                {LIT_STOPS.map((color, i) => (
                  <stop key={color} offset={i / (LIT_STOPS.length - 1)} stopColor={color} />
                ))}
              </linearGradient>
              {/* The peak's bloom fades out sideways instead of ending at an edge. */}
              <linearGradient id={`m${id}`} gradientUnits="userSpaceOnUse" x1={peakX - sigma * 7} x2={peakX + sigma * 7} y1="0" y2="0">
                <stop offset="0" stopColor="#000" />
                <stop offset="0.5" stopColor="#fff" />
                <stop offset="1" stopColor="#000" />
              </linearGradient>
              <mask id={`k${id}`} maskUnits="userSpaceOnUse" x="0" y={-height} width={width} height={height * 3}>
                <rect x="0" y={-height} width={width} height={height * 3} fill={`url(#m${id})`} />
              </mask>
              <filter id={`f${id}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>
            <g mask={`url(#k${id})`}>
              <path d={d} stroke={`url(#h${id})`} strokeWidth="8" fill="none" filter={`url(#f${id})`} opacity="0.55" />
            </g>
            <path className="tm-trace-line is-lit" d={d} stroke={`url(#h${id})`} pathLength={1} />
          </svg>
        </div>
      )}
      {caption && drawn && (
        <span
          className="tm-trace-caption"
          style={captionLeftOfPeak ? {
            right: width - (peakX - sigma * 3 - 10),
            bottom: height - baseline + peakH * 0.62,
            maxWidth: Math.max(0, peakX - sigma * 3 - 18),
            textAlign: "right",
          } : {
            left: peakX + sigma * 3 + 10,
            bottom: height - baseline + peakH * 0.62,
            // On a narrow screen the caption wraps beside the peak instead of running off the edge.
            maxWidth: Math.max(0, width - (peakX + sigma * 3 + 10) - 8),
          }}
        >
          {caption}
        </span>
      )}
    </div>
  );
}
