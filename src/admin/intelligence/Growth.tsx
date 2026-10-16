import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  PageHeader,
  Segmented,
  formatDateTime,
  formatMoney,
} from "../../app-kit";
import { LIVE } from "../../platform/mode";
import { analyze, dateKey, inWindow, orderMoney } from "./model";
import { campaignAudience } from "./workflows";
import type { Subscriber } from "./workflows";
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
  useDateRange,
  useDeviceState,
} from "./shared";
import { ContactImport } from "./Programs";

export function useWorkspaceTab(fallback: string, allowed: string[]) {
  const [params, setParams] = useSearchParams();
  const value = params.get("tab") ?? fallback;
  return [
    allowed.includes(value) ? value : fallback,
    (next: string) =>
      setParams(
        (p) => {
          const q = new URLSearchParams(p);
          q.set("tab", next);
          return q;
        },
        { replace: true },
      ),
  ] as const;
}

type Visit = {
  id: string;
  at: string;
  source: string;
  device: string;
  path: string;
  steps: string[];
  orderId?: string;
  status: string;
};
export function Traffic() {
  const data = useBusiness(),
    range = useDateRange();
  const [tab, setTab] = useWorkspaceTab("funnel", [
    "funnel",
    "live",
    "footprints",
  ]);
  const [source, setSource] = useState("all"),
    [device, setDevice] = useState("all"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Visit | null>(null);
  const report = range.window ? analyze(data, range.window) : null;
  // These illustrative journeys belong only to the public sample preview. They are never telemetry.
  const visits = useMemo<Visit[]>(
    () =>
      LIVE
        ? []
        : data.orders.flatMap((o, i) => {
            const at = o.createdAt,
              source =
                i % 4 === 0
                  ? "Email · illustrative"
                  : i % 3 === 0
                    ? "Partner · illustrative"
                    : "Search · illustrative";
            return [
              {
                id: `sample-journey-${o.id}`,
                at,
                source,
                device: i % 3 ? "Mobile" : "Desktop",
                path: "/products",
                steps: [
                  "Catalog",
                  "Product detail",
                  "Bag",
                  "Checkout",
                  ...(orderMoney(o).paid ? ["Payment captured"] : []),
                ],
                orderId: o.id,
                status: orderMoney(o).paid
                  ? "Captured order"
                  : "Checkout opened",
              },
              {
                id: `sample-browse-${o.id}`,
                at,
                source: "Direct · illustrative",
                device: i % 2 ? "Desktop" : "Mobile",
                path: i % 2 ? "/verify" : "/quality",
                steps: ["Landing", i % 2 ? "Lot lookup" : "Quality"],
                status: "Browsing only",
              },
            ];
          }),
    [data],
  );
  const rows = visits.filter(
    (v) =>
      range.window &&
      inWindow(v.at, range.window, Date.parse(data.asOf)) &&
      (source === "all" || source === v.source) &&
      (device === "all" || device === v.device) &&
      `${v.id} ${v.path} ${v.status}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const stages = report
    ? [
        { label: "Orders placed", value: report.orders.length },
        { label: "Payment captured", value: report.current.paid },
        {
          label: "Packed or further",
          value: report.orders.filter(
            (o) =>
              ["packed", "shipped", "delivered"].includes(o.status) &&
              orderMoney(o).paid,
          ).length,
        },
        {
          label: "Shipped or delivered",
          value: report.orders.filter(
            (o) =>
              ["shipped", "delivered"].includes(o.status) && orderMoney(o).paid,
          ).length,
        },
        {
          label: "Delivered",
          value: report.orders.filter(
            (o) => o.status === "delivered" && orderMoney(o).paid,
          ).length,
        },
      ]
    : [];
  const unpaid =
    report?.orders.filter(
      (o) =>
        !orderMoney(o).paid && !["cancelled", "refunded"].includes(o.status),
    ) ?? [];
  return (
    <div className="bi-page">
      <PageHeader description="Follow the order funnel, inspect customer journeys, and see exactly which traffic data is available." />
      <SourceNote />
      <Segmented
        label="Traffic workspace"
        value={tab}
        onChange={setTab}
        options={[
          { value: "funnel", label: "Order funnel" },
          { value: "live", label: "Live traffic" },
          { value: "footprints", label: "Footprints" },
        ]}
      />
      {range.controls}
      {tab === "funnel" && report && (
        <>
          <Kpis
            items={[
              {
                label: "Capture rate",
                value: report.orders.length
                  ? `${((report.current.paid / report.orders.length) * 100).toFixed(1)}%`
                  : "—",
                note: "Captured orders / orders placed in range",
              },
              {
                label: "Awaiting collection",
                value: formatMoney(report.current.unpaid),
                note: "Potential order value, not lost or collected revenue",
              },
              {
                label: "Delivered",
                value: stages[4].value,
                note: "Current recorded state of this cohort",
              },
            ]}
          />
          <Card title="From placed order to delivery">
            <div className="bi-funnel">
              {stages.map((s) => (
                <div key={s.label}>
                  <div>
                    <span>{s.label}</span>
                    <strong>{s.value}</strong>
                  </div>
                  <div className="bi-funnel-track">
                    <span
                      style={{
                        width: `${report.orders.length ? (s.value / report.orders.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="bi-small">
              This funnel starts when an order record exists. It cannot measure
              visitors, add-to-cart conversion or checkout abandonment before an
              order is created. Refunded captured orders stay in the capture
              stage; fulfillment stages use current status.
            </p>
          </Card>
          <Card
            title="Open checkouts requiring a review"
            meta={
              <ExportButton
                name="uncollected-orders"
                headers={["Order", "Placed UTC", "Payment", "Potential value"]}
                rows={unpaid.map((o) => [
                  o.number,
                  o.createdAt,
                  o.payment,
                  o.total,
                ])}
              />
            }
            flush
          >
            <Table
              label="Open orders without a captured payment"
              rows={unpaid}
              rowKey={(o) => o.id}
              columns={[
                {
                  key: "order",
                  label: "Order",
                  get: (o) => <OrderLink id={o.id}>{o.number}</OrderLink>,
                },
                {
                  key: "time",
                  label: "Created UTC",
                  get: (o) => formatDateTime(o.createdAt),
                  sort: (o) => o.createdAt,
                },
                { key: "payment", label: "Payment", get: (o) => o.payment },
                {
                  key: "value",
                  label: "Potential value",
                  get: (o) => formatMoney(o.total),
                  sort: (o) => o.total,
                  numeric: true,
                },
              ]}
            />
          </Card>
        </>
      )}
      {tab !== "funnel" && (
        <>
          {!LIVE && (
            <p className="bi-source">
              Illustrative session journeys · Not measured website traffic ·
              Historical sample, not real-time visitors
            </p>
          )}
          {LIVE ? (
            <EmptyState
              title="Visitor analytics is not connected."
              note="The order funnel works from recorded orders. Live sessions, traffic sources and visitor journeys need a consent-aware first-party event source."
              action={
                <Link className="bi-link" to="/admin/integrations">
                  Review connection requirements ↗
                </Link>
              }
            />
          ) : (
            <>
              <Kpis
                items={[
                  {
                    label: "Illustrative sessions in view",
                    value: rows.length,
                    note: "Fixed sample journeys for reviewing these controls",
                  },
                  {
                    label: "Sample sessions with orders",
                    value: rows.filter((v) => v.orderId).length,
                    note: "Links point to TrueMark sample order records",
                  },
                  {
                    label: "Live visitors",
                    value: "Not measured",
                    note: "No session tracker is installed by this preview",
                  },
                ]}
              />
              <Card
                title={
                  tab === "live"
                    ? "Session monitor · sample playback"
                    : "Journey explorer"
                }
                meta={
                  <ExportButton
                    name="sample-journeys"
                    headers={[
                      "Sample journey",
                      "Timestamp UTC",
                      "Illustrative source",
                      "Device",
                      "Path",
                      "Steps",
                      "Outcome",
                    ]}
                    rows={rows.map((v) => [
                      v.id,
                      v.at,
                      v.source,
                      v.device,
                      v.path,
                      v.steps.join(" → "),
                      v.status,
                    ])}
                  />
                }
              >
                <div className="bi-toolbar">
                  <label className="bi-field">
                    Find a journey
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Journey, path or outcome"
                    />
                  </label>
                  <label className="bi-field">
                    Illustrative source
                    <select
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                    >
                      <option value="all">All sample sources</option>
                      {[...new Set(visits.map((v) => v.source))].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="bi-field">
                    Device
                    <select
                      value={device}
                      onChange={(e) => setDevice(e.target.value)}
                    >
                      {["all", "Mobile", "Desktop"].map((d) => (
                        <option key={d} value={d}>
                          {d === "all" ? "All devices" : d}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <Table
                  label="Illustrative visitor journeys"
                  rows={rows}
                  rowKey={(v) => v.id}
                  onSelect={setSelected}
                  columns={[
                    {
                      key: "time",
                      label: "Sample time UTC",
                      get: (v) => formatDateTime(v.at),
                      sort: (v) => v.at,
                    },
                    { key: "path", label: "Entry path", get: (v) => v.path },
                    {
                      key: "source",
                      label: "Illustrative source",
                      get: (v) => v.source,
                    },
                    { key: "device", label: "Device", get: (v) => v.device },
                    { key: "outcome", label: "Outcome", get: (v) => v.status },
                  ]}
                />
              </Card>
            </>
          )}
          <HelpCard title="Connect a real event source">
            <p>
              A production monitor needs recorded session IDs, page and checkout
              events, timestamps, attribution and a retention policy. It should
              respect the store’s consent choices. Current orders alone cannot
              reconstruct browsing sessions, source attribution, devices or
              real-time visitor counts.
            </p>
            <Link className="bi-link" to="/admin/integrations">
              Integration workspace ↗
            </Link>
          </HelpCard>
        </>
      )}
      {selected && (
        <Drawer
          title="Illustrative customer journey"
          eyebrow={selected.id}
          onClose={() => setSelected(null)}
        >
          <p className="bi-small">
            Sample visualization, not an observed browsing history.
          </p>
          <ol className="bi-journey">
            {selected.steps.map((s, i) => (
              <li key={s}>
                <span>{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          {selected.orderId && (
            <OrderLink id={selected.orderId}>
              Open linked sample order ↗
            </OrderLink>
          )}
        </Drawer>
      )}
    </div>
  );
}

const subscribersValid = (v: unknown): v is Subscriber[] =>
  Array.isArray(v) &&
  v.length <= 5000 &&
  v.every(
    (s) =>
      isObject(s) &&
      ["id", "name", "email", "consentAt", "source", "reason"].every(
        (k) => typeof s[k] === "string",
      ) &&
      ["subscribed", "suppressed"].includes(String(s.status)),
  );
type Campaign = {
  id: string;
  name: string;
  subject: string;
  body: string;
  audience: string;
  budget: number;
  planned: string;
  updated: string;
};
const campaignsValid = (v: unknown): v is Campaign[] =>
  Array.isArray(v) &&
  v.length <= 50 &&
  v.every(
    (c) =>
      isObject(c) &&
      ["id", "name", "subject", "body", "audience", "planned", "updated"].every(
        (k) => typeof c[k] === "string",
      ) &&
      numeric(c.budget),
  );
type Flow = {
  id: string;
  title: string;
  hours: number;
  subject: string;
  body: string;
  planned: boolean;
};
const flowsValid = (v: unknown): v is Flow[] =>
  Array.isArray(v) &&
  v.length <= 10 &&
  v.every(
    (f) =>
      isObject(f) &&
      ["id", "title", "subject", "body"].every(
        (k) => typeof f[k] === "string",
      ) &&
      numeric(f.hours) &&
      typeof f.planned === "boolean",
  );
const initialFlows: Flow[] = [
  {
    id: "welcome",
    title: "Welcome after explicit opt-in",
    hours: 0,
    subject: "Welcome to TrueMark",
    body: "Explore product specifications, lot records and the research account process.",
    planned: false,
  },
  {
    id: "checkout",
    title: "Uncollected order review",
    hours: 24,
    subject: "Your TrueMark order",
    body: "Please review your order details. Contact the team if you need help with the research purchasing process.",
    planned: false,
  },
  {
    id: "purchase",
    title: "Post-purchase service follow-up",
    hours: 168,
    subject: "A follow-up on your order",
    body: "Your lot and certificate records remain available through the order and verification pages.",
    planned: false,
  },
  {
    id: "winback",
    title: "Returning-customer campaign",
    hours: 1080,
    subject: "An update from TrueMark",
    body: "Review the current catalog and published lot documentation.",
    planned: false,
  },
];

export function Marketing() {
  const data = useBusiness(),
    range = useDateRange();
  const [tab, setTab] = useWorkspaceTab("performance", [
    "performance",
    "campaigns",
    "flows",
    "subscribers",
  ]);
  const initialSubscribers: Subscriber[] = LIVE
    ? []
    : data.buyers.slice(0, 8).map((b, i) => ({
        id: `sample-${b.id}`,
        name: b.name,
        email: b.email,
        consentAt: `${dateKey(data.asOf)}T08:00:00Z`,
        source: "Fictional newsletter opt-in",
        status: i === 7 ? "suppressed" : "subscribed",
        reason: i === 7 ? "Sample unsubscribe" : "",
      }));
  const [subscribers, setSubscribers, subscriberWarning] = useDeviceState<
    Subscriber[]
  >("audience-plan", initialSubscribers, subscribersValid);
  const [campaigns, setCampaigns, campaignWarning] = useDeviceState<Campaign[]>(
    "campaign-drafts",
    [],
    campaignsValid,
  );
  const [flows, setFlows, flowWarning] = useDeviceState<Flow[]>(
    "flow-drafts",
    initialFlows,
    flowsValid,
  );
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [importOpen, setImportOpen] = useState(false),
    [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Campaign | null>(null),
    [flow, setFlow] = useState<Flow | null>(null),
    [contact, setContact] = useState<Subscriber | null>(null);
  const allowed = campaignAudience(subscribers, data.asOf),
    rows = subscribers.filter(
      (s) =>
        (status === "all" || s.status === status) &&
        `${s.name} ${s.email} ${s.source}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  const report = range.window ? analyze(data, range.window) : null;
  function createCampaign() {
    setEditing({
      id: crypto.randomUUID(),
      name: "",
      subject: "",
      body: "",
      audience: "subscribed",
      budget: 0,
      planned: "",
      updated: data.asOf,
    });
  }
  return (
    <div className="bi-page">
      <PageHeader description="Measure recorded attribution, prepare campaigns and flows, and review consent before building an audience." />
      <SourceNote />
      <Segmented
        label="Marketing workspace"
        value={tab}
        onChange={setTab}
        options={[
          { value: "performance", label: "Attribution" },
          { value: "campaigns", label: "Campaigns" },
          { value: "flows", label: "Email flows" },
          { value: "subscribers", label: "Subscribers" },
        ]}
      />
      {tab === "performance" && (
        <>
          {range.controls}
          {report && (
            <>
              <Kpis
                items={[
                  {
                    label: "Partner-code revenue",
                    value: formatMoney(
                      report.channels.find((c) => c.name === "Partners")
                        ?.revenue ?? 0,
                    ),
                    note: "Recorded order attribution",
                  },
                  {
                    label: "Other-code revenue",
                    value: formatMoney(
                      report.channels.find(
                        (c) => c.name === "Other promo codes",
                      )?.revenue ?? 0,
                    ),
                    note: "A promo code does not identify an ad channel",
                  },
                  {
                    label: "Unattributed revenue",
                    value: formatMoney(
                      report.channels.find((c) => c.name === "Unattributed")
                        ?.revenue ?? 0,
                    ),
                    note: "No traffic source can be inferred",
                  },
                ]}
              />
              <Card
                title="Discount code performance"
                meta={
                  <ExportButton
                    name="code-performance"
                    headers={[
                      "Code",
                      "Captured orders",
                      "Net revenue",
                      "Discounts",
                      "Average order",
                    ]}
                    rows={report.codes.map((c) => [
                      c.name,
                      c.paid,
                      c.revenue,
                      c.discounts,
                      c.average,
                    ])}
                  />
                }
                flush
              >
                <Table
                  label="Recorded code attribution"
                  rows={report.codes}
                  rowKey={(c) => c.name}
                  columns={[
                    { key: "code", label: "Code", get: (c) => c.name },
                    {
                      key: "orders",
                      label: "Orders",
                      get: (c) => c.paid,
                      sort: (c) => c.paid,
                      numeric: true,
                    },
                    {
                      key: "revenue",
                      label: "Net revenue",
                      get: (c) => formatMoney(c.revenue),
                      sort: (c) => c.revenue,
                      numeric: true,
                    },
                    {
                      key: "discounts",
                      label: "Discounts",
                      get: (c) => formatMoney(c.discounts),
                      numeric: true,
                    },
                    {
                      key: "aov",
                      label: "Average order",
                      get: (c) => formatMoney(c.average),
                      numeric: true,
                    },
                  ]}
                />
              </Card>
            </>
          )}
          <HelpCard title="Connect spending before claiming return on ad spend">
            <p>
              Ad-platform spend, impressions, clicks and campaign attribution
              are not imported. The profit planner accepts manual spend
              assumptions; its estimate does not establish campaign ROAS, CAC or
              incremental lift.
            </p>
            <Link className="bi-link" to="/admin/profit">
              Model advertising and contribution ↗
            </Link>
          </HelpCard>
        </>
      )}
      {tab === "campaigns" && (
        <>
          <div className="bi-toolbar">
            <Button variant="primary" onClick={createCampaign}>
              Create campaign draft
            </Button>
            <span className="bi-small">
              {allowed.length} opted-in contacts in this device’s audience plan
            </span>
          </div>
          <Card
            title="Campaign drafts"
            meta={
              <span className="bi-small">
                Device only · Delivery not connected
              </span>
            }
            flush
          >
            <Table
              label="Saved campaign drafts"
              rows={campaigns}
              rowKey={(c) => c.id}
              onSelect={setEditing}
              columns={[
                {
                  key: "name",
                  label: "Campaign",
                  get: (c) => (
                    <>
                      {c.name}
                      <span className="bi-cell-note">{c.subject}</span>
                    </>
                  ),
                  sort: (c) => c.name,
                },
                {
                  key: "plan",
                  label: "Intended date",
                  get: (c) => c.planned || "Not set",
                },
                {
                  key: "budget",
                  label: "Budget assumption",
                  get: (c) => formatMoney(c.budget),
                  numeric: true,
                },
                {
                  key: "status",
                  label: "State",
                  get: () => "Draft · not scheduled",
                },
              ]}
            />
          </Card>
          <DeviceNote warning={campaignWarning} />
          <HelpCard title="Prepare, then connect delivery">
            <p>
              Drafts save names, subjects, copy, audience and a planned date.
              This workspace does not send or schedule email. Delivery and
              engagement metrics become meaningful after an approved mail
              provider, suppression store and server scheduler are connected.
            </p>
            <Link className="bi-link" to="/admin/settings?section=connections">
              Review mail connection ↗
            </Link>
          </HelpCard>
        </>
      )}
      {tab === "flows" && (
        <>
          <Card
            title="Lifecycle flow plans"
            meta={<span className="bi-small">All automations remain off</span>}
            flush
          >
            <Table
              label="Email automation drafts"
              rows={flows}
              rowKey={(f) => f.id}
              onSelect={setFlow}
              columns={[
                { key: "title", label: "Flow", get: (f) => f.title },
                {
                  key: "delay",
                  label: "Delay assumption",
                  get: (f) => `${f.hours} hours`,
                  numeric: true,
                },
                {
                  key: "plan",
                  label: "Plan",
                  get: (f) =>
                    f.planned ? "Included in launch draft" : "Not planned",
                },
                { key: "state", label: "Delivery", get: () => "Not connected" },
              ]}
            />
          </Card>
          <DeviceNote warning={flowWarning} />
          <HelpCard title="Keep service messages and promotions distinct">
            <p>
              Transactional order messages have a different purpose from
              marketing. Welcome and win-back campaigns need explicit opt-in. A
              draft flow neither changes the transactional templates nor enrolls
              any customer.
            </p>
            <Link className="bi-link" to="/admin/messages">
              Review transactional deliveries ↗
            </Link>
          </HelpCard>
        </>
      )}
      {tab === "subscribers" && (
        <>
          <p className="bi-source">
            {LIVE
              ? "Local audience plan · Shared subscriber storage is not connected"
              : "Fictional subscriber workspace · Consent records are illustrative"}
          </p>
          <Kpis
            items={[
              {
                label: "Eligible in plan",
                value: allowed.length,
                note: "Explicit consent source and timestamp; not suppressed",
              },
              {
                label: "Suppressed",
                value: subscribers.filter((s) => s.status === "suppressed")
                  .length,
                note: "Excluded from campaign audience",
              },
              {
                label: "Shared audience",
                value: "Not connected",
                note: "Local changes do not update a mail provider",
              },
            ]}
          />
          <Card
            title="Audience and consent"
            meta={
              <Button onClick={() => setImportOpen(true)}>
                Preview subscriber CSV
              </Button>
            }
          >
            <div className="bi-toolbar">
              <label className="bi-field">
                Find a subscriber
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, email or opt-in source"
                />
              </label>
              <label className="bi-field">
                Consent state
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">All records</option>
                  <option value="subscribed">Subscribed</option>
                  <option value="suppressed">Suppressed</option>
                </select>
              </label>
              <ExportButton
                name="audience-plan"
                headers={[
                  "Name",
                  "Email",
                  "Consent UTC",
                  "Opt-in source",
                  "State",
                  "Suppression reason",
                ]}
                rows={rows.map((s) => [
                  s.name,
                  s.email,
                  s.consentAt,
                  s.source,
                  s.status,
                  s.reason,
                ])}
              />
            </div>
            <Table
              label="Local audience plan and consent records"
              rows={rows}
              rowKey={(s) => s.id}
              onSelect={setContact}
              columns={[
                {
                  key: "name",
                  label: "Contact",
                  get: (s) => (
                    <>
                      {s.name}
                      <span className="bi-cell-note">{s.email}</span>
                    </>
                  ),
                },
                { key: "source", label: "Opt-in source", get: (s) => s.source },
                {
                  key: "consent",
                  label: "Consent UTC",
                  get: (s) => formatDateTime(s.consentAt),
                  sort: (s) => s.consentAt,
                },
                { key: "state", label: "State", get: (s) => s.status },
              ]}
            />
          </Card>
          <DeviceNote warning={subscriberWarning} />
          <p className="bi-small">
            Research-account approval is never treated as marketing consent.
            Contact data entered here is stored in this browser; use the shared
            consent service for a production audience.
          </p>
        </>
      )}
      {editing && (
        <Drawer
          title={
            campaigns.some((c) => c.id === editing.id)
              ? "Edit campaign draft"
              : "New campaign draft"
          }
          eyebrow="No email will be sent"
          onClose={() => setEditing(null)}
          footer={
            <Button
              variant="primary"
              disabled={
                !editing.name.trim() ||
                !editing.subject.trim() ||
                !editing.body.trim()
              }
              onClick={() => {
                const next = { ...editing, updated: new Date().toISOString() };
                setCampaigns((c) => [
                  ...c.filter((x) => x.id !== next.id).slice(-49),
                  next,
                ]);
                setEditing(null);
                setMessage(
                  "Campaign draft saved on this device. No delivery was scheduled.",
                );
              }}
            >
              Save draft on this device
            </Button>
          }
        >
          <div className="bi-form">
            <label className="bi-field">
              Campaign name
              <input
                value={editing.name}
                maxLength={100}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <label className="bi-field">
              Subject
              <input
                value={editing.subject}
                maxLength={160}
                onChange={(e) =>
                  setEditing({ ...editing, subject: e.target.value })
                }
              />
            </label>
            <label className="bi-field">
              Message
              <textarea
                rows={8}
                value={editing.body}
                maxLength={10000}
                onChange={(e) =>
                  setEditing({ ...editing, body: e.target.value })
                }
              />
            </label>
            <label className="bi-field">
              Intended send date
              <input
                type="date"
                value={editing.planned}
                onChange={(e) =>
                  setEditing({ ...editing, planned: e.target.value })
                }
              />
            </label>
            <NumberField
              label="Budget assumption"
              value={editing.budget}
              suffix="USD"
              onChange={(n) => setEditing({ ...editing, budget: n ?? 0 })}
            />
            <p className="bi-small">
              Audience: explicitly opted-in, unsuppressed contacts in this plan
              ({allowed.length}). Consent must be checked again by the delivery
              service at send time.
            </p>
            <ExportButton
              name="campaign-draft"
              label="Export draft"
              headers={[
                "Campaign",
                "Subject",
                "Message",
                "Audience",
                "Intended date",
                "Budget assumption",
                "Delivery state",
              ]}
              rows={[
                [
                  editing.name,
                  editing.subject,
                  editing.body,
                  editing.audience,
                  editing.planned,
                  editing.budget,
                  "Draft — not scheduled",
                ],
              ]}
            />
          </div>
        </Drawer>
      )}
      {flow && (
        <Drawer
          title={flow.title}
          eyebrow="Automation draft · Not active"
          onClose={() => setFlow(null)}
          footer={
            <Button
              onClick={() => {
                setFlows((rows) =>
                  rows.map((f) => (f.id === flow.id ? flow : f)),
                );
                setFlow(null);
                setMessage("Flow draft saved. Automation remains off.");
              }}
            >
              Save flow draft
            </Button>
          }
        >
          <div className="bi-form">
            <NumberField
              label="Delay after trigger"
              value={flow.hours}
              max={8760}
              suffix="hours"
              onChange={(n) => setFlow({ ...flow, hours: n ?? 0 })}
            />
            <label className="bi-field">
              Subject
              <input
                value={flow.subject}
                maxLength={160}
                onChange={(e) => setFlow({ ...flow, subject: e.target.value })}
              />
            </label>
            <label className="bi-field">
              Message
              <textarea
                rows={8}
                value={flow.body}
                maxLength={10000}
                onChange={(e) => setFlow({ ...flow, body: e.target.value })}
              />
            </label>
            <label className="bi-check">
              <input
                type="checkbox"
                checked={flow.planned}
                onChange={(e) =>
                  setFlow({ ...flow, planned: e.target.checked })
                }
              />{" "}
              Include in the launch plan
            </label>
            <p className="bi-small">
              This is a planning flag. It does not activate an automation or add
              anyone to a flow.
            </p>
          </div>
        </Drawer>
      )}
      {contact && (
        <Drawer
          title={contact.name}
          eyebrow="Local consent record"
          onClose={() => setContact(null)}
          footer={
            <Button
              disabled={
                contact.status === "subscribed" &&
                subscribers.find((s) => s.id === contact.id)?.status ===
                  "suppressed"
              }
              onClick={() => {
                setSubscribers((s) =>
                  s.map((x) => (x.id === contact.id ? contact : x)),
                );
                setContact(null);
                setMessage(
                  "Local suppression plan saved. The mail provider was not changed.",
                );
              }}
            >
              Save local suppression
            </Button>
          }
        >
          <p>{contact.email}</p>
          <dl className="bi-ledger">
            <div>
              <dt>Consent source</dt>
              <dd>{contact.source}</dd>
            </div>
            <div>
              <dt>Consent time</dt>
              <dd>{formatDateTime(contact.consentAt)}</dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>{contact.status}</dd>
            </div>
          </dl>
          <label className="bi-check">
            <input
              type="checkbox"
              checked={contact.status === "suppressed"}
              onChange={(e) =>
                setContact({
                  ...contact,
                  status: e.target.checked ? "suppressed" : "subscribed",
                })
              }
            />{" "}
            Suppress in this local plan
          </label>
          <label className="bi-field">
            Reason
            <textarea
              rows={3}
              value={contact.reason}
              onChange={(e) =>
                setContact({ ...contact, reason: e.target.value })
              }
            />
          </label>
          <p className="bi-small">
            Previously suppressed records cannot be re-subscribed here. Renewed
            consent must be recorded through the connected subscription service.
          </p>
        </Drawer>
      )}
      {importOpen && (
        <Drawer
          title="Subscriber import preview"
          eyebrow="Validate consent before delivery"
          onClose={() => setImportOpen(false)}
        >
          <ContactImport
            kind="subscribers"
            existing={subscribers.map((s) => ({ email: s.email }))}
            onPlan={(rows) => {
              const remaining = Math.max(0, 5000 - subscribers.length);
              setSubscribers((s) => [
                ...s,
                ...rows.slice(0, remaining).map((r) => ({
                  id: crypto.randomUUID(),
                  name: r.name,
                  email: r.email,
                  consentAt: r.consentAt,
                  source: r.source,
                  status: "subscribed" as const,
                  reason: "",
                })),
              ]);
              setImportOpen(false);
              setMessage(
                `${Math.min(rows.length, remaining)} contacts added to the local audience plan. No subscription service was updated.`,
              );
            }}
          />
        </Drawer>
      )}
      <p className="bi-small" role="status">
        {message}
      </p>
    </div>
  );
}

export function ConnectionsGuide() {
  const [query, setQuery] = useState("");
  const providers = [
    {
      name: "Payments",
      state: "Existing connection controls",
      body: "Use the approved payment processor. Owner-only mode and secret configuration live in the existing Connections workspace.",
      to: "/admin/settings?section=connections",
    },
    {
      name: "Shipping / ShipStation",
      state: "Existing shipment interface",
      body: "Inspect actual shipment status per order. The shipping desk supports a read-only retry check before eligible failed pushes.",
      to: "/admin/shipping",
    },
    {
      name: "Transactional email and SMS",
      state: "Existing connection controls",
      body: "Review provider modes, templates and recorded delivery results. Draft marketing flows remain separate.",
      to: "/admin/settings?section=connections",
    },
    {
      name: "Visitor analytics",
      state: "Event source needed",
      body: "Connect consent-aware session and checkout events before live visitors, devices, traffic sources and journey history can be measured.",
      to: "/admin/traffic",
    },
    {
      name: "Marketing delivery",
      state: "Shared audience and delivery needed",
      body: "Connect an opt-in and suppression store, approved provider and server-side scheduler before campaigns or flows can be activated.",
      to: "/admin/marketing?tab=campaigns",
    },
    {
      name: "Advertising accounts",
      state: "Spend and attribution source needed",
      body: "Verified spend, campaign IDs and attribution are needed for channel ROAS and CAC. No advertising account is connected from this page.",
      to: "/admin/profit",
    },
    {
      name: "Search Console",
      state: "Verified production domain needed",
      body: "Search performance requires the owner’s verified production property. Content checks can run without claiming rankings or indexing.",
      to: "/admin/seo",
    },
    {
      name: "Accounting and financial costs",
      state: "Cost import needed",
      body: "The profit workspace uses editable estimates until actual fees, bills, product costs and return transactions are imported.",
      to: "/admin/profit",
    },
  ];
  return (
    <div className="bi-page">
      <PageHeader description="A clear map of the services behind each control surface. Open the existing connection controls to inspect operational modes." />
      <label className="bi-field">
        Find a connection
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Payments, shipping, analytics…"
        />
      </label>
      <div className="bi-two">
        {providers
          .filter((p) =>
            `${p.name} ${p.body}`.toLowerCase().includes(query.toLowerCase()),
          )
          .map((p) => (
            <HelpCard title={p.name} key={p.name}>
              <p className="bi-source">{p.state}</p>
              <p>{p.body}</p>
              <Link className="bi-link" to={p.to}>
                Open workspace ↗
              </Link>
            </HelpCard>
          ))}
      </div>
      <p className="bi-small">
        These are integration requirements, not connection-status claims.
        Secrets are never entered into a local planning form.
      </p>
    </div>
  );
}
