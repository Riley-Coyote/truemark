import { useEffect, useId, useRef, useState } from "react";
import "./trace.css";

/**
 * The brand's wave motif read as what it is in a lab: an HPLC trace.
 * A quiet baseline with one clean peak, and the peak alone carries the
 * brand gradient, so the gradient appears as light, never as paint.
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
            <linearGradient id={`g${id}`} gradientUnits="userSpaceOnUse" x1={peakX - sigma * 3} x2={peakX + sigma * 3} y1="0" y2="0">
              <stop offset="0" stopColor="#e9284c" />
              <stop offset="0.28" stopColor="#b3146b" />
              <stop offset="0.55" stopColor="#7a2aa0" />
              <stop offset="0.8" stopColor="#2f1492" />
              <stop offset="1" stopColor="#0a2ea9" />
            </linearGradient>
            <clipPath id={`c${id}`}>
              <rect x={peakX - sigma * 3.2} y="0" width={sigma * 6.4} height={height} />
            </clipPath>
            <filter id={`f${id}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          <path className="tm-trace-line" d={d} pathLength={1} />
          <g clipPath={`url(#c${id})`} className="tm-trace-peak">
            <path d={d} stroke={`url(#g${id})`} strokeWidth="6" fill="none" filter={`url(#f${id})`} opacity="0.55" />
            <path d={d} stroke={`url(#g${id})`} strokeWidth="1.75" fill="none" />
          </g>
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
