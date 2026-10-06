/**
 * The preview's stand-in for the backend. Every call is async, so screens are
 * built with loading and error states from the start; swapping this module for
 * real API calls should not change a single component.
 * Changes made in the preview persist in this browser's localStorage only.
 */
import { useCallback, useEffect, useState } from "react";
import { products, previewCategories } from "../../data";
import { emit } from "./events";
import { notices } from "./notifications";
import * as seed from "../seed";
import type { Product, Category } from "../../data";
import type { SettingsPatch } from "../commerce";
import { defaultSettings, priceQuote } from "../pricing";
import { STORE_CHANGE, read, worldNow, write } from "./storage";
import type { AssistantCapabilities, AssistantModels, AssistantIdentity, AssistantProduct } from "../assistant-types";
import { previewJournal } from "./content";
import type {
  Application,
  ApplicationStatus,
  Buyer,
  Discount,
  Lot,
  LotStatus,
  Order,
  OrderDraft,
  OrderStatus,
  Payout,
  Referral,
  ShippingMethod,
  StorefrontSettings,
  Visit,
} from "../types";

const LATENCY_MS = 140;
const wait = <T,>(value: T): Promise<T> =>
  new Promise((resolve) => window.setTimeout(() => resolve(structuredClone(value)), LATENCY_MS));


const KEYS = {
  session: "tm-preview-session",
  partnerSession: "tm-preview-partner-session",
  orders: "tm-preview-orders",
  applications: "tm-preview-applications",
  lots: "tm-preview-lots",
  buyers: "tm-preview-buyers",
  referrals: "tm-preview-referrals",
  orderUpdates: "tm-preview-order-updates",
  settings: "tm-preview-storefront-settings",
};

type OrderUpdate = Pick<Order, "status" | "events" | "payment"> & { shipping?: Order["shipping"] };

const allOrders = (): Order[] => {
  const updates = read<Record<string, OrderUpdate>>(KEYS.orderUpdates, {});
  return [...read<Order[]>(KEYS.orders, []), ...seed.orders].map((o) =>
    updates[o.id] ? { ...o, ...updates[o.id], shipping: { ...o.shipping, ...updates[o.id].shipping } } : o,
  );
};
const allReferrals = (): Referral[] => {
  const statuses = read<Record<string, Referral["status"]>>("tm-preview-assistant-referrals", {});
  return [...read<Referral[]>(KEYS.referrals, []), ...seed.referrals].map((r) => ({ ...r, status: statuses[r.id] ?? r.status }));
};
const allPayouts = () => [...read<Payout[]>("tm-preview-assistant-payouts", []), ...seed.payouts];
const allDiscounts = () => [...read<Discount[]>("tm-preview-assistant-discounts", []), ...seed.discounts];
const round2 = (n: number) => Math.round(n * 100) / 100;
const settings = (): StorefrontSettings => ({ ...defaultSettings, ...read(KEYS.settings, defaultSettings), taxMode: "off", taxShipping: false });
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const allApplications = (): Application[] => {
  const overrides = read<Record<string, Partial<Application>>>(KEYS.applications, {});
  const added = read<Application[]>(`${KEYS.applications}-added`, []);
  return [...added, ...seed.applications].map((a) => ({ ...a, ...overrides[a.id] }));
};
const allLots = (): Lot[] => {
  const overrides = read<Record<string, Partial<Lot>>>(KEYS.lots, {});
  return seed.lots.map((l) => ({ ...l, ...overrides[l.lot] }));
};
const allBuyers = (): Buyer[] => {
  const added = read<Buyer[]>(KEYS.buyers, []);
  return [...seed.buyers, ...added];
};

function discountFor(code?: string): Discount | undefined {
  if (!code) return undefined;
  const d = allDiscounts().find((x) => x.code === code.trim().toUpperCase());
  return d && d.active ? d : undefined;
}

/**
 * What an order draft comes to: its priced lines, subtotal, discount, shipping
 * and total, and, when a partner's code is on it, the partner's commission.
 */
export function quote(draft: OrderDraft) {
  const selectedMethod = seed.shippingMethods.find((m) => m.id === draft.shipping)!;
  const lines = draft.lines.map((l) => {
    const product = products.find((p) => p.id === l.productId)!;
    return { productId: l.productId, quantity: l.quantity, unitPrice: product.price ?? 0, lot: product.lot };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
  const discount = discountFor(draft.discountCode);
  const priced = priceQuote(subtotal, discount?.percent ?? 0, selectedMethod, settings(), draft.insurance);
  const { discountAmount, base } = priced;
  const method = { ...selectedMethod, price: priced.shipping };
  const partner = discount?.partnerId ? seed.partners.find((p) => p.id === discount.partnerId) : undefined;
  return {
    method,
    lines,
    subtotal,
    discount,
    discountAmount,
    insurance: priced.insurance,
    insuranceApplied: priced.insuranceApplied,
    total: priced.total,
    partner,
    base,
    commission: partner ? round2(base * partner.rate) : 0,
  };
}

export const store = {
  assistant: {
    saveModels: async (_models: AssistantModels): Promise<AssistantModels> => { throw new Error("Saving works in the live platform."); },
    identity: async (): Promise<AssistantIdentity> => null,
    capabilities: async (): Promise<AssistantCapabilities> => ({ updateProduct: false }),
    products: async (): Promise<AssistantProduct[]> => products.map((p) => ({ ...p, active: true, stock: null, description: p.description ?? null })),
    productRecord: async (id: string): Promise<Record<string, unknown> | null> => products.find((p) => p.id === id) ?? null,
    journal: async (all = false) => previewJournal(all),
  },
  settings: { get: (): Promise<StorefrontSettings> => wait(settings()),
    save: async (_patch: SettingsPatch): Promise<StorefrontSettings> => { throw new Error("Saving works in the live platform."); } },
  session: {
    /** The signed-in research buyer, or null. */
    get: () => {
      const id = read<string | null>(KEYS.session, null);
      return wait(allBuyers().find((b) => b.id === id) ?? null);
    },
    /** Preview only: any email signs in to the sample verified account. */
    signIn: (_email: string) => {
      write(KEYS.session, seed.demoBuyerId);
      return wait(allBuyers().find((b) => b.id === seed.demoBuyerId)!);
    },
    signOut: () => {
      write(KEYS.session, null);
      return wait(undefined);
    },
  },

  catalog: {
    products: (_includeInactive = false): Promise<Product[]> => wait(products.map((product) => ({ ...product, stock: null }))),
    categories: (): Promise<Category[]> => wait(previewCategories()),
    saveProduct: async (_product: Product, _expectedStock?: number | null): Promise<Product> => { throw new Error("Saving works in the live platform."); },
    saveCategory: async (_category: Category): Promise<Category> => { throw new Error("Saving works in the live platform."); },
    uploadPhoto: async (_productId: string, _file: File): Promise<string> => { throw new Error("Saving works in the live platform."); },
    shippingMethods: (): Promise<ShippingMethod[]> => wait(seed.shippingMethods),
    validateCode: (code: string): Promise<Discount | null> => wait(discountFor(code) ?? null),
  },

  orders: {
    listForBuyer: (buyerId: string) => wait(allOrders().filter((o) => o.buyerId === buyerId)),
    list: () => wait(allOrders()),
    get: (id: string) => wait(allOrders().find((o) => o.id === id || o.number === id) ?? null),
    place: async (buyerId: string, draft: OrderDraft): Promise<Order> => {
      const { method, lines, subtotal, discount, discountAmount, insurance, insuranceApplied, total, partner, base, commission } = quote(draft);
      const placed = read<Order[]>(KEYS.orders, []);
      const number = 10421 + seed.orders.length + placed.length;
      const now = worldNow();
      const order: Order = {
        id: `o-${number}`,
        number: `TM-${number}`,
        buyerId,
        createdAt: now,
        status: "placed",
        payment: "authorized",
        lines,
        address: draft.address,
        shipping: { method: method.id, price: method.price },
        subtotal,
        insurance,
        insuranceApplied,
        discount: discount ? { code: discount.code, amount: discountAmount, partnerId: discount.partnerId } : undefined,
        total,
        events: [{ status: "placed", at: now }],
      };
      write(KEYS.orders, [order, ...placed]);

      const buyer = allBuyers().find((b) => b.id === buyerId);
      notices.add({
        audience: "owner",
        kind: "order.placed",
        title: `New order ${order.number}`,
        body: `${money(order.total)} · ${buyer?.institution ?? "Research account"}${partner ? ` · via ${partner.code}` : ""}`,
        amount: order.total,
        href: `/admin/orders?order=${order.id}`,
        at: now,
      });
      notices.add({
        audience: `buyer:${buyerId}`,
        kind: "order.placed",
        title: `Order ${order.number} is confirmed`,
        body: "We'll write again when it ships.",
        href: `/account/orders/${order.id}`,
        at: now,
      });
      emit({ type: "order.placed", orderId: order.id, number: order.number, total: order.total, buyerId, partnerId: partner?.id, at: now });

      if (partner) {
        const referral: Referral = {
          id: `r-live-${number}`,
          partnerId: partner.id,
          orderId: order.id,
          orderNumber: order.number,
          createdAt: now,
          orderSubtotal: base,
          commission,
          status: "pending",
          via: draft.via ?? "code",
        };
        write(KEYS.referrals, [referral, ...read<Referral[]>(KEYS.referrals, [])]);
        notices.add({
          audience: `partner:${partner.id}`,
          kind: "referral.created",
          title: `New order through your ${referral.via}`,
          body: `Order ${order.number} · ${money(base)} subtotal`,
          amount: referral.commission,
          href: "/partners/app/referrals",
          at: now,
        });
        emit({
          type: "referral.created",
          referralId: referral.id,
          partnerId: partner.id,
          orderNumber: order.number,
          orderSubtotal: base,
          commission: referral.commission,
          via: referral.via,
          at: now,
        });
      }
      return wait(order);
    },
    /**
     * Move an order along its journey (packed, shipped with a carrier and tracking
     * number, delivered). The buyer is told at each step; open views refresh.
     */
    advance: (id: string, status: OrderStatus, extra: { carrier?: string; tracking?: string; note?: string } = {}) => {
      const order = allOrders().find((o) => o.id === id || o.number === id);
      if (!order) return Promise.reject(new Error(`No order ${id}`));
      const at = worldNow();
      const updates = read<Record<string, OrderUpdate>>(KEYS.orderUpdates, {});
      const shipping = extra.carrier || extra.tracking ? { ...order.shipping, carrier: extra.carrier, tracking: extra.tracking } : order.shipping;
      // Marking an order paid captures its payment; every later step carries that forward.
      const payment = status === "paid" ? "captured" : order.payment;
      updates[order.id] = { status, events: [...order.events, { status, at, note: extra.note }], shipping, payment };
      write(KEYS.orderUpdates, updates);
      const step =
        status === "packed"
          ? { kind: "order.packed" as const, title: `Order ${order.number} is packed`, body: "Packed cold and held until it ships." }
          : status === "shipped"
            ? {
                kind: "order.shipped" as const,
                title: `Order ${order.number} has shipped`,
                body: extra.tracking ? `${extra.carrier ?? "Carrier"} · ${extra.tracking}` : "Shipped with temperature control when applicable",
              }
            : status === "delivered"
              ? { kind: "order.delivered" as const, title: `Order ${order.number} was delivered`, body: "Certificates for each lot are in your account." }
              : null;
      if (step) notices.add({ audience: `buyer:${order.buyerId}`, ...step, href: `/account/orders/${order.id}`, at });
      emit({ type: "order.status", orderId: order.id, number: order.number, status, buyerId: order.buyerId, at, ...extra });
      return wait(allOrders().find((o) => o.id === order.id)!);
    },
  },

  lots: {
    list: () => wait(allLots()),
    get: (lot: string) => wait(allLots().find((l) => l.lot === lot.trim().toUpperCase()) ?? null),
    setStatus: (lot: string, status: LotStatus) => {
      const overrides = read<Record<string, Partial<Lot>>>(KEYS.lots, {});
      overrides[lot] = { ...overrides[lot], status, ...(status === "released" ? { releasedAt: worldNow() } : {}) };
      write(KEYS.lots, overrides);
      return wait(allLots().find((l) => l.lot === lot)!);
    },
  },

  buyers: {
    list: () => wait(allBuyers()),
    get: (id: string) => wait(allBuyers().find((b) => b.id === id) ?? null),
  },

  applications: {
    list: () => wait(allApplications()),
    submit: (form: Omit<Application, "id" | "submittedAt" | "status">) => {
      const added = read<Application[]>(`${KEYS.applications}-added`, []);
      const application: Application = {
        ...form,
        id: `app-${400 + added.length}`,
        submittedAt: worldNow(),
        status: "submitted",
      };
      write(`${KEYS.applications}-added`, [application, ...added]);
      return wait(application);
    },
    review: (id: string, status: Exclude<ApplicationStatus, "submitted">, note?: string) => {
      const overrides = read<Record<string, Partial<Application>>>(KEYS.applications, {});
      overrides[id] = { status, reviewNote: note, reviewedAt: worldNow() };
      write(KEYS.applications, overrides);
      return wait(allApplications().find((a) => a.id === id)!);
    },
  },

  partners: {
    list: () => wait(seed.partners),
    get: (id: string) => wait(seed.partners.find((p) => p.id === id) ?? null),
    /** Preview only: the portal signs in as the sample partner. */
    me: () => {
      const id = read<string | null>(KEYS.partnerSession, seed.demoPartnerId);
      return wait(seed.partners.find((p) => p.id === id) ?? null);
    },
    referrals: (partnerId?: string): Promise<Referral[]> =>
      wait(partnerId ? allReferrals().filter((r) => r.partnerId === partnerId) : allReferrals()),
    payouts: (partnerId?: string): Promise<Payout[]> =>
      wait(partnerId ? allPayouts().filter((p) => p.partnerId === partnerId) : allPayouts()),
    visits: (partnerId: string): Promise<Visit[]> => wait(seed.visitsFor(partnerId)),
    discounts: (): Promise<Discount[]> => wait(allDiscounts()),
  },
};

export type Resource<T> = { data: T | undefined; loading: boolean; error: Error | null; reload: () => void };

/**
 * Load async data for a screen and re-load when the preview store changes.
 * `deps` works like an effect's dependency list.
 */
export function useResource<T>(load: () => Promise<T>, deps: unknown[] = []): Resource<T> {
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: Error | null }>({
    data: undefined,
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    load().then(
      (data) => live && setState({ data, loading: false, error: null }),
      (error: unknown) => live && setState({ data: undefined, loading: false, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      live = false;
    };
  }, [...deps, tick]);
  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener(STORE_CHANGE, onChange);
    return () => window.removeEventListener(STORE_CHANGE, onChange);
  }, [reload]);
  return { ...state, reload };
}
