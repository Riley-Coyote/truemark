import type { Persona } from "./prompts.ts";

type Schema = { type: string; description?: string; enum?: string[]; minimum?: number; maximum?: number; maxLength?: number };
const str = (description: string, maxLength = 240): Schema => ({ type: "string", description, maxLength });
const choice = (...values: string[]): Schema => ({ type: "string", enum: values });
const number = (minimum: number, maximum: number): Schema => ({ type: "number", minimum, maximum });
const period = choice("7d", "30d", "90d", "365d", "month");
const paging = { offset: { type: "integer", minimum: 0, maximum: 10000 }, limit: { type: "integer", minimum: 1, maximum: 10 } };
function tool(name: string, description: string, properties: Record<string, Schema> = {}, required: string[] = []) {
  return { name, description, parameters: { type: "object", properties, required, additionalProperties: false } };
}
const catalog = (name: string) => tool(name, "Search the current catalog. Returns at most 10 records, counts and pagination, never inferred stock.", { query: str("Name, size or class"), ...paging });
export const TOOLS = {
  visitor: [
    catalog("search_catalog"),
    tool("get_product", "Show one product as a card: its sizes and prices, its specification, and its current lot with that lot's published purity.", { id: str("Product ID") }, ["id"]),
    tool("compare_products", "Show two or three current products side by side: sizes, prices, specification and each current lot's published purity.", { first: str("Product ID"), second: str("Product ID"), third: str("Optional product ID") }, ["first", "second"]),
    tool("lookup_lot", "Exactly the public Verify record. Never infer or fabricate results.", { lot: str("Printed lot number") }, ["lot"]),
    tool("shipping_info", "Current methods, prices, free shipping rule and the site's when-applicable wording."),
    tool("site_answers", "Quote the site's FAQ, storage, handling or policies. Query narrows excerpts.", { topic: choice("faq", "storage", "handling", "policies"), query: str("Question or policy search") }, ["topic"]),
    tool("my_orders", "The signed-in buyer's own orders only.", paging),
    tool("order_status", "The signed-in buyer's own order, by number.", { number: str("TM order number") }, ["number"]),
    tool("my_account_status", "Current research-account status, or signed out."),
    tool("add_to_bag", "Propose adding an item. Only a user's Confirm click adds it.", { id: str("Product ID"), quantity: { type: "integer", minimum: 1, maximum: 99 } }, ["id", "quantity"]),
  ],
  owner: [
    tool("business_summary", "Numbers and evidence for the owner's playbook, including reorder intervals, bundles, stock pace, partners and anomalies.", { period }),
    tool("orders", "Search permitted orders by number or status; compact linked rows.", { filter: str("Order number or status"), ...paging }),
    tool("order", "Read a permitted order.", { id: str("Order ID or number") }, ["id"]),
    tool("customers", "Search permitted customers; compact linked rows.", { filter: str("Name, email or institution"), ...paging }),
    tool("customer", "Read a permitted customer and their purchase interval.", { id: str("Buyer ID") }, ["id"]),
    tool("products_and_stock", "Product prices and recorded stock; null means untracked.", paging),
    tool("lots", "Lot status and recorded results.", { filter: str("Lot, product or status"), ...paging }),
    tool("applications", "Research applications, including pending reviews.", { filter: str("Name or status"), ...paging }),
    tool("partners", "Partners with recent and previous-period momentum.", paging),
    tool("referrals_and_payouts", "Commission totals and payout records.", { partnerId: str("Optional partner ID"), ...paging }),
    tool("journal", "Existing journal posts and drafts.", paging), tool("settings", "Current storefront settings."),
    tool("trend", "Aggregate observed orders. Revenue is merchandise after discounts, excluding cancelled/refunded orders; no invented forecasts.", { metric: choice("revenue", "orders", "units", "cancellations", "refunds"), period, groupBy: choice("day", "product", "partner", "customer"), ...paging }, ["metric", "period", "groupBy"]),
    tool("who_received_lot", "Recall trace: shipped or delivered orders containing this lot, with authorized recipient details.", { lot: str("Lot number"), ...paging }, ["lot"]),
    tool("advance_order", "Confirm an exact status change; shipping requires carrier and tracking.", { id: str("Order ID"), status: choice("paid", "packed", "shipped", "delivered", "cancelled", "refunded"), carrier: str("Carrier"), tracking: str("Tracking number"), note: str("Event note", 1000) }, ["id", "status"]),
    tool("review_application", "Confirm approval or decline of an application.", { id: str("Application ID"), status: choice("approved", "declined"), note: str("Review note", 1000) }, ["id", "status"]),
    tool("approve_commissions", "Confirm approval of eligible pending referrals older than the 14-day hold."),
    tool("record_payout", "Confirm recording a payment already made, not sending money.", { partnerId: str("Partner ID"), start: str("Period start YYYY-MM-DD"), end: str("Period end YYYY-MM-DD"), method: str("Payment method"), note: str("Payment note", 1000) }, ["partnerId", "start", "end", "method"]),
    tool("update_product", "Confirm changes to an existing product only. Feature-detected; unavailable before catalog editing lands.", { id: str("Product ID"), price: number(0, 9999999999.99), stock: { type: "integer", minimum: 0, maximum: 2147483647 }, description: str("Research material description", 4000), active: { type: "boolean" } }, ["id"]),
    tool("draft_journal_post", "Check proposed copy and confirm saving a NEW draft; never publish or overwrite a post.", { title: str("Title"), slug: str("URL slug"), excerpt: str("Excerpt", 600), body: str("Draft markdown", 6000), author: str("Actual author supplied by the user") }, ["title", "slug", "excerpt", "body", "author"]),
    tool("create_discount_code", "Owner only: confirm creating a new promo code. Never overwrite existing codes.", { code: str("Uppercase code"), percent: number(0.01, 100), active: { type: "boolean" }, expiresAt: str("Optional ISO expiry") }, ["code", "percent", "active"]),
  ],
  partner: [
    tool("my_month", "Own month-to-date earnings, sales, local goal and milestone."),
    tool("my_referrals", "Own referrals, without buyer identity.", paging), tool("my_payouts", "Own payouts.", paging),
    tool("my_links_and_visits", "Own link, visits and conversion, without buyer identity."), tool("program_rules", "Exact program rules and disclosure for the signed-in partner."),
    catalog("catalog"), tool("released_lots", "Public released certificates.", paging), tool("journal_posts", "Public published journal excerpts.", paging),
    tool("make_link", "Make own catalog referral link and QR locally, or link to the specified product.", { product: str("Optional product ID") }),
    tool("draft_post", "Check a proposed draft. Adds the exact partner disclosure before the draft, flags claims, returns text for Copy or rewrite; never publishes.", { platform: str("Platform"), angle: str("Research topic"), text: str("Proposed draft without disclosure", 4000) }, ["platform", "angle", "text"]),
  ],
} as const;

export function toolsFor(persona: Persona, role: string) {
  return [...TOOLS[persona]].filter((t) => !["create_discount_code", "approve_commissions", "record_payout"].includes(t.name) || role === "owner");
}
