import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import type { Address, Application, Buyer, OrderDraft, OrderStatus, Partner } from "../types";
import { catalogPhotoPath, stockProblem } from "../commerce";
import { priceQuote, roundMoney } from "../pricing";
import type { Audience, Notice } from "../notifications";
import type { PlatformEvent } from "../events";
import type * as Preview from "../preview/store";
import * as map from "./rows";
import { createContentAdapter } from "./content";

export type Profile = { id: string; role: "owner" | "staff" | "buyer" | "partner" };
export type ApplicationForm = Omit<Application, "id" | "submittedAt" | "status"> & { country?: string };
type Result<T> = { data: T | null; error: { message: string } | null };
function unwrap<T>({ data, error }: Result<T>): T {
  if (error) throw new Error(error.message);
  return data as T;
}
const savingNext = async (): Promise<never> => { throw new Error("Saving arrives next"); };
export const approvalCutoff = (today = new Date()) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - 14 * 86_400_000).toISOString().slice(0, 10);

/** Injected client keeps transport, row mapping, authorization failures and events testable. */
export function createLiveAdapter(client: SupabaseClient, options: {
  changed?: () => void; emit?: (event: PlatformEvent) => void; redirectTo?: () => string;
} = {}) {
  const changed = options.changed ?? (() => {});
  const emit = options.emit ?? (() => {});
  const rpc = async <T,>(name: string, args: Record<string, unknown> = {}) => unwrap<T>(await client.rpc(name, args));
  async function rows(table: string, select = "*", filters: Record<string, string> = {}) {
    const result: map.Row[] = [];
    for (let offset = 0; ; offset += 1000) {
      let query = client.from(table).select(select);
      for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
      // Stable pagination, also for tables whose key is not an `id` column.
      const key = table === "lots" ? "lot" : table === "discounts" ? "code" : table === "visits" ? "date" : "id";
      const page = unwrap<map.Row[]>(await query.order(key).range(offset, offset + 999).returns<map.Row[]>());
      result.push(...page);
      if (page.length < 1000) return result;
    }
  }
  async function userId() { const { data, error } = await client.auth.getSession(); if (error) throw new Error(error.message); return data.session?.user.id ?? null; }
  async function profile(): Promise<Profile | null> {
    const id = await userId();
    if (!id) return null;
    const row = (await rows("profiles", "*", { id }))[0];
    return row ? { id: String(row.id), role: row.role as Profile["role"] } : null;
  }
  const orderRows = (filters = {}) => rows("orders", "*, order_lines(*), order_events(*)", filters);
  async function getOrder(id: string) {
    const found = await orderRows(id.startsWith("TM-") ? { number: id } : { id });
    return found[0] ? map.order(found[0]) : null;
  }
  const codes = async () => (await rows("discounts")).map(map.discount);
  async function partnerRows(filters = {}): Promise<Partner[]> {
    const [people, discounts] = await Promise.all([rows("partners", "*", filters), codes()]);
    return people.map((row) => map.partner(row, discounts));
  }
  async function buyerSession() {
    const p = await profile();
    if (p?.role !== "buyer") return null;
    const found = await rows("buyers", "*, addresses(*)", { user_id: p.id });
    return found[0] ? map.buyer(found[0]) : null;
  }
  async function refreshedOrder(row: map.Row) {
    const result = await getOrder(String(row.id));
    if (!result) throw new Error("The order was saved, but could not be loaded. Check your orders before trying again.");
    changed();
    return result;
  }
  const store: typeof Preview.store = {
    assistant: {
      saveModels: async (draft) => { const saved = await rpc<import("../assistant-types").AssistantModels>("update_assistant_settings", { draft }); changed(); return saved; },
      identity: profile,
      capabilities: async () => rpc("assistant_capabilities"),
      products: async () => (await rows("products")).map((row) => ({ ...map.product(row), active: Boolean(row.active),
        stock: row.stock == null ? null : Number(row.stock), description: row.description == null ? null : String(row.description) })),
      productRecord: async (id) => (await rows("products", "*", { id }))[0] ?? null,
      journal: (all = false) => createContentAdapter(client, rows, rpc, changed).articles.list(all),
    },
    settings: { get: async () => {
      const row = (await rows("settings"))[0];
      if (!row) throw new Error("Storefront settings are unavailable.");
      return map.settings(row);
    }, save: async (draft) => {
      const result = map.settings(await rpc<map.Row>("update_storefront_settings", { draft }));
      changed(); return result;
    } },
    session: {
      get: buyerSession,
      signIn: async (): Promise<Buyer> => { throw new Error("Sign in with your email and password at /access."); },
      signOut: async () => { const { error } = await client.auth.signOut(); if (error) throw new Error(error.message); stopRealtime(); clearSession(); changed(); },
    },
    catalog: {
      products: async (includeInactive = false) => (await rows("products", "*", includeInactive ? {} : { active: "true" })).map(map.product),
      categories: async () => (await rows("categories")).map(map.category).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)),
      saveProduct: async (product, expectedStock) => {
        const { id, name, size, category, price, form, tag, description, stock, image, lot, color, colorInk } = product;
        const result = map.product(await rpc<map.Row>("upsert_product", { draft: { id, name, size, category, price, form,
          ...(expectedStock !== undefined ? { expectedStock } : {}), tag: tag ?? null, active: product.active !== false, description: description ?? null, stock: stock ?? null, image: image ?? null, lot, color, colorInk } }));
        changed(); return result;
      },
      saveCategory: async (category) => {
        const { id, name, short, labelColor, position, onHome, members } = category;
        const result = map.category(await rpc<map.Row>("upsert_category", { draft: { id, name, short, labelColor, position, onHome, members } }));
        changed(); return result;
      },
      uploadPhoto: async (productId, file) => {
        const path = catalogPhotoPath(productId, file);
        const bucket = client.storage.from("catalog");
        unwrap(await bucket.upload(path, file, { contentType: file.type, upsert: false }));
        return bucket.getPublicUrl(path).data.publicUrl;
      },
      shippingMethods: async () => (await rows("shipping_methods", "*", { active: "true" })).map(map.shipping),
      validateCode: async (code) => {
        const resolved = await rpc<{ percent: number; partnerName: string | null } | null>("resolve_code", { code });
        return resolved ? { code: code.trim().toUpperCase(), kind: resolved.partnerName ? "partner" : "promo", percent: Number(resolved.percent), active: true, uses: 0 } : null;
      },
    },
    orders: {
      list: async () => (await orderRows()).map(map.order).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      listForBuyer: async (buyerId) => (await orderRows({ buyer_id: buyerId })).map(map.order).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      get: getOrder,
      place: async (_buyerId, draft: OrderDraft) => refreshedOrder(await rpc<map.Row>("place_order", { draft: {
        lines: draft.lines.map(({ productId, quantity }) => ({ productId, quantity })), address: draft.address,
        shipping: draft.shipping, insurance: draft.insurance === true, discountCode: draft.discountCode, via: draft.via ?? "code",
      } })),
      advance: async (id, status, extra = {}) => {
        const order = id.startsWith("TM-") ? await getOrder(id) : null;
        return refreshedOrder(await rpc<map.Row>("advance_order", { order_id: order?.id ?? id, status,
          carrier: extra.carrier ?? null, tracking: extra.tracking ?? null, note: extra.note ?? null }));
      },
    },
    lots: {
      list: async () => (await rows("lots")).map(map.lot),
      get: async (lot) => { const row = await rpc<map.Row | null>("lot_lookup", { lot }); return row ? map.lot(row) : null; },
      setStatus: savingNext,
    },
    buyers: {
      list: async () => (await rows("buyers", "*, addresses(*)")).map(map.buyer),
      get: async (id) => { const row = (await rows("buyers", "*, addresses(*)", { id }))[0]; return row ? map.buyer(row) : null; },
    },
    applications: {
      list: async () => (await rows("applications")).map(map.application).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
      submit: async () => { throw new Error("Create an account with your application and password."); },
      review: async (id, status, note) => {
        const result = map.application(await rpc<map.Row>("review_application", { id, status, note: note ?? null }));
        changed(); return result;
      },
    },
    partners: {
      list: () => partnerRows(),
      get: async (id) => (await partnerRows({ id }))[0] ?? null,
      me: async () => { const p = await profile(); return p?.role === "partner" ? (await partnerRows({ user_id: p.id }))[0] ?? null : null; },
      referrals: async (partnerId) => (await rows("referrals", "*", partnerId ? { partner_id: partnerId } : {})).map(map.referral).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      payouts: async (partnerId) => (await rows("payouts", "*", partnerId ? { partner_id: partnerId } : {})).map(map.payout),
      visits: async (partnerId) => (await rows("visits", "*", { partner_id: partnerId })).map(map.visit),
      discounts: codes,
    },
  };
  const auth = {
    profile,
    async signIn(email: string, password: string) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      changed(); return profile();
    },
    async signUp(application: ApplicationForm, password: string) {
      const result = unwrap(await client.auth.signUp({ email: application.email, password,
        options: { data: { application }, emailRedirectTo: options.redirectTo?.() } }));
      changed(); return { confirmationRequired: !result.session };
    },
    signOut: store.session.signOut,
  };
  const owner = {
    async approveCommissions(today?: Date) { const count = await rpc<number>("approve_referrals", { before: approvalCutoff(today) }); changed(); return count; },
    async recordPayout(partnerId: string, start: string, end: string, method: string, note?: string) {
      const result = map.payout(await rpc<map.Row>("record_payout", { partner_id: partnerId, period_start: start, period_end: end, method, note: note ?? null }));
      changed(); return result;
    },
  };
  let noticeCache: Notice[] = [];
  let epoch = 0;
  const notices = {
    list: (audience: Audience) => noticeCache.filter((notice) => notice.audience === audience),
    async load(audience: Audience): Promise<Notice[]> {
      const current = epoch;
      const values = (await rows("notifications", "*", { audience })).map(map.notice).filter((n): n is Notice => n !== null).sort((a, b) => b.at.localeCompare(a.at));
      if (current !== epoch) return [];
      noticeCache = [...noticeCache.filter((n) => n.audience !== audience), ...values];
      return values;
    },
    add(): never { throw new Error("Live alerts are created by the database."); },
    async markRead(audience: Audience, ids?: string[]) {
      const targets = ids ?? notices.list(audience).filter((n) => !n.read).map((n) => n.id);
      if (!targets.length) return 0;
      const count = await rpc<number>("mark_notifications_read", { ids: targets });
      await notices.load(audience); changed(); return count;
    },
  };
  let channel: RealtimeChannel | undefined;
  const seen = new Set<string>();
  function clearSession() { epoch++; noticeCache = []; seen.clear(); }
  function stopRealtime() { if (channel) void client.removeChannel(channel); channel = undefined; }
  function startRealtime(id: string | null) {
    stopRealtime(); clearSession();
    if (!id) return;
    const current = epoch;
    channel = client.channel(`tm-live-platform:${id}`);
    for (const table of ["orders", "order_events", "referrals", "notifications"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        if (current !== epoch) return;
        changed();
        if (payload.eventType !== "INSERT") return;
        const row = payload.new as map.Row;
        const key = `${table}:${row.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        if (seen.size > 1000) seen.delete(seen.values().next().value!);
        if (table === "orders") emit({ type: "order.placed", orderId: String(row.id), number: String(row.number), buyerId: String(row.buyer_id), total: Number(row.total), partnerId: row.discount_partner_id ? String(row.discount_partner_id) : undefined, at: String(row.created_at) });
        if (table === "referrals") {
          const referral = map.referral(row);
          emit({ type: "referral.created", referralId: referral.id, partnerId: referral.partnerId, orderNumber: referral.orderNumber, orderSubtotal: referral.orderSubtotal, commission: referral.commission, via: referral.via, at: referral.createdAt });
        }
        if (table === "order_events" && row.status !== "placed") {
          void getOrder(String(row.order_id)).then((order) => {
            if (order && current === epoch) emit({ type: "order.status", orderId: order.id, number: order.number, buyerId: order.buyerId, status: row.status as OrderStatus, at: String(row.at), carrier: order.shipping.carrier, tracking: order.shipping.tracking });
          }).catch(() => changed());
        }
      });
    }
    channel.subscribe((status) => { if (status === "SUBSCRIBED") changed(); });
  }
  return { store, auth, owner, notices, startRealtime, stopRealtime,
    content: createContentAdapter(client, rows, rpc, changed),
    async quote(draft: OrderDraft) {
      const [products, settings, methods, discount] = await Promise.all([store.catalog.products(), store.settings.get(),
        store.catalog.shippingMethods(), draft.discountCode ? store.catalog.validateCode(draft.discountCode) : null]);
      const selected = methods.find((method) => method.id === draft.shipping);
      if (!selected) throw new Error("Shipping method unavailable.");
      if (draft.discountCode && !discount) throw new Error("Discount unavailable.");
      const seen = new Set<string>();
      if (!draft.lines.length || draft.lines.length > 100) throw new Error("Invalid order lines.");
      const lines = draft.lines.map(({ productId, quantity }) => {
        const product = products.find((product) => product.id === productId);
        if (!product || product.price === undefined) throw new Error("Product unavailable.");
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000 || seen.has(productId)) throw new Error("Invalid order quantity.");
        seen.add(productId);
        const problem = stockProblem(product, quantity);
        if (problem) throw new Error(problem);
        return { productId, quantity, unitPrice: product.price, lot: product.lot };
      });
      const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
      const priced = priceQuote(subtotal, discount?.percent ?? 0, selected, settings, draft.insurance);
      return { ...priced, lines, discount, method: { ...selected, price: priced.shipping } };
    },
    products: async () => (await rows("products", "*", { active: "true" })).map(map.product),
    recordVisit: (code: string) => rpc<void>("record_visit", { code }),
    async saveAddress(buyerId: string, address: Address) {
      // The buyer id is further constrained by the address table's RLS.
      const { id, ...fields } = address;
      const values = { ...fields, buyer_id: buyerId };
      const query = /^[0-9a-f-]{36}$/i.test(id) ? client.from("addresses").update(values).eq("id", id) : client.from("addresses").insert(values);
      const result = unwrap(await query.select().single()) as Address;
      changed(); return result;
    },
  };
}
