/**
 * A partner's figures, computed from their own referrals, payouts and visits.
 * The sample data runs to TODAY in seed.ts, so every window counts back from
 * the end of that day. Void referrals never count toward earnings.
 */
import { formatDay } from "../app-kit";
import { TODAY } from "../platform/seed";
import type { Payout, Referral, Visit } from "../platform/types";
import { SAMPLE_TERMS } from "./program";

const DAY = 86_400_000;
/** Midnight after the last day of sample data. */
export const END = Date.parse(`${TODAY}T00:00:00Z`) + DAY;
export const TODAY_ISO = `${TODAY}T12:00:00.000Z`;

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const at = (iso: string) => Date.parse(iso);
const round2 = (n: number) => Math.round(n * 100) / 100;
const total = (list: Referral[]) => round2(list.reduce((sum, r) => sum + r.commission, 0));
const earned = (r: Referral) => r.status !== "void";
const placedBetween = (list: Referral[], start: number, stop: number) =>
  list.filter((r) => earned(r) && at(r.createdAt) >= start && at(r.createdAt) < stop);

/** Commission earned on orders placed this month, against the same days of last month. */
export function monthToDate(referrals: Referral[]) {
  const today = new Date(`${TODAY}T00:00:00Z`);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const day = today.getUTCDate();
  const start = Date.UTC(year, month, 1);
  const previousStart = Date.UTC(year, month - 1, 1);
  const previousStop = Date.UTC(year, month - 1, day + 1);
  const current = placedBetween(referrals, start, END);
  const previous = placedBetween(referrals, previousStart, previousStop);
  const cumulative = Array.from({ length: day }, (_, i) => total(placedBetween(referrals, start, start + (i + 1) * DAY)));
  const previousMonth = MONTHS[new Date(previousStart).getUTCMonth()];
  return {
    current: total(current),
    currentCount: current.length,
    previous: total(previous),
    month: MONTHS[month],
    comparison: `1–${day} ${previousMonth.slice(0, 3)}`,
    cumulative,
  };
}

/** Everything paid out so far, with a 60-day running total for the tile's trace. */
export function paidToDate(payouts: Payout[]) {
  const paid = payouts.filter((p) => p.status === "paid" && p.paidAt);
  const amount = round2(paid.reduce((sum, p) => sum + p.amount, 0));
  const last = [...paid].sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))[0];
  const running = Array.from({ length: 60 }, (_, i) => {
    const dayEnd = END - (59 - i) * DAY;
    return round2(paid.filter((p) => at(`${p.paidAt}T12:00:00Z`) < dayEnd).reduce((sum, p) => sum + p.amount, 0));
  });
  return { amount, count: paid.length, lastPaidAt: last?.paidAt, running };
}

/** The next payout date: the payout day of this month if it is still ahead, otherwise next month's. */
export function nextPayoutDate(): string {
  const today = new Date(`${TODAY}T00:00:00Z`);
  const payoutDay = SAMPLE_TERMS.payoutDay;
  const month = today.getUTCDate() < payoutDay ? today.getUTCMonth() : today.getUTCMonth() + 1;
  return new Date(Date.UTC(today.getUTCFullYear(), month, payoutDay, 12)).toISOString();
}

/** What the next payout holds so far, and what is still waiting for approval. */
export function upcoming(referrals: Referral[]) {
  const approved = referrals.filter((r) => r.status === "approved");
  const pending = referrals.filter((r) => r.status === "pending");
  return {
    date: nextPayoutDate(),
    approved: total(approved),
    approvedCount: approved.length,
    pending: total(pending),
    pendingCount: pending.length,
  };
}

const clicksBetween = (visits: Visit[], start: number, stop: number) =>
  visits.filter((v) => at(`${v.date}T12:00:00Z`) >= start && at(`${v.date}T12:00:00Z`) < stop).reduce((sum, v) => sum + v.clicks, 0);

/** Clicks and conversion (referrals over clicks) for the last 30 days against the 30 before. */
export function traffic(visits: Visit[], referrals: Referral[]) {
  const windowOf = (daysAgo: number) => [END - (daysAgo + 30) * DAY, END - daysAgo * DAY] as const;
  const [start, stop] = windowOf(0);
  const [previousStart, previousStop] = windowOf(30);
  const clicks = clicksBetween(visits, start, stop);
  const previousClicks = clicksBetween(visits, previousStart, previousStop);
  const orders = placedBetween(referrals, start, stop).length;
  const previousOrders = placedBetween(referrals, previousStart, previousStop).length;
  const rate = (o: number, c: number) => (c ? o / c : 0);
  const daily = visits.filter((v) => at(`${v.date}T12:00:00Z`) >= start).map((v) => v.clicks);
  // Each of the last 30 days, the conversion over the 30 days that end on it.
  const trailing = Array.from({ length: 30 }, (_, i) => {
    const dayEnd = END - (29 - i) * DAY;
    return rate(placedBetween(referrals, dayEnd - 30 * DAY, dayEnd).length, clicksBetween(visits, dayEnd - 30 * DAY, dayEnd));
  });
  return {
    clicks,
    previousClicks,
    orders,
    conversion: rate(orders, clicks),
    previousConversion: rate(previousOrders, previousClicks),
    daily,
    trailing,
  };
}

/** Daily clicks as chart points, oldest first. */
export const clickSeries = (visits: Visit[]) =>
  visits.map((v) => ({
    key: v.date,
    label: formatDay(`${v.date}T12:00:00Z`),
    title: formatDay(`${v.date}T12:00:00Z`),
    value: v.clicks,
  }));

/** "0.05%": conversion rates are small, so they keep two decimals. */
export const formatRate = (rate: number) => `${(Math.round(rate * 10_000) / 100).toFixed(2)}%`;

/** Change in percentage points, with a true minus sign: "−0.16 pts". */
export function formatPoints(current: number, previous: number): { text: string; direction: "up" | "down" | "flat" } {
  const points = Math.round((current - previous) * 10_000) / 100;
  if (points === 0) return { text: "0.00 pts", direction: "flat" };
  return { text: `${points > 0 ? "+" : "−"}${Math.abs(points).toFixed(2)} pts`, direction: points > 0 ? "up" : "down" };
}

/** Which payout paid a referral: the paid payout whose period holds the order date. */
export function payoutFor(referral: Referral, payouts: Payout[]): Payout | undefined {
  if (referral.status !== "paid") return undefined;
  const day = referral.createdAt.slice(0, 10);
  return payouts.find((p) => p.status === "paid" && p.periodStart <= day && day <= p.periodEnd);
}

/** "July 2026" for a payout period. */
export function periodLabel(payout: Payout): string {
  const start = new Date(`${payout.periodStart}T12:00:00Z`);
  return `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
}
