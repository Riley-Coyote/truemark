/** Database names stop here; the screens continue using the platform contract. */
import type { Product, Category } from "../../data";
import type { Application, Buyer, Discount, Lot, Order, Partner, Payout, Referral, ShippingMethod, StorefrontSettings, Visit } from "../types";
import type { Notice } from "../notifications";

export type Row = Record<string, unknown>;
export function settings(row: Row): StorefrontSettings {
  return { freeShippingThreshold: row.free_shipping_threshold == null ? null : Number(row.free_shipping_threshold),
    freeShippingMethod: String(row.free_shipping_method), insuranceMode: row.insurance_mode as StorefrontSettings["insuranceMode"],
    insuranceRate: row.insurance_rate == null ? null : Number(row.insurance_rate) };
}
const optional = (value: unknown) => value == null ? undefined : String(value);
const date = (value: unknown) => value == null ? undefined : String(value).slice(0, 10);
export function category(row: Row): Category {
  return { id: String(row.id), name: String(row.name), short: String(row.short), labelColor: String(row.label_color),
    position: Number(row.position), onHome: Boolean(row.on_home), members: String(row.members_note ?? "") };
}
export function product(row: Row): Product {
  return { id: String(row.id), name: String(row.name), size: String(row.size), category: String(row.category),
    price: Number(row.price), description: optional(row.description), stock: row.stock == null ? null : Number(row.stock), active: row.active !== false, image: optional(row.image), color: String(row.color ?? "#777777"),
    colorInk: String(row.color_ink ?? "#333333"), form: row.form as Product["form"], lot: String(row.lot), tag: row.tag as Product["tag"] };
}
export function buyer(row: Row): Buyer {
  return { id: String(row.id), name: String(row.name), email: String(row.email), institution: String(row.institution),
    role: String(row.role), status: row.status as Buyer["status"], joinedAt: String(row.joined_at),
    verifiedAt: optional(row.verified_at), addresses: (row.addresses ?? []) as Buyer["addresses"] };
}
export function application(row: Row): Application {
  return { id: String(row.id), submittedAt: String(row.submitted_at), status: row.status as Application["status"],
    name: String(row.name), email: String(row.email), role: String(row.role), institution: String(row.institution),
    institutionType: String(row.institution_type), website: optional(row.website), researchArea: String(row.research_area),
    intendedUse: String(row.intended_use), attestations: row.attestations as string[], documents: row.documents as string[],
    reviewedAt: optional(row.reviewed_at), reviewNote: optional(row.review_note) };
}
export function discount(row: Row): Discount {
  return { code: String(row.code), kind: row.kind as Discount["kind"], percent: Number(row.percent),
    partnerId: optional(row.partner_id), active: Boolean(row.active), uses: Number(row.uses), expiresAt: optional(row.expires_at) };
}
export function partner(row: Row, codes: Discount[]): Partner {
  return { id: String(row.id), name: String(row.name), handle: String(row.handle), email: String(row.email), code: String(row.code),
    rate: Number(row.rate), codeDiscount: (codes.find((d) => d.partnerId === row.id)?.percent ?? 0) / 100,
    status: row.status as Partner["status"], joinedAt: String(row.joined_at), audience: String(row.audience) };
}
export function order(row: Row): Order {
  return { id: String(row.id), number: String(row.number), buyerId: String(row.buyer_id), createdAt: String(row.created_at),
    status: row.status as Order["status"], payment: row.payment as Order["payment"], address: row.address as Order["address"],
    shipping: { method: row.shipping_method_id as Order["shipping"]["method"], price: Number(row.shipping_price),
      carrier: optional(row.carrier), tracking: optional(row.tracking) }, subtotal: Number(row.subtotal),
    discount: row.discount_code ? { code: String(row.discount_code), amount: Number(row.discount_amount), partnerId: optional(row.discount_partner_id) } : undefined,
    insurance: Number(row.insurance ?? 0), insuranceApplied: Boolean(row.insurance_applied), total: Number(row.total),
    lines: ((row.order_lines ?? []) as Row[]).map((line) => ({ productId: String(line.product_id), quantity: Number(line.quantity), unitPrice: Number(line.unit_price), lot: String(line.lot) })),
    events: ((row.order_events ?? []) as Row[]).map((event) => ({ status: event.status as Order["status"], at: String(event.at), note: optional(event.note) })).sort((a, b) => a.at.localeCompare(b.at)) };
}
export function lot(row: Row): Lot {
  return { lot: String(row.lot), productId: String(row.product_id ?? row.productId), status: row.status as Lot["status"],
    receivedAt: optional(row.received_at) ?? null, testedAt: optional(row.tested_at ?? row.testedAt), releasedAt: optional(row.released_at ?? row.releasedAt),
    coaPath: row.status === "released" ? optional(row.coa_path) : undefined,
    coaUrl: row.status === "released" ? optional(row.coaUrl) : undefined,
    rejectionNote: row.status === "rejected" ? optional(row.rejection_note) : undefined,
    results: row.status === "released" ? (row.results ?? []) as Lot["results"] : [],
    reference: row.status === "released" ? optional(row.reference) : undefined,
    units: row.units == null ? null : Number(row.units), sample: false };
}
export function referral(row: Row): Referral {
  return { id: String(row.id), partnerId: String(row.partner_id), orderId: String(row.order_id), orderNumber: String(row.order_number),
    createdAt: String(row.created_at), orderSubtotal: Number(row.order_subtotal), commission: Number(row.commission),
    status: row.status as Referral["status"], via: row.via as Referral["via"] };
}
export function payout(row: Row): Payout {
  return { id: String(row.id), partnerId: String(row.partner_id), periodStart: String(row.period_start), periodEnd: String(row.period_end),
    amount: Number(row.amount), referrals: Number(row.referrals), status: row.status as Payout["status"], paidAt: date(row.paid_at), method: String(row.method) };
}
export const shipping = (row: Row): ShippingMethod => ({ id: row.id as ShippingMethod["id"], label: String(row.label), detail: String(row.detail), price: Number(row.price) });
export const visit = (row: Row): Visit => ({ date: String(row.date), clicks: Number(row.clicks) });
const noticeKinds = new Set(["order.placed", "order.packed", "order.shipped", "order.delivered", "referral.created", "commission.approved", "payout.sent"]);
export function notice(row: Row): Notice | null {
  // Older database versions also write payment/cancellation alerts. The app's
  // NoticeKind stays fixed; those transitions appear on the order's event line.
  if (!noticeKinds.has(String(row.kind))) return null;
  return { id: String(row.id), audience: row.audience as Notice["audience"], kind: row.kind as Notice["kind"],
    title: String(row.title), body: String(row.body), amount: row.amount == null ? undefined : Number(row.amount),
    href: optional(row.href), at: String(row.at), read: Boolean(row.read) };
}
