import { store as platform } from "../platform/store";
import { LIVE } from "../platform/mode";
import { live } from "../platform/live/runtime";
import { getClient } from "../platform/live/client";
import { read, worldNow, write } from "../platform/storage";
import { changed } from "../platform/live/storage";
import { approvalCutoff } from "../platform/live/adapter";
import type { ArticleInput, Discount, JournalArticle, Payout, Referral } from "../platform/types";

export const CATALOG_NEXT = "Catalog editing arrives with the next update.";
const eligible = async () => {
  const orders = await platform.orders.list();
  const ids = new Set(orders.filter((o) => o.payment === "captured" && ["paid", "packed", "shipped", "delivered"].includes(o.status)).map((o) => o.id));
  return (await platform.partners.referrals()).filter((r) => ids.has(r.orderId));
};
function setReferralStatus(referrals: Referral[], status: Referral["status"]) {
  const values = read<Record<string, Referral["status"]>>("tm-preview-assistant-referrals", {});
  for (const r of referrals) values[r.id] = status;
  write("tm-preview-assistant-referrals", values);
}

/** Assistant-facing facade. Existing platform shapes stay intact; writes use the same RPCs as the UI. */
export const store = {
  ...platform,
  actions: {
    async approveCommissions(asOf = worldNow()) {
      if (LIVE) return live().owner.approveCommissions(new Date(asOf));
      const before = approvalCutoff(new Date(asOf));
      const refs = (await eligible()).filter((r) => r.status === "pending" && r.createdAt.slice(0, 10) < before);
      setReferralStatus(refs, "approved"); return refs.length;
    },
    async recordPayout(partnerId: string, start: string, end: string, method: string, note?: string) {
      if (LIVE) return live().owner.recordPayout(partnerId, start, end, method, note);
      const refs = (await eligible()).filter((r) => r.partnerId === partnerId && r.status === "approved" && r.createdAt.slice(0, 10) >= start && r.createdAt.slice(0, 10) <= end);
      if (!refs.length) throw new Error("No approved referrals in this period.");
      const payout: Payout = { id: crypto.randomUUID(), partnerId, periodStart: start, periodEnd: end,
        amount: Math.round(refs.reduce((sum, r) => sum + r.commission, 0) * 100) / 100, referrals: refs.length, status: "paid", paidAt: worldNow(), method };
      setReferralStatus(refs, "paid"); write("tm-preview-assistant-payouts", [payout, ...read<Payout[]>("tm-preview-assistant-payouts", [])]); return payout;
    },
    async saveDraft(input: ArticleInput) {
      // Discard a supplied ID/status/publish date at this boundary as well as the tool boundary.
      const { id: _id, publishedAt: _date, ...fields } = input;
      const draft = { ...fields, status: "draft" as const };
      if (LIVE) return live().content.articles.save(draft);
      const saved: JournalArticle = { ...draft, id: crypto.randomUUID(), updatedAt: worldNow() };
      const previous = read<JournalArticle[]>("tm-preview-assistant-drafts", []);
      if ((await platform.assistant.journal(true)).some((a) => a.slug === saved.slug)) throw new Error("That journal slug is already in use.");
      write("tm-preview-assistant-drafts", [...previous, saved]); return saved;
    },
    async createDiscount(input: Pick<Discount, "code" | "percent" | "active" | "expiresAt">) {
      if (!LIVE) {
        if ((await platform.partners.discounts()).some((d) => d.code === input.code)) throw new Error("That code already exists.");
        const discount: Discount = { ...input, kind: "promo", uses: 0 };
        write("tm-preview-assistant-discounts", [...read<Discount[]>("tm-preview-assistant-discounts", []), discount]); return discount;
      }
      const { data, error } = await getClient().rpc("create_discount_code", { code: input.code, percent: input.percent, active: input.active, expires_at: input.expiresAt ?? null });
      if (error) throw new Error("The discount could not be created. Check the code and your permissions.");
      changed(); return { code: data.code, percent: Number(data.percent), active: data.active };
    },
    async updateProduct(id: string, patch: Record<string, unknown>, expectedStock?: number | null) {
      const capability = await platform.assistant.capabilities();
      if (!LIVE || !capability.updateProduct || capability.productArgument !== "draft") throw new Error(CATALOG_NEXT);
      const current = (await platform.assistant.products()).find((product) => product.id === id);
      if (!current) throw new Error("Product not found.");
      const allowed = Object.fromEntries(Object.entries(patch).filter(([key]) => ["price", "stock", "description", "active"].includes(key)));
      // Use WP-15's mapped draft and stock concurrency check, just like Products.
      await platform.catalog.saveProduct({ ...current, ...allowed, id, description: typeof allowed.description === "string" ? allowed.description : current.description ?? undefined }, expectedStock === undefined ? current.stock : expectedStock);
      const saved = await platform.assistant.productRecord(id);
      if (!saved || Object.entries(allowed).some(([key, value]) => typeof value === "number" ? Number(saved[key]) !== value : saved[key] !== value))
        throw new Error("The catalog accepted the request, but the requested fields could not be verified. Check Products before trying again.");
      return { id, ...allowed };
    },
  },
};
export type AssistantStore = typeof store;
