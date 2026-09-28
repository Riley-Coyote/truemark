import { useMemo } from "react";
import {
  DataTable,
  Drawer,
  PageHeader,
  Section,
  Segmented,
  StatusChip,
  Timeline,
  formatDate,
  formatDateTime,
  formatMoney,
  plural,
  statusLabel,
} from "../../app-kit";
import type { Column, SegmentOption, TimelineItem } from "../../app-kit";
import { store, useResource } from "../../platform/store";
import type { Payout, Referral, ReferralStatus } from "../../platform/types";
import { nextPayoutDate, payoutFor, periodLabel } from "../metrics";
import { percent } from "../program";
import { usePartner, useQueryParam } from "./context";
import { TotalsRow } from "./parts";

const FLOW: ReferralStatus[] = ["pending", "approved", "paid", "void"];

/**
 * A referral as the partner sees it: the order's number, date and amounts.
 * Nothing here can name the buyer; the portal never loads the order itself.
 */
export function referralColumns(compact = false): Column<Referral>[] {
  const columns: Column<Referral>[] = [
    {
      key: "order",
      header: "Order",
      width: compact ? "20%" : "18%",
      mobile: "primary",
      sortValue: (r) => r.orderNumber,
      sortFirst: "desc",
      cell: (r) => <span className="kit-mono">{r.orderNumber}</span>,
    },
    {
      key: "date",
      header: "Placed",
      width: compact ? "22%" : "18%",
      sortValue: (r) => r.createdAt,
      sortFirst: "desc",
      cell: (r) => formatDate(r.createdAt),
    },
    {
      key: "via",
      header: "Via",
      width: "12%",
      mobile: "hidden",
      sortValue: (r) => r.via,
      cell: (r) => statusLabel(r.via),
    },
    {
      key: "subtotal",
      header: "Order subtotal",
      width: compact ? "22%" : "18%",
      align: "end",
      mobile: "meta",
      sortValue: (r) => r.orderSubtotal,
      sortFirst: "desc",
      cell: (r) => (
        <>
          {formatMoney(r.orderSubtotal)}
          <span className="pp-mobile-label"> order subtotal</span>
        </>
      ),
    },
    {
      key: "commission",
      header: "Commission",
      width: compact ? "18%" : "16%",
      align: "end",
      mobile: "aside",
      sortValue: (r) => r.commission,
      sortFirst: "desc",
      cell: (r) => formatMoney(r.commission),
    },
    {
      key: "status",
      header: "Status",
      width: compact ? "18%" : "18%",
      mobile: "secondary",
      sortValue: (r) => FLOW.indexOf(r.status),
      cell: (r) => <StatusChip status={r.status} />,
    },
  ];
  // The overview's list is the most recent few, so it neither sorts nor shows the channel.
  return compact ? columns.filter((c) => c.key !== "via").map((c) => ({ ...c, sortValue: undefined })) : columns;
}

function recordFor(referral: Referral, payouts: Payout[]): TimelineItem[] {
  const placed: TimelineItem = {
    key: "placed",
    title: `Order placed, via your ${referral.via}`,
    meta: formatDateTime(referral.createdAt),
    tone: "neutral",
  };
  switch (referral.status) {
    case "pending":
      return [
        placed,
        {
          key: "pending",
          title: "Commission pending",
          meta: "Once approved, it is paid on the next payout date.",
          tone: "pending",
        },
      ];
    case "approved":
      return [
        placed,
        {
          key: "approved",
          title: "Commission approved",
          meta: `Paid on ${formatDate(nextPayoutDate())}, sample schedule.`,
          tone: "signal",
        },
      ];
    case "paid": {
      const payout = payoutFor(referral, payouts);
      return [
        placed,
        { key: "approved", title: "Commission approved", tone: "signal" },
        {
          key: "paid",
          title: payout ? `Paid in the ${periodLabel(payout)} payout` : "Paid",
          meta: payout?.paidAt ? formatDate(`${payout.paidAt}T12:00:00Z`) : undefined,
          tone: "signal",
        },
      ];
    }
    case "void":
      return [placed, { key: "void", title: "Commission void", meta: "The order did not complete.", tone: "danger" }];
  }
}

/** One referral's record: amounts, how it moved toward payment, and what stays private. */
export function ReferralDrawer({
  referral,
  payouts,
  rate,
  onClose,
}: {
  referral: Referral;
  payouts: Payout[];
  rate: number;
  onClose: () => void;
}) {
  return (
    <Drawer
      eyebrow="Referral"
      title={referral.orderNumber}
      mono
      subtitle={`Placed ${formatDate(referral.createdAt)}`}
      tags={<StatusChip status={referral.status} />}
      onClose={onClose}
    >
      <Section title="Commission">
        <dl className="pp-sum">
          <div>
            <dt>Order subtotal, after your audience’s discount</dt>
            <dd>{formatMoney(referral.orderSubtotal)}</dd>
          </div>
          <div>
            <dt>Your rate</dt>
            <dd>{percent(rate)}</dd>
          </div>
          <div className="is-total">
            <dt>Commission</dt>
            <dd>{formatMoney(referral.commission)}</dd>
          </div>
        </dl>
      </Section>
      <Section title="Record">
        <Timeline label={`Record of referral ${referral.orderNumber}`} items={recordFor(referral, payouts)} />
      </Section>
      <Section title="Privacy">
        <p className="kit-note">
          Buyer details stay with TrueMark. Partners see a referred order’s number, date and amounts, never who placed it
          or what they ordered.
        </p>
      </Section>
    </Drawer>
  );
}

export default function Referrals() {
  const partner = usePartner();
  const referrals = useResource(() => store.partners.referrals(partner.id), [partner.id]);
  const payouts = useResource(() => store.partners.payouts(partner.id), [partner.id]);
  const [statusParam, setStatus] = useQueryParam("status");
  const [openId, setOpenId] = useQueryParam("referral");
  const status = FLOW.includes(statusParam as ReferralStatus) ? (statusParam as ReferralStatus) : "all";
  const columns = useMemo(() => referralColumns(), []);

  const all = referrals.data ?? [];
  const rows = referrals.data && all.filter((r) => status === "all" || r.status === status);
  const options: SegmentOption<ReferralStatus | "all">[] = [
    { value: "all", label: "All", count: all.length },
    ...FLOW.map((s) => ({ value: s, label: statusLabel(s), count: all.filter((r) => r.status === s).length })).filter(
      (option) => option.count > 0 || option.value === status,
    ),
  ];
  const open = openId ? all.find((r) => r.id === openId) : undefined;
  const sum = (key: "orderSubtotal" | "commission") =>
    Math.round((rows ?? []).reduce((total, r) => total + r[key], 0) * 100) / 100;

  return (
    <div className="kit-grid pp-page">
      <PageHeader
        description="Every order placed with your code or through your link, newest first. You see the order, never the buyer. Select a referral to read its record."
        meta={referrals.data && <span>{plural(all.length, "referral")}</span>}
      />
      <div className="kit-toolbar">
        <Segmented
          label="Filter referrals by status"
          options={options}
          value={status}
          onChange={(value) => setStatus(value === "all" ? null : value, { replace: true })}
        />
        {referrals.data && status !== "all" && (
          <p className="pp-result-count" aria-live="polite">
            {plural(rows?.length ?? 0, "result")}
          </p>
        )}
      </div>
      <div className="kit-card kit-span-12">
        <DataTable
          caption="Referrals"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={referrals.loading}
          error={referrals.error}
          onRetry={referrals.reload}
          onRowClick={(r) => setOpenId(r.id)}
          activeKey={openId}
          defaultSort={{ key: "date", dir: "desc" }}
          skeletonRows={6}
          empty={{
            title: status === "all" ? "No referrals yet." : "No referrals with this status.",
            note:
              status === "all"
                ? "Orders placed with your code or through your link appear here."
                : "Choose another status above.",
          }}
        />
        {rows && rows.length > 0 && (
          <TotalsRow
            label="Totals for the referrals shown"
            columns={columns}
            cells={{
              order: `Total, ${plural(rows.length, "referral")}`,
              subtotal: (
                <>
                  <span className="pp-totals-key">Order subtotal </span>
                  {formatMoney(sum("orderSubtotal"))}
                </>
              ),
              commission: (
                <>
                  <span className="kit-sr">Commission </span>
                  {formatMoney(sum("commission"))}
                </>
              ),
            }}
          />
        )}
      </div>
      <p className="pp-footnote kit-span-12">
        Order subtotal is after your audience’s discount and before shipping. Pending commissions are recent; approved
        ones are paid on the next payout date; paid ones were included in a payout.
      </p>
      {open && (
        <ReferralDrawer
          key={open.id}
          referral={open}
          payouts={payouts.data ?? []}
          rate={partner.rate}
          onClose={() => setOpenId(null, { replace: true })}
        />
      )}
    </div>
  );
}
