import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { usePrefersReducedMotion } from "../shop/motion";
import "./lot-trace.css";

export type LotPeak = { name: string | null; retentionTime: string };

/** A peak's half-width in minutes (its standard deviation), and the least it may draw on a phone. */
const PEAK_MINUTES = 0.06;
const PEAK_MIN_PX = 3;
/** Room above the peaks for their labels, below the baseline for the minutes, and at each side. */
const TOP = 40;
const BOTTOM = 28;
const SIDE = 10;
/** Peaks closer than this label away from each other, each on its own side. */
const NEAR_PX = 140;
/** The last minute's label carries the unit ("9 min"); closer than this, the one before it gives way. */
const LAST_LABEL_PX = 48;
/** The line is recorded over this long, after this pause; each peak lights as the record reaches it. */
const DRAW_MS = 1600;
const DRAW_DELAY_MS = 200;

const SPECTRUM = [1, 2, 3, 4, 5].map((n) => `var(--tm-spectrum-${n})`);

type Placed = LotPeak & { minutes: number; x: number; anchor: "start" | "middle" | "end" };

/**
 * A lot's own line: each component's main peak, drawn on a minutes axis at the retention time
 * its certificate reports, so no two compounds draw the same line. Drawn, not measured: one peak
 * per component, all one height, with no impurities or solvent front (the laboratory's
 * chromatogram is in the full certificate). It speaks the brand trace's language: quiet ink
 * along the baseline, the gradient lighting each peak as the line reaches it.
 */
export function LotTrace({ peaks, height = 168, className = "" }: { peaks: LotPeak[]; height?: number; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const id = useId().replace(/:/g, "");
  const reduced = usePrefersReducedMotion();

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // It draws once, the first time it comes into view.
  useEffect(() => {
    const el = root.current;
    if (!el || drawn) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setDrawn(true);
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [drawn]);

  const valid = peaks.filter((peak) => Number.isFinite(Number(peak.retentionTime)));
  if (!valid.length) return null;

  const last = Math.max(...valid.map((peak) => Number(peak.retentionTime)));
  const span = Math.max(2, Math.ceil(last + 1));
  const perMinute = Math.max(0, width - SIDE * 2) / span;
  const at = (minutes: number) => SIDE + minutes * perMinute;
  const baseline = height - BOTTOM;
  const tip = TOP + 4;
  const peakHeight = baseline - tip;
  const sigma = Math.max(PEAK_MIN_PX, PEAK_MINUTES * perMinute);
  const reach = sigma * 5;

  const placed: Placed[] = valid
    .map((peak) => ({ ...peak, minutes: Number(peak.retentionTime), x: at(Number(peak.retentionTime)), anchor: "middle" as const }))
    .sort((a, b) => a.x - b.x)
    .map((peak, i, all) => {
      const before = all[i - 1];
      const after = all[i + 1];
      let anchor: Placed["anchor"] = "middle";
      if (after && after.x - peak.x < NEAR_PX) anchor = "end";
      else if (before && peak.x - before.x < NEAR_PX) anchor = "start";
      else if (peak.x < NEAR_PX / 2) anchor = "start";
      else if (width - peak.x < NEAR_PX / 2) anchor = "end";
      return { ...peak, anchor };
    });

  const rise = (x: number) =>
    Math.min(peakHeight, placed.reduce((sum, peak) => sum + peakHeight * Math.exp(-((x - peak.x) ** 2) / (2 * sigma * sigma)), 0));
  const path = (from: number, to: number) => {
    let d = "";
    for (let x = Math.max(SIDE, from); x <= Math.min(width - SIDE, to); x += 1) {
      d += `${d ? "L" : "M"}${x.toFixed(1)},${(baseline - rise(x)).toFixed(1)}`;
    }
    return d;
  };

  const step = perMinute < 30 ? 2 : 1;
  const ticks = Array.from({ length: span + 1 }, (_, minute) => minute);
  // Every other minute is numbered on a narrow line. The last always is, and carries the unit, so the
  // number before it steps aside wherever the two would touch.
  const roomy = perMinute >= LAST_LABEL_PX;
  const numbered = ticks.filter((minute) => minute === span || (minute % step === 0 && (roomy || minute !== span - 1)));
  const motion = (x: number) =>
    ({ "--tm-lot-trace-at": `${Math.round(DRAW_DELAY_MS + DRAW_MS * ((x - SIDE) / Math.max(1, width - SIDE * 2)))}ms` }) as CSSProperties;
  const said = placed.map((peak) => `${peak.name ? `${peak.name} at ` : "Main peak at "}${peak.retentionTime} minutes`).join(", ");

  return (
    <div
      ref={root}
      className={`tm-lot-trace ${className}`}
      style={{ height, "--tm-lot-trace-draw": `${DRAW_MS}ms`, "--tm-lot-trace-delay": `${DRAW_DELAY_MS}ms` } as CSSProperties}
      data-drawn={drawn || reduced ? "" : undefined}
      role="img"
      aria-label={`${said}. Drawn from the reported retention time${placed.length > 1 ? "s" : ""}.`}
    >
      {width > 0 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <defs>
            {placed.map((peak, i) => (
              <linearGradient key={i} id={`${id}g${i}`} gradientUnits="userSpaceOnUse" x1={peak.x - reach} x2={peak.x + reach} y1="0" y2="0">
                <stop offset="0" style={{ stopColor: SPECTRUM[0], stopOpacity: 0 }} />
                <stop offset="0.3" style={{ stopColor: SPECTRUM[0] }} />
                <stop offset="0.42" style={{ stopColor: SPECTRUM[1] }} />
                <stop offset="0.5" style={{ stopColor: SPECTRUM[2] }} />
                <stop offset="0.58" style={{ stopColor: SPECTRUM[3] }} />
                <stop offset="0.7" style={{ stopColor: SPECTRUM[4] }} />
                <stop offset="1" style={{ stopColor: SPECTRUM[4], stopOpacity: 0 }} />
              </linearGradient>
            ))}
            <filter id={`${id}f`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>
          <line className="tm-lot-trace-axis" x1={SIDE} x2={width - SIDE} y1={baseline + 0.5} y2={baseline + 0.5} />
          {ticks.map((minute) => (
            <line key={minute} className="tm-lot-trace-tick" x1={at(minute)} x2={at(minute)} y1={baseline + 1} y2={baseline + (minute % step === 0 ? 6 : 3)} />
          ))}
          <path className="tm-lot-trace-line" d={path(SIDE, width - SIDE)} />
          {placed.map((peak, i) => (
            <g key={i} className="tm-lot-trace-peak" style={motion(peak.x)}>
              <path d={path(peak.x - reach, peak.x + reach)} stroke={`url(#${id}g${i})`} className="is-glow" filter={`url(#${id}f)`} />
              <path d={path(peak.x - reach, peak.x + reach)} stroke={`url(#${id}g${i})`} className="is-light" />
            </g>
          ))}
        </svg>
      )}
      {width > 0 &&
        placed.map((peak, i) => (
          <span
            key={i}
            className={`tm-lot-trace-label is-${peak.anchor}`}
            style={{ ...motion(peak.x), bottom: height - tip + 8, ...(peak.anchor === "end" ? { right: width - peak.x + 6 } : { left: peak.anchor === "start" ? peak.x + 6 : peak.x }) }}
            aria-hidden="true"
          >
            {peak.name && <span className="tm-lot-trace-name">{peak.name}</span>}
            <span className="tm-lot-trace-time">{peak.retentionTime} min</span>
          </span>
        ))}
      {width > 0 && (
        <div className="tm-lot-trace-minutes" aria-hidden="true">
          {numbered.map((minute) => (
              <span key={minute} style={{ left: at(minute) }} className={minute === 0 ? "is-first" : minute === span ? "is-last" : undefined}>
                {minute}
                {minute === span && <i> min</i>}
              </span>
          ))}
        </div>
      )}
    </div>
  );
}
