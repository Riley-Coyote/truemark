import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { usePrefersReducedMotion } from "../shop/motion";
import "./trace.css";

/** How long the peak takes to glide to a new place, and the pulse's rhythm. */
const GLIDE_MS = 720;
const PULSE_CYCLE_MS = 4800;
/** The pulse travels for this share of each cycle, then rests. */
const PULSE_TRAVEL = 0.66;
/** The pulse starts once the line has finished drawing in (500 ms delay + 2400 ms draw). */
const PULSE_START_MS = 2900;
/** The light's head travels until even its longest tail (9% of the line) has passed the end. */
const PULSE_REACH = 1.09;
/** Where in its cycle the flare is brightest (see tm-trace-flare in trace.css). */
const FLARE_PEAK = 0.06;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The brand's wave motif read as what it is in a lab: an HPLC trace.
 * One continuous line: quiet ink along the baseline, warming into the brand
 * gradient as it rises into the peak and cooling back out, so the colour reads
 * as light travelling along the trace, never as a separate painted segment.
 * Illustrative only: it is a motif, not a result for any lot.
 *
 * `pulse` keeps it alive after it draws in: a light runs along the line on a
 * loop, taking the gradient's colours as it climbs the peak, which flares as
 * the light passes. A new `peakAt` glides the peak there. Reduced motion keeps
 * the line still and moves the peak without travel.
 */
export function Trace({
  peakAt = 0.5,
  height = 104,
  theme = "light",
  className = "",
  caption,
  pulse = false,
}: {
  peakAt?: number;
  height?: number;
  theme?: "light" | "night";
  className?: string;
  caption?: string;
  pulse?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [paused, setPaused] = useState(false);
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

  // The pulse rests while the trace is off screen.
  useEffect(() => {
    const el = root.current;
    if (!el || !pulse) return;
    const observer = new IntersectionObserver(([entry]) => setPaused(!entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [pulse]);

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

  const baseline = height - 18;
  const peakX = width * shown;
  const peakH = height * 0.74;
  const sigma = 9;
  // How far the colour travels along the baseline on each side of the peak, and where it fully arrives.
  const reach = Math.max(sigma * 12, width * 0.16);
  const core = Math.min(0.2, (sigma * 3) / (2 * reach));
  const warm = Math.max(0.05, 0.5 - core - Math.min(0.32, (sigma * 9) / (2 * reach)));
  // Deterministic, small, lab-like noise; two minor peaks keep it honest-looking.
  let seed = 7;
  const noise = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280 - 0.5;
  };
  const bump = (x: number, c: number, h: number, w: number) => h * Math.exp(-((x - c) ** 2) / (2 * w * w));
  let d = "";
  // The line's length up to the peak, so the flare lands as the pulse arrives.
  let length = 0;
  let lengthAtPeak = 0;
  let previous: [number, number] | null = null;
  for (let x = 0; x <= width; x += 2) {
    const y =
      baseline -
      (bump(x, peakX, peakH, sigma) +
        bump(x, width * 0.18, 5, 7) +
        bump(x, width * 0.74, 3.5, 6) +
        bump(x, peakX + 34, 3, 5) +
        noise() * 1.1);
    d += `${x === 0 ? "M" : "L"}${x},${y.toFixed(1)}`;
    if (previous) length += Math.hypot(x - previous[0], y - previous[1]);
    if (x <= peakX) lengthAtPeak = length;
    previous = [x, y];
  }
  const peakShare = length > 0 ? lengthAtPeak / length : shown;
  // The light's head reaches the peak at this moment in each cycle.
  const arrival = (peakShare / PULSE_REACH) * PULSE_TRAVEL * PULSE_CYCLE_MS;
  const motion = {
    "--tm-trace-cycle": `${PULSE_CYCLE_MS}ms`,
    "--tm-trace-start": `${PULSE_START_MS}ms`,
    // Hold the flare's timing while the peak glides; it settles with it.
    "--tm-trace-flare-start": `${Math.round(PULSE_START_MS + arrival - FLARE_PEAK * PULSE_CYCLE_MS)}ms`,
  } as CSSProperties;

  // Beyond the peak's right side the caption runs out of room; it then sits to the left.
  const captionLeftOfPeak = peakX > width * 0.72;

  return (
    <div
      ref={root}
      className={`tm-trace tm-trace-${theme} ${className}`}
      style={{ height }}
      data-pulse={pulse && !reduced ? "true" : undefined}
      data-paused={paused ? "true" : undefined}
      aria-hidden="true"
    >
      {width > 0 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={pulse ? motion : undefined}>
          <defs>
            {/* Neutral at the edges, the brand gradient across the peak, with long soft ramps between. */}
            <linearGradient id={`g${id}`} gradientUnits="userSpaceOnUse" x1={peakX - reach} x2={peakX + reach} y1="0" y2="0">
              <stop offset="0" style={{ stopColor: "var(--tm-trace-ink)" }} />
              <stop offset={warm} style={{ stopColor: "var(--tm-trace-ink)" }} />
              <stop offset={0.5 - core} stopColor="#e9284c" />
              <stop offset={0.5 - core * 0.45} stopColor="#b3146b" />
              <stop offset="0.5" stopColor="#7a2aa0" />
              <stop offset={0.5 + core * 0.45} stopColor="#2f1492" />
              <stop offset={0.5 + core} stopColor="#0a2ea9" />
              <stop offset={1 - warm} style={{ stopColor: "var(--tm-trace-ink)" }} />
              <stop offset="1" style={{ stopColor: "var(--tm-trace-ink)" }} />
            </linearGradient>
            {/* The pulse: the same colours, with a stronger ink along the baseline so it reads there too. */}
            {pulse && (
              <linearGradient id={`p${id}`} gradientUnits="userSpaceOnUse" x1={peakX - reach} x2={peakX + reach} y1="0" y2="0">
                <stop offset="0" style={{ stopColor: "var(--tm-trace-pulse-ink)" }} />
                <stop offset={warm} style={{ stopColor: "var(--tm-trace-pulse-ink)" }} />
                <stop offset={0.5 - core} stopColor="#e9284c" />
                <stop offset={0.5 - core * 0.45} stopColor="#b3146b" />
                <stop offset="0.5" stopColor="#7a2aa0" />
                <stop offset={0.5 + core * 0.45} stopColor="#2f1492" />
                <stop offset={0.5 + core} stopColor="#0a2ea9" />
                <stop offset={1 - warm} style={{ stopColor: "var(--tm-trace-pulse-ink)" }} />
                <stop offset="1" style={{ stopColor: "var(--tm-trace-pulse-ink)" }} />
              </linearGradient>
            )}
            {/* The glow fades out sideways instead of ending at an edge. */}
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
          <g mask={`url(#k${id})`} className="tm-trace-peak">
            <path d={d} stroke={`url(#g${id})`} strokeWidth="6" fill="none" filter={`url(#f${id})`} opacity="0.5" />
            {pulse && <path className="tm-trace-flare" d={d} stroke={`url(#g${id})`} strokeWidth="9" fill="none" filter={`url(#f${id})`} />}
          </g>
          <path className="tm-trace-line" d={d} stroke={`url(#g${id})`} pathLength={1} />
          {pulse && (
            // A comet: a bright head, its soft glow and a fading tail, all led by the same point.
            <g className="tm-trace-pulse">
              <path className="tm-trace-comet is-tail" d={d} stroke={`url(#p${id})`} pathLength={1} />
              <path className="tm-trace-comet is-glow" d={d} stroke={`url(#p${id})`} pathLength={1} filter={`url(#f${id})`} />
              <path className="tm-trace-comet is-body" d={d} stroke={`url(#p${id})`} pathLength={1} />
              <path className="tm-trace-comet is-head" d={d} stroke={`url(#p${id})`} pathLength={1} />
            </g>
          )}
        </svg>
      )}
      {caption && width > 0 && (
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
