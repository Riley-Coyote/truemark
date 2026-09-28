/**
 * A partner's momentum, computed from their own referrals, payouts and visits:
 * this month against their goal, their best month, the milestones they have
 * reached and the sample levels ahead. Like metrics.ts, every figure counts
 * referred orders that are not void, and windows count back from the end of
 * the sample world's day.
 */
import { formatDay, formatMoney } from "../app-kit";
import type { Payout, Referral, Visit } from "../platform/types";
import { END, MONTHS, periodLabel } from "./metrics";

const DAY = 86_400_000;
const at = (iso: string) => Date.parse(iso);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** "$250" for whole dollars, "$250.50" otherwise: goals and targets read as round numbers. */
export const roundMoney = (value: number) => formatMoney(value).replace(/\.00$/, "");
const counted = (referrals: Referral[]) =>
  referrals.filter((r) => r.status !== "void").sort((a, b) => a.createdAt.localeCompare(b.createdAt));

/* ---------- This month against the partner's goal ---------- */

/** How far this month's commission has come toward the partner's monthly goal, and when it got there. */
export function goalProgress(referrals: Referral[], current: number, goal: number) {
  const now = new Date(END - DAY);
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  let running = 0;
  let reachedAt: string | undefined;
  for (const r of counted(referrals)) {
    if (at(r.createdAt) < start || at(r.createdAt) >= END) continue;
    running = round2(running + r.commission);
    if (!reachedAt && running >= goal) reachedAt = r.createdAt;
  }
  return {
    goal,
    share: goal > 0 ? current / goal : 0,
    remaining: round2(Math.max(goal - current, 0)),
    reached: current >= goal,
    reachedAt,
  };
}

/**
 * The partner's best month so far, by commission that is approved or already paid,
 * named "August" (with its year only when it is not this year).
 */
export function bestMonth(referrals: Referral[]): { amount: number; label: string } | null {
  const months = new Map<string, number>();
  for (const r of referrals) {
    if (r.status !== "approved" && r.status !== "paid") continue;
    const key = r.createdAt.slice(0, 7);
    months.set(key, round2((months.get(key) ?? 0) + r.commission));
  }
  let best: [string, number] | null = null;
  for (const entry of months) if (!best || entry[1] > best[1]) best = entry;
  if (!best) return null;
  const [year, month] = best[0].split("-").map(Number);
  const thisYear = new Date(END - DAY).getUTCFullYear();
  return { amount: best[1], label: year === thisYear ? MONTHS[month - 1] : `${MONTHS[month - 1]} ${year}` };
}

/* ---------- Milestones ---------- */

type MilestoneRule = { id: string; title: string; kind: "orders" | "earned"; target: number };

const MILESTONES: MilestoneRule[] = [
  { id: "first-order", title: "First referred order", kind: "orders", target: 1 },
  { id: "orders-10", title: "10 referred orders", kind: "orders", target: 10 },
  { id: "earned-500", title: "$500 earned", kind: "earned", target: 500 },
  { id: "orders-25", title: "25 referred orders", kind: "orders", target: 25 },
  { id: "earned-1000", title: "$1,000 earned", kind: "earned", target: 1000 },
];

export type Milestone = MilestoneRule & {
  /** When the referral that reached it was placed. */
  reachedAt?: string;
  /** Where the partner stands on this milestone's measure: orders, or dollars earned. */
  current: number;
};

/** Each milestone, reached or not, in the order a partner meets them; `next` is the first one ahead. */
export function milestones(referrals: Referral[]) {
  const reached = new Map<string, string>();
  let orders = 0;
  let earned = 0;
  for (const r of counted(referrals)) {
    orders += 1;
    earned = round2(earned + r.commission);
    for (const rule of MILESTONES) {
      if (!reached.has(rule.id) && (rule.kind === "orders" ? orders : earned) >= rule.target) reached.set(rule.id, r.createdAt);
    }
  }
  const list: Milestone[] = MILESTONES.map((rule) => ({
    ...rule,
    reachedAt: reached.get(rule.id),
    current: rule.kind === "orders" ? orders : earned,
  }));
  return { list, next: list.find((m) => !m.reachedAt), reached: reached.size, orders, earned };
}

/* ---------- Levels (sample) ---------- */

export type Level = { id: string; name: string; rate: number; from: number };

/** Sample levels for the client to set: a higher commission as referred orders add up. */
export const SAMPLE_LEVELS: Level[] = [
  { id: "partner", name: "Partner", rate: 0.12, from: 0 },
  { id: "senior", name: "Senior partner", rate: 0.14, from: 25 },
  { id: "principal", name: "Principal partner", rate: 0.16, from: 75 },
];

/** The level a count of referred orders reaches, the next one, and how far along the way to it the partner is. */
export function levelProgress(orders: number) {
  let index = 0;
  SAMPLE_LEVELS.forEach((level, i) => {
    if (orders >= level.from) index = i;
  });
  const current = SAMPLE_LEVELS[index];
  const next = SAMPLE_LEVELS[index + 1];
  return {
    index,
    current,
    next,
    orders,
    toGo: next ? next.from - orders : 0,
    /** Share of the way from the current level's threshold to the next one's. */
    share: next ? (orders - current.from) / (next.from - current.from) : 1,
  };
}

/* ---------- The week, for the weekly summary ---------- */

/** The last seven days of the sample world: clicks, referred orders, commission, and how the orders arrived. */
export function lastWeek(referrals: Referral[], visits: Visit[]) {
  const start = END - 7 * DAY;
  const orders = counted(referrals).filter((r) => at(r.createdAt) >= start && at(r.createdAt) < END);
  const clicks = visits
    .filter((v) => at(`${v.date}T12:00:00Z`) >= start && at(`${v.date}T12:00:00Z`) < END)
    .reduce((sum, v) => sum + v.clicks, 0);
  const first = new Date(start);
  const last = new Date(END - DAY);
  const range =
    first.getUTCMonth() === last.getUTCMonth()
      ? `${first.getUTCDate()}–${formatDay(last.toISOString())}`
      : `${formatDay(first.toISOString())} – ${formatDay(last.toISOString())}`;
  return {
    range,
    clicks,
    orders: orders.length,
    earned: round2(orders.reduce((sum, r) => sum + r.commission, 0)),
    viaLink: orders.filter((r) => r.via === "link").length,
    viaCode: orders.filter((r) => r.via === "code").length,
  };
}

/* ---------- Records the previews are built from ---------- */

/** The most recent referral, the most recent approved one, and the most recent payout with the orders it paid. */
export function latestRecords(referrals: Referral[], payouts: Payout[]) {
  const newest = [...referrals].filter((r) => r.status !== "void").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const payout = [...payouts]
    .filter((p) => p.status === "paid" && p.paidAt)
    .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))[0];
  const lines = payout
    ? referrals
        .filter(
          (r) =>
            r.status === "paid" &&
            r.createdAt.slice(0, 10) >= payout.periodStart &&
            r.createdAt.slice(0, 10) <= payout.periodEnd,
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];
  return {
    referral: newest[0],
    approved: newest.find((r) => r.status === "approved"),
    payout,
    payoutLabel: payout ? periodLabel(payout) : undefined,
    payoutLines: lines,
  };
}
