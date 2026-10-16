import { ConnectedPrograms, ConnectedWorkspaceLink } from "./ConnectedPrograms";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  Drawer,
  PageHeader,
  Segmented,
  formatMoney,
} from "../../app-kit";
import { LIVE } from "../../platform/mode";
import { customerHealth, salesTotals } from "./model";
import { contactImport, rewardEstimate, validEmail } from "./workflows";
import type { ImportRow, RewardRules } from "./workflows";
import {
  CustomerLink,
  DeviceNote,
  ExportButton,
  HelpCard,
  Kpis,
  NumberField,
  SourceNote,
  Table,
  isObject,
  numeric,
  useBusiness,
  useDeviceState,
} from "./shared";

export function ContactImport({
  kind,
  existing,
  onPlan,
}: {
  kind: "customers" | "subscribers";
  existing: { email: string }[];
  onPlan?: (rows: ImportRow[]) => void;
}) {
  const data = useBusiness();
  const [text, setText] = useState(""),
    [rows, setRows] = useState<ImportRow[] | null>(null),
    [error, setError] = useState("");
  const example =
    kind === "customers"
      ? "name,email,institution\nSample Researcher,researcher@example.test,Sample Research Institute"
      : `name,email,consent_at,source\nSample Subscriber,subscriber@example.test,${data.asOf.slice(0, 10)}T08:00:00Z,Explicit newsletter opt-in`;
  const valid = rows?.filter((r) => !r.problem) ?? [];
  function validate(next = text) {
    try {
      setRows(contactImport(next, existing, kind, data.asOf));
      setError("");
    } catch (e) {
      setRows(null);
      setError(e instanceof Error ? e.message : "The file could not be read.");
    }
  }
  async function read(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) {
      setError("Choose a CSV smaller than 2 MB.");
      return;
    }
    try {
      const next = await file.text();
      setText(next);
      validate(next);
    } catch {
      setError("This file could not be read.");
    }
  }
  return (
    <div className="bi-form">
      <p className="bi-small">
        {kind === "customers"
          ? "Validate a customer migration plan. New research accounts remain pending until the normal application review is completed."
          : "A subscriber needs a valid email, explicit opt-in source and an ISO consent timestamp. Existing and duplicate addresses are excluded."}
      </p>
      <div className="bi-toolbar">
        <label className="bi-field">
          Choose CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void read(e.target.files?.[0])}
          />
        </label>
        <Button
          onClick={() => {
            setText(example);
            setRows(null);
            setError("");
          }}
        >
          Use sample format
        </Button>
      </div>
      <label className="bi-field">
        CSV to validate
        <textarea
          rows={7}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setRows(null);
            setError("");
          }}
          spellCheck={false}
          maxLength={2_000_000}
          placeholder={example}
        />
      </label>
      <Button
        variant="primary"
        onClick={() => validate()}
        disabled={!text.trim()}
      >
        Validate import
      </Button>
      {error && (
        <p role="alert" className="bi-warning">
          {error}
        </p>
      )}
      {rows && (
        <>
          <p role="status" className="bi-source">
            {valid.length} eligible · {rows.length - valid.length} need review ·
            No shared records have changed
          </p>
          <Table
            label="CSV validation results"
            rows={rows}
            rowKey={(r) => String(r.line)}
            columns={[
              { key: "line", label: "CSV row", get: (r) => r.line },
              {
                key: "contact",
                label: "Contact",
                get: (r) => (
                  <>
                    {r.name}
                    <span className="bi-cell-note">{r.email}</span>
                  </>
                ),
              },
              {
                key: "result",
                label: "Validation",
                get: (r) =>
                  r.problem ||
                  (kind === "customers"
                    ? "Ready for pending-account import plan"
                    : "Consent columns complete"),
              },
            ]}
          />
          <ExportButton
            name={`${kind}-import-plan`}
            label="Export eligible import plan"
            headers={
              kind === "customers"
                ? ["name", "email", "institution", "account_status"]
                : ["name", "email", "consent_at", "source"]
            }
            rows={valid.map((r) =>
              kind === "customers"
                ? [r.name, r.email, r.institution, "pending"]
                : [r.name, r.email, r.consentAt, r.source],
            )}
          />
          {onPlan && (
            <Button disabled={!valid.length} onClick={() => onPlan(valid)}>
              Add eligible contacts to local plan
            </Button>
          )}
        </>
      )}
      <p className="bi-small">
        CSV validation and export run in this browser. A production import needs
        the shared account or consent service. The file is not uploaded and no
        accounts are approved.
      </p>
    </div>
  );
}

const rulesValid = (v: unknown): v is RewardRules =>
  isObject(v) &&
  typeof v.enabled === "boolean" &&
  ["perDollar", "pointsPerDollar", "minPoints", "maxPercent"].every((k) =>
    numeric(v[k]),
  ) &&
  isObject(v.adjustments) &&
  Object.values(v.adjustments).every(numeric);
type Tier = {
  id: string;
  name: string;
  threshold: number;
  discount: number;
  note: string;
};
const tiersValid = (v: unknown): v is Tier[] =>
  Array.isArray(v) &&
  v.length <= 20 &&
  v.every(
    (t) =>
      isObject(t) &&
      ["id", "name", "note"].every((k) => typeof t[k] === "string") &&
      numeric(t.threshold) &&
      numeric(t.discount),
  );
type Inquiry = {
  id: string;
  name: string;
  email: string;
  institution: string;
  units: number;
  status: string;
  note: string;
  request: string;
};
const inquiriesValid = (v: unknown): v is Inquiry[] =>
  Array.isArray(v) &&
  v.length <= 100 &&
  v.every(
    (r) =>
      isObject(r) &&
      ["id", "name", "email", "institution", "status", "note", "request"].every(
        (k) => typeof r[k] === "string",
      ) &&
      numeric(r.units),
  );

export function CustomerPrograms() { return LIVE ? <ConnectedPrograms /> : <PreviewCustomerPrograms />; }
function PreviewCustomerPrograms() {
  const data = useBusiness(),
    [params, setParams] = useSearchParams();
  const tab = ["rewards", "memberships", "wholesale", "import"].includes(
    params.get("tab") ?? "",
  )
    ? params.get("tab")!
    : "rewards";
  const [rules, setRules, rulesWarning] = useDeviceState<RewardRules>(
    "reward-rules",
    {
      enabled: false,
      perDollar: 1,
      pointsPerDollar: 100,
      minPoints: 500,
      maxPercent: 10,
      adjustments: {},
    },
    rulesValid,
  );
  const [tiers, setTiers, tiersWarning] = useDeviceState<Tier[]>(
    "membership-tiers",
    [
      {
        id: "standard",
        name: "Research",
        threshold: 0,
        discount: 0,
        note: "Verified research account",
      },
      {
        id: "repeat",
        name: "Research partner",
        threshold: 2000,
        discount: 5,
        note: "Illustrative tier benefit; approval required",
      },
      {
        id: "institution",
        name: "Institution",
        threshold: 7500,
        discount: 10,
        note: "Illustrative volume tier; approval required",
      },
    ],
    tiersValid,
  );
  const initial: Inquiry[] = LIVE
    ? []
    : data.buyers.slice(0, 3).map((b, i) => ({
        id: `sample-wholesale-${b.id}`,
        name: b.name,
        email: b.email,
        institution: b.institution,
        units: [50, 100, 250][i],
        status: ["New", "Reviewing", "Responded"][i],
        note: "",
        request:
          "Fictional volume inquiry for research purchasing. Please share the qualification and quotation process.",
      }));
  const [inquiries, setInquiries, inquiryWarning] = useDeviceState<Inquiry[]>(
    "wholesale-drafts",
    initial,
    inquiriesValid,
  );
  const [query, setQuery] = useState(""),
    [message, setMessage] = useState(""),
    [tier, setTier] = useState<Tier | null>(null),
    [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [buyerId, setBuyerId] = useState(data.buyers[0]?.id ?? ""),
    [adjustment, setAdjustment] = useState(0),
    [basket, setBasket] = useState(100);
  const health = useMemo(() => customerHealth(data), [data]);
  const estimates = health.rows.map((c) => {
    const own = data.orders.filter(
      (o) =>
        o.buyerId === c.id && Date.parse(o.createdAt) <= Date.parse(data.asOf),
    );
    const net = salesTotals(own).product;
    return {
      ...c,
      net,
      ...rewardEstimate(net, rules, rules.adjustments[c.id] ?? 0),
    };
  });
  const selected = estimates.find((c) => c.id === buyerId);
  const rewardRows = estimates.filter((c) =>
    `${c.name} ${c.institution}`.toLowerCase().includes(query.toLowerCase()),
  );
  const sortedTiers = [...tiers].sort((a, b) => a.threshold - b.threshold);
  const membership = health.rows.map((c) => ({
    ...c,
    tier: sortedTiers.filter((t) => c.ltv >= t.threshold).at(-1),
  }));
  const field = (
    key: "perDollar" | "pointsPerDollar" | "minPoints" | "maxPercent",
    label: string,
    max = 100000,
  ) => (
    <NumberField
      label={label}
      value={rules[key]}
      min={key === "pointsPerDollar" ? 1 : 0}
      max={max}
      onChange={(n) => setRules((r) => ({ ...r, [key]: n ?? 0 }))}
    />
  );
  return (
    <div className="bi-page">
      <PageHeader description="Plan rewards and memberships, review volume inquiries, and prepare customer migrations." />
      <SourceNote />
      <Segmented
        label="Customer programs"
        value={tab}
        onChange={(value) => setParams({ tab: value }, { replace: true })}
        options={[
          { value: "rewards", label: "Rewards" },
          { value: "memberships", label: "Memberships" },
          { value: "wholesale", label: "Wholesale" },
          { value: "import", label: "Customer import" },
        ]}
      />
      <p className="bi-source">
        Program planning workspace · Saved on this device · Benefits and
        balances are not active at checkout
      </p>
      {tab === "rewards" && (
        <>
          <Kpis
            items={[
              {
                label: "Estimated earned points",
                value: estimates.reduce((s, c) => s + c.earned, 0),
                note: "Simulation from retained merchandise revenue",
              },
              {
                label: "Estimated balance",
                value: estimates.reduce((s, c) => s + c.balance, 0),
                note: "Includes local planning adjustments",
              },
              {
                label: "Checkout rewards",
                value: "Not active",
                note: "No points wallet or redemption service connected",
              },
            ]}
          />
          <div className="bi-two">
            <Card title="Earning and redemption draft">
              <div className="bi-fields">
                {field(
                  "perDollar",
                  "Points per retained merchandise dollar",
                  100,
                )}
                {field(
                  "pointsPerDollar",
                  "Points needed for one credit dollar",
                )}
                {field("minPoints", "Minimum redemption points")}
                {field("maxPercent", "Maximum basket discount (%)", 100)}
              </div>
              <label className="bi-check">
                <input
                  type="checkbox"
                  checked={rules.enabled}
                  onChange={(e) =>
                    setRules((r) => ({ ...r, enabled: e.target.checked }))
                  }
                />{" "}
                Include rewards in the launch plan
              </label>
              <ConnectedWorkspaceLink area="programs" />
      <DeviceNote warning={rulesWarning} />
            </Card>
            <Card title="Redemption simulator">
              <div className="bi-fields">
                <label className="bi-field">
                  Sample / recorded customer
                  <select
                    value={buyerId}
                    onChange={(e) => {
                      setBuyerId(e.target.value);
                      setAdjustment(0);
                    }}
                  >
                    {estimates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <NumberField
                  label="Planning adjustment"
                  value={adjustment}
                  min={-1000000}
                  max={1000000}
                  onChange={(n) => setAdjustment(n ?? 0)}
                />
                <NumberField
                  label="Test merchandise basket"
                  value={basket}
                  suffix="USD"
                  onChange={(n) => setBasket(n ?? 0)}
                />
              </div>
              <Button
                disabled={!selected}
                onClick={() => {
                  setRules((r) => ({
                    ...r,
                    adjustments: {
                      ...r.adjustments,
                      [buyerId]:
                        (r.adjustments[buyerId] ?? 0) + Math.trunc(adjustment),
                    },
                  }));
                  setAdjustment(0);
                  setMessage(
                    "Planning adjustment saved. No wallet balance was changed.",
                  );
                }}
              >
                Apply adjustment to plan
              </Button>
              <p className="bi-big">
                {formatMoney(
                  Math.min(
                    selected?.credit ?? 0,
                    (basket * rules.maxPercent) / 100,
                  ),
                )}
              </p>
              <p className="bi-small">
                Possible credit under this draft: minimum points, available
                estimated balance and the basket cap all apply. This simulator
                does not redeem points or discount an order.
              </p>
            </Card>
          </div>
          <Card
            title="Reward balance simulation"
            meta={
              <ExportButton
                name="reward-simulation"
                headers={[
                  "Customer",
                  "Retained merchandise",
                  "Earned points estimate",
                  "Local balance estimate",
                  "Credit estimate",
                ]}
                rows={rewardRows.map((c) => [
                  c.name,
                  c.net,
                  c.earned,
                  c.balance,
                  c.credit,
                ])}
              />
            }
          >
            <label className="bi-field">
              Find a customer
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <Table
              label="Estimated reward balances"
              rows={rewardRows}
              rowKey={(c) => c.id}
              columns={[
                {
                  key: "name",
                  label: "Customer",
                  get: (c) => <CustomerLink id={c.id}>{c.name}</CustomerLink>,
                },
                {
                  key: "net",
                  label: "Net merchandise",
                  get: (c) => formatMoney(c.net),
                  sort: (c) => c.net,
                  numeric: true,
                },
                {
                  key: "earned",
                  label: "Estimated earned",
                  get: (c) => c.earned,
                  numeric: true,
                },
                {
                  key: "balance",
                  label: "Planned balance",
                  get: (c) => c.balance,
                  numeric: true,
                },
                {
                  key: "credit",
                  label: "Potential credit",
                  get: (c) => formatMoney(c.credit),
                  numeric: true,
                },
              ]}
            />
          </Card>
          <p className="bi-small">
            Past redemption history and point expiry are not recorded in the
            current platform. Estimated balances cannot be used as actual wallet
            liabilities. Refunds reduce retained-merchandise estimates; shipping
            and tax do not earn points in this draft.
          </p>
        </>
      )}
      {tab === "memberships" && (
        <>
          <Card
            title="Tier definitions"
            meta={
              <Button
                onClick={() =>
                  setTier({
                    id: crypto.randomUUID(),
                    name: "",
                    threshold: 0,
                    discount: 0,
                    note: "",
                  })
                }
              >
                Create tier draft
              </Button>
            }
            flush
          >
            <Table
              label="Membership tier drafts"
              rows={sortedTiers}
              rowKey={(t) => t.id}
              onSelect={setTier}
              columns={[
                {
                  key: "name",
                  label: "Tier",
                  get: (t) => (
                    <>
                      {t.name}
                      <span className="bi-cell-note">{t.note}</span>
                    </>
                  ),
                },
                {
                  key: "threshold",
                  label: "Recorded spend threshold",
                  get: (t) => formatMoney(t.threshold),
                  numeric: true,
                },
                {
                  key: "discount",
                  label: "Discount assumption",
                  get: (t) => `${t.discount}%`,
                  numeric: true,
                },
                {
                  key: "state",
                  label: "State",
                  get: () => "Draft · not active",
                },
              ]}
            />
          </Card>
          <Card title="Qualification preview" flush>
            <Table
              label="Membership qualification simulation"
              rows={membership}
              rowKey={(c) => c.id}
              columns={[
                {
                  key: "name",
                  label: "Customer",
                  get: (c) => <CustomerLink id={c.id}>{c.name}</CustomerLink>,
                },
                {
                  key: "ltv",
                  label: "Recorded net revenue",
                  get: (c) => formatMoney(c.ltv),
                  sort: (c) => c.ltv,
                  numeric: true,
                },
                {
                  key: "tier",
                  label: "Would qualify for",
                  get: (c) => c.tier?.name ?? "No tier",
                },
                {
                  key: "state",
                  label: "Assignment",
                  get: () => "Preview only",
                },
              ]}
            />
          </Card>
          <DeviceNote warning={tiersWarning} />
          <HelpCard title="Qualification does not activate a membership">
            <p>
              These tiers model cumulative recorded net revenue, not a paid
              subscription. Review eligibility, stacking and benefits before a
              shared membership service changes prices or grants benefits.
            </p>
            <Link className="bi-link" to="/admin/discounts">
              Manage existing discount codes ↗
            </Link>
          </HelpCard>
        </>
      )}
      {tab === "wholesale" && (
        <>
          <div className="bi-toolbar">
            <Button
              variant="primary"
              onClick={() =>
                setInquiry({
                  id: crypto.randomUUID(),
                  name: "",
                  email: "",
                  institution: "",
                  units: 0,
                  status: "New",
                  note: "",
                  request: "",
                })
              }
            >
              Record inquiry draft
            </Button>
            <label className="bi-field">
              Find an inquiry
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, institution or state"
              />
            </label>
          </div>
          <Card
            title="Wholesale inquiry plan"
            meta={
              <ExportButton
                name="wholesale-inquiry-plan"
                headers={[
                  "Name",
                  "Email",
                  "Institution",
                  "Requested units",
                  "Review state",
                  "Request",
                  "Private draft note",
                ]}
                rows={inquiries
                  .filter((i) =>
                    `${i.name} ${i.institution} ${i.status}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((i) => [
                    i.name,
                    i.email,
                    i.institution,
                    i.units,
                    i.status,
                    i.request,
                    i.note,
                  ])}
              />
            }
            flush
          >
            <Table
              label="Local wholesale inquiry drafts"
              rows={inquiries.filter((i) =>
                `${i.name} ${i.institution} ${i.status}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )}
              rowKey={(i) => i.id}
              onSelect={setInquiry}
              columns={[
                {
                  key: "name",
                  label: "Contact",
                  get: (i) => (
                    <>
                      {i.name}
                      <span className="bi-cell-note">{i.institution}</span>
                    </>
                  ),
                },
                {
                  key: "units",
                  label: "Requested units",
                  get: (i) => i.units || "Not specified",
                  numeric: true,
                },
                { key: "status", label: "Review state", get: (i) => i.status },
              ]}
            />
          </Card>
          <DeviceNote warning={inquiryWarning} />
          <p className="bi-small">
            {LIVE
              ? "This local inquiry plan is not a shared inbox."
              : "Initial inquiries are fictional sample records."}{" "}
            Status and notes stay on this device. A response is a draft; no
            email, quote, account approval or pricing change is sent from this
            page.
          </p>
        </>
      )}
      {tab === "import" && (
        <Card title="Customer migration preview">
          <ContactImport kind="customers" existing={data.buyers} />
        </Card>
      )}
      {tier && (
        <Drawer
          title="Membership tier draft"
          onClose={() => setTier(null)}
          footer={
            <Button
              variant="primary"
              disabled={!tier.name.trim()}
              onClick={() => {
                setTiers((t) => [
                  ...t.filter((x) => x.id !== tier.id).slice(-19),
                  tier,
                ]);
                setTier(null);
                setMessage(
                  "Tier draft saved. No membership benefits were activated.",
                );
              }}
            >
              Save tier draft
            </Button>
          }
        >
          <div className="bi-form">
            <label className="bi-field">
              Tier name
              <input
                value={tier.name}
                maxLength={80}
                onChange={(e) => setTier({ ...tier, name: e.target.value })}
              />
            </label>
            <NumberField
              label="Cumulative net revenue threshold"
              value={tier.threshold}
              suffix="USD"
              onChange={(n) => setTier({ ...tier, threshold: n ?? 0 })}
            />
            <NumberField
              label="Discount assumption"
              value={tier.discount}
              max={100}
              suffix="%"
              onChange={(n) => setTier({ ...tier, discount: n ?? 0 })}
            />
            <label className="bi-field">
              Benefit / qualification notes
              <textarea
                rows={4}
                value={tier.note}
                maxLength={2000}
                onChange={(e) => setTier({ ...tier, note: e.target.value })}
              />
            </label>
            <DeviceNote />
          </div>
        </Drawer>
      )}
      {inquiry && (
        <Drawer
          title="Wholesale inquiry draft"
          onClose={() => setInquiry(null)}
          footer={
            <Button
              variant="primary"
              disabled={
                !inquiry.name.trim() ||
                !validEmail(inquiry.email) ||
                !inquiry.institution.trim()
              }
              onClick={() => {
                setInquiries((r) => [
                  ...r.filter((x) => x.id !== inquiry.id).slice(-99),
                  inquiry,
                ]);
                setInquiry(null);
                setMessage(
                  "Inquiry plan saved on this device. No response was sent.",
                );
              }}
            >
              Save inquiry draft
            </Button>
          }
        >
          <div className="bi-form">
            {(["name", "email", "institution"] as const).map((key) => (
              <label className="bi-field" key={key}>
                {key === "name"
                  ? "Contact name"
                  : key === "email"
                    ? "Email"
                    : "Institution"}
                <input
                  type={key === "email" ? "email" : "text"}
                  value={inquiry[key]}
                  maxLength={254}
                  onChange={(e) =>
                    setInquiry({ ...inquiry, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <NumberField
              label="Requested units"
              value={inquiry.units}
              onChange={(n) => setInquiry({ ...inquiry, units: n ?? 0 })}
            />
            <label className="bi-field">
              Review state
              <select
                value={inquiry.status}
                onChange={(e) =>
                  setInquiry({ ...inquiry, status: e.target.value })
                }
              >
                {["New", "Reviewing", "Responded", "Closed"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="bi-field">
              Inquiry
              <textarea
                value={inquiry.request}
                rows={4}
                maxLength={4000}
                onChange={(e) =>
                  setInquiry({ ...inquiry, request: e.target.value })
                }
              />
            </label>
            <label className="bi-field">
              Review / response draft
              <textarea
                value={inquiry.note}
                rows={5}
                maxLength={4000}
                onChange={(e) =>
                  setInquiry({ ...inquiry, note: e.target.value })
                }
              />
            </label>
            <DeviceNote />
          </div>
        </Drawer>
      )}
      <p className="bi-small" role="status">
        {message}
      </p>
    </div>
  );
}
