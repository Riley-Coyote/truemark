import type { AssistantStore } from "./store";
import type { LotRecord } from "../shop/records";
import type { Order, OrderStatus, Partner } from "../platform/types";
import { checkClaims, type ClaimCheck } from "./claims";
import { expectedNames, validateInput, type Persona, type ToolSchema, type ToolCall } from "./protocol";
import { businessSummary, partnerMomentum, recordedStock, reorder, trend, windowFor, within } from "./metrics";

export type Artifact = { kind: "certificate"; record: LotRecord; coaUrl?: string } |
  { kind: "rows"; rows: { label: string; detail: string; href: string }[] } |
  { kind: "draft"; text: string; check: ClaimCheck; disclosure?: string } |
  { kind: "link"; url: string; qr: string };
export type ToolOutput = { model: unknown; artifact?: Artifact; pending?: PendingAction };
export type PendingAction = { kind: "pending_action"; tool: string; title: string; details: Record<string, unknown>; confirm: () => Promise<ToolOutput>; cancel: () => ToolOutput };
export type Scope = { persona: Persona; role: string; id: string; sample: boolean };
export type RuntimeDependencies = {
  store: AssistantStore;
  scope: () => Promise<Scope>;
  now: () => string;
  addToBag?: (id: string, quantity: number) => void;
  verify: (lot: Awaited<ReturnType<AssistantStore["lots"]["get"]>>) => LotRecord | null;
  siteAnswers: (topic: string, query?: string) => unknown;
  shippingCopy: string[];
  program: { disclosure: (code: string) => string; rules: unknown; link: (path: string, code: string) => string };
  goal: (id: string) => number;
  milestones: (refs: Awaited<ReturnType<AssistantStore["partners"]["referrals"]>>) => unknown;
  qr: (url: string) => Promise<string>;
};
const productSummary = (p: Awaited<ReturnType<AssistantStore["assistant"]["products"]>>[number]) => ({ id: p.id, name: p.name, size: p.size, price: p.price ?? null, category: p.category, form: p.form, active: p.active, stock: p.stock, description: p.description });
const orderSummary = (o: Order) => ({ id: o.id, number: o.number, status: o.status, total: o.total, createdAt: o.createdAt });
const matching = (query: unknown, ...parts: unknown[]) => !query || parts.join(" ").toLowerCase().includes(String(query).toLowerCase());
function page<T>(rows: T[], input: Record<string, unknown>) {
  const offset = Number(input.offset ?? 0), limit = Number(input.limit ?? 5);
  return { total: rows.length, offset, items: rows.slice(offset, offset + limit), nextOffset: offset + limit < rows.length ? offset + limit : null };
}
const money = (v: number) => `$${v.toFixed(2)}`;
const fingerprint = (v: unknown) => JSON.stringify(v);
function required<T>(value: T | null | undefined, message: string): T { if (value == null) throw new Error(message); return value; }
function date(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error("Use a valid YYYY-MM-DD date."); return value; }
export function createToolRuntime(deps: RuntimeDependencies) {
  const s = deps.store;
  return async function prepare(tool: ToolCall, schemas: ToolSchema[], persona: Persona): Promise<ToolOutput> {
    const schema = schemas.find((entry) => entry.name === tool.name);
    if (!schema || !expectedNames[persona].includes(tool.name)) throw new Error("This assistant cannot use that tool.");
    validateInput(tool, schema);
    const scope = structuredClone(await deps.scope());
    if (scope.persona !== persona) throw new Error("Your account changed. Please reopen the assistant.");
    if (["approve_commissions", "record_payout", "create_discount_code"].includes(tool.name) && scope.role !== "owner") throw new Error("This action requires the owner.");
    const a = structuredClone(tool.arguments), text = (key: string) => String(a[key] ?? "");
    const now = deps.now();
    const output = (model: unknown, artifact?: Artifact): ToolOutput => ({ model: { sample: scope.sample, data: model }, artifact });
    async function ownPartner(): Promise<Partner> { return required(await s.partners.me(), "Sign in to your partner account first."); }
    async function ownOrders() { const buyer = required(await s.session.get(), "Sign in to your research account to see your orders."); return s.orders.listForBuyer(buyer.id); }
    const product = async () => structuredClone(required((await s.assistant.products()).find((p) => p.id === text("id")), "Product not found."));
    const pending = (title: string, details: Record<string, unknown>, run: () => Promise<unknown>, artifact?: Artifact): ToolOutput => {
      let settled = false;
      return { model: { pending_action: true, title }, artifact, pending: { kind: "pending_action", tool: tool.name, title, details,
        async confirm() {
          if (settled) throw new Error("This action has already been handled.");
          settled = true;
          if (fingerprint(await deps.scope()) !== fingerprint(scope)) throw new Error("Your account changed. Please ask again.");
          return output(await run());
        },
        cancel() { settled = true; return output({ cancelled: true, message: "Cancelled. No change was made." }); },
      } };
    };
    const unchanged = async (read: () => Promise<unknown>, before: unknown) => {
      if (fingerprint(await read()) !== fingerprint(before)) throw new Error("This record changed. Please ask again to review the latest values.");
    };
    const partnerStats = async () => {
      const [partners, refs] = await Promise.all([s.partners.list(), s.partners.referrals()]);
      return Promise.all(partners.map(async (p) => partnerMomentum(p, refs, await s.partners.visits(p.id), now)));
    };
    const orderRows = (orders: Order[]): Artifact => ({ kind: "rows", rows: orders.map((o) => ({ label: o.number, detail: `${o.status} · ${money(o.total)}`, href: persona === "owner" ? `/admin/orders?order=${encodeURIComponent(o.id)}` : `/account/orders/${encodeURIComponent(o.id)}` })) });
    switch (tool.name) {
      case "search_catalog": case "catalog": case "products_and_stock": {
        const list = (await s.assistant.products()).filter((p) => (persona === "owner" || p.active) && matching(a.query, p.name, p.size, p.category));
        const lots = tool.name === "products_and_stock" ? await s.lots.list() : [];
        const result = page(list.map((p) => ({ ...productSummary(p), ...(tool.name === "products_and_stock" ? recordedStock(p, lots) : {}) })), a); return output(result);
      }
      case "get_product": return output(productSummary(await product()));
      case "lookup_lot": {
        const lot = await s.lots.get(text("lot").trim().toUpperCase().replace(/\s+/g, "").replace(/[–—]/g, "-"));
        const record = deps.verify(lot);
        if (!record) return output({ found: false, contact: "/contact" });
        return output({ ...record, product: { id: record.product.id, name: record.product.name, size: record.product.size }, coaUrl: lot?.coaUrl }, { kind: "certificate", record, coaUrl: lot?.coaUrl });
      }
      case "shipping_info": return output({ methods: await s.catalog.shippingMethods(), settings: await s.settings.get(), wording: deps.shippingCopy, policy: "/shipping-policy" });
      case "site_answers": return output(deps.siteAnswers(text("topic"), text("query")));
      case "my_account_status": { const buyer = await s.session.get(); return output(buyer ? { signedIn: true, status: buyer.status } : { signedIn: false, href: "/access" }); }
      case "my_orders": { const result = page(await ownOrders(), a); return output({ ...result, items: result.items.map(orderSummary) }, orderRows(result.items)); }
      case "order_status": { const o = required((await ownOrders()).find((o) => o.number.toUpperCase() === text("number").toUpperCase()), "No order with that number belongs to this account."); return output({ ...orderSummary(o), shipping: o.shipping, events: o.events.slice(-7) }, orderRows([o])); }
      case "add_to_bag": {
        const p = await product(); if (!p.active || p.price == null || !deps.addToBag) throw new Error("This item cannot be added here.");
        const quantity = Number(a.quantity);
        if (p.stock !== null && p.stock < quantity) throw new Error("That quantity is not currently in stock.");
        return pending(`Add ${quantity} × ${p.name} ${p.size} to your bag`, { productId: `${p.name} ${p.size}`, unitPrice: p.price, quantity }, async () => {
          await unchanged(product, p); deps.addToBag!(p.id, quantity); return { added: true, id: p.id, quantity };
        });
      }
      case "orders": { const result = page((await s.orders.list()).filter((o) => matching(a.filter, o.number, o.status)), a); return output({ ...result, items: result.items.map(orderSummary) }, orderRows(result.items)); }
      case "order": {
        const o = required(await s.orders.get(text("id")), "Order not found.");
        return output({ ...orderSummary(o), buyerId: o.buyerId, payment: o.payment, address: o.address, shipping: o.shipping, lines: page(o.lines, {}), events: o.events.slice(-7) }, orderRows([o]));
      }
      case "customers": case "customer": {
        const buyers = tool.name === "customer" ? [required(await s.buyers.get(text("id")), "Customer not found.")] : (await s.buyers.list()).filter((b) => matching(a.filter, b.name, b.email, b.institution));
        const result = page(buyers, a);
        const items = await Promise.all(result.items.map(async (b) => ({ id: b.id, name: b.name, email: b.email, institution: b.institution, status: b.status, reorder: reorder(await s.orders.listForBuyer(b.id), now) })));
        return output({ ...result, items }, { kind: "rows", rows: items.map((b) => ({ label: b.name, detail: `${b.institution} · ${b.status}`, href: `/admin/customers?customer=${encodeURIComponent(b.id)}` })) });
      }
      case "lots": case "released_lots": {
        const list = (await s.lots.list()).filter((l) => (tool.name !== "released_lots" || l.status === "released") && matching(a.filter, l.lot, l.productId, l.status));
        return output(page(list.map((l) => ({ lot: l.lot, productId: l.productId, status: l.status, units: l.units, results: l.results.slice(0, 6), sample: l.sample })), a));
      }
      case "applications": return output(page((await s.applications.list()).filter((row) => matching(a.filter, row.name, row.status)).map(({ id, name, institution, status, submittedAt }) => ({ id, name, institution, status, submittedAt })), a));
      case "partners": return output(page(await partnerStats(), a));
      case "referrals_and_payouts": {
        const [refs, payouts] = await Promise.all([s.partners.referrals(text("partnerId") || undefined), s.partners.payouts(text("partnerId") || undefined)]);
        return output({ referrals: page(refs, a), payouts: page(payouts, a), commissions: Object.fromEntries(["pending", "approved", "paid", "void"].map((status) => [status, refs.filter((r) => r.status === status).reduce((sum, r) => sum + r.commission, 0)])) });
      }
      case "journal": case "journal_posts": return output(page((await s.assistant.journal(persona === "owner")).filter((p) => persona === "owner" || p.status === "published").map(({ id, slug, title, excerpt, status }) => ({ id, slug, title, excerpt, status })), a));
      case "settings": return output(await s.settings.get());
      case "trend": { const result = trend(await s.orders.list(), text("metric"), text("period"), text("groupBy"), now); return output({ ...result, rows: page(result.rows, a) }); }
      case "business_summary": {
        const [orders, buyers, products, lots, partners] = await Promise.all([s.orders.list(), s.buyers.list(), s.assistant.products(), s.lots.list(), partnerStats()]);
        return output(businessSummary({ orders, buyers, products, lots, partners }, text("period") || "30d", now, scope.sample));
      }
      case "who_received_lot": {
        const list = (await s.orders.list()).filter((o) => o.events.some((e) => e.status === "shipped" || e.status === "delivered") && o.lines.some((l) => l.lot.toUpperCase() === text("lot").toUpperCase()));
        const result = page(list, a); return output({ ...result, items: result.items.map((o) => ({ ...orderSummary(o), buyerId: o.buyerId, recipient: o.address, quantity: o.lines.filter((l) => l.lot.toUpperCase() === text("lot").toUpperCase()).reduce((n, l) => n + l.quantity, 0) })) }, orderRows(result.items));
      }
      case "advance_order": {
        const o = structuredClone(required(await s.orders.get(text("id")), "Order not found.")); const status = text("status") as OrderStatus;
        const transitions: Record<OrderStatus, string[]> = { placed: ["paid", "cancelled"], paid: ["packed", "shipped", "cancelled", "refunded"], packed: ["shipped", "cancelled", "refunded"], shipped: ["delivered", "refunded"], delivered: ["refunded"], cancelled: [], refunded: [] };
        if (!transitions[o.status].includes(status)) throw new Error("This status change is not available for the order.");
        if (status === "shipped" && (!a.carrier || !a.tracking)) throw new Error("Provide the carrier and tracking number first.");
        return pending(`Mark ${o.number} ${status}${status === "shipped" ? ` with ${text("carrier")} ${text("tracking")}` : ""}`, { ...a, id: o.number, currentStatus: o.status }, async () => {
          await unchanged(() => s.orders.get(o.id), o);
          return orderSummary(await s.orders.advance(o.id, status, { carrier: text("carrier") || undefined, tracking: text("tracking") || undefined, note: text("note") || undefined }));
        });
      }
      case "review_application": {
        const app = structuredClone(required((await s.applications.list()).find((p) => p.id === text("id")), "Application not found."));
        return pending(`${text("status") === "approved" ? "Approve" : "Decline"} ${app.name}'s research application`, { ...a, id: app.name, institution: app.institution, currentStatus: app.status }, async () => {
          await unchanged(async () => (await s.applications.list()).find((p) => p.id === app.id), app);
          const saved = await s.applications.review(app.id, text("status") as "approved" | "declined", text("note") || undefined); return { id: saved.id, status: saved.status };
        });
      }
      case "approve_commissions": {
        const refs = structuredClone(await s.partners.referrals());
        const cutoff = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate()) - 14 * 86400000).toISOString().slice(0, 10);
        const orders = structuredClone(await s.orders.list());
        const valid = new Set(orders.filter((o) => o.payment === "captured" && ["paid", "packed", "shipped", "delivered"].includes(o.status)).map((o) => o.id));
        const eligible = refs.filter((r) => r.status === "pending" && r.createdAt.slice(0, 10) < cutoff && valid.has(r.orderId));
        if (!eligible.length) return output({ count: 0, message: "No commissions are eligible for approval." });
        return pending(`Approve ${eligible.length} commissions totalling ${money(eligible.reduce((sum, r) => sum + r.commission, 0))}`, { before: cutoff, hold: "14 days", count: eligible.length }, async () => {
          await unchanged(() => s.partners.referrals(), refs); await unchanged(() => s.orders.list(), orders);
          return { approved: await s.actions.approveCommissions(now) };
        });
      }
      case "record_payout": {
        const start = date(text("start")), end = date(text("end")); if (end < start) throw new Error("The payout end date must follow its start.");
        const partner = required(await s.partners.get(text("partnerId")), "Partner not found.");
        const refs = structuredClone(await s.partners.referrals(partner.id));
        const orders = structuredClone(await s.orders.list());
        const valid = new Set(orders.filter((o) => o.payment === "captured" && ["paid", "packed", "shipped", "delivered"].includes(o.status)).map((o) => o.id));
        const eligible = refs.filter((r) => valid.has(r.orderId) && r.status === "approved" && r.createdAt.slice(0, 10) >= start && r.createdAt.slice(0, 10) <= end);
        if (!eligible.length) throw new Error("No approved referrals in this period.");
        return pending(`Record ${money(eligible.reduce((sum, r) => sum + r.commission, 0))} paid to ${partner.name}`, { ...a, partnerId: partner.name, note: text("note"), meaning: "Records a payment already made. Does not send money.", referrals: eligible.length }, async () => {
          await unchanged(() => s.partners.referrals(partner.id), refs); await unchanged(() => s.orders.list(), orders);
          return s.actions.recordPayout(partner.id, start, end, text("method"), text("note") || undefined);
        });
      }
      case "update_product": {
        if (!(await s.assistant.capabilities()).updateProduct) return output({ message: "Catalog editing arrives with the next update." });
        const p = await product(); const { id: _id, ...patch } = a;
        if (!Object.keys(patch).length) throw new Error("Specify which product fields to change.");
        if (typeof patch.description === "string") { const check = checkClaims(patch.description); if (!check.passed) return output({ check }, { kind: "draft", text: patch.description, check }); }
        return pending(`Update ${p.name} ${p.size}`, { id: `${p.name} ${p.size}`, before: Object.fromEntries(Object.keys(patch).map((key) => [key, p[key as keyof typeof p]])), after: patch }, async () => { await unchanged(product, p); return s.actions.updateProduct(p.id, patch, p.stock); });
      }
      case "draft_journal_post": {
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(text("slug"))) throw new Error("Use a lowercase URL slug.");
        const draftText = `${text("title")}\n\n${text("excerpt")}\n\n${text("body")}`;
        const check = checkClaims(draftText), artifact: Artifact = { kind: "draft", text: draftText, check };
        if (!check.passed) return output({ check, instruction: "Rewrite the flagged phrases and run draft_journal_post again." }, artifact);
        return pending(`Save “${text("title")}” as a draft`, { ...a, status: "draft", publishes: false }, async () => {
          const saved = await s.actions.saveDraft({ title: text("title"), slug: text("slug"), excerpt: text("excerpt"), bodyMd: text("body"), author: text("author"), status: "draft", kicker: "", readingMinutes: Math.max(1, Math.ceil(text("body").split(/\s+/).length / 200)) });
          return { id: saved.id, slug: saved.slug, status: saved.status };
        }, artifact);
      }
      case "create_discount_code": {
        const code = text("code"); if (!/^[A-Z0-9_-]{1,64}$/.test(code) || (a.expiresAt && (!Number.isFinite(Date.parse(text("expiresAt"))) || Date.parse(text("expiresAt")) <= Date.parse(now)))) throw new Error("Check the code and expiry.");
        return pending(`Create ${code}: ${a.percent}% off, ${a.active ? "active" : "inactive"}`, { ...a, expiresAt: a.expiresAt ?? "No expiry", kind: "promo" }, () => s.actions.createDiscount({ code, percent: Number(a.percent), active: Boolean(a.active), expiresAt: text("expiresAt") || undefined }));
      }
      case "my_month": {
        const partner = await ownPartner(); const refs = await s.partners.referrals(partner.id); const w = windowFor("month", now);
        const month = refs.filter((r) => r.status !== "void" && within(r.createdAt, w));
        return output({ asOf: now, sales: month.length, earnings: month.reduce((sum, r) => sum + r.commission, 0), goal: deps.goal(partner.id), goalScope: "Preference on this device", milestone: deps.milestones(refs) });
      }
      case "my_referrals": { const p = await ownPartner(); return output(page((await s.partners.referrals(p.id)).map(({ orderNumber, createdAt, orderSubtotal, commission, status, via }) => ({ orderNumber, createdAt, orderSubtotal, commission, status, via })), a)); }
      case "my_payouts": { const p = await ownPartner(); return output(page((await s.partners.payouts(p.id)).map(({ periodStart, periodEnd, amount, status, paidAt, method }) => ({ periodStart, periodEnd, amount, status, paidAt, method })), a)); }
      case "my_links_and_visits": {
        const p = await ownPartner(); const [refs, visits] = await Promise.all([s.partners.referrals(p.id), s.partners.visits(p.id)]);
        return output({ ...partnerMomentum(p, refs, visits, now), link: deps.program.link("/", p.code), note: "Visits are recorded per partner and day, not per product link. Codes entered at checkout are not visits." });
      }
      case "program_rules": { const p = await ownPartner(); return output({ rules: deps.program.rules, disclosure: deps.program.disclosure(p.code), commissionRate: p.rate, buyerDiscount: p.codeDiscount }); }
      case "make_link": {
        const p = await ownPartner(); const id = text("product");
        if (id && !(await s.assistant.products()).some((product) => product.id === id && product.active)) throw new Error("Product not found.");
        const url = deps.program.link(id ? `/product/${encodeURIComponent(id)}` : "/products", p.code);
        return output({ url, qr: "Generated locally and shown in the panel" }, { kind: "link", url, qr: await deps.qr(url) });
      }
      case "draft_post": {
        const p = await ownPartner(), disclosure = deps.program.disclosure(p.code);
        const draft = `${disclosure}\n\n${text("text")}`; const check = checkClaims(draft, disclosure);
        return output({ platform: text("platform"), angle: text("angle"), text: draft, check, instruction: check.passed ? "The checked draft is ready to copy." : "Offer a rewrite and run draft_post again." }, { kind: "draft", text: draft, disclosure, check });
      }
      default: throw new Error("This tool is unavailable.");
    }
  };
}
