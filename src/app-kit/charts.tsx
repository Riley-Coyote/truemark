/**
 * Hand-written SVG charts. One series colour, gridlines at 6% of the ink,
 * axis labels in mono micro. The SVG is drawn at the measured pixel width so
 * text never scales; every chart carries a visually hidden table of its values.
 */
import { useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";

/** Geometry in SVG pixels. Tick text is 12px mono, about 7.2px per character. */
const CHAR_WIDTH = 7.4;
const PAD = { top: 14, right: 14, bottom: 30, gap: 12 };

export type ChartPoint = { key: string; label: string; value: number; /** Longer name for the tooltip and table. */ title?: string };

function useSize<T extends HTMLElement>(): [RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    setSize({ width: box.width, height: box.height });
    if (!("ResizeObserver" in window)) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

function niceStep(raw: number): number {
  const base = 10 ** Math.floor(Math.log10(raw));
  const f = raw / base;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * base;
}

function niceScale(max: number, count = 4): { top: number; ticks: number[] } {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] };
  const step = niceStep(max / count);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { top, ticks };
}

/** Which x labels to print so they never collide. */
function labelStride(slot: number, longest: number): number {
  const needed = longest * CHAR_WIDTH + 10;
  return Math.max(1, Math.ceil(needed / Math.max(slot, 1)));
}

type Frame = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  y: (v: number) => number;
  ticks: number[];
};

function frame(width: number, height: number, values: number[], formatAxis: (v: number) => string): Frame {
  const { top: maxValue, ticks } = niceScale(Math.max(...values, 0));
  const longest = Math.max(...ticks.map((t) => formatAxis(t).length));
  const left = Math.ceil(longest * CHAR_WIDTH) + PAD.gap;
  const top = PAD.top;
  const bottom = height - PAD.bottom;
  return {
    width,
    height,
    left,
    right: width - PAD.right,
    top,
    bottom,
    y: (v: number) => bottom - (v / maxValue) * (bottom - top),
    ticks,
  };
}

function Grid({ f, formatAxis }: { f: Frame; formatAxis: (v: number) => string }) {
  return (
    <g>
      {f.ticks.map((t) => {
        const y = Math.round(f.y(t)) + 0.5;
        return (
          <g key={t}>
            <line className={t === 0 ? "kit-chart-base" : "kit-chart-grid"} x1={f.left} x2={f.right} y1={y} y2={y} />
            <text className="kit-chart-tick" x={f.left - PAD.gap} y={y} dy="0.32em" textAnchor="end">
              {formatAxis(t)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ValueTable({ data, caption, formatValue }: { data: ChartPoint[]; caption: string; formatValue: (v: number) => string }) {
  return (
    <table className="kit-sr">
      <caption>{caption}</caption>
      <tbody>
        {data.map((d) => (
          <tr key={d.key}>
            <th scope="row">{d.title ?? d.label}</th>
            <td>{formatValue(d.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Pointer and arrow-key reading of one point at a time. */
function useReading(count: number) {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!count) return;
    const current = active ?? count - 1;
    const next =
      event.key === "ArrowRight" ? Math.min(count - 1, current + 1)
      : event.key === "ArrowLeft" ? Math.max(0, current - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? count - 1
      : null;
    if (event.key === "Escape") setActive(null);
    if (next !== null) {
      event.preventDefault();
      setActive(next);
    }
  };
  return {
    active,
    setActive,
    handlers: {
      onKeyDown,
      onFocus: () => setActive((a) => a ?? count - 1),
      onBlur: () => setActive(null),
      onPointerLeave: () => setActive(null),
    },
  };
}

function Tip({ x, y, width, label, value }: { x: number; y: number; width: number; label: string; value: string }) {
  const shift = x < width * 0.18 ? "0%" : x > width * 0.82 ? "-100%" : "-50%";
  return (
    <div
      className="kit-chart-tip"
      style={{ left: x, top: y, transform: `translate(${shift}, calc(-100% - 0.75rem))` }}
      aria-hidden="true"
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type ChartProps = {
  data: ChartPoint[];
  label: string;
  height?: number;
  formatValue: (v: number) => string;
  formatAxis: (v: number) => string;
};

export function LineChart({ data, label, height = 240, formatValue, formatAxis }: ChartProps) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const { active, setActive, handlers } = useReading(data.length);
  const f = frame(width, height, data.map((d) => d.value), formatAxis);
  const longestLabel = Math.max(...data.map((d) => d.label.length), 1);
  const inset = Math.ceil((longestLabel * CHAR_WIDTH) / 2);
  const step = data.length > 1 ? (f.right - f.left - inset * 2) / (data.length - 1) : 0;
  const x = (i: number) => f.left + inset + i * step;
  const points = data.map((d, i) => [x(i), f.y(d.value)] as const);
  const line = points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
  const area = points.length
    ? `${line}L${points[points.length - 1][0].toFixed(1)},${f.bottom}L${points[0][0].toFixed(1)},${f.bottom}Z`
    : "";
  const stride = labelStride(step, longestLabel);
  const last = points.length - 1;

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const i = Math.round((event.clientX - box.left - f.left) / Math.max(step, 1));
    setActive(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div
      ref={ref}
      className="kit-chart"
      role="group"
      aria-label={`${label}. Arrow keys read each point.`}
      tabIndex={data.length ? 0 : -1}
      {...handlers}
    >
      {width > 0 && data.length > 0 && (
        <svg width={width} height={height} aria-hidden="true" onPointerMove={onPointerMove}>
          <Grid f={f} formatAxis={formatAxis} />
          <path className="kit-chart-area" d={area} />
          <path className="kit-chart-line" d={line} />
          {data.map((d, i) =>
            i % stride === (last % stride) ? (
              <text key={d.key} className="kit-chart-tick" x={x(i)} y={f.bottom + PAD.bottom - 8} textAnchor="middle">
                {d.label}
              </text>
            ) : null,
          )}
          {active !== null && (
            <g>
              <line className="kit-chart-cross" x1={Math.round(x(active)) + 0.5} x2={Math.round(x(active)) + 0.5} y1={f.top} y2={f.bottom} />
              <circle className="kit-chart-point" cx={points[active][0]} cy={points[active][1]} r={3.5} />
            </g>
          )}
          {active !== last && (
            <g>
              <circle className="kit-chart-halo" cx={points[last][0]} cy={points[last][1]} r={3} />
              <circle className="kit-chart-end" cx={points[last][0]} cy={points[last][1]} r={2.5} />
            </g>
          )}
        </svg>
      )}
      {active !== null && width > 0 && (
        <Tip x={points[active][0]} y={points[active][1]} width={width} label={data[active].title ?? data[active].label} value={formatValue(data[active].value)} />
      )}
      <ValueTable data={data} caption={label} formatValue={formatValue} />
    </div>
  );
}

export function BarChart({ data, label, height = 240, formatValue, formatAxis }: ChartProps) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const { active, setActive, handlers } = useReading(data.length);
  const f = frame(width, height, data.map((d) => d.value), formatAxis);
  const slot = data.length ? (f.right - f.left) / data.length : 0;
  const barWidth = Math.max(2, Math.min(slot * 0.56, 36));
  const cx = (i: number) => f.left + slot * i + slot / 2;
  const stride = labelStride(slot, Math.max(...data.map((d) => d.label.length), 1));
  const last = data.length - 1;

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const i = Math.floor((event.clientX - box.left - f.left) / Math.max(slot, 1));
    setActive(i >= 0 && i < data.length ? i : null);
  };

  return (
    <div
      ref={ref}
      className="kit-chart"
      role="group"
      aria-label={`${label}. Arrow keys read each bar.`}
      tabIndex={data.length ? 0 : -1}
      {...handlers}
    >
      {width > 0 && data.length > 0 && (
        <svg width={width} height={height} aria-hidden="true" onPointerMove={onPointerMove}>
          <Grid f={f} formatAxis={formatAxis} />
          {data.map((d, i) => {
            const top = f.y(d.value);
            const h = Math.max(0, f.bottom - top);
            return (
              <rect
                key={d.key}
                className={`kit-chart-bar${active === i ? " is-active" : ""}`}
                x={cx(i) - barWidth / 2}
                y={top}
                width={barWidth}
                height={h}
                rx={Math.min(2, barWidth / 4)}
              />
            );
          })}
          {data.map((d, i) =>
            i % stride === (last % stride) ? (
              <text key={d.key} className="kit-chart-tick" x={cx(i)} y={f.bottom + PAD.bottom - 8} textAnchor="middle">
                {d.label}
              </text>
            ) : null,
          )}
        </svg>
      )}
      {active !== null && width > 0 && (
        <Tip x={cx(active)} y={f.y(data[active].value)} width={width} label={data[active].title ?? data[active].label} value={formatValue(data[active].value)} />
      )}
      <ValueTable data={data} caption={label} formatValue={formatValue} />
    </div>
  );
}

/** A 30-point trace for a stat tile. Decorative; the tile states the figure. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const [ref, { width, height }] = useSize<HTMLSpanElement>();
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const inset = 3;
  const step = values.length > 1 ? (width - inset * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [inset + i * step, inset + (1 - (v - min) / span) * (height - inset * 2)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const end = pts[pts.length - 1];
  return (
    <span ref={ref} className="kit-spark" role="img" aria-label={label}>
      {width > 0 && height > 0 && values.length > 1 && (
        <svg width={width} height={height} aria-hidden="true">
          <path className="kit-chart-line" d={d} />
          <circle className="kit-chart-end" cx={end[0]} cy={end[1]} r={2} />
        </svg>
      )}
    </span>
  );
}
