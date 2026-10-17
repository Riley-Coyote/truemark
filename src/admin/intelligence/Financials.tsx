import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Segmented,
  formatChange,
  formatCount,
  formatMoney,
} from "../../app-kit";
import {
  analyze,
  orderCode,
  customerHealth,
  dateWindow,
  forecast,
  profit,
  trailingWindow,
  DEFAULT_COSTS,
  DEFAULT_FORECAST,
} from "./model";
import type { CostAssumptions, ForecastAssumptions } from "./model";
import {
  DeviceNote,
  ExportButton,
  FormulaNote,
  HelpCard,
  Kpis,
  NumberField,
  SourceNote,
  Table,
  TrendChart,
  isObject,
  numeric,
  useBusiness,
  useDateRange,
  useDeviceState,
} from "./shared";

const percent = (v: number | null) =>
  v === null ? "—" : `${(v * 100).toFixed(1)}%`;
const forecastValid = (v: unknown): v is ForecastAssumptions =>
  isObject(v) &&
  ["demandChange", "basketChange", "spread", "target", "horizon"].every((k) =>
    numeric(v[k]),
  );
const costsValid = (v: unknown): v is CostAssumptions =>
  isObject(v) &&
  (v.mode === "margin" || v.mode === "sku") &&
  [
    "margin",
    "shippingPerOrder",
    "feePercent",
    "feeFixed",
    "adSpend",
    "overheadMonthly",
  ].every((k) => numeric(v[k])) &&
  isObject(v.costs) &&
  Object.values(v.costs).every(numeric);

export function SalesAnalytics() {
  const source = useBusiness(),
    range = useDateRange();
  const [channel, setChannel] = useState("all"),
    [series, setSeries] = useState("revenue"),
    [breakdown, setBreakdown] = useState("products");
  const data = useMemo(
    () => ({
      ...source,
      orders: source.orders.filter(
        (o) =>
          channel === "all" ||
          (channel === "partners" && o.discount?.partnerId) ||
          (channel === "promo" && !o.discount?.partnerId && orderCode(o)) ||
          (channel === "unknown" && !orderCode(o)),
      ),
    }),
    [source, channel],
  );
  const report = range.window ? analyze(data, range.window) : null;
  return (
    <div className="bi-page">
      <PageHeader
        description="Sales, refunds and product performance, reconciled to captured orders."
        actions={
          <Link className="bi-link" to="/admin/forecasts">
            Plan what comes next ↗
          </Link>
        }
      />
      <SourceNote />
      {range.controls}
      <div className="bi-toolbar">
        <label className="bi-field">
          Order attribution
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="all">All orders</option>
            <option value="partners">Partner codes</option>
            <option value="promo">Other promo codes</option>
            <option value="unknown">Unattributed</option>
          </select>
        </label>
        {report && (
          <ExportButton
            name={`sales-${range.range.from}-${range.range.to}`}
            headers={[
              "Date UTC",
              "Net revenue excluding tax",
              "Paid orders",
              "Gross product",
              "Discounts",
              "Refunded cash",
              "Tax retained",
              "Shipping retained",
            ]}
            rows={report.daily.map((d) => [
              d.key,
              d.revenue,
              d.paid,
              d.gross,
              d.discounts,
              d.refunds,
              d.tax,
              d.shipping,
            ])}
          />
        )}
      </div>
      {report && (
        <>
          <Kpis
            items={[
              {
                label: "Net revenue",
                value: formatMoney(report.current.revenue),
                note: `${formatChange(report.current.revenue, report.previous.revenue).text} vs previous ${report.window.days} days`,
              },
              {
                label: "Captured orders",
                value: formatCount(report.current.paid),
                note: `${report.current.placed} placed across all states`,
              },
              {
                label: "Average paid order",
                value: formatMoney(report.current.average),
                note: "Net revenue / captured orders",
              },
              {
                label: "Refunded cash",
                value: formatMoney(report.current.refunds),
                note: "Current refunds in this order cohort",
              },
            ]}
          />
          <Card
            title={
              series === "revenue" ? "Revenue over time" : "Orders over time"
            }
            meta={
              <Segmented
                label="Chart series"
                value={series}
                onChange={setSeries}
                options={[
                  { value: "revenue", label: "Revenue" },
                  { value: "orders", label: "Orders" },
                ]}
              />
            }
          >
            <TrendChart
              label={`Daily ${series}`}
              money={series === "revenue"}
              points={report.daily.map((d) => ({
                key: d.key,
                value: series === "revenue" ? d.revenue : d.paid,
              }))}
            />
          </Card>
          <div className="bi-two">
            <Card title="From gross sales to net revenue">
              <dl className="bi-ledger">
                {[
                  ["Gross merchandise", report.current.gross],
                  ["Discounts", -report.current.discounts],
                  [
                    "Merchandise refunds (allocated)",
                    -report.current.productRefunds,
                  ],
                  ["Shipping retained", report.current.shipping],
                  ["Insurance retained", report.current.insurance],
                  ["Other recorded adjustments", report.current.other],
                  ["Net revenue, excluding tax", report.current.revenue],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{formatMoney(Number(value))}</dd>
                  </div>
                ))}
              </dl>
              <p className="bi-small">
                Tax retained: {formatMoney(report.current.tax)}. Collected after
                refunds, including tax: {formatMoney(report.current.collected)}.
              </p>
            </Card>
            <Card title="Orders still awaiting collection">
              <p className="bi-big">{formatMoney(report.current.unpaid)}</p>
              <p className="bi-small">
                Open, unpaid orders placed in this range. This amount is a
                pipeline, not revenue.
              </p>
              <Link className="bi-link" to="/admin/orders?status=placed">
                Review unpaid orders ↗
              </Link>
              <p className="bi-small">
                Orders collected after this report is read will appear when
                records refresh.
              </p>
            </Card>
          </div>
          <Card
            title="Where sales come from"
            meta={
              <Segmented
                label="Sales breakdown"
                value={breakdown}
                onChange={setBreakdown}
                options={[
                  { value: "products", label: "Products" },
                  { value: "channels", label: "Attribution" },
                  { value: "states", label: "Regions" },
                  { value: "payments", label: "Payments" },
                ]}
              />
            }
            flush
          >
            {breakdown === "products" ? (
              <Table
                label="Product sales after discount and refund allocation"
                rows={report.products}
                rowKey={(r) => r.id}
                columns={[
                  {
                    key: "product",
                    label: "Product",
                    get: (r) => (
                      <Link
                        className="bi-link"
                        to={`/admin/products?product=${encodeURIComponent(r.id)}`}
                      >
                        {r.name} <span className="kit-quiet">{r.size}</span>
                      </Link>
                    ),
                    sort: (r) => r.name,
                  },
                  {
                    key: "units",
                    label: "Units ordered",
                    get: (r) => formatCount(r.units),
                    sort: (r) => r.units,
                    numeric: true,
                  },
                  {
                    key: "orders",
                    label: "Orders",
                    get: (r) => r.orders,
                    sort: (r) => r.orders,
                    numeric: true,
                  },
                  {
                    key: "gross",
                    label: "Before discounts",
                    get: (r) => formatMoney(r.gross),
                    sort: (r) => r.gross,
                    numeric: true,
                  },
                  {
                    key: "net",
                    label: "Net merchandise",
                    get: (r) => formatMoney(r.net),
                    sort: (r) => r.net,
                    numeric: true,
                  },
                ]}
              />
            ) : (
              <Table
                label={`Sales by ${breakdown}`}
                rows={report[breakdown as "channels" | "states" | "payments"]}
                rowKey={(r) => r.name}
                columns={[
                  {
                    key: "name",
                    label:
                      breakdown === "states"
                        ? "State / region"
                        : breakdown === "payments"
                          ? "Recorded provider"
                          : "Attribution",
                    get: (r) => r.name,
                    sort: (r) => r.name,
                  },
                  {
                    key: "orders",
                    label: "Orders",
                    get: (r) => r.paid,
                    sort: (r) => r.paid,
                    numeric: true,
                  },
                  {
                    key: "revenue",
                    label: "Net revenue",
                    get: (r) => formatMoney(r.revenue),
                    sort: (r) => r.revenue,
                    numeric: true,
                  },
                  {
                    key: "average",
                    label: "Average order",
                    get: (r) => formatMoney(r.average),
                    sort: (r) => r.average,
                    numeric: true,
                  },
                ]}
              />
            )}
          </Card>
          <p className="bi-small">
            No promo code does not identify a traffic source. Unattributed
            orders remain unattributed until first-party session attribution is
            connected.
          </p>
          <FormulaNote />
        </>
      )}
    </div>
  );
}

type Scenario = { id: string; name: string; values: ForecastAssumptions };
const scenariosValid = (v: unknown): v is Scenario[] =>
  Array.isArray(v) &&
  v.length <= 30 &&
  v.every(
    (s) =>
      isObject(s) &&
      typeof s.id === "string" &&
      typeof s.name === "string" &&
      forecastValid(s.values),
  );
export function Forecasts() {
  const data = useBusiness();
  const [settings, setSettings, warning] = useDeviceState(
    "forecast",
    DEFAULT_FORECAST,
    forecastValid,
  );
  const [saved, setSaved, savedWarning] = useDeviceState<Scenario[]>(
      "scenarios",
      [],
      scenariosValid,
    ),
    [name, setName] = useState(""),
    [message, setMessage] = useState("");
  const f = useMemo(() => forecast(data, settings), [data, settings]);
  const history = analyze(data, trailingWindow(data.asOf, 28));
  const setNumber =
    (key: keyof ForecastAssumptions) => (n: number | undefined) =>
      setSettings((s) => ({ ...s, [key]: n ?? 0 }));
  return (
    <div className="bi-page">
      <PageHeader description="See the run rate, model the next month, and test the assumptions behind a revenue goal." />
      <SourceNote />
      <div className="bi-scenario-presets">
        <span className="kit-label">Start from a scenario</span>
        <Button
          onClick={() =>
            setSettings((s) => ({
              ...s,
              demandChange: -15,
              basketChange: 0,
              spread: 25,
            }))
          }
        >
          Cautious
        </Button>
        <Button
          onClick={() =>
            setSettings((s) => ({
              ...s,
              demandChange: 0,
              basketChange: 0,
              spread: 20,
            }))
          }
        >
          Current pace
        </Button>
        <Button
          onClick={() =>
            setSettings((s) => ({
              ...s,
              demandChange: 20,
              basketChange: 5,
              spread: 25,
            }))
          }
        >
          Growth plan
        </Button>
      </div>
      <Kpis
        items={[
          {
            label: "Month to date",
            value: formatMoney(f.monthActual),
            note: "Recorded captured orders",
          },
          {
            label: "Projected month",
            value: f.enough ? formatMoney(f.projectedMonth) : "—",
            note: f.enough
              ? `${formatMoney(f.monthLow)}–${formatMoney(f.monthHigh)} scenario range`
              : "Needs 14 days and 5 captured orders",
          },
          {
            label: "Daily run rate",
            value: f.enough ? formatMoney(f.dailyRevenue) : "—",
            note: "Last 28 completed days, or available history",
          },
          {
            label: "Gap to your goal",
            value: settings.target && f.enough ? formatMoney(f.targetGap) : "—",
            note: settings.target
              ? `Goal: ${formatMoney(settings.target)}`
              : "Set a monthly goal below",
          },
        ]}
      />
      <div className="bi-two bi-plan-layout">
        <Card title="Forecast assumptions">
          <div className="bi-fields">
            <NumberField
              label="Demand change over 30 days"
              value={settings.demandChange}
              onChange={setNumber("demandChange")}
              min={-90}
              max={200}
              suffix="%"
            />
            <NumberField
              label="Average basket change"
              value={settings.basketChange}
              onChange={setNumber("basketChange")}
              min={-90}
              max={200}
              suffix="%"
            />
            <NumberField
              label="Scenario spread"
              value={settings.spread}
              onChange={setNumber("spread")}
              max={90}
              suffix="± %"
            />
            <NumberField
              label="Future horizon"
              value={settings.horizon}
              onChange={setNumber("horizon")}
              min={7}
              max={90}
              suffix="days"
            />
            <NumberField
              label="Monthly revenue goal"
              value={settings.target}
              onChange={setNumber("target")}
              step={100}
              suffix="USD"
            />
          </div>
          <DeviceNote warning={warning} />
        </Card>
        <Card
          title="Observed history and your scenario"
          meta={
            <span className="bi-small">
              Solid = recorded · Dashed = scenario
            </span>
          }
        >
          {f.enough ? (
            <TrendChart
              label="Revenue, history and scenario"
              points={[
                ...history.daily.map((d) => ({ key: d.key, value: d.revenue })),
                ...f.points.map((p) => ({ ...p, forecast: true })),
              ]}
            />
          ) : (
            <EmptyState
              title="More history is needed for a forecast."
              note={`${f.coverage} observed calendar days and ${f.historicalOrders} captured orders. A zero line would imply certainty the data does not support.`}
            />
          )}
          <p className="bi-small">
            Forecast baseline: recent same-weekday revenue, weighted toward
            newer weeks. Demand growth compounds across 30 days; basket change
            applies to future revenue. Shading is your scenario spread, not a
            statistical confidence interval. No seasonality beyond weekday
            patterns or future restocks is assumed.
          </p>
        </Card>
      </div>
      <div className="bi-two">
        <Card title="Keep a planning scenario">
          <form
            className="bi-inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              setSaved((s) => [
                ...s.slice(-29),
                {
                  id: crypto.randomUUID(),
                  name: name.trim().slice(0, 80),
                  values: { ...settings },
                },
              ]);
              setMessage(`Saved “${name.trim()}” on this device.`);
              setName("");
            }}
          >
            <label className="bi-field">
              Scenario name
              <input
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. October restock"
              />
            </label>
            <Button type="submit">Save scenario</Button>
          </form>
          <ul className="bi-saved-list">
            {saved.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setSettings(s.values);
                    setMessage(`Restored “${s.name}”.`);
                  }}
                >
                  {s.name} <span>Restore ↗</span>
                </button>
                <button
                  aria-label={`Remove scenario ${s.name}`}
                  onClick={() =>
                    setSaved((v) => v.filter((x) => x.id !== s.id))
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <p className="bi-small" role="status">
            {message ||
              savedWarning ||
              "Saved scenarios contain assumptions only, not customer records."}
          </p>
        </Card>
        <HelpCard title="Make the goal actionable">
          <p>
            {settings.target && f.enough && f.average > 0
              ? `At this plan’s average paid order of ${formatMoney(f.average)}, an additional ${Math.ceil(f.targetGap / f.average)} orders would close the ${formatMoney(f.targetGap)} modeled gap.`
              : "Set a goal to translate the revenue gap into an approximate number of additional orders."}
          </p>
          <p>
            The month projection covers recorded revenue plus the remaining days
            through {f.monthEnd}. It is separate from the {settings.horizon}-day
            horizon.
          </p>
          <Link className="bi-link" to="/admin/restock">
            Check whether stock can support the plan ↗
          </Link>
          <ExportButton
            name="revenue-scenario"
            headers={[
              "Date UTC",
              "Scenario revenue",
              "Low scenario",
              "High scenario",
              "Demand change %",
              "Basket change %",
            ]}
            rows={
              f.enough
                ? f.points.map((p) => [
                    p.key,
                    p.value,
                    p.low,
                    p.high,
                    settings.demandChange,
                    settings.basketChange,
                  ])
                : []
            }
          />
        </HelpCard>
      </div>
    </div>
  );
}

export function Profitability() {
  const data = useBusiness(),
    range = useDateRange();
  const [costs, setCosts, warning] = useDeviceState(
    "costs",
    DEFAULT_COSTS,
    costsValid,
  );
  const p = range.window ? profit(data, range.window, costs) : null;
  const field = (
    key: keyof Omit<CostAssumptions, "mode" | "costs">,
    label: string,
    suffix?: string,
    max = 1_000_000,
  ) => (
    <NumberField
      label={label}
      value={costs[key]}
      onChange={(n) => setCosts((c) => ({ ...c, [key]: n ?? 0 }))}
      suffix={suffix}
      max={max}
      step={key === "feeFixed" ? 0.01 : 1}
    />
  );
  return (
    <div className="bi-page">
      <PageHeader description="Model what remains after product costs, shipping, fees, partner commissions and overhead." />
      <SourceNote />
      {range.controls}
      <p className="bi-source">
        Estimated operating contribution · Cost assumptions, not a connected
        accounting ledger
      </p>
      {p && (
        <>
          <Kpis
            items={[
              {
                label: "Net revenue",
                value: formatMoney(p.report.current.revenue),
                note: "Captured, after refunds and tax",
              },
              {
                label: "Estimated profit",
                value: p.complete ? formatMoney(p.net) : "—",
                note: p.complete
                  ? "After all modeled costs"
                  : "Enter missing SKU costs",
              },
              {
                label: "Estimated margin",
                value: p.complete ? percent(p.margin) : "—",
                note: "Estimated profit / net revenue",
              },
              {
                label: "Break-even ads / order",
                value:
                  p.complete && p.report.current.paid
                    ? formatMoney((p.net + p.ads) / p.report.current.paid)
                    : "—",
                note: "Contribution per order before modeled ad spend",
              },
            ]}
          />
          <details className="bi-settings" open>
            <summary>
              Cost model and assumptions <span>Saved on this device</span>
            </summary>
            <div className="bi-settings-body">
              <Segmented
                label="Product costing method"
                value={costs.mode}
                onChange={(mode) => setCosts((c) => ({ ...c, mode }))}
                options={[
                  { value: "margin", label: "Assumed gross margin" },
                  { value: "sku", label: "Cost by product" },
                ]}
              />
              <div className="bi-fields">
                {costs.mode === "margin" &&
                  field("margin", "Assumed merchandise gross margin", "%", 100)}
                {field(
                  "shippingPerOrder",
                  "Shipping / packaging cost per order",
                  "USD",
                )}
                {field("feePercent", "Payment processing percentage", "%", 100)}
                {field("feeFixed", "Fixed processing fee per order", "USD")}
                {field("adSpend", "Ad spend for this selected range", "USD")}
                {field(
                  "overheadMonthly",
                  "Fixed overhead per calendar month",
                  "USD",
                )}
              </div>
              {costs.mode === "sku" && (
                <div className="bi-cost-grid">
                  {[
                    ...data.products,
                    ...p.report.products.filter(
                      (product) =>
                        !data.products.some(
                          (record) => record.id === product.id,
                        ),
                    ),
                  ].map((product) => (
                    <NumberField
                      key={product.id}
                      label={`${product.name} · ${product.size} unit cost`}
                      value={costs.costs[product.id]}
                      optional
                      step={0.01}
                      onChange={(n) =>
                        setCosts((c) => {
                          const values = { ...c.costs };
                          if (n === undefined) delete values[product.id];
                          else values[product.id] = n;
                          return { ...c, costs: values };
                        })
                      }
                      suffix="USD"
                    />
                  ))}
                </div>
              )}
              <DeviceNote warning={warning} />
            </div>
          </details>
          {!p.complete && (
            <p className="bi-warning" role="status">
              Unit costs are missing for {p.missing.length} sold products.
              Estimated profit stays hidden until those costs are entered.
            </p>
          )}
          <div className="bi-two">
            <Card title="Revenue to estimated profit">
              <dl className="bi-ledger">
                {[
                  ["Net revenue", p.report.current.revenue],
                  ["Product cost", -p.cogs],
                  ["Shipping / packaging", -p.shipping],
                  ["Processing fees", -p.fees],
                  ["Accrued partner commissions", -p.commissions],
                  ["Advertising", -p.ads],
                  ["Allocated fixed overhead", -p.overhead],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{formatMoney(Number(value))}</dd>
                  </div>
                ))}
                <div>
                  <dt>Estimated operating profit</dt>
                  <dd>
                    {p.complete ? formatMoney(p.net) : "Costs incomplete"}
                  </dd>
                </div>
              </dl>
            </Card>
            <Card title="Daily estimated profit">
              {p.complete ? (
                <TrendChart
                  label="Daily estimated profit"
                  points={p.daily.map((d) => ({ key: d.key, value: d.net }))}
                />
              ) : (
                <EmptyState
                  compact
                  title="Complete product costs to see the profit trend."
                />
              )}
            </Card>
          </div>
          <Card
            title="Daily breakdown"
            meta={
              <ExportButton
                name="estimated-profit"
                headers={[
                  "Day UTC",
                  "Net revenue",
                  "Product cost",
                  "Shipping cost",
                  "Processing fees",
                  "Partner commissions",
                  "Ad spend",
                  "Overhead",
                  "Estimated profit",
                ]}
                rows={
                  p.complete
                    ? p.daily.map((d) => [
                        d.key,
                        d.revenue,
                        d.cogs,
                        d.shippingCost,
                        d.fees,
                        d.commission,
                        d.ads,
                        d.overhead,
                        d.net,
                      ])
                    : []
                }
              />
            }
            flush
          >
            <Table
              label="Estimated daily profit"
              rows={p.daily}
              rowKey={(r) => r.key}
              columns={[
                {
                  key: "day",
                  label: "Day UTC",
                  get: (r) => r.key,
                  sort: (r) => r.key,
                },
                {
                  key: "revenue",
                  label: "Revenue",
                  get: (r) => formatMoney(r.revenue),
                  sort: (r) => r.revenue,
                  numeric: true,
                },
                {
                  key: "cogs",
                  label: "Product cost",
                  get: (r) => formatMoney(r.cogs),
                  numeric: true,
                },
                {
                  key: "costs",
                  label: "Other costs",
                  get: (r) =>
                    formatMoney(
                      r.shippingCost +
                        r.fees +
                        r.commission +
                        r.ads +
                        r.overhead,
                    ),
                  numeric: true,
                },
                {
                  key: "profit",
                  label: "Est. profit",
                  get: (r) => (p.complete ? formatMoney(r.net) : "—"),
                  sort: (r) => r.net,
                  numeric: true,
                },
              ]}
            />
          </Card>
          <p className="bi-small">
            Overhead is allocated using each date’s actual calendar-month
            length. Processing and shipping costs are estimates per captured
            order; actual provider fees, returns, inventory recovery, income
            taxes, capital expenditure and owner compensation are not imported.
            SKU costs count units originally ordered; returned inventory is not
            automatically credited. Partner commissions use current non-void
            referral records.
          </p>
          <FormulaNote />
        </>
      )}
    </div>
  );
}

export { default as Retention } from "./Retention";

type SavedReport = {
  id: string;
  name: string;
  group: string;
  from: string;
  to: string;
  frequency: string;
};
const reportsValid = (v: unknown): v is SavedReport[] =>
  Array.isArray(v) &&
  v.length <= 40 &&
  v.every(
    (r) =>
      isObject(r) &&
      ["id", "name", "group", "from", "to", "frequency"].every(
        (k) => typeof r[k] === "string",
      ),
  );
export function Reports() {
  const data = useBusiness(),
    range = useDateRange();
  const [group, setGroup] = useState("daily"),
    [name, setName] = useState(""),
    [frequency, setFrequency] = useState("manual"),
    [message, setMessage] = useState("");
  const [saved, setSaved, warning] = useDeviceState<SavedReport[]>(
    "reports",
    [],
    reportsValid,
  );
  const report = range.window ? analyze(data, range.window) : null;
  const headers =
    group === "products"
      ? ["Product", "Size", "Units", "Gross merchandise", "Net merchandise"]
      : group === "daily"
        ? [
            "Day UTC",
            "Net revenue",
            "Captured orders",
            "Refunds",
            "Retained tax",
          ]
        : group === "customers"
          ? ["Buyer ID", "Customer", "Orders in range", "Net revenue in range"]
          : [
              group === "states"
                ? "State / region"
                : group === "payments"
                  ? "Recorded provider"
                  : "Attribution",
              "Captured orders",
              "Net revenue",
              "Average paid order",
            ];
  const customers = customerHealth(data).rows;
  const rows: unknown[][] = !report
    ? []
    : group === "products"
      ? report.products.map((r) => [r.name, r.size, r.units, r.gross, r.net])
      : group === "daily"
        ? report.daily.map((r) => [r.key, r.revenue, r.paid, r.refunds, r.tax])
        : group === "customers"
          ? customers.flatMap((c) => {
              const own = report.orders.filter((o) => o.buyerId === c.id);
              const totals = analyze(
                { ...data, orders: own },
                report.window,
              ).current;
              return totals.paid
                ? [[c.id, c.name, totals.paid, totals.revenue]]
                : [];
            })
          : report[group as "states" | "payments" | "channels"].map((r) => [
              r.name,
              r.paid,
              r.revenue,
              r.average,
            ]);
  return (
    <div className="bi-page">
      <PageHeader description="Build a report from the same order records, save its definition, and export exactly what is shown." />
      <SourceNote />
      {range.controls}
      <Card title="Report builder">
        <div className="bi-toolbar">
          <label className="bi-field">
            Group report by
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              {[
                ["daily", "Day"],
                ["products", "Product"],
                ["customers", "Customer"],
                ["states", "State / region"],
                ["payments", "Payment provider"],
                ["channels", "Order attribution"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <ExportButton
            name={`${group}-${range.range.from}-${range.range.to}`}
            headers={headers}
            rows={rows}
          />
        </div>
        <div className="bi-report-scroll">
          <table>
            <caption>
              {group} report · {range.range.from} through {range.range.to}
            </caption>
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((v, j) => (
                    <td key={j}>
                      {typeof v === "number" &&
                      headers[j]
                        .toLowerCase()
                        .match(/revenue|merchandise|refund|tax|average/)
                        ? formatMoney(v)
                        : String(v ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="bi-small">No report rows for this selection.</p>
          )}
        </div>
      </Card>
      <div className="bi-two">
        <Card title="Save this report">
          <form
            className="bi-fields"
            onSubmit={(e) => {
              e.preventDefault();
              if (!range.window || !name.trim()) return;
              setSaved((s) => [
                ...s.slice(-39),
                {
                  id: crypto.randomUUID(),
                  name: name.trim().slice(0, 80),
                  group,
                  from: range.range.from,
                  to: range.range.to,
                  frequency,
                },
              ]);
              setMessage(
                frequency === "manual"
                  ? "Report definition saved on this device."
                  : "Schedule draft saved. Automated delivery is not connected.",
              );
              setName("");
            }}
          >
            <label className="bi-field">
              Report name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                placeholder="e.g. Weekly product performance"
              />
            </label>
            <label className="bi-field">
              Delivery plan
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="manual">Run manually</option>
                <option value="daily">Daily · schedule draft</option>
                <option value="weekly">Weekly · schedule draft</option>
                <option value="monthly">Monthly · schedule draft</option>
              </select>
            </label>
            <Button type="submit" disabled={!range.window}>
              Save report definition
            </Button>
          </form>
          <p className="bi-small" role="status">
            {message ||
              warning ||
              "Saved definitions contain dates and settings. Report data is generated fresh when you restore one."}
          </p>
        </Card>
        <Card title="Saved reports">
          <ul className="bi-saved-list">
            {saved.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => {
                    try {
                      dateWindow(r.from, r.to);
                      if (
                        ![
                          "daily",
                          "products",
                          "customers",
                          "states",
                          "payments",
                          "channels",
                        ].includes(r.group)
                      )
                        throw Error();
                      setGroup(r.group);
                      setFrequency(r.frequency);
                      range.setRange({ from: r.from, to: r.to });
                      setMessage(`Restored “${r.name}”.`);
                    } catch {
                      setMessage(
                        "This saved definition needs valid dates and grouping.",
                      );
                    }
                  }}
                >
                  {r.name}
                  <span>
                    {r.frequency === "manual"
                      ? "Manual"
                      : `${r.frequency} · delivery not connected`}
                  </span>
                </button>
                <button
                  aria-label={`Remove report ${r.name}`}
                  onClick={() =>
                    setSaved((s) => s.filter((x) => x.id !== r.id))
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {!saved.length && (
            <p className="bi-small">
              Save a definition to return to the same view later.
            </p>
          )}
          <p className="bi-small">
            Scheduled delivery needs a server-side scheduler and an approved
            mail provider. Saving a draft does not send or schedule an email.
          </p>
        </Card>
      </div>
      <FormulaNote />
    </div>
  );
}
