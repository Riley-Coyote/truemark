import { useEffect, useId, useRef, useState } from "react";
import "./trace.css";

/**
 * The brand's wave motif read as what it is in a lab: an HPLC trace.
 * One continuous line: quiet ink along the baseline, warming into the brand
 * gradient as it rises into the peak and cooling back out, so the colour reads
 * as light travelling along the trace, never as a separate painted segment.
 * Illustrative only: it is a motif, not a result for any lot.
 */
export function Trace({
  peakAt = 0.5,
  height = 104,
  theme = "light",
  className = "",
  caption,
}: {
  peakAt?: number;
  height?: number;
  theme?: "light" | "night";
  className?: string;
  caption?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const baseline = height - 18;
  const peakX = width * peakAt;
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

  return (
    <div
      ref={root}
      className={`tm-trace tm-trace-${theme} ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      {width > 0 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
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
          </g>
          <path className="tm-trace-line" d={d} stroke={`url(#g${id})`} pathLength={1} />
        </svg>
      )}
      {caption && width > 0 && (
        <span
          className="tm-trace-caption"
          style={{
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
