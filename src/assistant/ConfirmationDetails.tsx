import { formatCount, formatDate, formatDateTime, formatMoney, sentenceCase } from "../app-kit/format";
import type { PendingAction } from "./runtime";

const labels: Record<string, string> = {
  status: "New status", currentStatus: "Current status", carrier: "Carrier", tracking: "Tracking",
  partnerId: "Partner", productId: "Product", start: "From", end: "To", method: "Method", note: "Note",
  price: "Price", unitPrice: "Price per item", stock: "Stock", description: "Description", active: "Shown in store",
  code: "Code", percent: "Percent off", expiresAt: "Expires", title: "Title", slug: "Slug", excerpt: "Excerpt",
  author: "Author", body: "Draft text", institution: "Institution", before: "Before", hold: "Hold period",
  count: "Commissions", quantity: "Quantity", meaning: "What this does", referrals: "Referrals", publishes: "Publishes", kind: "Type",
};
const identities: Record<string, string> = {
  advance_order: "Order", review_application: "Application", update_product: "Product", add_to_bag: "Product", record_payout: "Partner",
};
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function displayValue(key: string, value: unknown): string {
  if (value == null || value === "") return key === "stock" ? "Not tracked" : "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (["price", "unitPrice", "amount", "total"].includes(key)) return formatMoney(value);
    if (key === "percent") return `${value}%`;
    return formatCount(value);
  }
  if (typeof value === "string") {
    if (["start", "end", "expiresAt", "before"].includes(key) && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) && Number.isFinite(Date.parse(value))) {
      return value.includes("T") ? formatDateTime(value) : formatDate(value);
    }
    if (["status", "currentStatus", "kind"].includes(key)) return sentenceCase(value.replace(/_/g, " "));
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => displayValue(key, item)).join(", ");
  return "Not set";
}

/** Details contain display identities resolved by the runtime; writes keep their original IDs. */
export function ConfirmationDetails({ action }: { action: Pick<PendingAction, "tool" | "details"> }) {
  const rows: { key: string; label: string; value: string }[] = [];
  const label = (key: string) => key === "id" ? identities[action.tool] ?? "Record" : labels[key] ?? sentenceCase(key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " "));
  const { before, after } = action.details;
  for (const [key, value] of Object.entries(action.details)) {
    if ((key === "before" || key === "after") && record(before) && record(after)) {
      if (key === "after") for (const [field, next] of Object.entries(after)) rows.push({ key: field, label: label(field), value: `${displayValue(field, before[field])} → ${displayValue(field, next)}` });
    } else rows.push({ key, label: label(key), value: displayValue(key, value) });
  }
  return <dl>{rows.map((row) => <div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>;
}
