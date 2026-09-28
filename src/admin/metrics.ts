/**
 * Figures for the overview, computed from orders. The sample data runs to
 * TODAY in seed.ts, so every window counts back from the end of that day.
 * Cancelled and refunded orders are left out of revenue and order counts.
 */
import { TODAY } from "../platform/seed";
import type { Order, OrderStatus } from "../platform/types";
import { productById } from "../shop/catalog";
import { formatDay } from "../app-kit";

const DAY = 86_400_000;
/** Midnight after the last day of sample data. */
export const END = Date.parse(`${TODAY}T00:00:00Z`) + DAY;
export const TODAY_ISO = `${TODAY}T12:00:00.000Z`;

const OPEN: OrderStatus[] = ["placed", "paid", "packed", "shipped"];
export const isOpen = (status: OrderStatus) => OPEN.includes(status);
export const isCounted = (order: Order) => order.status !== "cancelled" && order.status !== "refunded";

const at = (iso: string) => Date.parse(iso);
const round2 = (n: number) => Math.round(n * 100) / 100;
export const units = (order: Order) => order.lines.reduce((sum, line) => sum + line.quantity, 0);

/** Orders created from `from` days ago up to `to` days ago (0 = now, open-ended). */
function between(orders: Order[], from: number, to: number) {
  const start = END - from * DAY;
  const stop = to === 0 ? Infinity : END - to * DAY;
  return orders.filter((o) => isCounted(o) && at(o.createdAt) >= start && at(o.createdAt) < stop);
}

function totals(list: Order[]) {
  const revenue = round2(list.reduce((sum, o) => sum + o.total, 0));
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

export type Overview = {
  current: { revenue: number; count: number; average: number };
  previous: { revenue: number; count: number; average: number };
  openNow: number;
  openBefore: number;
  /** 30 daily points, oldest first, each a trailing seven-day view. */
  spark: { revenue: number[]; count: number[]; average: number[]; open: number[] };
  weeks: { key: string; label: string; revenue: number; count: number }[];
};

export function overview(orders: Order[]): Overview {
  const current = totals(between(orders, 30, 0));
  const previous = totals(between(orders, 60, 30));
  const openNow = orders.filter((o) => isOpen(o.status)).length;
  const openBefore = openAt(orders, END - 30 * DAY - 1);

  const spark = { revenue: [] as number[], count: [] as number[], average: [] as number[], open: [] as number[] };
  let lastAverage = 0;
  for (let k = 29; k >= 0; k--) {
    const dayEnd = END - k * DAY;
    const trailing = totals(orders.filter((o) => isCounted(o) && at(o.createdAt) >= dayEnd - 7 * DAY && at(o.createdAt) < dayEnd));
    spark.revenue.push(trailing.revenue);
    spark.count.push(trailing.count);
    lastAverage = trailing.count ? trailing.average : lastAverage;
    spark.average.push(lastAverage);
    spark.open.push(openAt(orders, dayEnd - 1));
  }

  const weeks = Array.from({ length: 12 }, (_, w) => {
    const start = END - (12 - w) * 7 * DAY;
    const stop = w === 11 ? Infinity : END - (11 - w) * 7 * DAY;
    const list = orders.filter((o) => isCounted(o) && at(o.createdAt) >= start && at(o.createdAt) < stop);
    const t = totals(list);
    return { key: `w${w}`, label: formatDay(new Date(start).toISOString()), revenue: t.revenue, count: t.count };
  });

  return { current, previous, openNow, openBefore, spark, weeks };
}

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
