export type Persona = "visitor" | "owner" | "partner";
export type ToolCall = { type: "tool_call"; id: string; name: string; arguments: Record<string, unknown> };
export type ToolResult = { role: "tool"; tool_call_id: string; content: string };
export type ToolSchema = { name: string; description: string; parameters: { type: string; properties: Record<string, { type: string; enum?: string[]; minimum?: number; maximum?: number; maxLength?: number }>; required: string[]; additionalProperties: boolean } };
export type Meta = { persona: Persona; threadId: string; threadToken: string; tools: ToolSchema[] };
export type Reply = { text: string; tools: ToolCall[]; meta: Meta };
export const OFFLINE = "The assistant is unavailable right now";
export class AssistantError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const expectedNames: Record<Persona, readonly string[]> = {
  visitor: ["search_catalog", "get_product", "compare_products", "lookup_lot", "shipping_info", "site_answers", "my_orders", "order_status", "my_account_status", "add_to_bag"],
  owner: ["business_summary", "orders", "order", "customers", "customer", "products_and_stock", "lots", "applications", "partners", "referrals_and_payouts", "journal", "settings", "trend", "who_received_lot", "advance_order", "review_application", "approve_commissions", "record_payout", "update_product", "draft_journal_post", "create_discount_code"],
  partner: ["my_month", "my_referrals", "my_payouts", "my_links_and_visits", "program_rules", "catalog", "released_lots", "journal_posts", "make_link", "draft_post"],
};
export function validateInput(tool: ToolCall, schema: ToolSchema) {
  if (!tool.arguments || typeof tool.arguments !== "object" || Array.isArray(tool.arguments)) throw new Error("Please provide the tool's fields.");
  for (const key of schema.parameters.required) if (!(key in tool.arguments)) throw new Error(`Missing ${key}.`);
  for (const [key, value] of Object.entries(tool.arguments)) {
    const rule = schema.parameters.properties[key];
    if (!rule || (rule.type === "integer" ? !Number.isInteger(value) : typeof value !== rule.type)) throw new Error(`Check ${key}.`);
    if (rule.enum && !rule.enum.includes(String(value))) throw new Error(`Check ${key}.`);
    if (typeof value === "number" && (!Number.isFinite(value) || value < (rule.minimum ?? -Infinity) || value > (rule.maximum ?? Infinity))) throw new Error(`Check ${key}.`);
    if (typeof value === "string" && (!value.trim() || value.length > (rule.maxLength ?? 6000))) throw new Error(`Check ${key}.`);
  }
}
