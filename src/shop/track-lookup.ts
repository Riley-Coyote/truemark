import { LIVE } from "../platform/mode";
import { live } from "../platform/live/runtime";
import type { TrackedOrder } from "../platform/live/rows";
import { store } from "../platform/store";
import type { Order } from "../platform/types";

/* Finding an order by its number and the email it was placed with: the Track page's lookup, shared
   with the chat so both answer the same way. */

export const ORDER_NUMBER = /^TM-\d{5}$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "tm 10478", "10478" and "TM10478" all mean TM-10478. */
export function normaliseNumber(input: string): string {
  const compact = input.trim().toUpperCase().replace(/[\s–—]/g, "");
  const digits = compact.replace(/^TM-?/, "");
  return /^\d{5}$/.test(digits) ? `TM-${digits}` : compact;
}

/**
 * An order by its number and the email it was placed with. Both reads happen
 * whether or not the number exists, and a miss gives the same answer either way,
 * so the page never tells anyone which orders exist. At launch the backend makes
 * this check itself.
 */
export async function lookUp(number: string, email: string): Promise<Order | TrackedOrder | null> {
  if (LIVE) return live().trackOrder(number, email);
  const [order, buyers] = await Promise.all([store.orders.get(number), store.buyers.list()]);
  const buyer = order ? buyers.find((b) => b.id === order.buyerId) : undefined;
  return order && buyer && buyer.email.toLowerCase() === email.trim().toLowerCase() ? order : null;
}

