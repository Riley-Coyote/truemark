import { useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
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
import { live } from "../../platform/live/runtime";
import { store, useResource } from "../../platform/store";
import type {
  Campaign,
  MarketingDelivery,
  MarketingFlow,
  MembershipTier,
  ProgramSettings,
} from "../../platform/live/programs";
import { analyze } from "./model";
import { Kpis, useDateRange, NumberField, Table, useBusiness } from "./shared";
import { useSearchParams } from "react-router-dom";
import { contactImport } from "./workflows";

const CONNECTED = "https://riley-coyote.github.io/truemark/live/";
export function ConnectedWorkspaceLink({
  area,
}: {
  area: "marketing" | "programs";
}) {
  return (
    <p className="bi-source">
      This walkthrough uses fictional records.{" "}
      <a href={`${CONNECTED}#/admin/${area}`} target="_blank" rel="noreferrer">
        Open the connected test workspace ↗
      </a>{" "}
      to use shared records with a team account. Payments and marketing delivery
      are simulated during testing.
    </p>
  );
}
function useTab(fallback: string, allowed: string[]) {
  const [p, set] = useSearchParams();
  const current = p.get("tab") ?? fallback;
  return [
    allowed.includes(current) ? current : fallback,
    (value: string) =>
      set(
        (old) => {
          const q = new URLSearchParams(old);
          q.set("tab", value);
          return q;
        },
        { replace: true },
      ),
  ] as const;
}
function useAction() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function run(action: () => Promise<string | void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setMessage((await action()) || "Saved to the shared workspace.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The change could not be saved. Reload and try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    busy,
    run,
    notice: (
      <>
        {error && (
          <p role="alert" className="bi-warning">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="bi-source">
            {message}
          </p>
        )}
      </>
    ),
  };
}
function Load({ error, reload }: { error?: Error | null; reload: () => void }) {
  return error ? (
    <EmptyState
      title="Shared records couldn’t be loaded."
      note={error.message}
      action={<Button onClick={reload}>Try again</Button>}
    />
  ) : (
    <p role="status">Loading shared records…</p>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="bi-field">
      {label}
      {children}
    </label>
  );
}

type ProgramApi = ReturnType<typeof live>["programs"];
export function ConnectedPrograms({
  api = live().programs,
  fixtureOwner = false,
}: { api?: ProgramApi; fixtureOwner?: boolean } = {}) {
  const business = useBusiness(),
    result = useResource(() => api.dashboard()),
    identity = useResource(() =>
      fixtureOwner
        ? Promise.resolve({ role: "owner" as const, id: "fixture" })
        : store.assistant.identity(),
    );
  const [tab, setTab] = useTab("rewards", ["rewards", "memberships", "ledger"]);
  const action = useAction();
  const [tier, setTier] = useState<Partial<MembershipTier> | null>(null),
    [buyer, setBuyer] = useState(""),
    [points, setPoints] = useState(0),
    [reason, setReason] = useState("");
  const request = useRef(crypto.randomUUID());
  if (!result.data) return <Load error={result.error} reload={result.reload} />;
  const { settings, tiers, wallets, ledger } = result.data;
  const owner = identity.data?.role === "owner";
  const label = (id: string) =>
    business.buyers.find((b) => b.id === id)?.name ?? id;
  return (
    <div className="bi-page">
      <PageHeader description="Shared rewards, order-linked point history and spend-qualified membership benefits." />
      <p className="bi-source">
        Connected workspace · saved to the database. Benefits are checked at
        checkout. Memberships use retained merchandise spend; points earn only
        after a captured payment. Changes apply to new orders.
      </p>
      <Segmented
        label="Customer programs"
        value={tab}
        onChange={setTab}
        options={[
          { value: "rewards", label: "Rewards" },
          { value: "memberships", label: "Memberships" },
          { value: "ledger", label: "Point ledger" },
        ]}
      />
      {action.notice}
      {!owner && (
        <p className="bi-small">
          Owner access is required to change program rules, tiers or point
          balances. Team members can inspect them.
        </p>
      )}
      {tab === "rewards" && (
        <>
          <ProgramSettingsForm
            key={settings.version}
            settings={settings}
            owner={owner}
            busy={action.busy}
            save={(s) =>
              void action.run(async () => {
                await api.saveSettings(s);
              })
            }
          />
          <Card title="Customer wallets">
            <Table
              label="Shared reward balances"
              rows={wallets}
              rowKey={(w) => w.buyerId}
              columns={[
                {
                  key: "buyer",
                  label: "Customer",
                  get: (w) => label(w.buyerId),
                },
                {
                  key: "points",
                  label: "Ledger balance",
                  get: (w) => w.balance,
                  numeric: true,
                },
                {
                  key: "credit",
                  label: "Available credit",
                  get: (w) =>
                    formatMoney(w.available / settings.points_per_dollar),
                  numeric: true,
                },
                {
                  key: "spend",
                  label: "Qualifying spend",
                  get: (w) => formatMoney(w.spend),
                  numeric: true,
                },
                {
                  key: "tier",
                  label: "Membership",
                  get: (w) => w.tier?.name ?? "No active tier",
                },
              ]}
            />
          </Card>
          <Card title="Audited point adjustment">
            <form
              className="bi-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(async () => {
                  await api.adjust(buyer, points, reason, request.current);
                  request.current = crypto.randomUUID();
                  setPoints(0);
                  setReason("");
                  return "Adjustment recorded once in the shared ledger.";
                });
              }}
            >
              <fieldset disabled={!owner || action.busy} className="bi-form">
                <Field label="Verified customer">
                  <select
                    required
                    value={buyer}
                    onChange={(e) => {
                      setBuyer(e.target.value);
                      request.current = crypto.randomUUID();
                    }}
                  >
                    <option value="">Choose a customer</option>
                    {business.buyers
                      .filter((b) => b.status === "verified")
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <NumberField
                  label="Points to add or remove"
                  value={points}
                  min={-1000000}
                  max={1000000}
                  step={1}
                  onChange={(n) => {
                    setPoints(Math.trunc(n ?? 0));
                    request.current = crypto.randomUUID();
                  }}
                />
                <Field label="Audit reason">
                  <input
                    required
                    minLength={3}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      request.current = crypto.randomUUID();
                    }}
                  />
                </Field>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!buyer || !points || reason.trim().length < 3}
                >
                  Record adjustment
                </Button>
              </fieldset>
            </form>
          </Card>
        </>
      )}
      {tab === "memberships" && (
        <>
          <Card
            title="Spend-based membership tiers"
            meta={
              <Button
                disabled={!owner || action.busy}
                onClick={() =>
                  setTier({
                    id: crypto.randomUUID(),
                    name: "",
                    threshold: 0,
                    discount: 0,
                    note: "",
                    active: true,
                  })
                }
              >
                Create tier
              </Button>
            }
          >
            <p className="bi-small">
              The highest active qualifying tier applies automatically. Checkout
              uses the larger of the tier benefit or a promotion, then any
              eligible reward credit. Refunds reduce future qualification. These
              memberships have no subscription fees.
            </p>
            <div className="bi-toolbar">
              <p className="bi-source">
                Membership pricing is{" "}
                {settings.memberships_enabled ? "enabled" : "paused"}.
              </p>
              <Button
                disabled={!owner || action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await api.saveSettings({
                      ...settings,
                      memberships_enabled: !settings.memberships_enabled,
                    });
                  })
                }
              >
                {settings.memberships_enabled
                  ? "Pause membership pricing"
                  : "Enable membership pricing"}
              </Button>
            </div>
            <Table
              label="Shared membership tiers"
              rows={[...tiers].sort((a, b) => a.threshold - b.threshold)}
              rowKey={(t) => t.id}
              onSelect={(t) => setTier(t)}
              columns={[
                { key: "name", label: "Tier", get: (t) => t.name },
                {
                  key: "threshold",
                  label: "Lifetime merchandise spend",
                  get: (t) => formatMoney(t.threshold),
                  numeric: true,
                },
                {
                  key: "discount",
                  label: "Benefit",
                  get: (t) => `${t.discount}%`,
                  numeric: true,
                },
                {
                  key: "active",
                  label: "Status",
                  get: (t) => (t.active ? "Active" : "Paused"),
                },
                { key: "note", label: "Note", get: (t) => t.note },
              ]}
            />
          </Card>
          <Card title="Current qualification">
            <Table
              label="Customer memberships"
              rows={wallets}
              rowKey={(w) => w.buyerId}
              columns={[
                {
                  key: "name",
                  label: "Customer",
                  get: (w) => label(w.buyerId),
                },
                {
                  key: "spend",
                  label: "Qualifying spend",
                  get: (w) => formatMoney(w.spend),
                  numeric: true,
                },
                {
                  key: "tier",
                  label: "Membership",
                  get: (w) => w.tier?.name ?? "No active tier",
                },
                {
                  key: "discount",
                  label: "Benefit",
                  get: (w) => `${w.tier?.discount ?? 0}%`,
                  numeric: true,
                },
              ]}
            />
          </Card>
        </>
      )}
      {tab === "ledger" && (
        <Card title="Immutable point history">
          <p className="bi-small">
            Checkout reserves redeemed points immediately. Unpaid cancellation
            or expiry returns them; refunds return redeemed points
            proportionally and reverse unearned points. Refunds after spending
            can leave a negative balance, which blocks redemption until
            replenished. Shipping, insurance and tax earn no points.
          </p>
          <Table
            label="Reward ledger"
            rows={ledger}
            rowKey={(l) => l.id}
            columns={[
              {
                key: "at",
                label: "Recorded",
                get: (l) => formatDateTime(l.created_at),
              },
              {
                key: "buyer",
                label: "Customer",
                get: (l) => label(l.buyer_id),
              },
              {
                key: "kind",
                label: "Entry",
                get: (l) => l.kind.replaceAll("_", " "),
              },
              {
                key: "points",
                label: "Points",
                get: (l) => l.points,
                numeric: true,
              },
              { key: "note", label: "Reason / order", get: (l) => l.note },
            ]}
          />
        </Card>
      )}
      {tier && (
        <Drawer
          onClose={() => setTier(null)}
          title={
            tier?.version ? "Edit membership tier" : "Create membership tier"
          }
        >
          {tier && (
            <form
              className="bi-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(async () => {
                  await api.saveTier(tier);
                  setTier(null);
                });
              }}
            >
              <fieldset disabled={!owner || action.busy} className="bi-form">
                <Field label="Tier name">
                  <input
                    required
                    maxLength={80}
                    value={tier.name}
                    onChange={(e) => setTier({ ...tier, name: e.target.value })}
                  />
                </Field>
                <NumberField
                  label="Lifetime merchandise spend · USD"
                  value={tier.threshold ?? 0}
                  min={0}
                  max={100000000}
                  onChange={(n) => setTier({ ...tier, threshold: n ?? 0 })}
                />
                <NumberField
                  label="Checkout benefit · %"
                  value={tier.discount ?? 0}
                  min={0}
                  max={100}
                  onChange={(n) => setTier({ ...tier, discount: n ?? 0 })}
                />
                <Field label="Tier note">
                  <textarea
                    maxLength={500}
                    value={tier.note}
                    onChange={(e) => setTier({ ...tier, note: e.target.value })}
                  />
                </Field>
                <label className="bi-check">
                  <input
                    type="checkbox"
                    checked={tier.active}
                    onChange={(e) =>
                      setTier({ ...tier, active: e.target.checked })
                    }
                  />
                  Active tier
                </label>
                <Button type="submit" variant="primary">
                  Save shared tier
                </Button>
              </fieldset>
              {action.notice}
            </form>
          )}
        </Drawer>
      )}
    </div>
  );
}
function ProgramSettingsForm({
  settings,
  owner,
  busy,
  save,
}: {
  settings: ProgramSettings;
  owner: boolean;
  busy: boolean;
  save: (s: ProgramSettings) => void;
}) {
  const [draft, set] = useState(settings);
  return (
    <Card title="Program rules">
      <form
        className="bi-form"
        onSubmit={(e) => {
          e.preventDefault();
          save(draft);
        }}
      >
        <fieldset className="bi-form" disabled={!owner || busy}>
          <div className="bi-toolbar">
            <label className="bi-check">
              <input
                type="checkbox"
                checked={draft.rewards_enabled}
                onChange={(e) =>
                  set({ ...draft, rewards_enabled: e.target.checked })
                }
              />
              Enable rewards
            </label>
            <label className="bi-check">
              <input
                type="checkbox"
                checked={draft.memberships_enabled}
                onChange={(e) =>
                  set({ ...draft, memberships_enabled: e.target.checked })
                }
              />
              Enable membership pricing
            </label>
          </div>
          <div className="bi-fields">
            <NumberField
              label="Points earned per USD of merchandise"
              min={0}
              max={1000}
              value={draft.earn_per_dollar}
              onChange={(n) => set({ ...draft, earn_per_dollar: n ?? 0 })}
            />
            <NumberField
              label="Points per USD of credit"
              min={1}
              max={1000000}
              step={1}
              value={draft.points_per_dollar}
              onChange={(n) => set({ ...draft, points_per_dollar: n ?? 0 })}
            />
            <NumberField
              label="Minimum points to redeem"
              min={0}
              max={100000000}
              step={1}
              value={draft.min_points}
              onChange={(n) => set({ ...draft, min_points: n ?? 0 })}
            />
            <NumberField
              label="Maximum merchandise covered · %"
              min={0}
              max={100}
              value={draft.max_percent}
              onChange={(n) => set({ ...draft, max_percent: n ?? 0 })}
            />
          </div>
          <p className="bi-small">
            Credit redeems in whole USD increments. Point value becomes fixed
            after the first ledger entry. Existing orders keep their earning
            rate and pricing; turning rewards off blocks new redemption and
            earning.
          </p>
          <Button type="submit" variant="primary">
            Save shared rules
          </Button>
        </fieldset>
      </form>
    </Card>
  );
}

export function ConnectedMarketing({
  api = live().programs,
}: { api?: ProgramApi } = {}) {
  const business = useBusiness(),
    range = useDateRange(),
    report = range.window ? analyze(business, range.window) : null;
  const result = useResource(() => api.marketing()),
    action = useAction();
  const [tab, setTab] = useTab("campaigns", [
    "performance",
    "campaigns",
    "flows",
    "subscribers",
    "deliveries",
  ]);
  const [campaign, setCampaign] = useState<Partial<Campaign> | null>(null),
    [flow, setFlow] = useState<MarketingFlow | null>(null),
    [delivery, setDelivery] = useState<MarketingDelivery | null>(null);
  const [schedule, setSchedule] = useState(""),
    [csv, setCsv] = useState(""),
    [contact, setContact] = useState({
      name: "",
      email: "",
      source: "",
      consent_at: "",
    });
  if (!result.data) return <Load error={result.error} reload={result.reload} />;
  const { contacts, campaigns, flows, deliveries } = result.data;
  const recipient = (id: string) =>
    contacts.find((c) => c.id === id)?.email ?? id;
  const newCampaign = () => {
    setCampaign({
      id: crypto.randomUUID(),
      name: "",
      subject: "",
      body: "",
      segment: "all",
      status: "draft",
    });
    setSchedule("");
  };
  return (
    <div className="bi-page">
      <PageHeader description="Shared audiences, campaigns, order-triggered flows and a delivery test outbox." />
      <p className="bi-source">
        Connected workspace · marketing transport: simulator. Queued messages
        are processed every minute, or with Run due messages. The outbox records
        the recipient, content and result; no email or SMS leaves the platform.
      </p>
      <div className="bi-toolbar">
        <Segmented
          label="Marketing workspace"
          value={tab}
          onChange={setTab}
          options={[
            { value: "performance", label: "Performance" },
            { value: "campaigns", label: "Campaigns" },
            { value: "flows", label: "Flows" },
            { value: "subscribers", label: "Subscribers" },
            { value: "deliveries", label: "Test outbox" },
          ]}
        />
        <Button
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              const r = await api.runQueue();
              return `${r.processed} due messages processed by the simulator.`;
            })
          }
        >
          Run due messages
        </Button>
      </div>
      {action.notice}
      {tab === "performance" && (
        <>
          {range.controls}
          {report && (
            <>
              <Kpis
                items={[
                  {
                    label: "Partner-attributed revenue",
                    value: formatMoney(
                      report.channels.find((c) => c.name === "Partners")
                        ?.revenue ?? 0,
                    ),
                    note: "Recorded partner code attribution",
                  },
                  {
                    label: "Other code revenue",
                    value: formatMoney(
                      report.channels.find(
                        (c) => c.name === "Other promo codes",
                      )?.revenue ?? 0,
                    ),
                    note: "A code does not identify an ad channel",
                  },
                  {
                    label: "Simulated deliveries",
                    value: deliveries.filter((d) => d.status === "simulated")
                      .length,
                    note: "Test outbox only; no real opens or clicks",
                  },
                ]}
              />
              <Card title="Recorded code performance">
                <Table
                  label="Order code attribution"
                  rows={report.codes}
                  rowKey={(c) => c.name}
                  columns={[
                    { key: "name", label: "Code", get: (c) => c.name },
                    {
                      key: "paid",
                      label: "Captured orders",
                      get: (c) => c.paid,
                      numeric: true,
                    },
                    {
                      key: "revenue",
                      label: "Net revenue",
                      get: (c) => formatMoney(c.revenue),
                      numeric: true,
                    },
                    {
                      key: "discount",
                      label: "Total order discounts",
                      get: (c) => formatMoney(c.discounts),
                      numeric: true,
                    },
                  ]}
                />
                <p className="bi-small">
                  No campaign revenue, opens, clicks or ROAS are inferred from
                  simulated deliveries. Code-attributed order revenue uses
                  current refunds and excludes retained tax.
                </p>
              </Card>
            </>
          )}
        </>
      )}
      {tab === "campaigns" && (
        <Card
          title="Shared campaigns"
          meta={<Button onClick={newCampaign}>Create campaign</Button>}
        >
          <p className="bi-small">
            Schedule a consented audience snapshot. Consent and cancellation are
            checked again at delivery. Queued content is fixed; create a new
            draft for a revised campaign.
          </p>
          <Table
            label="Shared campaigns"
            rows={campaigns}
            rowKey={(c) => c.id}
            onSelect={(c) => {
              setCampaign(c);
              setSchedule("");
            }}
            columns={[
              { key: "name", label: "Campaign", get: (c) => c.name },
              {
                key: "audience",
                label: "Audience",
                get: (c) =>
                  c.segment === "buyers"
                    ? "Verified buyers with opt-in"
                    : "All consented subscribers",
              },
              { key: "status", label: "Status", get: (c) => c.status },
              {
                key: "schedule",
                label: "Scheduled",
                get: (c) =>
                  c.scheduled_at
                    ? formatDateTime(c.scheduled_at)
                    : "Not queued",
              },
              {
                key: "sent",
                label: "Simulated / queued",
                get: (c) =>
                  `${deliveries.filter((d) => d.campaign_id === c.id && d.status === "simulated").length} / ${deliveries.filter((d) => d.campaign_id === c.id && d.status === "queued").length}`,
              },
            ]}
          />
        </Card>
      )}
      {tab === "flows" && (
        <Card title="Event-based flows">
          <p className="bi-small">
            Activation starts with new events; it does not backfill old
            customers. Pausing suppresses queued messages. Changes affect future
            enrollments. Abandoned-order flows apply only while an order remains
            payable (normally 30 minutes); use a zero-hour delay to test.
          </p>
          <Table
            label="Shared marketing flows"
            rows={flows}
            rowKey={(f) => f.id}
            onSelect={setFlow}
            columns={[
              { key: "name", label: "Flow", get: (f) => f.name },
              {
                key: "delay",
                label: "Delay",
                get: (f) => `${f.delay_hours} hours`,
              },
              {
                key: "active",
                label: "Status",
                get: (f) => (f.active ? "Active · simulated" : "Paused"),
              },
              {
                key: "entries",
                label: "Enrolled",
                get: (f) => deliveries.filter((d) => d.flow_id === f.id).length,
                numeric: true,
              },
            ]}
          />
        </Card>
      )}
      {tab === "subscribers" && (
        <>
          <Card title="Add an explicitly consented subscriber">
            <form
              className="bi-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(async () => {
                  const n = await api.importContacts([
                    {
                      ...contact,
                      consent_at: new Date(contact.consent_at).toISOString(),
                    },
                  ]);
                  if (n)
                    setContact({
                      name: "",
                      email: "",
                      source: "",
                      consent_at: "",
                    });
                  return n
                    ? "Subscriber saved with consent evidence."
                    : "Address already exists; its existing consent and suppression were preserved.";
                });
              }}
            >
              <fieldset disabled={action.busy} className="bi-form">
                <div className="bi-fields">
                  <Field label="Subscriber name">
                    <input
                      required
                      maxLength={200}
                      value={contact.name}
                      onChange={(e) =>
                        setContact({ ...contact, name: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Subscriber email">
                    <input
                      type="email"
                      required
                      maxLength={254}
                      value={contact.email}
                      onChange={(e) =>
                        setContact({ ...contact, email: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Opt-in recorded at · your local time">
                    <input
                      type="datetime-local"
                      required
                      value={contact.consent_at}
                      onChange={(e) =>
                        setContact({ ...contact, consent_at: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Explicit opt-in source">
                    <input
                      required
                      minLength={3}
                      maxLength={500}
                      value={contact.source}
                      onChange={(e) =>
                        setContact({ ...contact, source: e.target.value })
                      }
                      placeholder="e.g. Account newsletter preference"
                    />
                  </Field>
                </div>
                <Button type="submit" variant="primary">
                  Save consented subscriber
                </Button>
              </fieldset>
            </form>
          </Card>
          <Card title="Subscribers and suppressions">
            <Table
              label="Shared subscribers"
              rows={contacts}
              rowKey={(c) => c.id}
              columns={[
                {
                  key: "name",
                  label: "Subscriber",
                  get: (c) => (
                    <>
                      {c.name}
                      <span className="bi-cell-note">{c.email}</span>
                    </>
                  ),
                },
                { key: "status", label: "Status", get: (c) => c.status },
                {
                  key: "source",
                  label: "Consent evidence",
                  get: (c) => (
                    <>
                      {c.source}
                      <span className="bi-cell-note">
                        {formatDateTime(c.consent_at)}
                      </span>
                    </>
                  ),
                },
                {
                  key: "action",
                  label: "Action",
                  get: (c) =>
                    c.status === "subscribed" ? (
                      <Button
                        disabled={action.busy}
                        onClick={() =>
                          void action.run(async () => {
                            await api.suppress(c);
                            return "Subscriber suppressed. Queued messages were stopped.";
                          })
                        }
                      >
                        Suppress
                      </Button>
                    ) : (
                      "Renewed opt-in required from their account"
                    ),
                },
              ]}
            />
          </Card>
          <Card title="Import consent records">
            <form
              className="bi-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(async () => {
                  const parsed = contactImport(
                    csv,
                    contacts,
                    "subscribers",
                    new Date().toISOString(),
                  );
                  const bad = parsed.filter((r) => r.problem);
                  if (bad.length)
                    throw Error(
                      `${bad.length} rows need review. Row ${bad[0].line}: ${bad[0].problem}`,
                    );
                  if (parsed.length > 1000)
                    throw Error("Import at most 1,000 rows per batch.");
                  const n = await api.importContacts(
                    parsed.map((r) => ({
                      name: r.name,
                      email: r.email,
                      source: r.source ?? "",
                      consent_at: r.consentAt ?? "",
                    })),
                  );
                  setCsv("");
                  return `${n} consent records saved. Existing suppressions remain unchanged.`;
                });
              }}
            >
              <Field label="Subscriber CSV">
                <textarea
                  rows={6}
                  required
                  maxLength={2000000}
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                  placeholder={
                    "name,email,consent_at,source\nSample Subscriber,subscriber@example.test,2026-10-15T12:00:00Z,Explicit test opt-in"
                  }
                />
              </Field>
              <p className="bi-small">
                Required columns: name, email, consent_at (ISO time), source.
                Validation is atomic; invalid rows or duplicate addresses must
                be resolved before importing.
              </p>
              <Button type="submit" disabled={action.busy || !csv.trim()}>
                Validate and import to backend
              </Button>
            </form>
          </Card>
        </>
      )}
      {tab === "deliveries" && (
        <Card title="Delivery test outbox">
          <Table
            label="Marketing test outbox"
            rows={[...deliveries].sort((a, b) =>
              b.due_at.localeCompare(a.due_at),
            )}
            rowKey={(d) => d.id}
            onSelect={setDelivery}
            columns={[
              {
                key: "recipient",
                label: "Recipient",
                get: (d) => recipient(d.contact_id),
              },
              { key: "subject", label: "Subject", get: (d) => d.subject },
              {
                key: "source",
                label: "Source",
                get: (d) =>
                  d.flow_id ??
                  campaigns.find((c) => c.id === d.campaign_id)?.name ??
                  "Campaign",
              },
              {
                key: "due",
                label: "Due",
                get: (d) => formatDateTime(d.due_at),
              },
              {
                key: "status",
                label: "Result",
                get: (d) =>
                  d.status === "simulated"
                    ? "Delivered to simulator"
                    : d.status,
              },
            ]}
          />
        </Card>
      )}
      {campaign && (
        <Drawer
          onClose={() => setCampaign(null)}
          title={campaign?.version ? "Campaign details" : "Create campaign"}
        >
          {campaign && (
            <>
              <form
                className="bi-form"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  void action.run(async () => {
                    const saved = await api.saveCampaign(campaign);
                    setCampaign(saved);
                    return "Campaign draft saved to the backend.";
                  });
                }}
              >
                <fieldset
                  disabled={action.busy || campaign.status !== "draft"}
                  className="bi-form"
                >
                  <Field label="Campaign name">
                    <input
                      required
                      maxLength={150}
                      value={campaign.name}
                      onChange={(e) =>
                        setCampaign({ ...campaign, name: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Subject">
                    <input
                      required
                      maxLength={200}
                      value={campaign.subject}
                      onChange={(e) =>
                        setCampaign({ ...campaign, subject: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Message body">
                    <textarea
                      required
                      maxLength={20000}
                      rows={9}
                      value={campaign.body}
                      onChange={(e) =>
                        setCampaign({ ...campaign, body: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Audience">
                    <select
                      value={campaign.segment}
                      onChange={(e) =>
                        setCampaign({
                          ...campaign,
                          segment: e.target.value as Campaign["segment"],
                        })
                      }
                    >
                      <option value="all">All consented subscribers</option>
                      <option value="buyers">
                        Verified buyers with explicit opt-in
                      </option>
                    </select>
                  </Field>
                  <Button type="submit" variant="primary">
                    Save shared draft
                  </Button>
                </fieldset>
              </form>
              {campaign.version && campaign.status === "draft" && (
                <div className="bi-form">
                  <Field label="Optional schedule · your local time">
                    <input
                      type="datetime-local"
                      value={schedule}
                      onChange={(e) => setSchedule(e.target.value)}
                    />
                  </Field>
                  <p className="bi-small">
                    Uses the last saved draft. Leave the schedule blank to queue
                    now.
                  </p>
                  <Button
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(async () => {
                        const n = await api.schedule(
                          campaign as Campaign,
                          schedule
                            ? new Date(schedule).toISOString()
                            : new Date().toISOString(),
                        );
                        setCampaign(null);
                        return `${n} consented recipients queued for simulated delivery.`;
                      })
                    }
                  >
                    Queue saved campaign for test delivery
                  </Button>
                </div>
              )}
              {campaign.version &&
                ["draft", "scheduled"].includes(campaign.status ?? "") && (
                  <Button
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(async () => {
                        await api.cancel(campaign as Campaign);
                        setCampaign(null);
                        return "Campaign cancelled; queued messages stopped.";
                      })
                    }
                  >
                    Cancel campaign
                  </Button>
                )}
              {action.notice}
            </>
          )}
        </Drawer>
      )}
      {flow && (
        <Drawer
          onClose={() => setFlow(null)}
          title={flow?.name ?? "Marketing flow"}
        >
          {flow && (
            <form
              className="bi-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(async () => {
                  await api.saveFlow(flow);
                  setFlow(null);
                  return "Shared flow saved. New eligible events will be enrolled by the worker.";
                });
              }}
            >
              <fieldset disabled={action.busy} className="bi-form">
                <Field label="Flow subject">
                  <input
                    required
                    maxLength={200}
                    value={flow.subject}
                    onChange={(e) =>
                      setFlow({ ...flow, subject: e.target.value })
                    }
                  />
                </Field>
                <Field label="Flow message">
                  <textarea
                    required
                    rows={8}
                    maxLength={20000}
                    value={flow.body}
                    onChange={(e) => setFlow({ ...flow, body: e.target.value })}
                  />
                </Field>
                <NumberField
                  label="Delay after event · hours"
                  value={flow.delay_hours}
                  min={0}
                  max={8760}
                  step={1}
                  onChange={(n) => setFlow({ ...flow, delay_hours: n ?? 0 })}
                />
                <label className="bi-check">
                  <input
                    type="checkbox"
                    checked={flow.active}
                    onChange={(e) =>
                      setFlow({ ...flow, active: e.target.checked })
                    }
                  />
                  Active · simulated delivery
                </label>
                <Button type="submit" variant="primary">
                  Save shared flow
                </Button>
              </fieldset>
              {action.notice}
            </form>
          )}
        </Drawer>
      )}
      {delivery && (
        <Drawer onClose={() => setDelivery(null)} title="Test delivery record">
          {delivery && (
            <div className="bi-form">
              <p>{recipient(delivery.contact_id)}</p>
              <p className="bi-source">
                {delivery.status} ·{" "}
                {delivery.processed_at
                  ? formatDateTime(delivery.processed_at)
                  : "Awaiting scheduled processing"}
              </p>
              <h3>{delivery.subject}</h3>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {delivery.body}
              </p>
              <p className="bi-small">{delivery.reason}</p>
              <p className="bi-small">
                Transport: simulator. No external message was sent.
              </p>
            </div>
          )}
        </Drawer>
      )}
    </div>
  );
}
