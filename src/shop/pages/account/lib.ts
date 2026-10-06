/**
 * Pure helpers for the research account pages. Dates are shown in UTC so a
 * record reads the same wherever it is opened.
 */
import { products } from "../../../data";
import type { Product } from "../../../data";
import type { BuyerStatus, Order, OrderStatus, PaymentStatus } from "../../../platform/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "23 Sep 2026" */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "23 September 2026" */
export function longDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "23 Sep" */
export function dayMonth(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Dr. Mara Ellison" → "Mara" */
export function firstName(name: string): string {
  return name.replace(/^(dr|prof|mr|mrs|ms|mx)\.?\s+/i, "").trim().split(/\s+/)[0] ?? name;
}

export const productFor = (id: string): Product | undefined => products.find((p) => p.id === id);

export const orderStatusLabel: Record<OrderStatus, string> = {
  placed: "Placed",
  paid: "Paid",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/**
 * How a status reads at a glance. The signal colour is kept for verified,
 * released and paid; order progress stays neutral.
 */
export type Tone = "signal" | "done" | "progress" | "closed" | "pending";

export function orderTone(status: OrderStatus): Tone {
  if (status === "delivered") return "done";
  if (status === "cancelled" || status === "refunded") return "closed";
  return "progress";
}

export const paymentLabel: Record<PaymentStatus, string> = {
  pending: "Awaiting payment",
  authorized: "Authorized",
  captured: "Paid",
  partially_refunded: "Partly refunded",
  refunded: "Refunded",
  failed: "Failed",
};

export function paymentTone(status: PaymentStatus): Tone {
  if (status === "captured") return "signal";
  if (status === "refunded" || status === "failed") return "closed";
  return "progress";
}

export const buyerStatusLabel: Record<BuyerStatus, string> = {
  verified: "Verified research account",
  pending: "Application under review",
  declined: "Application not approved",
  suspended: "Account suspended",
};

export const units = (order: Order) => order.lines.reduce((sum, line) => sum + line.quantity, 0);

export const byNewest = (a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt);

/** When the order reached a status, if it has. */
export const eventAt = (order: Order, status: OrderStatus) => order.events.find((e) => e.status === status)?.at;

/** The most recent thing that happened to an order. */
export function latestEvent(order: Order) {
  return [...order.events].sort((a, b) => a.at.localeCompare(b.at)).pop() ?? { status: order.status, at: order.createdAt };
}

export type ReceivedLot = {
  lot: string;
  productId: string;
  /** The most recent delivery of this lot to the buyer. */
  receivedAt: string;
  orders: { id: string; number: string }[];
};

/** Every lot the buyer has received: one entry per lot, from delivered orders. */
export function receivedLots(orders: Order[]): ReceivedLot[] {
  const map = new Map<string, ReceivedLot>();
  for (const order of [...orders].sort(byNewest)) {
    const delivered = eventAt(order, "delivered");
    if (!delivered) continue;
    for (const line of order.lines) {
      const entry = map.get(line.lot);
      if (!entry) {
        map.set(line.lot, { lot: line.lot, productId: line.productId, receivedAt: delivered, orders: [{ id: order.id, number: order.number }] });
      } else {
        if (delivered > entry.receivedAt) entry.receivedAt = delivered;
        if (!entry.orders.some((o) => o.id === order.id)) entry.orders.push({ id: order.id, number: order.number });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt) || a.lot.localeCompare(b.lot));
}

/** Only accept in-app account paths as a place to return to after signing in. */
export function safeReturn(path: unknown): string | undefined {
  return typeof path === "string" && /^\/account(\/|$)/.test(path) ? path : undefined;
}
