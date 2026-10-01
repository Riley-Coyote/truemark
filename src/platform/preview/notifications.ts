/**
 * Alerts for each audience: the owner (the command center), each partner (the
 * partner portal) and each buyer (their account and emails). Live alerts are
 * raised by the store as things happen; a short history is derived from the
 * sample data so no inbox starts empty. Nothing here is sent anywhere: sending
 * email and text messages arrives with the backend.
 */
import { useCallback, useEffect, useState } from "react";
import * as seed from "../seed";
import { STORE_CHANGE, read, worldNow, write } from "./storage";
import type { Money } from "../types";

export type Audience = "owner" | `partner:${string}` | `buyer:${string}`;

export type NoticeKind =
  | "order.placed"
  | "order.packed"
  | "order.shipped"
  | "order.delivered"
  | "referral.created"
  | "commission.approved"
  | "payout.sent";

export type Notice = {
  id: string;
  audience: Audience;
  kind: NoticeKind;
  title: string;
  body: string;
  amount?: Money;
  /** The in-app route that shows the thing the alert is about. */
  href?: string;
  at: string;
  read: boolean;
};

type Stored = { added: Notice[]; read: string[] };
const KEY = "tm-preview-notices";
const DAY = 86_400_000;
const money = (n: Money) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const today = Date.parse(`${seed.TODAY}T23:59:59Z`);

/** A short, true history for an audience, built from the sample data. */
function history(audience: Audience): Notice[] {
  if (audience === "owner") {
    return seed.orders.slice(0, 6).map((o) => {
      const buyer = seed.buyers.find((b) => b.id === o.buyerId);
      const via = o.discount?.partnerId ? ` · via ${o.discount.code}` : "";
      return {
        id: `h-owner-${o.id}`,
        audience,
        kind: "order.placed" as const,
        title: `New order ${o.number}`,
        body: `${money(o.total)} · ${buyer?.institution ?? "Research account"}${via}`,
        amount: o.total,
        href: `/admin/orders?order=${o.id}`,
        at: o.createdAt,
        read: true,
      };
    });
  }
  if (audience.startsWith("partner:")) {
    const partnerId = audience.slice("partner:".length);
    const items: Notice[] = [];
    for (const r of seed.referrals.filter((x) => x.partnerId === partnerId)) {
      items.push({
        id: `h-${r.id}-new`,
        audience,
        kind: "referral.created",
        title: `New order through your ${r.via}`,
        body: `Order ${r.orderNumber} · ${money(r.orderSubtotal)} subtotal`,
        amount: r.commission,
        href: "/partners/app/referrals",
        at: r.createdAt,
        read: true,
      });
      const approvedAt = Date.parse(r.createdAt) + 14 * DAY;
      if (r.status !== "pending" && approvedAt <= today) {
        items.push({
          id: `h-${r.id}-approved`,
          audience,
          kind: "commission.approved",
          title: "Commission approved",
          body: `Order ${r.orderNumber} · ready for payout`,
          amount: r.commission,
          href: "/partners/app/payouts",
          at: new Date(approvedAt).toISOString(),
          read: true,
        });
      }
    }
    for (const p of seed.payouts.filter((x) => x.partnerId === partnerId)) {
      items.push({
        id: `h-${p.id}`,
        audience,
        kind: "payout.sent",
        title: "Payout sent",
        body: `${p.referrals} ${p.referrals === 1 ? "order" : "orders"} · ${p.method}`,
        amount: p.amount,
        href: "/partners/app/payouts",
        at: `${p.paidAt}T15:00:00.000Z`,
        read: true,
      });
    }
    return items;
  }
  const buyerId = audience.slice("buyer:".length);
  return seed.orders
    .filter((o) => o.buyerId === buyerId && (o.status === "shipped" || o.status === "delivered"))
    .map((o) => ({
      id: `h-buyer-${o.id}-${o.status}`,
      audience,
      kind: o.status === "shipped" ? ("order.shipped" as const) : ("order.delivered" as const),
      title: o.status === "shipped" ? `Order ${o.number} has shipped` : `Order ${o.number} was delivered`,
      body: o.status === "shipped" ? "Shipped with temperature control when applicable" : "Certificates for each lot are in your account",
      href: `/account/orders/${o.id}`,
      at: o.events[o.events.length - 1]?.at ?? o.createdAt,
      read: true,
    }));
}

export const notices = {
  list(audience: Audience): Notice[] {
    const stored = read<Stored>(KEY, { added: [], read: [] });
    const readSet = new Set(stored.read);
    return [...stored.added.filter((n) => n.audience === audience), ...history(audience)]
      .map((n) => ({ ...n, read: n.read || readSet.has(n.id) }))
      .sort((a, b) => b.at.localeCompare(a.at));
  },
  add(notice: Omit<Notice, "id" | "read" | "at"> & { at?: string }): Notice {
    const stored = read<Stored>(KEY, { added: [], read: [] });
    const created: Notice = {
      ...notice,
      id: `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      at: notice.at ?? worldNow(),
      read: false,
    };
    write(KEY, { ...stored, added: [created, ...stored.added].slice(0, 200) });
    return created;
  },
  markRead(audience: Audience, ids?: string[]) {
    const stored = read<Stored>(KEY, { added: [], read: [] });
    const targets = ids ?? notices.list(audience).filter((n) => !n.read).map((n) => n.id);
    write(KEY, { ...stored, read: [...new Set([...stored.read, ...targets])] });
  },
};

/** An audience's alerts, kept current as the store changes here or in another tab. */
export function useNotices(audience: Audience | null) {
  const load = useCallback(() => (audience ? notices.list(audience) : []), [audience]);
  const [items, setItems] = useState<Notice[]>(load);
  useEffect(() => {
    setItems(load());
    const refresh = () => setItems(load());
    window.addEventListener(STORE_CHANGE, refresh);
    return () => window.removeEventListener(STORE_CHANGE, refresh);
  }, [load]);
  return {
    items,
    unread: items.filter((n) => !n.read).length,
    markAllRead: () => audience && notices.markRead(audience),
    markRead: (id: string) => audience && notices.markRead(audience, [id]),
  };
}
