import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  StatGroup,
  StatTile,
  formatDate,
  formatMoney,
} from "../../app-kit";
import type { Column } from "../../app-kit";
import { LIVE, storageKey } from "../../platform/mode";
import { store, useResource } from "../../platform/store";
import { TODAY } from "../../platform/seed";
import { dateKey, dateWindow, shiftDay, toCsv, trailingWindow } from "./model";
import type { BusinessData, DateWindow } from "./model";

const DataContext = createContext<BusinessData | null>(null);
const PlanningScope = createContext("");
export function BusinessProvider({
  children,
  fixture,
  scope,
}: {
  children: ReactNode;
  fixture?: BusinessData;
  scope?: string;
}) {
  const inheritedScope = useContext(PlanningScope);
  const content = fixture ? (
    <DataContext.Provider value={fixture}>{children}</DataContext.Provider>
  ) : (
    <ResourceProvider>{children}</ResourceProvider>
  );
  return (
    <PlanningScope.Provider value={scope ?? inheritedScope}>
      {content}
    </PlanningScope.Provider>
  );
}
function ResourceProvider({ children }: { children: ReactNode }) {
  const result = useResource(async () => {
    const [orders, buyers, products, lots, partners, referrals] =
      await Promise.all([
        store.orders.list(),
        store.buyers.list(),
        store.catalog.products(true),
        store.lots.list(),
        store.partners.list(),
        store.partners.referrals(),
      ]);
    return {
      orders,
      buyers,
      products,
      lots,
      partners,
      referrals,
      asOf: LIVE ? new Date().toISOString() : `${TODAY}T23:59:59.999Z`,
    };
  });
  if (result.error)
    return (
      <EmptyState
        title="Business records couldn’t be loaded."
        note={result.error.message}
        action={<Button onClick={result.reload}>Try again</Button>}
      />
    );
  if (!result.data)
    return (
      <div className="bi-loading" role="status">
        Loading order, customer and inventory records…
      </div>
    );
  return (
    <DataContext.Provider value={result.data}>{children}</DataContext.Provider>
  );
}
export function useBusiness() {
  const data = useContext(DataContext);
  if (!data) throw Error("BusinessProvider is required");
  return data;
}

/** Device-local planning preferences. Invalid saved content is preserved until the user edits. */
export function useDeviceState<T>(
  name: string,
  initial: T,
  valid: (v: unknown) => v is T,
) {
  const scope = useContext(PlanningScope);
  const key = storageKey(`tm-business-${scope ? `${scope}-` : ""}${name}-v1`);
  const [state, set] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { value: initial, warning: "" };
      const saved = JSON.parse(raw);
      return valid(saved)
        ? { value: saved, warning: "" }
        : {
            value: initial,
            warning:
              "A saved plan could not be read. Its original data remains on this device until you save a change.",
          };
    } catch {
      return {
        value: initial,
        warning: "Browser storage is unavailable. Changes stay in this tab.",
      };
    }
  });
  const update = (next: T | ((current: T) => T)) =>
    set((old) => {
      const value =
        typeof next === "function" ? (next as (v: T) => T)(old.value) : next;
      if (!valid(value))
        return { ...old, warning: "Check the values in this plan." };
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return { value, warning: "" };
      } catch {
        return {
          value,
          warning: "Browser storage is unavailable. Changes stay in this tab.",
        };
      }
    });
  return [state.value, update, state.warning] as const;
}
export const isObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);
export const numeric = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v);

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 1_000_000,
  step = "any",
  suffix,
  optional = false,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  suffix?: string;
  optional?: boolean;
}) {
  const id = useId(),
    [draft, setDraft] = useState(String(value ?? ""));
  useEffect(() => setDraft(String(value ?? "")), [value]);
  function commit() {
    const n =
      draft.trim() === ""
        ? optional
          ? undefined
          : min
        : Math.max(min, Math.min(max, Number(draft)));
    const next =
      n === undefined || Number.isFinite(n) ? n : optional ? undefined : min;
    onChange(next);
    setDraft(String(next ?? ""));
  }
  return (
    <label className="bi-field" htmlFor={id}>
      <span>{label}</span>
      <span className="bi-number">
        <input
          id={id}
          aria-label={label}
          aria-describedby={suffix ? `${id}-unit` : undefined}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={draft}
          placeholder={optional ? "Not entered" : undefined}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onChange={(e) => {
            const s = e.target.value;
            setDraft(s);
            if (s.trim() === "") return;
            const n = Number(s);
            if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
          }}
        />
        {suffix && <span id={`${id}-unit`}>{suffix}</span>}
      </span>
    </label>
  );
}
export function Kpis({
  items,
  label = "Business figures",
}: {
  items: { label: string; value: ReactNode; note?: string }[];
  label?: string;
}) {
  return (
    <div className="bi-kpis">
      <StatGroup label={label}>
        {items.map((item) => (
          <div key={item.label}>
            <StatTile label={item.label} figure={item.value} />
            {item.note && <p className="bi-small">{item.note}</p>}
          </div>
        ))}
      </StatGroup>
    </div>
  );
}
export function SourceNote() {
  const d = useBusiness();
  return (
    <p className="bi-source">
      {LIVE ? "Recorded business data" : "Fictional TrueMark sample records"} ·
      Through {formatDate(d.asOf)} · Dates in UTC
    </p>
  );
}
export function FormulaNote() {
  return (
    <details className="bi-method">
      <summary>How these figures are calculated</summary>
      <p>
        Order creation dates define the selected cohort. Revenue includes
        captured payments less current refunds and retained sales tax; shipping
        and insurance remain in revenue. Authorized, pending and failed payments
        are not collected sales. Refunded amounts are allocated proportionally
        across merchandise, shipping and tax until line-level refund details are
        available. Later refunds update the original order’s cohort; these
        figures are not a bank settlement or accounting ledger.
      </p>
    </details>
  );
}
export function DeviceNote({ warning }: { warning?: string }) {
  return (
    <p
      className={warning ? "bi-warning" : "bi-small"}
      role={warning ? "status" : undefined}
    >
      {warning ||
        "Planning assumptions are saved on this device. They do not change prices, orders or store settings."}
    </p>
  );
}

export function useDateRange() {
  const data = useBusiness(),
    initial = trailingWindow(data.asOf);
  const [range, setRange] = useState({ from: initial.from, to: initial.to });
  let window: DateWindow | null = null,
    error = "";
  try {
    window = dateWindow(range.from, range.to);
    if (range.to > dateKey(data.asOf))
      throw Error("Choose an end date within the recorded period.");
  } catch (e) {
    error = e instanceof Error ? e.message : "Choose valid dates.";
    window = null;
  }
  const controls = (
    <div className="bi-range">
      <div className="bi-presets">
        {[7, 30, 90].map((days) => (
          <Button
            key={days}
            aria-pressed={
              range.from === shiftDay(dateKey(data.asOf), 1 - days) &&
              range.to === dateKey(data.asOf)
            }
            onClick={() => {
              const w = trailingWindow(data.asOf, days);
              setRange({ from: w.from, to: w.to });
            }}
          >
            Last {days} days
          </Button>
        ))}
        <Button
          onClick={() =>
            setRange({
              from: dateKey(data.asOf).slice(0, 7) + "-01",
              to: dateKey(data.asOf),
            })
          }
        >
          This month
        </Button>
      </div>
      <div className="bi-date-fields">
        <label>
          From
          <input
            type="date"
            value={range.from}
            max={dateKey(data.asOf)}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
          />
        </label>
        <label>
          Through
          <input
            type="date"
            value={range.to}
            min={range.from}
            max={dateKey(data.asOf)}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="bi-warning">
          {error}
        </p>
      )}
    </div>
  );
  return { window, controls, range, setRange };
}

type TableColumn<T> = {
  key: string;
  label: string;
  get: (row: T) => ReactNode;
  sort?: (row: T) => string | number | null;
  numeric?: boolean;
};
export function Table<T>({
  rows,
  columns,
  label,
  rowKey,
  onSelect,
}: {
  rows: T[];
  columns: TableColumn<T>[];
  label: string;
  rowKey: (r: T) => string;
  onSelect?: (r: T) => void;
}) {
  const mapped: Column<T>[] = columns.map((c, i) => ({
    key: c.key,
    header: c.label,
    cell: c.get,
    sortValue: c.sort,
    align: c.numeric ? "end" : undefined,
    mobile: i === 0 ? "primary" : i === columns.length - 1 ? "aside" : "meta",
  }));
  return (
    <div className="bi-table">
      <DataTable
        columns={mapped}
        rows={rows}
        rowKey={rowKey}
        caption={label}
        empty={{
          title: "No matching records",
          note: "Try another range or filter. Unknown values stay unknown.",
        }}
        onRowClick={onSelect}
      />
    </div>
  );
}
export function downloadCsv(
  name: string,
  headers: string[],
  rows: unknown[][],
) {
  const blob = new Blob([toCsv(headers, rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `truemark-${name}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ExportButton({
  name,
  headers,
  rows,
  label = "Export CSV",
}: {
  name: string;
  headers: string[];
  rows: unknown[][];
  label?: string;
}) {
  return (
    <Button
      onClick={() => downloadCsv(name, headers, rows)}
      disabled={!rows.length}
    >
      {label} ↓
    </Button>
  );
}
export function OrderLink({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <Link
      className="bi-link"
      to={`/admin/orders?order=${encodeURIComponent(id)}`}
    >
      {children}
    </Link>
  );
}
export function CustomerLink({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <Link
      className="bi-link"
      to={`/admin/customers?customer=${encodeURIComponent(id)}`}
    >
      {children}
    </Link>
  );
}

export type TrendPoint = {
  key: string;
  value: number;
  low?: number;
  high?: number;
  forecast?: boolean;
};
export function TrendChart({
  points,
  label,
  money = true,
}: {
  points: TrendPoint[];
  label: string;
  money?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null),
    id = useId().replace(/:/g, "");
  const values = points.flatMap((p) => [
    p.value,
    p.low ?? p.value,
    p.high ?? p.value,
  ]);
  const min = Math.min(0, ...values),
    max = Math.max(1, ...values),
    width = 1000,
    height = 210;
  const x = (i: number) =>
      10 + ((width - 20) * i) / Math.max(1, points.length - 1),
    y = (v: number) => 12 + (height - 24) * (1 - (v - min) / (max - min));
  const line = (
    ps: { p: TrendPoint; i: number }[],
    field: "value" | "low" | "high" = "value",
  ) => ps.map(({ p, i }) => `${x(i)},${y(p[field] ?? p.value)}`).join(" ");
  const historical = points
      .map((p, i) => ({ p, i }))
      .filter((p) => !p.p.forecast),
    future = points.map((p, i) => ({ p, i })).filter((p) => p.p.forecast);
  const format = money
    ? formatMoney
    : (v: number) => new Intl.NumberFormat("en-US").format(v);
  const index = active !== null ? Math.min(active, points.length - 1) : null;
  const current = index !== null ? points[index] : undefined;
  const hasForecast = points.some((p) => p.forecast);
  const totalValue = useMemo(
    () =>
      points
        .filter((p) => !hasForecast || p.forecast)
        .reduce((s, p) => s + p.value, 0),
    [points, hasForecast],
  );
  return (
    <div
      className="bi-chart"
      role="group"
      aria-label={`${label}. Use left and right arrows to read values.`}
      tabIndex={points.length ? 0 : undefined}
      onKeyDown={(e) => {
        if (
          ["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(e.key)
        ) {
          e.preventDefault();
          if (e.key === "Escape") setActive(null);
          else
            setActive(
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? points.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        points.length - 1,
                        (index ?? points.length - 1) +
                          (e.key === "ArrowLeft" ? -1 : 1),
                      ),
                    ),
            );
        }
      }}
    >
      <div className="bi-chart-read" aria-live="polite">
        <span>
          {current
            ? `${current.key}${current.forecast ? " · Scenario" : ""}`
            : hasForecast
              ? "Future scenario total"
              : label}
        </span>
        <strong>{current ? format(current.value) : format(totalValue)}</strong>
      </div>
      <div className="bi-chart-scale">
        <span>{format(max)}</span>
        <span>{format(min)}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        onPointerLeave={() => setActive(null)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setActive(
            Math.max(
              0,
              Math.min(
                points.length - 1,
                Math.round(
                  ((e.clientX - r.left) / r.width) * (points.length - 1),
                ),
              ),
            ),
          );
        }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity=".13" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((n) => (
          <line
            key={n}
            x1="0"
            x2={width}
            y1={y(min + (max - min) * n)}
            y2={y(min + (max - min) * n)}
            className="bi-chart-grid"
          />
        ))}
        {historical.length > 0 && (
          <polygon
            points={`${x(historical[0].i)},${y(0)} ${line(historical)} ${x(historical.at(-1)!.i)},${y(0)}`}
            fill={`url(#${id})`}
          />
        )}
        {future.length > 0 && (
          <polygon
            points={`${line(future, "high")} ${line([...future].reverse(), "low")}`}
            fill="currentColor"
            opacity=".09"
          />
        )}
        {historical.length > 0 && (
          <polyline
            points={line(historical)}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {future.length > 0 && (
          <polyline
            points={line(
              historical.length ? [historical.at(-1)!, ...future] : future,
            )}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="5 5"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {current && index !== null && (
          <>
            <line
              x1={x(index)}
              x2={x(index)}
              y1="0"
              y2={height}
              className="bi-chart-guide"
            />
            <circle
              cx={x(index)}
              cy={y(current.value)}
              r="4"
              fill="currentColor"
            />
          </>
        )}
      </svg>
      <div className="bi-chart-dates">
        <span>{points[0]?.key}</span>
        <span>{points.at(-1)?.key}</span>
      </div>
      <details className="bi-chart-values">
        <summary>View daily values</summary>
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Basis</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={`${p.key}-${i}`}>
                <th scope="row">{p.key}</th>
                <td>{p.forecast ? "Scenario" : "Recorded"}</td>
                <td>{format(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
export function HelpCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card title={title}>
      <div className="bi-prose">{children}</div>
    </Card>
  );
}
