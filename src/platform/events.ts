/**
 * The platform's event line. When something happens (an order is placed, an
 * order ships, a partner earns), every open view hears it: in this tab through
 * an in-page target, and in other tabs and frames of the same site through a
 * BroadcastChannel. Screens use it to raise alerts; the store uses it to keep
 * every open view's data current.
 */
import type { Money, OrderStatus } from "./types";

export type PlatformEvent =
  | { type: "order.placed"; orderId: string; number: string; total: Money; buyerId: string; partnerId?: string; at: string }
  | {
      type: "order.status";
      orderId: string;
      number: string;
      status: OrderStatus;
      buyerId: string;
      at: string;
      carrier?: string;
      tracking?: string;
    }
  | {
      type: "referral.created";
      referralId: string;
      partnerId: string;
      orderNumber: string;
      orderSubtotal: Money;
      commission: Money;
      /** Whether the buyer arrived through the partner's link or typed the code. */
      via: "link" | "code";
      at: string;
    };

const CHANNEL = "truemark-platform";
const local = new EventTarget();
const channel: BroadcastChannel | null = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);

/** Tell every open view, here and in other tabs, that something happened. */
export function emit(event: PlatformEvent) {
  local.dispatchEvent(new CustomEvent<PlatformEvent>("platform", { detail: event }));
  channel?.postMessage(event);
}

/** Listen for platform events from this tab and from other tabs. Returns an unsubscribe. */
export function onPlatformEvent(handler: (event: PlatformEvent, fromHere: boolean) => void): () => void {
  const onLocal = (e: Event) => handler((e as CustomEvent<PlatformEvent>).detail, true);
  const onRemote = (e: MessageEvent<PlatformEvent>) => handler(e.data, false);
  local.addEventListener("platform", onLocal);
  channel?.addEventListener("message", onRemote);
  return () => {
    local.removeEventListener("platform", onLocal);
    channel?.removeEventListener("message", onRemote);
  };
}
