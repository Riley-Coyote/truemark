import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  Drawer,
  PageHeader,
  Segmented,
  formatDate,
  formatDateTime,
} from "../../app-kit";
import { LIVE } from "../../platform/mode";
import { live } from "../../platform/live/runtime";
import {
  activityRows,
  readyToShip,
  riskSignals,
  stockPlan,
  DEFAULT_STOCK,
} from "./model";
import type { StockAssumptions } from "./model";
import {
  DeviceNote,
  ExportButton,
  HelpCard,
  Kpis,
  NumberField,
  OrderLink,
  SourceNote,
  Table,
  isObject,
  numeric,
  useBusiness,
  useDeviceState,
} from "./shared";

type StockSettings = StockAssumptions & { counts: Record<string, number> };
const stockValid = (v: unknown): v is StockSettings =>
  isObject(v) &&
  ["lookback", "leadDays", "safetyDays", "targetDays"].every((k) =>
    numeric(v[k]),
  ) &&
  isObject(v.onOrder) &&
  Object.values(v.onOrder).every(numeric) &&
  isObject(v.counts) &&
  Object.values(v.counts).every(numeric);
export function Restock() {
  const source = useBusiness();
  const [settings, setSettings, warning] = useDeviceState<StockSettings>(
      "stock-plan",
      { ...DEFAULT_STOCK, counts: {} },
      stockValid,
    ),
    [query, setQuery] = useState(""),
    [attention, setAttention] = useState(false);
  const data = useMemo(
    () => ({
      ...source,
      products: source.products.map((p) => ({
        ...p,
        stock: settings.counts[p.id] ?? p.stock,
      })),
    }),
    [source, settings.counts],
  );
  const all = useMemo(() => stockPlan(data, settings), [data, settings]),
    rows = all.filter(
      (p) =>
        `${p.name} ${p.size}`.toLowerCase().includes(query.toLowerCase()) &&
        (!attention || p.status !== "Covered"),
    );
  const [selected, setSelected] = useState<string | null>(null),
    product = all.find((r) => r.id === selected);
  const change =
    (key: "lookback" | "leadDays" | "safetyDays" | "targetDays") =>
    (value: number | undefined) =>
      setSettings((s) => ({ ...s, [key]: value ?? 0 }));
  const setRecord = (
    key: "counts" | "onOrder",
    id: string,
    value: number | undefined,
  ) =>
    setSettings((s) => {
      const record = { ...s[key] };
      if (value === undefined) delete record[id];
      else record[id] = value;
      return { ...s, [key]: record };
    });
  return (
    <div className="bi-page">
      <PageHeader description="Turn paid sales velocity into a stock-cover and purchasing plan. Held lots never count as sellable stock." />
      <SourceNote />
      <Kpis
        items={[
          {
            label: "Out of stock",
            value: all.filter((p) => p.status === "Out of stock").length,
            note: "Known sellable count is zero",
          },
          {
            label: "Before next delivery",
            value: all.filter((p) => p.status === "Before delivery").length,
            note: "Projected cover shorter than lead time",
          },
          {
            label: "Counts needed",
            value: all.filter((p) => p.sellable === null).length,
            note: "Unknown stock is not treated as zero",
          },
          {
            label: "Suggested purchase",
            value: all.reduce((s, p) => s + (p.suggested ?? 0), 0),
            note: "Units across products with known counts",
          },
        ]}
      />
      <Card title="Purchasing assumptions">
        <div className="bi-fields">
          <NumberField
            label="Sales velocity window"
            value={settings.lookback}
            min={7}
            max={90}
            suffix="days"
            onChange={change("lookback")}
          />
          <NumberField
            label="Supplier lead time"
            value={settings.leadDays}
            max={365}
            suffix="days"
            onChange={change("leadDays")}
          />
          <NumberField
            label="Safety stock"
            value={settings.safetyDays}
            max={90}
            suffix="days"
            onChange={change("safetyDays")}
          />
          <NumberField
            label="Cover after delivery"
            value={settings.targetDays}
            min={1}
            max={180}
            suffix="days"
            onChange={change("targetDays")}
          />
        </div>
        <DeviceNote warning={warning} />
      </Card>
      <Card
        title="Restock guidance"
        meta={
          <ExportButton
            name="purchase-plan"
            headers={[
              "Product",
              "Size",
              "Sellable stock",
              "Held inventory",
              "Paid units in window",
              "Units per day",
              "Days cover",
              "Incoming assumed",
              "Suggested purchase units",
              "Stockout UTC",
              "Status",
            ]}
            rows={rows.map((p) => [
              p.name,
              p.size,
              p.sellable ?? "Unknown",
              p.heldUnits ?? "Unknown",
              p.sold,
              p.velocity.toFixed(3),
              p.cover?.toFixed(1) ?? "",
              p.incoming,
              p.suggested ?? "Unknown",
              p.stockout ?? "",
              p.status,
            ])}
          />
        }
      >
        <div className="bi-toolbar">
          <label className="bi-field">
            Find a product
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Compound or size"
            />
          </label>
          <label className="bi-check">
            <input
              type="checkbox"
              checked={attention}
              onChange={(e) => setAttention(e.target.checked)}
            />{" "}
            Needs attention only
          </label>
        </div>
        <Table
          label="Stock cover and suggested purchase quantities"
          rows={rows}
          rowKey={(p) => p.id}
          onSelect={(p) => setSelected(p.id)}
          columns={[
            {
              key: "name",
              label: "Product",
              get: (p) => (
                <>
                  {p.name}
                  <span className="bi-cell-note">
                    {p.size}
                    {settings.counts[p.id] !== undefined
                      ? " · planning count"
                      : ""}
                  </span>
                </>
              ),
              sort: (p) => p.name,
            },
            {
              key: "stock",
              label: "Sellable",
              get: (p) => p.sellable ?? "Unknown",
              sort: (p) => p.sellable,
              numeric: true,
            },
            {
              key: "sold",
              label: "Units sold",
              get: (p) => p.sold,
              sort: (p) => p.sold,
              numeric: true,
            },
            {
              key: "cover",
              label: "Days cover",
              get: (p) =>
                p.cover === null
                  ? p.sold
                    ? "Count needed"
                    : "No velocity"
                  : p.cover.toFixed(1),
              sort: (p) => p.cover,
              numeric: true,
            },
            {
              key: "suggested",
              label: "Buy",
              get: (p) => p.suggested ?? "—",
              sort: (p) => p.suggested,
              numeric: true,
            },
            {
              key: "status",
              label: "Status",
              get: (p) => p.status,
              sort: (p) => p.status,
            },
          ]}
        />
        <p className="bi-small">
          Open a product to enter incoming units or a local stock-count
          assumption. Reorder point = daily paid units × (lead time + safety
          days). Suggested purchase targets lead time + safety + desired cover,
          less sellable and incoming units. Counts and incoming units entered
          here are planning assumptions, not inventory adjustments or purchase
          orders.
        </p>
      </Card>
      {product && (
        <Drawer
          title={`${product.name} · ${product.size}`}
          eyebrow="Purchase planning"
          onClose={() => setSelected(null)}
          footer={
            <Link
              className="bi-link"
              to={`/admin/products?product=${encodeURIComponent(product.id)}`}
            >
              Open the inventory record ↗
            </Link>
          }
        >
          <dl className="bi-ledger">
            <div>
              <dt>Released / sellable stock</dt>
              <dd>{product.sellable ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Held in testing / quarantine</dt>
              <dd>{product.heldUnits ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Daily paid units</dt>
              <dd>{product.velocity.toFixed(3)}</dd>
            </div>
            <div>
              <dt>Projected stockout</dt>
              <dd>{product.stockout ?? "Not enough data"}</dd>
            </div>
            <div>
              <dt>Assumed arrival</dt>
              <dd>{product.arrival}</dd>
            </div>
          </dl>
          <div className="bi-fields">
            <NumberField
              optional
              label="Planning stock count"
              value={settings.counts[product.id]}
              onChange={(n) => setRecord("counts", product.id, n)}
            />
            <NumberField
              label="Confirmed / assumed incoming units"
              value={settings.onOrder[product.id] ?? 0}
              onChange={(n) => setRecord("onOrder", product.id, n)}
            />
          </div>
          <Button onClick={() => setRecord("counts", product.id, undefined)}>
            Use recorded stock instead
          </Button>
          <DeviceNote warning={warning} />
        </Drawer>
      )}
    </div>
  );
}

export function ShippingDesk() {
  const data = useBusiness();
  const [tab, setTab] = useState("ready"),
    [selected, setSelected] = useState<string[]>([]),
    [numbers, setNumbers] = useState(""),
    [dryRun, setDryRun] = useState<
      { number: string; id?: string; status: string; eligible: boolean }[]
    >([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const category = (o: (typeof data.orders)[number]) =>
    ["shipped", "delivered"].includes(o.status)
      ? "shipped"
      : readyToShip(o)
        ? "ready"
        : "held";
  const rows = data.orders.filter(
    (o) =>
      o.status !== "cancelled" &&
      o.status !== "refunded" &&
      (tab === "all" || category(o) === tab),
  );
  const picked = rows.filter((o) => selected.includes(o.id)),
    buyers = new Map(data.buyers.map((b) => [b.id, b]));
  async function check() {
    setBusy(true);
    setError("");
    setConfirmed(false);
    try {
      const input = [
        ...new Set(
          numbers
            .split(/[\s,;]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ];
      if (!input.length || input.length > 50)
        throw Error("Enter 1–50 order numbers.");
      const found = [];
      for (const number of input) {
        const order = data.orders.find(
          (o) => o.number.toLowerCase() === number.toLowerCase(),
        );
        if (!order) {
          found.push({ number, status: "Order not found", eligible: false });
          continue;
        }
        if (!LIVE) {
          found.push({
            number,
            id: order.id,
            status: "Preview only · no shipment provider is called",
            eligible: false,
          });
          continue;
        }
        const shipment = await live().shipping.get(order.id);
        found.push({
          number,
          id: order.id,
          status: shipment
            ? `${shipment.status}${shipment.lastError ? ` · ${shipment.lastError}` : ""}`
            : "No shipment record",
          eligible: shipment?.status === "failed" && readyToShip(order),
        });
      }
      setDryRun(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Shipment check failed.");
    } finally {
      setBusy(false);
    }
  }
  async function retry() {
    if (!LIVE || !confirmed) return;
    setBusy(true);
    setError("");
    const results = [...dryRun];
    try {
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (!r.eligible || !r.id) continue;
        const [current, order] = await Promise.all([
          live().shipping.get(r.id),
          live().store.orders.get(r.id),
        ]);
        if (current?.status !== "failed" || !order || !readyToShip(order)) {
          results[i] = {
            ...r,
            status: "Status changed; not retried",
            eligible: false,
          };
          continue;
        }
        await live().shipping.retry(r.id);
        results[i] = { ...r, status: "Retry requested", eligible: false };
      }
      setDryRun(results);
      setConfirmed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry request failed.");
      setDryRun(results);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="bi-page">
      <PageHeader description="Review packing queues, export a picking manifest, and inspect failed shipment pushes." />
      <SourceNote />
      <Kpis
        items={[
          {
            label: "Ready to pack",
            value: data.orders.filter((o) => category(o) === "ready").length,
            note: "Captured orders with a usable address",
          },
          {
            label: "Shipped / delivered",
            value: data.orders.filter((o) => category(o) === "shipped").length,
            note: "Based on recorded order states",
          },
          {
            label: "Selected in this view",
            value: picked.length,
            note: "Selections from other filters are not exported",
          },
        ]}
      />
      <Card
        title="Fulfillment queue"
        meta={
          <Segmented
            label="Fulfillment queue"
            value={tab}
            onChange={setTab}
            options={[
              { value: "ready", label: "Ready" },
              { value: "shipped", label: "Shipped" },
              { value: "held", label: "Held" },
              { value: "all", label: "All" },
            ]}
          />
        }
      >
        <div className="bi-toolbar">
          <Button
            onClick={() =>
              setSelected(
                rows.every((o) => selected.includes(o.id))
                  ? []
                  : rows.map((o) => o.id),
              )
            }
          >
            {rows.length && rows.every((o) => selected.includes(o.id))
              ? "Clear selection"
              : "Select this view"}
          </Button>
          <ExportButton
            label="Packing manifest"
            name="packing-manifest"
            headers={[
              "Order",
              "Buyer",
              "Institution",
              "Product ID",
              "Lot",
              "Quantity",
              "Shipping method",
              "Status",
              "Tracking",
            ]}
            rows={picked.flatMap((o) =>
              o.lines.map((l) => [
                o.number,
                buyers.get(o.buyerId)?.name ?? o.buyerId,
                o.address.institution,
                l.productId,
                l.lot,
                l.quantity,
                o.shipping.method,
                o.status,
                o.shipping.tracking ?? "",
              ]),
            )}
          />
        </div>
        <Table
          label="Fulfillment queue"
          rows={rows}
          rowKey={(o) => o.id}
          columns={[
            {
              key: "choose",
              label: "Select",
              get: (o) => (
                <input
                  type="checkbox"
                  aria-label={`Select ${o.number}`}
                  checked={selected.includes(o.id)}
                  onChange={() =>
                    setSelected((s) =>
                      s.includes(o.id)
                        ? s.filter((id) => id !== o.id)
                        : [...s, o.id],
                    )
                  }
                />
              ),
            },
            {
              key: "order",
              label: "Order",
              get: (o) => <OrderLink id={o.id}>{o.number}</OrderLink>,
              sort: (o) => o.number,
            },
            {
              key: "buyer",
              label: "Institution",
              get: (o) => o.address.institution,
              sort: (o) => o.address.institution,
            },
            {
              key: "items",
              label: "Units",
              get: (o) => o.lines.reduce((s, l) => s + l.quantity, 0),
              numeric: true,
            },
            {
              key: "status",
              label: "Status",
              get: (o) => o.status,
              sort: (o) => o.status,
            },
            {
              key: "tracking",
              label: "Tracking",
              get: (o) => o.shipping.tracking ?? "Not recorded",
            },
          ]}
        />
        <p className="bi-small">
          A packing manifest is not a purchased carrier label. Open an order for
          its actual shipment status, tracking and the provider actions
          supported by its connection.
        </p>
      </Card>
      <Card title="ShipStation / shipping retry desk">
        <p className="bi-small">
          Run a read-only check first. Only failed shipment records can be
          retried here; shipped orders are never re-pushed.
        </p>
        <label className="bi-field">
          Order numbers
          <textarea
            rows={3}
            value={numbers}
            onChange={(e) => {
              setNumbers(e.target.value);
              setConfirmed(false);
              setDryRun([]);
            }}
            placeholder="One order number per line"
          />
        </label>
        <Button disabled={busy} onClick={() => void check()}>
          {busy ? "Checking…" : "Dry run"}
        </Button>
        {dryRun.length > 0 && (
          <Table
            label="Shipment retry dry run"
            rows={dryRun}
            rowKey={(r) => r.number}
            columns={[
              {
                key: "number",
                label: "Order",
                get: (r) =>
                  r.id ? <OrderLink id={r.id}>{r.number}</OrderLink> : r.number,
              },
              { key: "status", label: "Current result", get: (r) => r.status },
              {
                key: "eligible",
                label: "Retry eligible",
                get: (r) => (r.eligible ? "Yes" : "No"),
              },
            ]}
          />
        )}
        <label className="bi-check">
          <input
            type="checkbox"
            disabled={!dryRun.some((r) => r.eligible) || busy}
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          Request a retry for the failed shipments shown above
        </label>
        <Button
          disabled={!LIVE || !confirmed || busy}
          onClick={() => void retry()}
        >
          Retry failed shipments
        </Button>
        {!LIVE && (
          <p className="bi-small">
            This sample-data preview does not call a shipping provider.
          </p>
        )}
        {error && (
          <p className="bi-warning" role="alert">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}

const reviewValid = (v: unknown): v is Record<string, string> =>
  isObject(v) && Object.values(v).every((x) => typeof x === "string");
export function RiskDesk() {
  const data = useBusiness();
  const [days, setDays] = useState(60),
    [filter, setFilter] = useState("open"),
    [reviews, setReviews, warning] = useDeviceState<Record<string, string>>(
      "risk-reviews",
      {},
      reviewValid,
    );
  const result = riskSignals(data, days),
    rows = result.signals.filter(
      (s) =>
        filter === "all" ||
        (filter === "open" && !reviews[s.id]) ||
        (filter === "reviewed" && reviews[s.id]),
    );
  const [selected, setSelected] = useState<string | null>(null),
    [note, setNote] = useState("");
  const signal = result.signals.find((s) => s.id === selected);
  return (
    <div className="bi-page">
      <PageHeader description="Review unusual order patterns and incomplete fulfillment data. Signals are prompts for a human review, never automatic fraud verdicts." />
      <SourceNote />
      <Kpis
        items={[
          {
            label: "Orders scanned",
            value: result.scanned,
            note: `Last ${days} days`,
          },
          {
            label: "Needs review",
            value: result.signals.filter(
              (s) => s.level === "Review" && !reviews[s.id],
            ).length,
            note: "Self-referrals or repeated unpaid orders",
          },
          {
            label: "Other attention",
            value: result.signals.filter(
              (s) => s.level === "Attention" && !reviews[s.id],
            ).length,
            note: "High frequency or incomplete addresses",
          },
          {
            label: "Reviewed on this device",
            value: result.signals.filter((s) => Boolean(reviews[s.id])).length,
          },
        ]}
      />
      <div className="bi-toolbar">
        <NumberField
          label="Review window"
          value={days}
          min={7}
          max={90}
          suffix="days"
          onChange={(n) => setDays(n ?? 60)}
        />
        <Segmented
          label="Risk review state"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: "Open signals" },
            { value: "reviewed", label: "Reviewed" },
            { value: "all", label: "All" },
          ]}
        />
      </div>
      <Card title="Review signals" flush>
        <Table
          label="Order review signals"
          rows={rows}
          rowKey={(s) => s.id}
          onSelect={(s) => {
            setSelected(s.id);
            setNote(reviews[s.id] ?? "");
          }}
          columns={[
            {
              key: "signal",
              label: "Signal",
              get: (s) => (
                <>
                  {s.reason}
                  <span className="bi-cell-note">{s.detail}</span>
                </>
              ),
              sort: (s) => s.reason,
            },
            {
              key: "level",
              label: "Priority",
              get: (s) => s.level,
              sort: (s) => s.level,
            },
            {
              key: "review",
              label: "Review",
              get: (s) => (reviews[s.id] ? "Reviewed" : "Open"),
            },
          ]}
        />
      </Card>
      <DeviceNote warning={warning} />
      <HelpCard title="Detection rules">
        <p>
          Self-referrals match buyer and partner email. High frequency means at
          least four orders in the window; repeated unpaid checkouts means at
          least three currently unpaid orders. Incomplete-address signals check
          street, postcode and country. No orders are blocked, cancelled or
          refunded by this screen.
        </p>
      </HelpCard>
      {signal && (
        <Drawer
          title={signal.reason}
          eyebrow="Review signal"
          onClose={() => setSelected(null)}
          footer={
            <Button
              onClick={() => {
                setReviews((r) => ({
                  ...r,
                  [signal.id]: note.trim() || "Reviewed",
                }));
                setSelected(null);
              }}
            >
              Save review note on this device
            </Button>
          }
        >
          <p>{signal.detail}</p>
          {signal.orderId && (
            <OrderLink id={signal.orderId}>Open order ↗</OrderLink>
          )}
          <label className="bi-field">
            Review note
            <textarea
              rows={6}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
            />
          </label>
          <DeviceNote warning={warning} />
        </Drawer>
      )}
    </div>
  );
}

export function ActivityLog() {
  const data = useBusiness();
  const [query, setQuery] = useState(""),
    [state, setState] = useState("all");
  const all = activityRows(data),
    rows = all.filter(
      (r) =>
        (state === "all" || r.action === state) &&
        `${r.target} ${r.action} ${r.detail}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  return (
    <div className="bi-page">
      <PageHeader description="Trace the recorded order lifecycle and open the underlying records." />
      <SourceNote />
      <p className="bi-source">
        Order-event history · Actor identity and non-order admin changes are not
        in this source
      </p>
      <Card
        title="Activity history"
        meta={
          <ExportButton
            name="order-activity"
            headers={["Timestamp UTC", "Category", "Order", "Event", "Note"]}
            rows={rows.map((r) => [
              r.at,
              r.category,
              r.target,
              r.action,
              r.detail,
            ])}
          />
        }
      >
        <div className="bi-toolbar">
          <label className="bi-field">
            Search activity
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Order, event or note"
            />
          </label>
          <label className="bi-field">
            Event
            <select value={state} onChange={(e) => setState(e.target.value)}>
              <option value="all">All order events</option>
              {[...new Set(all.map((r) => r.action))].sort().map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <Table
          label="Recorded order lifecycle events"
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            {
              key: "at",
              label: "Time UTC",
              get: (r) => formatDateTime(r.at),
              sort: (r) => r.at,
            },
            {
              key: "order",
              label: "Order",
              get: (r) => <OrderLink id={r.orderId}>{r.target}</OrderLink>,
              sort: (r) => r.target,
            },
            {
              key: "action",
              label: "Event",
              get: (r) => r.action,
              sort: (r) => r.action,
            },
            { key: "note", label: "Details", get: (r) => r.detail },
          ]}
        />
      </Card>
      <HelpCard title="About this trail">
        <p>
          This is a read-only view of recorded order events. It does not claim
          to be a tamper-proof security audit, and it cannot identify actors
          that the source did not record. A complete administrator audit
          covering price changes, permissions and certificate publication needs
          server-side audit events.
        </p>
      </HelpCard>
    </div>
  );
}

export const handbookSections = [
  {
    title: "Orders and fulfillment",
    text: "Order states track placed, paid, packed, shipped and delivered work. A captured payment is different from an authorization. Open an order to inspect payment and shipment details before advancing it.",
    to: "/admin/orders",
  },
  {
    title: "Revenue and financial planning",
    text: "Sales analytics reconciles captured-order revenue, discounts, refunds, tax and shipping. Forecasts are editable scenarios; Profit uses local cost assumptions and is not a connected accounting ledger.",
    to: "/admin/analytics",
  },
  {
    title: "Stock and lot release",
    text: "Stock planning uses paid unit velocity. Only released inventory counts toward sellable cover. Testing and quarantined units are shown separately. A plan does not change actual inventory.",
    to: "/admin/restock",
  },
  {
    title: "Certificates and research accounts",
    text: "A certificate is published only when the record is ready for release. Missing or pending results are never passing results. Research applications are reviewed before purchase access is approved.",
    to: "/admin/lots",
  },
  {
    title: "Customers and retention",
    text: "Retention groups customers by first captured order and shows repeat purchasing over completed months. A reorder interval is observed behavior, not a promise or an automatic marketing instruction.",
    to: "/admin/retention",
  },
  {
    title: "Partner program",
    text: "Partner codes attribute referred orders and commission. Inspect the referral ledger before recording a payout. Recording a payout documents a payment already made; it never sends money.",
    to: "/admin/partners",
  },
  {
    title: "Marketing consent",
    text: "An approved research account is not permission for promotional email. Subscriber records need an explicit opt-in source and consent time. Suppressed or unsubscribed contacts stay out of campaign audiences.",
    to: "/admin/marketing",
  },
  {
    title: "Connections and launch",
    text: "Payment, email, SMS and shipping switches remain off or simulated until approved provider accounts are connected. A local draft, forecast or setup preview does not activate an integration.",
    to: "/admin/settings?section=connections",
  },
];
export function Handbook() {
  const [query, setQuery] = useState("");
  return (
    <div className="bi-page">
      <PageHeader description="The owner’s guide to TrueMark’s control surfaces." />
      <label className="bi-field">
        Search the handbook
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Revenue, stock, partners, consent…"
        />
      </label>
      <div className="bi-two">
        {handbookSections
          .filter((s) =>
            `${s.title} ${s.text}`.toLowerCase().includes(query.toLowerCase()),
          )
          .map((s) => (
            <HelpCard key={s.title} title={s.title}>
              <p>{s.text}</p>
              <Link className="bi-link" to={s.to}>
                Open this workspace ↗
              </Link>
            </HelpCard>
          ))}
      </div>
    </div>
  );
}

export function LaunchReadiness() {
  const data = useBusiness();
  const checks = [
    {
      name: "Active product catalog",
      ready: data.products.some((p) => p.active !== false),
      detail: `${data.products.filter((p) => p.active !== false).length} active products`,
      to: "/admin/products",
    },
    {
      name: "Prices recorded",
      ready: data.products
        .filter((p) => p.active !== false)
        .every((p) => typeof p.price === "number" && p.price > 0),
      detail: "Each active product needs an intentional selling price.",
      to: "/admin/products",
    },
    {
      name: "Released certificate records",
      ready: data.lots.some(
        (l) =>
          l.status === "released" &&
          !l.sample &&
          Boolean(l.coaPath || l.coaUrl),
      ),
      detail:
        "Real, released records stay separate from illustrative sample certificates.",
      to: "/admin/lots",
    },
    {
      name: "Research account review",
      ready: data.buyers.some((b) => b.status === "verified"),
      detail: "Verified buyers can be distinguished from pending applications.",
      to: "/admin/applications",
    },
    {
      name: "Inventory counts",
      ready: data.products
        .filter((p) => p.active !== false)
        .every((p) => p.stock != null),
      detail:
        "Product stock needs recorded counts before live replenishment planning.",
      to: "/admin/products",
    },
  ];
  return (
    <div className="bi-page">
      <PageHeader description="A record-based readiness check, followed by the services the owner and Riley connect for launch." />
      <SourceNote />
      <Kpis
        items={[
          {
            label: "Record checks ready",
            value: `${checks.filter((c) => c.ready).length} / ${checks.length}`,
            note: "This is not a certification that commerce is live",
          },
          {
            label: "Provider connections",
            value: "Review required",
            note: "Payment, shipping, email and SMS",
          },
        ]}
      />
      <Card title="Store records">
        <ul className="bi-checklist">
          {checks.map((c) => (
            <li key={c.name}>
              <span className="bi-check-state">
                {c.ready ? "Ready" : "Needs review"}
              </span>
              <div>
                <h3>{c.name}</h3>
                <p className="bi-small">{c.detail}</p>
              </div>
              <Link className="bi-link" to={c.to}>
                Review ↗
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <HelpCard title="Finish the launch checks">
        <p>
          Review payment processing, email delivery, shipping accounts, domain
          ownership, tax configuration and customer-facing policies with the
          people responsible for them. Their current operational switches are
          shown in Settings → Connections; nothing is marked connected from this
          checklist.
        </p>
        <Link className="bi-link" to="/admin/settings?section=connections">
          Review real connection states ↗
        </Link>
        <p>
          Use a test order to confirm the complete journey before accepting real
          commerce. Review the research-use notices and the exact certificate
          records that will be public.
        </p>
      </HelpCard>
      <p className="bi-small">
        Records inspected through {formatDate(data.asOf)}.
      </p>
    </div>
  );
}
