import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConnectionMode } from "../connections";
import type { Row } from "./rows";
import { order } from "./rows";
import type { TaxRate } from "../tax";

export type Outcome = "approve" | "decline" | "delay";
export type Payment = { id: string; orderId: string; kind: "charge" | "refund"; provider: string; amount: number; status: "pending" | "succeeded" | "failed" | "abandoned"; createdAt: string; reference?: string; reason?: string; failureReason?: string };
export function createPayments(client: SupabaseClient, rows: (table: string, select?: string, filters?: Record<string, string>) => Promise<Row[]>, rpc: <T>(name: string, args?: Record<string, unknown>) => Promise<T>, changed: () => void) {
  async function call<T>(path: string, input: Record<string, unknown>): Promise<T> {
    const result = await client.functions.invoke(`payments/${path}`, { body: input });
    if (result.error) {
      const response = result.error.context as Response | undefined;
      const detail = response && typeof response.json === "function" ? await response.json().catch(() => null) : null;
      throw new Error(detail?.message ?? "Payment request could not be completed. Try again.");
    }
    changed(); return result.data as T;
  }
  return {
    mode: () => rpc<ConnectionMode>("checkout_payment_mode"),
    async list(orderId: string): Promise<Payment[]> {
      return (await rows("payments", "*", { order_id: orderId })).map((r) => ({ id: String(r.id), orderId: String(r.order_id), kind: r.kind as Payment["kind"], provider: String(r.provider), amount: Number(r.amount), status: r.status as Payment["status"], createdAt: String(r.created_at), reference: r.provider_ref == null ? undefined : String(r.provider_ref), reason: r.reason == null ? undefined : String(r.reason), failureReason: r.failure_reason == null ? undefined : String(r.failure_reason) })).sort((a,b) => a.createdAt.localeCompare(b.createdAt));
    },
    async pay(orderId: string, outcome: Outcome) {
      const started = await call<{ paymentId: string }>("start", { orderId });
      return call<{ status: "succeeded" | "processing" | "failed"; orderId?: string; message?: string }>("simulate", { paymentId: started.paymentId, outcome });
    },
    async cancelUnpaid(orderId: string) { const saved = order(await rpc<Row>("cancel_unpaid_order", { order_id: orderId })); changed(); return saved; },
    refund: (orderId: string, amount: number, reason: string) => call<{ status: string }>("refund", { orderId, amount, reason }),
    cancel: (orderId: string, reason: string) => call<{ status: string }>("cancel", { orderId, reason }),
    async rates(): Promise<TaxRate[]> { return (await rows("tax_rates")).map((r) => ({ region: String(r.region), rate: Number(r.rate) })); },
    async setTaxSettings(mode: "off" | "rates", shipping: boolean) { await rpc("set_tax_settings", { mode, shipping }); changed(); },
    async setTaxRate(region: string, rate: number | null) { await rpc("set_tax_rate", { region, rate }); changed(); },
  };
}
