/**
 * A day-by-day series drawn in the site's HPLC-trace language (src/brand/Trace.tsx):
 * a thin line of light, gently smoothed (monotone, so it never swings past a day's
 * value), over a soft luminous fill that fades to nothing, on near-invisible
 * gridlines. The highest day carries the logo's dot and a small label. Hover or
 * focus draws a hairline crosshair with the day's value; arrow keys step the days.
 * The SVG is drawn at the box's measured pixel size (at least its CSS min-height),
 * so text never scales and the trace fills the panel it sits in; a visually hidden
 * table carries every value.
 */
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { weekdayDate } from "../brand/Tracker";

export type TracePoint = { key: string; iso: string; label: string; value: number };

/** Geometry in SVG pixels. Tick text is 12px, about 7.4px a character. */
const CHAR = 7.4;
const PAD = { top: 36, right: 14, bottom: 30, gap: 12, inset: 8 };
/** The label's distance from the peak's dot, and how near the crosshair may come before the label gives way to its tip. */
const PEAK_LABEL_GAP = 10;
const PEAK_LABEL_CLEAR = 170;

/** The box's inner size. The SVG is placed absolutely, so it never props the box open. */
function useSize<T extends HTMLElement>(): [RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setSize({ width: el.clientWidth, height: el.clientHeight });
    if (!("ResizeObserver" in window)) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

function niceScale(max: number, count = 4): { top: number; ticks: number[] } {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] };
  const raw = max / count;
  const base = 10 ** Math.floor(Math.log10(raw));
  const f = raw / base;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * base;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { top, ticks };
}

const f = (n: number) => n.toFixed(1);

/**
 * A monotone cubic through the points (Steffen's method, as d3's monotoneX): each
 * segment stays between its two days, so a quiet day is never drawn below zero.
 */
function monotone(points: [number, number][]): string {
  const n = points.length;
  if (!n) return "";
  if (n === 1) return `M${f(points[0][0])},${f(points[0][1])}`;
  const sign = (v: number) => (v < 0 ? -1 : 1);
  const tangent: number[] = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const h0 = points[i][0] - points[i - 1][0];
    const h1 = points[i + 1][0] - points[i][0];
    const s0 = (points[i][1] - points[i - 1][1]) / h0;
    const s1 = (points[i + 1][1] - points[i][1]) / h1;
    const p = (s0 * h1 + s1 * h0) / (h0 + h1);
    tangent[i] = (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }
  const endTangent = (a: number, b: number, t: number) => {
    const h = points[b][0] - points[a][0];
    return h ? ((3 * (points[b][1] - points[a][1])) / h - t) / 2 : t;
  };
  if (n === 2) {
    tangent[0] = tangent[1] = (points[1][1] - points[0][1]) / (points[1][0] - points[0][0]);
  } else {
    tangent[0] = endTangent(0, 1, tangent[1]);
    tangent[n - 1] = endTangent(n - 2, n - 1, tangent[n - 2]);
  }
  let d = `M${f(points[0][0])},${f(points[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const dx = (x1 - x0) / 3;
    d += `C${f(x0 + dx)},${f(y0 + dx * tangent[i])},${f(x1 - dx)},${f(y1 - dx * tangent[i + 1])},${f(x1)},${f(y1)}`;
  }
  return d;
}

export function TraceChart({
  data,
  label,
  formatValue,
  formatAxis,
  formatPeak,
}: {
  data: TracePoint[];
  /** What the series is, for its name and its table: "Daily revenue, last 30 days". */
  label: string;
  formatValue: (value: number) => string;
  formatAxis: (value: number) => string;
  /** The peak's value as its label says it, shorter than the tooltip's. */
  formatPeak: (value: number) => string;
}) {
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const id = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);
  const [pressing, setPressing] = useState(false);
  const count = data.length;
  const ready = width > 0 && height > 0;

  const values = data.map((d) => d.value);
  const { top: maxValue, ticks } = niceScale(Math.max(...values, 0));
  const left = Math.ceil(Math.max(...ticks.map((t) => formatAxis(t).length)) * CHAR) + PAD.gap;
  const right = width - PAD.right;
  const top = PAD.top;
  const bottom = height - PAD.bottom;
  const step = count > 1 ? (right - left - PAD.inset * 2) / (count - 1) : 0;
  const x = (i: number) => left + PAD.inset + i * step;
  const y = (v: number) => bottom - (v / maxValue) * (bottom - top);
  const points = data.map((d, i) => [x(i), y(d.value)] as [number, number]);
  const line = monotone(points);
  const area = points.length ? `${line}L${f(points[points.length - 1][0])},${bottom}L${f(points[0][0])},${bottom}Z` : "";

  // The highest day; on a tie, the most recent.
  const peak = values.reduce((best, v, i) => (v >= values[best] ? i : best), 0);
  const hasPeak = count > 0 && values[peak] > 0;

  // Date labels that never collide, always including today at the end.
  const longest = Math.max(...data.map((d) => d.label.length), 1);
  const stride = Math.max(1, Math.ceil((longest * CHAR + 12) / Math.max(step, 1)));
  const last = count - 1;

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const i = Math.round((event.clientX - box.left - left - PAD.inset) / Math.max(step, 1));
    setActive(Math.max(0, Math.min(last, i)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!count) return;
    const current = active ?? last;
    const next =
      event.key === "ArrowRight" ? Math.min(last, current + 1)
      : event.key === "ArrowLeft" ? Math.max(0, current - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (event.key === "Escape") setActive(null);
    if (next !== null) {
      event.preventDefault();
      setActive(next);
    }
  };

  const peakRight = hasPeak && points[peak][0] > width * 0.66;
  const peakLabelShown = hasPeak && (active === null || Math.abs(points[active][0] - points[peak][0]) > PEAK_LABEL_CLEAR);
  const tipShift = active === null ? "-50%" : points[active][0] < width * 0.18 ? "0%" : points[active][0] > width * 0.82 ? "-100%" : "-50%";
  const peakText = hasPeak ? `Peak · ${data[peak].label} · ${formatPeak(values[peak])}` : "";

  return (
    <div
      ref={ref}
      className="cc-trace"
      role="group"
      aria-label={`${label}.${hasPeak ? ` Peak ${data[peak].label}, ${formatValue(values[peak])}.` : ""} Arrow keys read each day.`}
      aria-disabled={count ? undefined : true}
      tabIndex={count ? 0 : -1}
      data-pressing={pressing ? "" : undefined}
      onKeyDown={onKeyDown}
      onFocus={() => setActive((a) => a ?? last)}
      onBlur={() => setActive(null)}
    >
      {ready && count > 0 && (
        <svg
          width={width}
          height={height}
          aria-hidden="true"
          onPointerMove={onPointerMove}
          onPointerLeave={() => {
            setActive(null);
            setPressing(false);
          }}
          onPointerDown={() => setPressing(true)}
          onPointerUp={() => setPressing(false)}
        >
          <defs>
            <linearGradient id={`fill${id}`} x1="0" x2="0" y1={top} y2={bottom} gradientUnits="userSpaceOnUse">
              <stop className="cc-trace-fill-top" offset="0" />
              <stop className="cc-trace-fill-end" offset="1" />
            </linearGradient>
            <filter id={`glow${id}`} x="-5%" y="-40%" width="110%" height="180%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          {ticks.map((t) => {
            const ty = Math.round(y(t)) + 0.5;
            return (
              <g key={t}>
                <line className={t === 0 ? "cc-trace-base" : "cc-trace-grid"} x1={left} x2={right} y1={ty} y2={ty} />
                <text className="cc-trace-tick" x={left - PAD.gap} y={ty} dy="0.32em" textAnchor="end">
                  {formatAxis(t)}
                </text>
              </g>
            );
          })}
          <path className="cc-trace-fill" d={area} fill={`url(#fill${id})`} />
          <path className="cc-trace-halo" d={line} filter={`url(#glow${id})`} />
          <path className="cc-trace-line" d={line} />
          {data.map((d, i) =>
            i % stride === last % stride ? (
              <text key={d.key} className="cc-trace-tick" x={x(i)} y={bottom + PAD.bottom - 8} textAnchor="middle">
                {d.label}
              </text>
            ) : null,
          )}
          {active !== null && (
            <g>
              <line className="cc-trace-cross" x1={Math.round(points[active][0]) + 0.5} x2={Math.round(points[active][0]) + 0.5} y1={top} y2={bottom} />
              <circle className="cc-trace-point" cx={points[active][0]} cy={points[active][1]} r={3.5} />
            </g>
          )}
        </svg>
      )}
      {ready && hasPeak && (
        <>
          <span className="tm-brand-dot cc-trace-dot" aria-hidden="true" style={{ left: points[peak][0], top: points[peak][1] }} />
          {peakLabelShown && (
            <span
              className="cc-trace-peak"
              aria-hidden="true"
              style={{
                left: points[peak][0] + (peakRight ? -PEAK_LABEL_GAP : PEAK_LABEL_GAP),
                top: points[peak][1],
                transform: `translate(${peakRight ? "-100%" : "0"}, -100%)`,
              }}
            >
              {peakText}
            </span>
          )}
        </>
      )}
      {active !== null && ready && (
        <div className="kit-chart-tip cc-trace-tip" style={{ left: points[active][0], top: points[active][1], transform: `translate(${tipShift}, calc(-100% - 0.75rem))` }} aria-hidden="true">
          <span>{weekdayDate(data[active].iso)}</span>
          <strong>{formatValue(data[active].value)}</strong>
        </div>
      )}
      <table className="kit-sr">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{weekdayDate(d.iso)}</th>
              <td>{formatValue(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
