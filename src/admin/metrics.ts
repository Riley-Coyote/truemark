import { statusLabel } from "../app-kit";
/**
 * Figures for the command center (the Overview, Orders and Partners), computed
 * from orders. The sample data runs to TODAY in seed.ts, so every window counts
 * back from the end of that day. Cancelled and refunded orders are left out of
 * revenue and order counts. Every figure is read from the same orders the Orders
 * page lists, and every order's status reads in one language (orderTone).
 */
import { TODAY } from "../platform/seed";
import type { Buyer, Order, OrderStatus, Partner, PaymentStatus, Referral } from "../platform/types";
import { monthToDate } from "../partners/metrics";
import { productById } from "../shop/catalog";
import { formatCount, formatDay, formatMoney } from "../app-kit";
import type { Tone } from "../app-kit";
import type { PayoutBatch } from "./preview";
import { NEXT_PAYOUT, awaitingPayout } from "./program";
import type { PartnerRow } from "./program";

const HOUR = 3_600_000;
const DAY = 86_400_000;
/** Midnight after the last day of sample data. */
export const END = Date.parse(`${TODAY}T00:00:00Z`) + DAY;
/** Midnight at the start of the sample world's today. */
export const TODAY_START = END - DAY;
export const TODAY_ISO = `${TODAY}T12:00:00.000Z`;
const TODAY_DATE = new Date(TODAY_START);
/** Midnight at the start of the sample month, where "this month" begins, as the partner portal counts it. */
export const MONTH_START = Date.UTC(TODAY_DATE.getUTCFullYear(), TODAY_DATE.getUTCMonth(), 1);

const OPEN: OrderStatus[] = ["placed", "paid", "packed", "shipped"];
export const isOpen = (status: OrderStatus) => OPEN.includes(status);
export const isCounted = (order: Order) => order.status !== "cancelled" && order.status !== "refunded";
/** An order that came with a partner's code (or link, which carries the code). */
export const viaPartner = (order: Order) => Boolean(order.discount?.partnerId);

const at = (iso: string) => Date.parse(iso);
const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (values: number[]) => round2(values.reduce((total, v) => total + v, 0));
export const units = (order: Order) => order.lines.reduce((total, line) => total + line.quantity, 0);

/**
 * An order placed in the last `days` days, counted back from the end of the sample day as
 * every window here is. The Orders page's `?days=` and the pipeline's closed counts both use it.
 */
export const placedWithin = (order: Order, days: number) => at(order.createdAt) >= END - days * DAY;

/** Counted orders created from `from` days ago up to `to` days ago (0 = now, open-ended). */
function between(orders: Order[], from: number, to: number) {
  const start = END - from * DAY;
  const stop = to === 0 ? Infinity : END - to * DAY;
  return orders.filter((o) => isCounted(o) && at(o.createdAt) >= start && at(o.createdAt) < stop);
}

export type Totals = { revenue: number; count: number; average: number };

function totals(list: Order[]): Totals {
  const revenue = sum(list.map((o) => o.total));
  return { revenue, count: list.length, average: list.length ? round2(revenue / list.length) : 0 };
}

/** An order's status at a moment, read from its events. Cancellation is final. */
function statusAt(order: Order, time: number): OrderStatus | null {
  if (at(order.createdAt) > time) return null;
  const past = order.events.filter((e) => at(e.at) <= time).sort((a, b) => at(a.at) - at(b.at));
  if (past.some((e) => e.status === "cancelled" || e.status === "refunded")) return "cancelled";
  return past.length ? past[past.length - 1].status : "placed";
}

const openAt = (orders: Order[], time: number) =>
  orders.filter((o) => {
    const status = statusAt(o, time);
    return status !== null && isOpen(status);
  }).length;

/* ---------- Deltas ---------- */

export type Change = { text: string; direction: "up" | "down" | "flat" };
const MINUS = "−";

/** A difference in dollars, with a true minus sign: "+$294.00", "−$504.00". */
export function formatMoneyChange(current: number, previous: number): Change {
  const diff = round2(current - previous);
  if (diff === 0) return { text: formatMoney(0), direction: "flat" };
  return { text: `${diff > 0 ? "+" : MINUS}${formatMoney(Math.abs(diff))}`, direction: diff > 0 ? "up" : "down" };
}

/** A change between two shares, in whole percentage points: "+38 pts". */
export function formatShareChange(current: number, previous: number): Change {
  const points = Math.round((current - previous) * 100);
  if (points === 0) return { text: "0 pts", direction: "flat" };
  return { text: `${points > 0 ? "+" : MINUS}${Math.abs(points)} pts`, direction: points > 0 ? "up" : "down" };
}

/** A share as whole percent: 0.3804 → 38. */
export const percentOf = (share: number) => Math.round(share * 100);

/* ---------- Today ---------- */

export type DayFigures = {
  revenue: number;
  count: number;
  /** Null until the day has an order. */
  average: number | null;
  partnerRevenue: number;
  /** The share of the day's revenue that came with a partner's code; null until there is revenue. */
  partnerShare: number | null;
};

function dayFigures(list: Order[]): DayFigures {
  const t = totals(list);
  const partnerRevenue = sum(list.filter(viaPartner).map((o) => o.total));
  return {
    revenue: t.revenue,
    count: t.count,
    average: t.count ? t.average : null,
    partnerRevenue,
    partnerShare: t.revenue ? partnerRevenue / t.revenue : null,
  };
}

/**
 * Today so far, and the same weekday last week up to the same hour, so a morning is
 * never compared with a whole day. Today is the sample world's calendar day (UTC).
 */
export function todayFigures(orders: Order[], now: string) {
  const counted = orders.filter(isCounted);
  const elapsed = Math.min(DAY, Math.max(0, at(now) - TODAY_START));
  const weekAgo = TODAY_START - 7 * DAY;
  return {
    today: dayFigures(counted.filter((o) => at(o.createdAt) >= TODAY_START && at(o.createdAt) < END)),
    lastWeek: dayFigures(counted.filter((o) => at(o.createdAt) >= weekAgo && at(o.createdAt) <= weekAgo + elapsed)),
  };
}

/* ---------- The period ---------- */

export type Period = 7 | 30 | 90;
export const PERIODS: Period[] = [7, 30, 90];

export type DayPoint = { key: string; iso: string; label: string; revenue: number; count: number };

export type PeriodFigures = {
  days: Period;
  current: Totals;
  previous: Totals;
  openNow: number;
  /** Open at the end of the day before the period began. */
  openBefore: number;
  /** One point per day, oldest first; today is the last. */
  daily: DayPoint[];
};

/** The period's figures against the period of the same length before it. */
export function periodFigures(orders: Order[], days: Period): PeriodFigures {
  const counted = orders.filter(isCounted);
  const daily = Array.from({ length: days }, (_, i) => {
    const start = END - (days - i) * DAY;
    const t = totals(counted.filter((o) => at(o.createdAt) >= start && at(o.createdAt) < start + DAY));
    const iso = new Date(start + DAY / 2).toISOString();
    return { key: iso.slice(0, 10), iso, label: formatDay(iso), revenue: t.revenue, count: t.count };
  });
  return {
    days,
    current: totals(between(orders, days, 0)),
    previous: totals(between(orders, days * 2, days)),
    openNow: orders.filter((o) => isOpen(o.status)).length,
    openBefore: openAt(orders, END - days * DAY - 1),
    daily,
  };
}

/* ---------- Partners ---------- */

export type PartnerLine = { partner: Partner; orders: number; revenue: number; commission: number };

export type PartnerFigures = {
  revenue: number;
  /** Revenue from orders that came with a partner's code: the same order totals as everywhere else. */
  partnerRevenue: number;
  share: number | null;
  top: PartnerLine[];
  /** Commission earned on the period's partner orders and not yet paid: pending, and approved for a payout. */
  earned: { pending: number; approved: number; total: number };
};

/** The period's partner revenue and share, the commission earned on it, and its top three partners by revenue. */
export function partnerFigures(orders: Order[], referrals: Referral[], partners: Partner[], days: Period): PartnerFigures {
  const list = between(orders, days, 0);
  const via = list.filter(viaPartner);
  const revenue = totals(list).revenue;
  const partnerRevenue = sum(via.map((o) => o.total));
  const referralFor = new Map(referrals.filter((r) => r.status !== "void").map((r) => [r.orderId, r]));
  const lines = partners
    .map((partner) => {
      const own = via.filter((o) => o.discount?.partnerId === partner.id);
      return {
        partner,
        orders: own.length,
        revenue: sum(own.map((o) => o.total)),
        commission: sum(own.map((o) => referralFor.get(o.id)?.commission ?? 0)),
      };
    })
    .filter((line) => line.orders > 0)
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders || a.partner.name.localeCompare(b.partner.name));
  const commissionIn = (status: Referral["status"]) =>
    sum(via.map((o) => referralFor.get(o.id)).flatMap((r) => (r?.status === status ? [r.commission] : [])));
  const pending = commissionIn("pending");
  const approved = commissionIn("approved");
  return {
    revenue,
    partnerRevenue,
    share: revenue ? partnerRevenue / revenue : null,
    top: lines.slice(0, 3),
    earned: { pending, approved, total: round2(pending + approved) },
  };
}

export type NextPayout = { date: string; amount: number; partners: number };

/**
 * The next payout as the Partners screen states it: approved commission waiting for
 * a batch, and any batch already scheduled for the same day.
 */
export function nextPayout(rows: PartnerRow[], batches: PayoutBatch[]): NextPayout {
  const waiting = awaitingPayout(rows, batches);
  const scheduled = batches.filter((batch) => batch.scheduledFor === NEXT_PAYOUT).flatMap((batch) => batch.lines);
  return {
    date: NEXT_PAYOUT,
    amount: sum([...waiting.map((line) => line.amount), ...scheduled.map((line) => line.amount)]),
    partners: new Set([...waiting.map((line) => line.partner.id), ...scheduled.map((line) => line.partnerId)]).size,
  };
}

export type PartnerMonth = { revenue: number; orders: number; commission: number };

/**
 * Each partner's month so far: the totals of their orders placed since the 1st of the sample
 * month (cancelled and refunded orders left out, as from every revenue figure here), and the
 * commission on them exactly as the partner's own portal counts "This month".
 */
export function partnerMonths(orders: Order[], referrals: Referral[], partners: Partner[]): Map<string, PartnerMonth> {
  const month = orders.filter((o) => viaPartner(o) && isCounted(o) && at(o.createdAt) >= MONTH_START && at(o.createdAt) < END);
  return new Map(
    partners.map((partner) => {
      const own = month.filter((o) => o.discount?.partnerId === partner.id);
      return [
        partner.id,
        {
          revenue: sum(own.map((o) => o.total)),
          orders: own.length,
          commission: monthToDate(referrals.filter((r) => r.partnerId === partner.id)).current,
        },
      ];
    }),
  );
}

/* ---------- The pipeline ---------- */

export const STAGES = ["placed", "paid", "packed", "shipped", "delivered"] as const;
export type Stage = (typeof STAGES)[number];
export type OpenStage = Exclude<Stage, "delivered">;

/** How long an order may wait in a stage before it is late for the next step, in days. */
export const STAGE_LIMIT: Record<OpenStage, number> = { placed: 1, paid: 1, packed: 1, shipped: 5 };

export type StageFigures = {
  stage: Stage;
  count: number;
  /** Open stages: how long the longest-waiting order has been in the stage, in milliseconds. */
  oldest: number | null;
  /** Open stages: orders waiting past the stage's limit. */
  late: number;
};

/** When an order entered the stage it is in: that step's latest event, or its creation. */
function enteredStage(order: Order): number {
  const steps = order.events.filter((e) => e.status === order.status).map((e) => at(e.at));
  return steps.length ? Math.max(...steps) : at(order.createdAt);
}

/**
 * How long an open order has waited in its stage, never less than zero (a step stamped later
 * in the day than the sample clock counts as just taken); null once the order is closed.
 */
export function waitInStage(order: Order, now: string): number | null {
  return isOpen(order.status) ? Math.max(0, at(now) - enteredStage(order)) : null;
}

/** An open order that has waited past its stage's limit: late for the next step. */
export function isLate(order: Order, now: string): boolean {
  const wait = waitInStage(order, now);
  return wait !== null && wait > STAGE_LIMIT[order.status as OpenStage] * DAY;
}

/** The last 30 days' delivered or cancelled orders: placed in the window, as the Orders page lists them for `?days=30`. */
const closedWithin = (orders: Order[], status: OrderStatus) => orders.filter((o) => o.status === status && placedWithin(o, 30)).length;

/**
 * Open orders now, stage by stage, with how long the oldest has waited and how many
 * have waited past the stage's limit. Delivered and cancelled count the last 30 days.
 */
export function pipeline(orders: Order[], now: string): { stages: StageFigures[]; cancelled: number } {
  const open = (["placed", "paid", "packed", "shipped"] as OpenStage[]).map((stage) => {
    const here = orders.filter((o) => o.status === stage);
    const waits = here.map((o) => waitInStage(o, now) ?? 0);
    return {
      stage,
      count: here.length,
      oldest: waits.length ? Math.max(...waits) : null,
      late: here.filter((o) => isLate(o, now)).length,
    };
  });
  return {
    stages: [...open, { stage: "delivered", count: closedWithin(orders, "delivered"), oldest: null, late: 0 }],
    cancelled: closedWithin(orders, "cancelled"),
  };
}

/* ---------- One status language ---------- */

/**
 * An order's status dot, the same on Orders, in its drawer, in the pipeline and in the Live
 * stream: an open order in the quiet tone, delivered in the signal tone, cancelled (or
 * refunded) in the danger tone, and an open order past its stage's limit in the pending tone.
 */
export function orderTone(order: Order, now: string): Tone {
  if (!isOpen(order.status)) return stepTone(order.status);
  return isLate(order, now) ? "pending" : "neutral";
}

/** A step an order took, on its timeline or in the Live stream: the same tones, without lateness. */
export function stepTone(status: OrderStatus): Tone {
  if (status === "delivered") return "signal";
  return status === "cancelled" || status === "refunded" ? "danger" : "neutral";
}

/** Payment follows suit: captured in the signal tone, authorized quiet, refunded (or failed) in the danger tone. */
export function paymentTone(payment: PaymentStatus): Tone {
  if (payment === "captured") return "signal";
  return payment === "refunded" || payment === "failed" ? "danger" : "neutral";
}

/** A wait as a person says it: "under an hour", "26 hours", "3 days". Hours until two days. */
export function formatWait(ms: number): string {
  const hours = Math.floor(ms / HOUR);
  if (hours < 1) return "under an hour";
  if (hours < 48) return hours === 1 ? "1 hour" : `${hours} hours`;
  return `${Math.floor(ms / DAY)} days`;
}

/** "1 day", "5 days". */
export const formatLimit = (days: number) => (days === 1 ? "1 day" : `${days} days`);

/* ---------- The stream ---------- */

export type PulseKind = "placed" | "partner" | "paid" | "packed" | "shipped" | "delivered" | "cancelled";

export type PulseEvent = {
  /** Stable across the store and the event line, so a live arrival and its stored record are one row. */
  key: string;
  kind: PulseKind;
  at: string;
  /** What opens the order's drawer: its id, or its number when only that is known yet. */
  orderRef: string;
  number: string;
  total?: number;
  institution?: string;
  code?: string;
  carrier?: string;
  partner?: string;
  commission?: number;
};

const STEP_KINDS: OrderStatus[] = ["placed", "paid", "packed", "shipped", "delivered", "cancelled"];

/** The event key an order step and its platform event share. */
export const stepKey = (orderId: string, status: OrderStatus, when: string) => `${orderId}:${status}:${when}`;
export const referralKey = (referralId: string) => `referral:${referralId}`;

/** Every step every order took, and every partner sale, from the store. Newest first. */
export function pulseHistory(orders: Order[], referrals: Referral[], partners: Partner[], buyers: Buyer[]): PulseEvent[] {
  const partnerById = new Map(partners.map((p) => [p.id, p]));
  const buyerById = new Map(buyers.map((b) => [b.id, b]));
  const steps = orders.flatMap((o) =>
    o.events
      .filter((e) => STEP_KINDS.includes(e.status))
      .map((e) => ({
        key: stepKey(o.id, e.status, e.at),
        kind: e.status as PulseKind,
        at: e.at,
        orderRef: o.id,
        number: o.number,
        ...(e.status === "placed"
          ? {
              total: o.total,
              institution: buyerById.get(o.buyerId)?.institution ?? o.address.institution,
              code: o.discount?.partnerId ? partnerById.get(o.discount.partnerId)?.code : undefined,
            }
          : {}),
        ...(e.status === "shipped" ? { carrier: o.shipping.carrier } : {}),
      })),
  );
  const sales = referrals
    .filter((r) => r.status !== "void")
    .map((r) => ({
      key: referralKey(r.id),
      kind: "partner" as const,
      at: r.createdAt,
      orderRef: r.orderId,
      number: r.orderNumber,
      partner: partnerById.get(r.partnerId)?.name,
      commission: r.commission,
    }));
  return sortPulse([...steps, ...sales]);
}

/** At the same moment, later steps come first, and an order sits above the partner sale it made. */
const TIE: PulseKind[] = ["cancelled", "delivered", "shipped", "packed", "paid", "placed", "partner"];
export const sortPulse = (list: PulseEvent[]) =>
  [...list].sort((a, b) => at(b.at) - at(a.at) || TIE.indexOf(a.kind) - TIE.indexOf(b.kind));

/** One line for a stream row, as it is read aloud. */
export function pulseSentence(e: PulseEvent): string {
  switch (e.kind) {
    case "placed":
      return [`New order ${e.number}`, e.total !== undefined ? formatMoney(e.total) : null, e.institution, e.code ? `via ${e.code}` : null]
        .filter(Boolean)
        .join(", ");
    case "partner":
      return `${e.partner ?? "A partner"} earned ${formatMoney(e.commission ?? 0)} on ${e.number}`;
    case "shipped":
      return `${e.number} shipped${e.carrier ? ` with ${e.carrier}` : ""}`;
    default:
      return `${e.number} ${e.kind}`;
  }
}

/* ---------- Compounds ---------- */

export type CompoundRevenue = { name: string; colour: string; revenue: number; units: number };

/** Line revenue by compound over the last 30 days, before discounts and shipping. */
export function topCompounds(orders: Order[], limit = 5): CompoundRevenue[] {
  const byName = new Map<string, CompoundRevenue>();
  for (const order of between(orders, 30, 0)) {
    for (const line of order.lines) {
      const product = productById(line.productId);
      if (!product) continue;
      const entry = byName.get(product.name) ?? { name: product.name, colour: product.color, revenue: 0, units: 0 };
      entry.revenue = round2(entry.revenue + line.unitPrice * line.quantity);
      entry.units += line.quantity;
      byName.set(product.name, entry);
    }
  }
  return [...byName.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

/** "3 orders", "1 order". */
export const orderCount = (n: number) => `${formatCount(n)} ${n === 1 ? "order" : "orders"}`;

export function paymentLabel(payment: PaymentStatus): string {
  return payment === "pending" ? "Awaiting payment" : payment === "partially_refunded" ? "Partly refunded" : statusLabel(payment);
}
