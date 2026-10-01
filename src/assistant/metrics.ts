import type { Buyer, Lot, Order, Partner, Referral, Visit } from "../platform/types";
import type { AssistantProduct } from "../platform/assistant-types";

const DAY = 86400000;
const round = (n: number) => Math.round(n * 100) / 100;
export const counted = (o: Order) => o.status !== "cancelled" && o.status !== "refunded";
export function windowFor(period: string, now: string) {
  const end = Date.parse(now);
  const date = new Date(now);
  const start = period === "month" ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) : end - Number.parseInt(period, 10) * DAY;
  return { start, end, days: Math.max((end - start) / DAY, 1) };
}
export const within = (iso: string, window: { start: number; end: number }) => Date.parse(iso) >= window.start && Date.parse(iso) <= window.end;
const net = (o: Order) => o.subtotal - (o.discount?.amount ?? 0);
export function recordedStock(product: AssistantProduct, lots: Lot[]) {
  if (product.stock !== null) return { stock: product.stock, stockBasis: "Recorded product stock" };
  const own = lots.filter((lot) => lot.productId === product.id && ["quarantine", "testing", "released"].includes(lot.status));
  return { stock: own.length && own.every((lot) => lot.units !== null) ? own.reduce((sum, lot) => sum + lot.units!, 0) : null,
    stockBasis: "Units on hand in quarantine, testing and released lots, as in Products. Includes unreleased inventory; unknown counts stay unknown." };
}
export function reorder(orders: Order[], now: string) {
  const dates = orders.filter(counted).map((o) => Date.parse(o.createdAt)).sort((a, b) => a - b);
  const intervals = dates.slice(1).map((date, i) => (date - dates[i]) / DAY).filter((days) => days > 0).sort((a, b) => a - b);
  const middle = Math.floor(intervals.length / 2);
  const median = intervals.length ? intervals.length % 2 ? intervals[middle] : (intervals[middle - 1] + intervals[middle]) / 2 : null;
  return { purchases: dates.length, intervals: intervals.length, medianDays: median === null ? null : round(median),
    daysSinceLast: dates.length ? round((Date.parse(now) - dates.at(-1)!) / DAY) : null,
    due: intervals.length >= 2 && median !== null && Date.parse(now) - dates.at(-1)! >= median * DAY,
    evidence: intervals.length >= 2 ? "Observed customer interval" : "Too few repeat purchases to suggest a reorder" };
}
export function partnerMomentum(partner: Partner, referrals: Referral[], visits: Visit[], now: string) {
  const w = windowFor("30d", now), previous = { start: w.start - 30 * DAY, end: w.start - 1 };
  const own = referrals.filter((r) => r.partnerId === partner.id && r.status !== "void");
  const current = own.filter((r) => within(r.createdAt, w));
  const before = own.filter((r) => within(r.createdAt, previous));
  const clicks = visits.filter((v) => within(`${v.date}T12:00:00Z`, w)).reduce((sum, v) => sum + v.clicks, 0);
  return { id: partner.id, name: partner.name, status: partner.status, orders30d: current.length, previous30d: before.length,
    commission30d: round(current.reduce((sum, r) => sum + r.commission, 0)), visits30d: clicks,
    trend: current.length > before.length ? "rising" : current.length < before.length ? "slowing" : "unchanged",
    visitsWithoutOrders: clicks > 0 && current.length === 0 };
}
export function businessSummary(data: { orders: Order[]; buyers: Buyer[]; products: AssistantProduct[]; lots: Lot[]; partners: ReturnType<typeof partnerMomentum>[] }, period: string, now: string, sample: boolean) {
  const w = windowFor(period, now), previous = { start: w.start - (w.end - w.start), end: w.start - 1 };
  const current = data.orders.filter((o) => within(o.createdAt, w));
  const before = data.orders.filter((o) => within(o.createdAt, previous));
  const paid = current.filter(counted);
  const pairs = new Map<string, number>();
  for (const o of paid) {
    const ids = [...new Set(o.lines.map((l) => l.productId))].sort();
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
      const pair = `${ids[a]} + ${ids[b]}`; pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
    }
  }
  const stock = data.products.map((p) => {
    const unitsSold = paid.reduce((sum, o) => sum + o.lines.filter((l) => l.productId === p.id).reduce((n, l) => n + l.quantity, 0), 0);
    const inventory = recordedStock(p, data.lots);
    return { id: p.id, name: p.name, ...inventory, unitsSold, daysOfStock: inventory.stock !== null && unitsSold > 0 ? round(inventory.stock / (unitsSold / w.days)) : null };
  });
  const reorders = data.buyers.map((b) => ({ id: b.id, name: b.name, ...reorder(data.orders.filter((o) => o.buyerId === b.id), now) }));
  const firstBuyers = data.buyers.filter((b) => {
    const first = data.orders.filter((o) => o.buyerId === b.id && counted(o)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    return first && within(first.createdAt, w);
  });
  const anomalies = (rows: Order[]) => ({ orders: rows.length, cancellations: rows.filter((o) => o.status === "cancelled").length, refunds: rows.filter((o) => o.status === "refunded").length });
  return { sample, asOf: now, period, days: round(w.days), basis: "Order creation dates; revenue is merchandise after discounts, excluding cancelled/refunded orders. Stock pace is an estimate, not a forecast.",
    orders: current.length, revenue: round(paid.reduce((sum, o) => sum + net(o), 0)), previousRevenue: round(before.filter(counted).reduce((sum, o) => sum + net(o), 0)),
    reorderCandidates: reorders.filter((b) => b.due).slice(0, 3), insufficientReorderHistory: reorders.filter((b) => b.intervals < 2).length,
    bundles: [...pairs].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([products, ordersTogether]) => ({ products, ordersTogether, outOfOrders: paid.length })),
    slowMovers: stock.filter((p) => p.stock !== null && p.stock > 0 && p.unitsSold === 0).slice(0, 3),
    stockPace: stock.filter((p) => p.daysOfStock !== null).sort((a, b) => a.daysOfStock! - b.daysOfStock!).slice(0, 3), untrackedStock: stock.filter((p) => p.stock === null).length,
    partnerMomentum: data.partners.filter((p) => p.trend !== "unchanged" || p.visitsWithoutOrders).slice(0, 3),
    anomalies: { current: anomalies(current), previous: anomalies(before), evidence: current.length < 10 || before.length < 10 ? "Too few orders for a reliable anomaly comparison" : "Compare counts and denominators; changes alone do not establish a cause" },
    firstBuyers: { count: firstBuyers.length, examples: firstBuyers.slice(0, 3).map(({ id, name }) => ({ id, name })) },
    awaitingLots: data.lots.filter((lot) => ["quarantine", "testing"].includes(lot.status) && stock.some((p) => p.id === lot.productId && p.unitsSold > 0)).slice(0, 3).map((l) => ({ lot: l.lot, productId: l.productId, status: l.status })),
  };
}
export function trend(orders: Order[], metric: string, period: string, groupBy: string, now: string) {
  const selected = orders.filter((o) => within(o.createdAt, windowFor(period, now)));
  const rows = metric === "cancellations" ? selected.filter((o) => o.status === "cancelled") : metric === "refunds" ? selected.filter((o) => o.status === "refunded") : selected.filter(counted);
  const groups = new Map<string, number>();
  for (const o of rows) {
    const value = metric === "revenue" ? net(o) : metric === "units" ? o.lines.reduce((sum, l) => sum + l.quantity, 0) : 1;
    if (groupBy === "product") {
      for (const id of new Set(o.lines.map((l) => l.productId))) {
        const lines = o.lines.filter((l) => l.productId === id);
        const n = metric === "revenue" ? lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0) * (o.subtotal ? net(o) / o.subtotal : 0)
          : metric === "units" ? lines.reduce((sum, l) => sum + l.quantity, 0) : 1;
        groups.set(id, (groups.get(id) ?? 0) + n);
      }
    } else {
      const key = groupBy === "day" ? o.createdAt.slice(0, 10) : groupBy === "partner" ? o.discount?.partnerId ?? "direct" : o.buyerId;
      groups.set(key, (groups.get(key) ?? 0) + value);
    }
  }
  return { metric, period, groupBy, asOf: now, ordersInPeriod: selected.length, basis: "Order creation date; net merchandise, excluding cancelled/refunded orders except when counting those statuses", rows: [...groups].sort((a, b) => groupBy === "day" ? a[0].localeCompare(b[0]) : b[1] - a[1]).map(([group, value]) => ({ group, value: round(value) })) };
}
