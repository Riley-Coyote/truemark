import { useEffect, useId, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../shop/motion";
import "./trace.css";

/** How long the peak takes to glide to a new place. */
const GLIDE_MS = 720;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The brand's wave motif read as what it is in a lab: an HPLC trace.
 * Illustrative only: it is a motif, not a result for any lot. A new `peakAt`
 * glides the peak there; reduced motion moves it without travel.
 *
 * The line is one ink, a little stronger as it rises into the peak; no colour is
 * held on it.
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

  const drawn = width > 0;
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
