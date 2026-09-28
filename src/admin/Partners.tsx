import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  Facts,
  MoneyFigure,
  PageHeader,
  SampleTag,
  Section,
  Segmented,
  StatusChip,
  formatCount,
  formatDate,
  formatMoney,
  plural,
  statusLabel,
} from "../app-kit";
import type { Column, RowGroup, Tone } from "../app-kit";
import { store, useResource } from "../platform/store";
import type { PartnerStatus, Payout, Referral } from "../platform/types";
import { Mark, PreviewTag, keepTogether } from "./fields";
import { TODAY_ISO } from "./metrics";
import { HOME } from "./nav";
import { DrawerLoading } from "./OrderDrawer";
import { preview, usePreview } from "./preview";
import type { PayoutBatch } from "./preview";
import { NEXT_PAYOUT, PAYOUT_METHOD, awaitingPayout, partnerRows, payoutHistory, percent } from "./program";
import type { AwaitingLine, PartnerRow, PayoutLine } from "./program";
import { matches, useQueryParam, useSearchQuery } from "./state";

const PARTNER_TONE: Record<PartnerStatus, Tone> = { active: "signal", pending: "pending", paused: "neutral" };
const STATUS_ORDER: PartnerStatus[] = ["pending", "active", "paused"];
const round2 = (n: number) => Math.round(n * 100) / 100;

function PartnerChip({ status }: { status: PartnerStatus }) {
  return <StatusChip status={status} tone={PARTNER_TONE[status]} />;
}

/** A count whose unit prints only on phones, where the column header is gone. */
function Count({ value, one, many }: { value: number; one: string; many: string }) {
  return (
    <>
      {formatCount(value)}
      <span className="cc-unit"> {value === 1 ? one : many}</span>
    </>
  );
}

/** Everything the partner pages read: partners, referrals and payouts, with this preview's changes. */
function useProgram() {
  const partners = useResource(() => store.partners.list(), []);
  const referrals = useResource(() => store.partners.referrals(), []);
  const payouts = useResource(() => store.partners.payouts(), []);
  const changes = usePreview();
  const rows = useMemo(
    () => (partners.data && referrals.data ? partnerRows(partners.data, referrals.data, changes) : undefined),
    [partners.data, referrals.data, changes],
  );
  return {
    rows,
    referrals: referrals.data,
    payouts: payouts.data,
    batches: changes.batches,
    loading: partners.loading || referrals.loading || payouts.loading,
    error: partners.error ?? referrals.error ?? payouts.error,
    reload: () => {
      partners.reload();
      referrals.reload();
      payouts.reload();
    },
  };
}

const partnerColumns: Column<PartnerRow>[] = [
  {
    key: "name",
    header: "Partner",
    width: "17%",
    mobile: "primary",
    sortValue: (r) => r.name,
    cell: (r) => (
      <span className="cc-marked">
        <span className="cc-marked-text">{r.name}</span>
        {r.edited && <Mark>Edited</Mark>}
      </span>
    ),
  },
  { key: "handle", header: "Handle", width: "17%", mobile: "secondary", sortValue: (r) => r.handle, cell: (r) => r.handle },
  { key: "code", header: "Code", width: "12%", mobile: "meta", sortValue: (r) => r.code, cell: (r) => <span className="kit-mono">{r.code}</span> },
  { key: "rate", header: "Rate", width: "8%", align: "end", mobile: "hidden", sortValue: (r) => r.rate, sortFirst: "desc", cell: (r) => percent(r.rate) },
  {
    key: "status",
    header: "Status",
    width: "12%",
    mobile: "meta",
    sortValue: (r) => STATUS_ORDER.indexOf(r.status),
    cell: (r) => <PartnerChip status={r.status} />,
  },
  {
    key: "referrals",
    header: "Referrals",
    width: "11%",
    align: "end",
    mobile: "hidden",
    sortValue: (r) => r.count,
    sortFirst: "desc",
    cell: (r) => <Count value={r.count} one="referral" many="referrals" />,
  },
  {
    key: "revenue",
    header: "Revenue",
    width: "12%",
    align: "end",
    mobile: "hidden",
    sortValue: (r) => r.revenue,
    sortFirst: "desc",
    cell: (r) => (r.revenue ? formatMoney(r.revenue) : <span className="kit-quiet">{formatMoney(0)}</span>),
  },
  {
    key: "owed",
    header: "Owed",
    width: "11%",
    align: "end",
    mobile: "aside",
    sortValue: (r) => r.owed,
    sortFirst: "desc",
    cell: (r) => (
      <span className={r.owed ? undefined : "kit-quiet"}>
        {formatMoney(r.owed)}
        <span className="cc-unit"> owed</span>
      </span>
    ),
  },
];

export default function Partners() {
  const program = useProgram();
  const query = useSearchQuery();
  const [viewParam, setView] = useQueryParam("view");
  const [openId, setOpenId] = useQueryParam("partner");
  const [batchParam, setBatch] = useQueryParam("batch");
  const view = viewParam === "payouts" ? "payouts" : "partners";
  const { rows, batches } = program;

  const sorted = useMemo(
    () => rows && [...rows].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.revenue - a.revenue),
    [rows],
  );
  const shown = useMemo(
    () => sorted?.filter((r) => matches(query, r.name, r.handle, r.code, r.email, r.audience)),
    [sorted, query],
  );
  const awaiting = useMemo(() => (rows ? awaitingPayout(rows, batches) : undefined), [rows, batches]);
  const awaitingTotal = round2((awaiting ?? []).reduce((sum, line) => sum + line.amount, 0));
  const waiting = rows?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div className="kit-grid">
      <PageHeader
        description={
          view === "partners"
            ? "Partners who refer buyers with their code or link. Revenue counts referred subtotals after the code's discount; owed is approved commission not yet paid. Rates are sample terms."
            : "Approved commission waiting to be paid, and every payout sent. Payouts go out by bank transfer on the 5th of each month, a sample schedule."
        }
        meta={
          <>
            {rows && (
              <span>
                {view === "partners"
                  ? `${plural(rows.length, "partner")} · ${formatCount(waiting)} awaiting approval`
                  : `${formatMoney(awaitingTotal)} approved, not yet paid`}
              </span>
            )}
            <PreviewTag />
          </>
        }
      />
      <div className="kit-toolbar">
        <Segmented
          label="Partners or payouts"
          value={view}
          onChange={(value) => setView(value === "partners" ? null : value, { replace: true })}
          options={[
            { value: "partners", label: "Partners" },
            { value: "payouts", label: "Payouts" },
          ]}
        />
        {rows && query && view === "partners" && (
          <p className="cc-result-count" aria-live="polite">
            {plural(shown?.length ?? 0, "result")}
          </p>
        )}
      </div>

      {view === "partners" ? (
        <div className="kit-card kit-span-12">
          <DataTable
            caption="Partners"
            columns={partnerColumns}
            rows={shown}
            rowKey={(r) => r.id}
            loading={program.loading}
            error={program.error}
            onRetry={program.reload}
            onRowClick={(r) => setOpenId(r.id)}
            activeKey={openId}
            skeletonRows={7}
            empty={{ title: "No partners match this search.", note: "Search looks at names, handles, codes and emails." }}
          />
        </div>
      ) : (
        <PayoutsView
          program={program}
          awaiting={awaiting}
          awaitingTotal={awaitingTotal}
          query={query}
          openId={openId}
          onOpenPartner={setOpenId}
          onCreate={() => setBatch("new")}
        />
      )}

      {openId && (
        <PartnerDrawer
          key={openId}
          id={openId}
          row={rows?.find((r) => r.id === openId)}
          payouts={program.payouts}
          batches={batches}
          referrals={program.referrals}
          loading={!rows && !program.error}
          failed={program.error}
          onRetry={program.reload}
          onClose={() => setOpenId(null, { replace: true })}
        />
      )}
      {batchParam === "new" && (
        <BatchDrawer
          awaiting={awaiting}
          count={batches.length}
          loading={!rows && !program.error}
          failed={program.error}
          onRetry={program.reload}
          onClose={() => setBatch(null, { replace: true })}
        />
      )}
    </div>
  );
}

/* ---------- Payouts ---------- */

const awaitingColumns: Column<AwaitingLine>[] = [
  { key: "partner", header: "Partner", width: "22%", mobile: "primary", sortValue: (l) => l.partner.name, cell: (l) => l.partner.name },
  { key: "handle", header: "Handle", width: "20%", mobile: "secondary", sortValue: (l) => l.partner.handle, cell: (l) => l.partner.handle },
  { key: "code", header: "Code", width: "14%", mobile: "meta", sortValue: (l) => l.partner.code, cell: (l) => <span className="kit-mono">{l.partner.code}</span> },
  {
    key: "referrals",
    header: "Referrals",
    width: "12%",
    align: "end",
    mobile: "meta",
    sortValue: (l) => l.referrals.length,
    sortFirst: "desc",
    cell: (l) => <Count value={l.referrals.length} one="referral" many="referrals" />,
  },
  { key: "since", header: "Earliest order", width: "16%", mobile: "meta", sortValue: (l) => l.since, cell: (l) => formatDate(l.since) },
  { key: "amount", header: "Amount", width: "16%", align: "end", mobile: "aside", sortValue: (l) => l.amount, sortFirst: "desc", cell: (l) => formatMoney(l.amount) },
];

function historyColumns(names: Map<string, { name: string; handle: string }>): Column<PayoutLine>[] {
  return [
    {
      key: "partner",
      header: "Partner",
      width: "30%",
      mobile: "primary",
      sortValue: (l) => names.get(l.partnerId)?.name ?? l.partnerId,
      cell: (l) => names.get(l.partnerId)?.name ?? l.partnerId,
    },
    { key: "period", header: "Period", width: "26%", mobile: "secondary", cell: (l) => l.period },
    {
      key: "referrals",
      header: "Referrals",
      width: "12%",
      align: "end",
      mobile: "meta",
      sortValue: (l) => l.referrals,
      sortFirst: "desc",
      cell: (l) => <Count value={l.referrals} one="referral" many="referrals" />,
    },
    { key: "method", header: "Method", width: "14%", mobile: "meta", cell: (l) => l.method },
    { key: "amount", header: "Amount", width: "18%", align: "end", mobile: "aside", sortValue: (l) => l.amount, sortFirst: "desc", cell: (l) => formatMoney(l.amount) },
  ];
}

const runKey = (line: PayoutLine) => `${line.status}:${line.date.slice(0, 10)}`;

function PayoutsView({
  program,
  awaiting,
  awaitingTotal,
  query,
  openId,
  onOpenPartner,
  onCreate,
}: {
  program: ReturnType<typeof useProgram>;
  awaiting: AwaitingLine[] | undefined;
  awaitingTotal: number;
  query: string;
  openId: string | null;
  onOpenPartner: (id: string) => void;
  onCreate: () => void;
}) {
  const { rows, payouts, referrals, batches } = program;
  const names = useMemo(() => new Map((rows ?? []).map((r) => [r.id, r])), [rows]);
  const columns = useMemo(() => historyColumns(names), [names]);
  const history = useMemo(
    () => (payouts && referrals ? payoutHistory(payouts, batches, referrals) : undefined),
    [payouts, referrals, batches],
  );

  const find = (partnerId: string) => {
    const r = names.get(partnerId);
    return matches(query, r?.name, r?.handle, r?.code);
  };
  const awaitingShown = awaiting?.filter((line) => find(line.partner.id));
  const historyShown = history?.filter((line) => find(line.partnerId));

  const groups: RowGroup<PayoutLine>[] = [...new Set((history ?? []).map(runKey))].map((key) => {
    const [status, day] = key.split(":");
    const paid = status === "paid";
    return {
      key,
      label: <StatusChip status={status} tone={paid ? "signal" : "pending"} label={`${paid ? "Paid" : "Scheduled for"} ${formatDate(day)}`} />,
      match: (line: PayoutLine) => runKey(line) === key,
    };
  });

  return (
    <>
      <Card
        className="kit-span-12"
        title="Approved, not yet paid"
        flush
        meta={awaiting && <span className="kit-num">{`${plural(awaiting.length, "partner")} · ${formatMoney(awaitingTotal)}`}</span>}
      >
        <DataTable
          caption="Approved commission awaiting payout"
          columns={awaitingColumns}
          rows={awaitingShown}
          rowKey={(line) => line.partner.id}
          loading={program.loading}
          error={program.error}
          onRetry={program.reload}
          onRowClick={(line) => onOpenPartner(line.partner.id)}
          activeKey={openId}
          stickyHeader={false}
          skeletonRows={3}
          empty={
            query
              ? { title: "No approved commission matches this search." }
              : { title: "Nothing waiting to be paid.", note: "Approved commission appears here until a payout batch holds it." }
          }
        />
        <div className="cc-card-foot">
          <p className="cc-footnote">
            {awaiting?.length
              ? `A batch pays ${formatMoney(awaitingTotal)} by bank transfer on ${formatDate(NEXT_PAYOUT)}, a sample schedule.`
              : "Nothing to batch until more commission is approved."}
          </p>
          <Button variant="primary" onClick={onCreate} disabled={!awaiting?.length}>
            Create payout batch
          </Button>
        </div>
      </Card>

      <Card className="kit-span-12" title="Payout history" flush meta={history && <span>{plural(history.length, "payout")}</span>}>
        <DataTable
          caption="Payout history"
          columns={columns}
          rows={historyShown}
          rowKey={(line) => line.key}
          groups={groups}
          loading={program.loading}
          error={program.error}
          onRetry={program.reload}
          onRowClick={(line) => onOpenPartner(line.partnerId)}
          stickyHeader={false}
          skeletonRows={6}
          empty={{ title: query ? "No payouts match this search." : "No payouts yet." }}
        />
      </Card>
    </>
  );
}

function BatchDrawer({
  awaiting,
  count,
  loading,
  failed,
  onRetry,
  onClose,
}: {
  awaiting: AwaitingLine[] | undefined;
  count: number;
  loading: boolean;
  failed: Error | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  const [created, setCreated] = useState<{ batch: PayoutBatch; lines: AwaitingLine[] } | null>(null);

  if (!created && !awaiting) {
    return (
      <Drawer title="Payout batch" eyebrow="Payouts" onClose={onClose}>
        {loading ? (
          <DrawerLoading />
        ) : failed ? (
          <EmptyState compact title="Commission could not be loaded." note={failed.message} action={<Button onClick={onRetry}>Try again</Button>} />
        ) : null}
      </Drawer>
    );
  }

  // Once created, the batch keeps the lines it was confirmed with; the waiting list is empty by then.
  const source = created ? created.lines : (awaiting ?? []);
  const total = round2(source.reduce((sum, line) => sum + line.amount, 0));
  const referralCount = source.reduce((sum, line) => sum + line.referrals.length, 0);

  if (!created && !source.length) {
    return (
      <Drawer title="Payout batch" eyebrow="Payouts" onClose={onClose}>
        <EmptyState compact title="Nothing waiting to be paid." note="Approved commission appears here until a payout batch holds it." />
      </Drawer>
    );
  }

  function confirm() {
    const batch: PayoutBatch = {
      id: `PB-${NEXT_PAYOUT.slice(2, 4)}${NEXT_PAYOUT.slice(5, 7)}-${String(count + 1).padStart(2, "0")}`,
      createdAt: TODAY_ISO,
      scheduledFor: NEXT_PAYOUT,
      method: PAYOUT_METHOD,
      lines: source.map((line) => ({ partnerId: line.partner.id, referralIds: line.referrals.map((r) => r.id), amount: line.amount })),
      total,
    };
    preview.addBatch(batch);
    setCreated({ batch, lines: source });
  }

  const partnersText = plural(source.length, "partner");
  const footer = created ? (
    <div className="cc-confirm-actions cc-foot-row">
      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
      <PreviewTag />
    </div>
  ) : (
    <div className="cc-confirm" role="group" aria-label="Confirm the payout batch">
      <p className="cc-confirm-text">
        Pay {formatMoney(total)} to {partnersText} by bank transfer on {keepTogether(formatDate(NEXT_PAYOUT))}?
      </p>
      <div className="cc-confirm-actions cc-foot-row">
        <Button variant="primary" onClick={confirm}>
          Confirm payout batch
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        <PreviewTag />
      </div>
    </div>
  );

  return (
    <Drawer
      mono={Boolean(created)}
      title={created ? created.batch.id : "New payout batch"}
      eyebrow="Payout batch"
      subtitle={`${created ? "Scheduled for" : "Pays on"} ${formatDate(NEXT_PAYOUT)} · ${PAYOUT_METHOD}`}
      tags={
        <>
          <StatusChip status={created ? "scheduled" : "draft"} tone={created ? "pending" : "neutral"} />
          <SampleTag>Sample schedule</SampleTag>
        </>
      }
      footer={footer}
      onClose={onClose}
    >
      <div className="cc-live" aria-live="polite">
        {created && (
          <p className="kit-note">
            Payout batch <span className="kit-mono">{created.batch.id}</span> created: {formatMoney(created.batch.total)} to{" "}
            {partnersText}, scheduled for {keepTogether(formatDate(created.batch.scheduledFor))}.
          </p>
        )}
      </div>

      <dl className="cc-figures">
        <div>
          <dt className="kit-label">Total</dt>
          <dd className="kit-figure">
            <MoneyFigure value={total} />
          </dd>
        </div>
        <div>
          <dt className="kit-label">Referrals</dt>
          <dd className="kit-figure">{formatCount(referralCount)}</dd>
        </div>
      </dl>

      <Section title="Partners in this batch">
        <ul className="cc-batch">
          {source.map((line) => (
            <li key={line.partner.id}>
              <div className="cc-line-main">
                <span className="cc-line-name">
                  {line.partner.name} <span className="kit-quiet">{line.partner.handle}</span>
                </span>
                <span className="cc-line-qty">
                  <span className="kit-mono">{line.partner.code}</span> ·{" "}
                  {line.referrals.length === 1
                    ? `1 referral, ${formatDate(line.since)}`
                    : `${plural(line.referrals.length, "referral")} from ${formatDate(line.since)}`}
                </span>
              </div>
              <span className="cc-line-total kit-num">{formatMoney(line.amount)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="What the batch holds">
        <p className="cc-prose">
          Commission approved through {formatDate(TODAY_ISO)}. It stays owed to each partner until the transfer is sent;
          commission approved later waits for the next batch.
        </p>
      </Section>
    </Drawer>
  );
}

/* ---------- One partner ---------- */

type Change = { to: PartnerStatus; label: string; confirm: string; text: string };

function changeFor(row: PartnerRow): Change {
  if (row.status === "pending") {
    return {
      to: "active",
      label: "Approve partner",
      confirm: "Confirm approval",
      text: `Approve ${row.name}? Their code ${row.code} will work at checkout.`,
    };
  }
  if (row.status === "active") {
    return {
      to: "paused",
      label: "Pause partner",
      confirm: "Confirm pause",
      text: `Pause ${row.name}? Their code ${row.code} will stop working at checkout. Commission already approved stays owed.`,
    };
  }
  return {
    to: "active",
    label: "Resume partner",
    confirm: "Confirm resume",
    text: `Resume ${row.name}? Their code ${row.code} will work at checkout again.`,
  };
}

/** A fixed list, newest first, like the orders in a customer's drawer. */
const referralColumns: Column<Referral>[] = [
  { key: "order", header: "Order", width: "22%", mobile: "primary", cell: (r) => <span className="kit-mono">{r.orderNumber}</span> },
  { key: "placed", header: "Placed", width: "26%", mobile: "meta", cell: (r) => formatDate(r.createdAt) },
  { key: "commission", header: "Earned", width: "22%", align: "end", mobile: "aside", cell: (r) => formatMoney(r.commission) },
  { key: "status", header: "Status", width: "30%", mobile: "secondary", cell: (r) => <StatusChip status={r.status} /> },
];

const payoutColumns: Column<PayoutLine>[] = [
  { key: "period", header: "Period", width: "22%", mobile: "primary", cell: (l) => l.period },
  { key: "referrals", header: "Referrals", width: "24%", align: "end", mobile: "meta", cell: (l) => <Count value={l.referrals} one="referral" many="referrals" /> },
  { key: "amount", header: "Amount", width: "20%", align: "end", mobile: "aside", cell: (l) => formatMoney(l.amount) },
  {
    key: "status",
    header: "Status",
    width: "34%",
    mobile: "secondary",
    cell: (l) =>
      l.status === "scheduled" ? (
        <StatusChip status="scheduled" tone="pending" label={`Due ${formatDate(l.date)}`} />
      ) : (
        <StatusChip status="paid" label={`Paid ${formatDate(l.date)}`} />
      ),
  },
];

function PartnerDrawer({
  id,
  row,
  payouts,
  batches,
  referrals,
  loading,
  failed,
  onRetry,
  onClose,
}: {
  id: string;
  row: PartnerRow | undefined;
  payouts: Payout[] | undefined;
  batches: PayoutBatch[];
  referrals: Referral[] | undefined;
  loading: boolean;
  failed: Error | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<Change | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const history = useMemo(
    () => (payouts && referrals ? payoutHistory(payouts, batches, referrals).filter((line) => line.partnerId === id) : []),
    [payouts, referrals, batches, id],
  );

  if (!row) {
    return (
      <Drawer title="Partner" eyebrow="Partner" onClose={onClose}>
        {loading ? (
          <DrawerLoading />
        ) : failed ? (
          <EmptyState compact title="This partner could not be loaded." note={failed.message} action={<Button onClick={onRetry}>Try again</Button>} />
        ) : (
          <EmptyState compact title="No partner matches this link." />
        )}
      </Drawer>
    );
  }

  const change = changeFor(row);

  function apply(next: Change) {
    if (!row) return;
    preview.setPartnerStatus(row.id, next.to);
    setPending(null);
    setMessage(`${row.name} is now ${statusLabel(next.to).toLowerCase()} in this preview.`);
  }

  const footer = pending ? (
    <div className="cc-confirm" role="group" aria-label="Confirm the change">
      <p className="cc-confirm-text">{pending.text}</p>
      <div className="cc-confirm-actions cc-foot-row">
        <Button variant="primary" onClick={() => apply(pending)}>
          {pending.confirm}
        </Button>
        <Button onClick={() => setPending(null)}>Cancel</Button>
        <PreviewTag />
      </div>
    </div>
  ) : (
    <div className="cc-confirm-actions cc-foot-row">
      <Button
        variant={change.to === "paused" ? "quiet" : "primary"}
        onClick={() => {
          setMessage(null);
          setPending(change);
        }}
      >
        {change.label}
      </Button>
      <PreviewTag />
    </div>
  );

  return (
    <Drawer
      title={row.name}
      eyebrow="Partner"
      subtitle={`${row.handle} · ${row.audience}`}
      tags={
        <>
          <PartnerChip status={row.status} />
          {row.edited && <Mark>Edited</Mark>}
          <span className="cc-tag-text">Joined {formatDate(row.joinedAt)}</span>
        </>
      }
      footer={footer}
      onClose={onClose}
    >
      <div className="cc-live" aria-live="polite">
        {message && <p className="kit-note">{message}</p>}
      </div>

      <dl className="cc-figures">
        <div>
          <dt className="kit-label">Owed</dt>
          <dd className="kit-figure">
            <MoneyFigure value={row.owed} />
          </dd>
        </div>
        <div>
          <dt className="kit-label">Paid to date</dt>
          <dd className="kit-figure">
            <MoneyFigure value={row.paid} />
          </dd>
        </div>
      </dl>

      <Section title="Terms">
        <Facts
          items={[
            {
              label: "Code",
              value: (
                <Link className="cc-inline-link" to={`${HOME}/discounts?code=${encodeURIComponent(row.code)}`}>
                  <span className="kit-mono">{row.code}</span>
                </Link>
              ),
            },
            {
              label: "Commission",
              value: (
                <span className="cc-fact-line">
                  {percent(row.rate)} of the order subtotal after discount <SampleTag>Sample rate</SampleTag>
                </span>
              ),
            },
            { label: "Buyer discount", value: `${percent(row.codeDiscount)} off the order subtotal` },
            {
              label: "Payouts",
              value: (
                <span className="cc-fact-line">
                  {PAYOUT_METHOD} on the 5th of each month <SampleTag>Sample schedule</SampleTag>
                </span>
              ),
            },
          ]}
        />
      </Section>

      <Section title="Profile">
        <Facts
          items={[
            { label: "Name", value: row.name },
            { label: "Handle", value: row.handle },
            { label: "Email", value: row.email },
            { label: "Audience", value: row.audience },
            { label: "Joined", value: formatDate(row.joinedAt) },
          ]}
        />
      </Section>

      <Section title="Referrals">
        <div className="cc-drawer-table">
          <DataTable
            caption={`Referrals from ${row.name}`}
            columns={referralColumns}
            rows={row.referrals}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`${HOME}/orders?order=${r.orderId}`)}
            stickyHeader={false}
            empty={{ title: "No referrals yet.", note: row.status === "pending" ? "Referrals start once the partner is approved." : undefined }}
          />
        </div>
        {row.pending > 0 && (
          <p className="cc-footnote">
            {formatMoney(row.pending)} is still pending. Pending commission is approved before it can be paid.
          </p>
        )}
      </Section>

      <Section title="Payouts">
        {history.length ? (
          <div className="cc-drawer-table">
            <DataTable caption={`Payouts to ${row.name}`} columns={payoutColumns} rows={history} rowKey={(l) => l.key} stickyHeader={false} empty={{ title: "No payouts yet." }} />
          </div>
        ) : (
          <p className="kit-note">No payouts yet.</p>
        )}
      </Section>
    </Drawer>
  );
}
