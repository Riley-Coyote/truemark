/**
 * The partner program as the command center reads it: the store's sample
 * partners, referrals, payouts and codes, with this preview's changes laid on
 * top. Partners and Discount codes both read from here, so pausing a partner
 * also stops their code.
 */
import { formatDate, formatDay } from "../app-kit";
import type { Tone } from "../app-kit";
import { payoutFor } from "../partners/metrics";
import { TODAY } from "../platform/seed";
import { LIVE } from "../platform/mode";
import type { Discount, Order, Partner, PartnerStatus, Payout, Referral } from "../platform/types";
import type { PayoutBatch, PreviewState } from "./preview";

/** Payouts go out on the 5th for approved commission: the sample schedule. */
export const NEXT_PAYOUT = "2026-10-05T12:00:00.000Z";
export const PAYOUT_METHOD = "Bank transfer";

const END_OF_TODAY = `${TODAY}T23:59:59.999Z`;
const round2 = (n: number) => Math.round(n * 100) / 100;
const commission = (list: Referral[]) => round2(list.reduce((total, r) => total + r.commission, 0));

/** 0.12 → "12%" */
export const percent = (fraction: number) => `${LIVE ? Math.round(fraction * 10000) / 100 : Math.round(fraction * 1000) / 10}%`;

/** "1 Aug 2026" → "Aug 2026" */
export const formatMonth = (iso: string) => formatDate(iso).split(" ").slice(1).join(" ");

export function partnerStatus(partner: Partner, changes: PreviewState): PartnerStatus {
  return LIVE ? partner.status : changes.partnerStatus[partner.id] ?? partner.status;
}

export type PartnerRow = Partner & {
  /** Referrals that count (not void), newest first. */
  referrals: Referral[];
  count: number;
  /** Referred order subtotals after the code's discount: the base commission is paid on. */
  revenue: number;
  /** Approved commission not yet paid, in a batch or not. */
  owed: number;
  pending: number;
  paid: number;
  /** The status was changed in this preview. */
  edited: boolean;
};

export function partnerRows(partners: Partner[], referrals: Referral[], changes: PreviewState): PartnerRow[] {
  return partners.map((partner) => {
    const own = referrals
      .filter((r) => r.partnerId === partner.id && r.status !== "void")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const status = partnerStatus(partner, changes);
    return {
      ...partner,
      status,
      referrals: own,
      count: own.length,
      revenue: round2(own.reduce((total, r) => total + r.orderSubtotal, 0)),
      owed: commission(own.filter((r) => r.status === "approved")),
      pending: commission(own.filter((r) => r.status === "pending")),
      paid: commission(own.filter((r) => r.status === "paid")),
      edited: status !== partner.status,
    };
  });
}

export type CommissionState = { tone: Tone; text: string };

/**
 * A referral's commission as the owner reads it on the order: its state, with one line that
 * explains it in the program's words. Commission is pending until 14 days after delivery, is
 * then approved for the next payout on the 5th, and is paid in that payout.
 */
export function commissionState(referral: Referral, order: Order, payouts: Payout[]): CommissionState {
  switch (referral.status) {
    case "pending":
      return {
        tone: "pending",
        text: order.status === "delivered" ? "Pending until 14 days after delivery" : "Pending until delivered",
      };
    case "approved":
      return { tone: "signal", text: `Approved for the ${formatDay(NEXT_PAYOUT)} payout` };
    case "paid": {
      const payout = payoutFor(referral, payouts.filter((p) => p.partnerId === referral.partnerId));
      return { tone: "signal", text: payout?.paidAt ? `Paid on ${formatDay(`${payout.paidAt}T12:00:00Z`)}` : "Paid" };
    }
    case "void":
      return { tone: "danger", text: "Void, the order did not complete" };
  }
}

/** Referral ids that a payout batch in this preview already holds. */
export const batchedIds = (batches: PayoutBatch[]) =>
  new Set(batches.flatMap((batch) => batch.lines.flatMap((line) => line.referralIds)));

export type AwaitingLine = { partner: PartnerRow; referrals: Referral[]; amount: number; since: string };

/** Approved commission no batch holds yet, by partner, largest first. */
export function awaitingPayout(rows: PartnerRow[], batches: PayoutBatch[]): AwaitingLine[] {
  const held = batchedIds(batches);
  return rows
    .map((partner) => {
      const list = partner.referrals.filter((r) => r.status === "approved" && !held.has(r.id));
      const since = list.map((r) => r.createdAt).sort()[0] ?? "";
      return { partner, referrals: list, amount: commission(list), since };
    })
    .filter((line) => line.referrals.length > 0)
    .sort((a, b) => b.amount - a.amount);
}

export type PayoutLine = {
  key: string;
  partnerId: string;
  period: string;
  referrals: number;
  amount: number;
  status: "paid" | "scheduled";
  /** Paid on, or scheduled for. */
  date: string;
  method: string;
};

/** Every payout: this preview's scheduled batches first, then those already paid. */
export function payoutHistory(payouts: Payout[], batches: PayoutBatch[], referrals: Referral[]): PayoutLine[] {
  const byId = new Map(referrals.map((r) => [r.id, r]));
  const scheduled = batches.flatMap((batch) =>
    batch.lines.map((line) => {
      const dates = line.referralIds.map((id) => byId.get(id)?.createdAt ?? "").filter(Boolean).sort();
      const first = dates[0] ?? batch.createdAt;
      const last = dates[dates.length - 1] ?? batch.createdAt;
      return {
        key: `${batch.id}-${line.partnerId}`,
        partnerId: line.partnerId,
        period: first.slice(0, 10) === last.slice(0, 10) ? formatDate(first) : `${formatDate(first)} to ${formatDate(last)}`,
        referrals: line.referralIds.length,
        amount: line.amount,
        status: "scheduled" as const,
        date: batch.scheduledFor,
        method: batch.method,
      };
    }),
  );
  const paid = [...payouts]
    .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))
    .map((payout) => ({
      key: payout.id,
      partnerId: payout.partnerId,
      period: LIVE ? `${formatDate(payout.periodStart)} to ${formatDate(payout.periodEnd)}` : formatMonth(payout.periodStart),
      referrals: payout.referrals,
      amount: payout.amount,
      status: payout.status === "paid" ? ("paid" as const) : ("scheduled" as const),
      date: payout.paidAt ?? payout.periodEnd,
      method: payout.method,
    }));
  return [...scheduled, ...paid];
}

export type CodeStatus = "active" | "inactive" | "expired";

export type CodeRow = Discount & {
  status: CodeStatus;
  /** The code's own switch, before its partner or end date is considered. */
  enabled: boolean;
  /** Orders placed with the code, counted live. */
  uses: number;
  partner?: Partner;
  partnerState?: PartnerStatus;
  /** Why the switch cannot be turned on here, when it cannot. */
  locked?: string;
  created: boolean;
  edited: boolean;
};

/**
 * A code works at checkout when its own switch is on, it has not ended, and,
 * for a partner code, its partner is active. The sample partner codes carry
 * their partner's status, so their own switch starts on.
 */
export function codeRows(discounts: Discount[], partners: Partner[], orders: Order[], changes: PreviewState): CodeRow[] {
  const created = new Set((LIVE ? [] : changes.codes).map((d) => d.code));
  return [...(LIVE ? [] : changes.codes), ...discounts].map((discount) => {
    const isNew = created.has(discount.code);
    const partner = discount.partnerId ? partners.find((p) => p.id === discount.partnerId) : undefined;
    const partnerState = partner ? partnerStatus(partner, changes) : undefined;
    const base = LIVE || isNew || discount.kind !== "partner" ? discount.active : true;
    const enabled = LIVE ? base : changes.codeActive[discount.code] ?? base;
    const expired = Boolean(discount.expiresAt && (LIVE ? new Date(discount.expiresAt).getTime() <= Date.now() : discount.expiresAt < END_OF_TODAY));

    let locked: string | undefined;
    if (expired && discount.expiresAt) locked = `This code ended on ${formatDate(discount.expiresAt)}.`;
    else if (partner && partnerState === "pending") locked = `Approve ${partner.name} to use this code.`;
    else if (partner && partnerState === "paused") locked = `${partner.name} is paused. Resume the partner to use this code.`;

    const active = enabled && !locked;
    return {
      ...discount,
      active,
      status: expired ? "expired" : active ? "active" : "inactive",
      enabled,
      uses: orders.filter((o) => o.discount?.code === discount.code).length,
      partner,
      partnerState,
      locked,
      created: isNew,
      edited: !isNew && enabled !== base,
    };
  });
}
