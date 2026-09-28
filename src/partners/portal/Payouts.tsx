import { useMemo } from "react";
import { Landmark } from "lucide-react";
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
  Skeleton,
  StatusChip,
  formatCount,
  formatDate,
  formatMoney,
  plural,
} from "../../app-kit";
import type { Column } from "../../app-kit";
import { store, useResource } from "../../platform/store";
import type { Payout, Referral } from "../../platform/types";
import { paidToDate, periodLabel, upcoming } from "../metrics";
import { SAMPLE_TERMS, ordinal } from "../program";
import { usePartner, useQueryParam } from "./context";

const paidOn = (payout: Payout) => (payout.paidAt ? formatDate(`${payout.paidAt}T12:00:00Z`) : "Scheduled");

const columns: Column<Payout>[] = [
  {
    key: "period",
    header: "Period",
    width: "22%",
    mobile: "primary",
    sortValue: (p) => p.periodStart,
    sortFirst: "desc",
    cell: (p) => periodLabel(p),
  },
  {
    key: "paid",
    header: "Paid on",
    width: "20%",
    sortValue: (p) => p.paidAt ?? "",
    sortFirst: "desc",
    cell: paidOn,
  },
  {
    key: "referrals",
    header: "Referrals",
    width: "14%",
    align: "end",
    sortValue: (p) => p.referrals,
    sortFirst: "desc",
    cell: (p) => (
      <>
        {formatCount(p.referrals)}
        <span className="pp-mobile-label">{p.referrals === 1 ? " referral" : " referrals"}</span>
      </>
    ),
  },
  {
    key: "amount",
    header: "Amount",
    width: "16%",
    align: "end",
    mobile: "aside",
    sortValue: (p) => p.amount,
    sortFirst: "desc",
    cell: (p) => formatMoney(p.amount),
  },
  {
    key: "method",
    header: "Method",
    width: "16%",
    cell: (p) => p.method,
  },
  {
    key: "status",
    header: "Status",
    width: "12%",
    mobile: "secondary",
    sortValue: (p) => p.status,
    cell: (p) => <StatusChip status={p.status} />,
  },
];

/** The referrals a paid payout covers: paid ones placed within its period. */
function covered(payout: Payout, referrals: Referral[]): Referral[] {
  return referrals
    .filter((r) => r.status === "paid" && r.createdAt.slice(0, 10) >= payout.periodStart && r.createdAt.slice(0, 10) <= payout.periodEnd)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function Statement({ payout, referrals, onClose }: { payout: Payout; referrals: Referral[] | undefined; onClose: () => void }) {
  const lines = referrals ? covered(payout, referrals) : undefined;
  return (
    <Drawer
      eyebrow="Payout statement"
      title={periodLabel(payout)}
      subtitle={`${payout.paidAt ? `Paid ${paidOn(payout)}` : "Scheduled"} · ${payout.method}`}
      tags={<StatusChip status={payout.status} />}
      onClose={onClose}
    >
      <Section title="Referrals in this payout">
        {!lines ? (
          <div className="pp-list-loading" aria-label="Loading">
            <Skeleton width="84%" />
            <Skeleton width="72%" />
          </div>
        ) : lines.length ? (
          <ul className="pp-lines">
            {lines.map((r) => (
              <li key={r.id}>
                <span className="kit-mono">{r.orderNumber}</span>
                <span className="kit-quiet">{formatDate(r.createdAt)}</span>
                <span className="pp-lines-figure kit-num">{formatMoney(r.commission)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="kit-note">The referrals for this period are not in the preview’s records.</p>
        )}
      </Section>
      <Section title="Total">
        <dl className="pp-sum">
          <div>
            <dt>Referrals</dt>
            <dd>{formatCount(payout.referrals)}</dd>
          </div>
          <div className="is-total">
            <dt>Paid</dt>
            <dd>{formatMoney(payout.amount)}</dd>
          </div>
        </dl>
      </Section>
      <Section title="Privacy">
        <p className="kit-note">Statements list order numbers and amounts only. Buyer details stay with TrueMark.</p>
      </Section>
    </Drawer>
  );
}

export default function Payouts() {
  const partner = usePartner();
  const payouts = useResource(() => store.partners.payouts(partner.id), [partner.id]);
  const referrals = useResource(() => store.partners.referrals(partner.id), [partner.id]);
  const [openId, setOpenId] = useQueryParam("payout");
  const next = useMemo(() => (referrals.data ? upcoming(referrals.data) : null), [referrals.data]);
  const paid = useMemo(() => (payouts.data ? paidToDate(payouts.data) : null), [payouts.data]);
  const open = openId ? payouts.data?.find((p) => p.id === openId) : undefined;

  return (
    <div className="kit-grid pp-page pp-payouts">
      <PageHeader
        description={`Approved commissions are paid on the ${ordinal(SAMPLE_TERMS.payoutDay)} of each month (sample schedule). Select a payout to read its statement.`}
        meta={payouts.data && <span>{plural(payouts.data.length, "payout")}</span>}
      />

      <Card className="kit-span-4 pp-figure-card" title="Next payout" meta={<SampleTag>Sample schedule</SampleTag>}>
        {!next ? (
          referrals.error ? (
            <EmptyState compact title="Could not be loaded." action={<Button onClick={referrals.reload}>Try again</Button>} />
          ) : (
            <div className="pp-list-loading" aria-label="Loading">
              <Skeleton width="60%" height="1.5rem" />
              <Skeleton width="80%" />
            </div>
          )
        ) : (
          <>
            <p className="kit-figure pp-next-date">
              <time dateTime={next.date.slice(0, 10)}>{formatDate(next.date)}</time>
            </p>
            <Facts
              items={[
                { label: "Approved so far", value: <span className="kit-num">{formatMoney(next.approved)}</span> },
                {
                  label: "Pending approval",
                  value: (
                    <span className="pp-fact-figure">
                      <span className="kit-num">{formatMoney(next.pending)}</span>
                      <span className="kit-quiet">{plural(next.pendingCount, "referral")}</span>
                    </span>
                  ),
                },
              ]}
            />
          </>
        )}
      </Card>

      <Card className="kit-span-4 pp-figure-card" title="Lifetime paid">
        {!paid ? (
          <div className="pp-list-loading" aria-label="Loading">
            <Skeleton width="60%" height="1.5rem" />
            <Skeleton width="80%" />
          </div>
        ) : (
          <>
            <p className="kit-figure pp-next-date">
              <MoneyFigure value={paid.amount} />
            </p>
            <Facts
              items={[
                { label: "Payouts", value: <span className="kit-num">{formatCount(paid.count)}</span> },
                {
                  label: "Last paid",
                  value: paid.lastPaidAt ? formatDate(`${paid.lastPaidAt}T12:00:00Z`) : "Not yet",
                },
              ]}
            />
          </>
        )}
      </Card>

      <Card className="kit-span-4 pp-method" title="Payout method" meta={<SampleTag>Sample</SampleTag>}>
        <div className="pp-method-row">
          <span className="pp-method-icon" aria-hidden="true">
            <Landmark strokeWidth={1.5} />
          </span>
          <span className="pp-method-text">
            <span className="pp-method-name">Bank transfer</span>
            <span className="kit-quiet">Account details are added at launch.</span>
          </span>
        </div>
        <Button disabled title="Arrives with the backend">
          Change method
        </Button>
        <p className="pp-footnote">Changing the method arrives with the backend.</p>
      </Card>

      <div className="kit-card kit-span-12">
        <DataTable
          caption="Payout history"
          columns={columns}
          rows={payouts.data}
          rowKey={(p) => p.id}
          loading={payouts.loading}
          error={payouts.error}
          onRetry={payouts.reload}
          onRowClick={(p) => setOpenId(p.id)}
          activeKey={openId}
          defaultSort={{ key: "period", dir: "desc" }}
          skeletonRows={3}
          empty={{ title: "No payouts yet.", note: "Your first payout follows your first approved commissions." }}
        />
      </div>

      {open && <Statement key={open.id} payout={open} referrals={referrals.data} onClose={() => setOpenId(null, { replace: true })} />}
    </div>
  );
}
