import type { Db } from "../_shared/db.ts";
import { presentable } from "../_shared/db.ts";
import { body, isUuid, json, message, preflight, route, text } from "../_shared/http.ts";
import { identify } from "../_shared/identity.ts";
import type { Caller } from "../_shared/identity.ts";
import { readConnection, reportStatus } from "../_shared/connections.ts";
import { simulator } from "./providers.ts";
import type { PaymentEvent } from "./providers.ts";

type Row = Record<string, unknown>;
export type Deps = {
  db: Db; url: string; serviceKey: string; functionsKey: string; simSecret: string;
  fetcher?: typeof fetch; now?: () => number; randomHex?: () => string;
  sleep?: (ms: number) => Promise<void>; background?: (task: Promise<void>) => void;
  identify?: (req: Request) => Promise<Caller | null>;
  provider?: ReturnType<typeof simulator>;
};
export function createHandler(deps: Deps) {
  const { db } = deps;
  const fetcher = deps.fetcher ?? fetch;
  const now = deps.now ?? Date.now;
  const randomHex = deps.randomHex ?? (() => Array.from(crypto.getRandomValues(new Uint8Array(12)), (n) => n.toString(16).padStart(2, "0")).join(""));
  const sleep = deps.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const provider = deps.provider ?? simulator({ secret: deps.simSecret, url: deps.url, fetcher, now, randomHex });
  const identifyCaller = deps.identify ?? ((req) => identify(req, deps.url, deps.serviceKey, db, fetcher));
  const row = (table: string, id: string) => db.one<Row>(`${table}?id=eq.${id}&select=*&limit=1`);
  async function sendRefund(payment: Row) {
    const charge = typeof payment.refund_of === "string" ? await row("payments", payment.refund_of) : null;
    if (!charge?.provider_ref || payment.provider !== "simulator") throw new Error("Payment adapter unavailable.");
    return provider.refund({ chargeRef: String(charge.provider_ref), amount: Number(payment.amount), paymentId: String(payment.id) });
  }
  async function refund(order: Row, amount: number, reason: string, cancels: boolean, actor: string | null) {
    const payment = await db.rpc<Row>("system_create_refund", { order_id: order.id, amount, reason, cancels, actor });
    return sendRefund(payment);
  }
  async function apply(event: PaymentEvent) {
    const result = await db.rpc<{ result: string; action?: string; payment_id?: string }>("system_apply_payment_event", {
      provider: "simulator", event_id: event.id, type: event.type, payment_id: event.paymentId, provider_ref: event.ref, amount: event.amount, failure_reason: event.failureReason ?? null,
    });
    if (result.action === "refund_needed") {
      const payment = await db.rpc<Row>("system_create_late_refund", { charge_id: result.payment_id });
      await sendRefund(payment);
    }
  }
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return preflight();
    const path = route(req, "payments");
    if (req.method !== "POST" || !["/start", "/simulate", "/webhook", "/refund", "/cancel"].includes(path)) return message(404, "Not found.");
    try {
      const raw = await text(req, 65536);
      if (path === "/webhook") {
        const events = await provider.parseWebhook(req, raw);
        if (!events) return message(401, "Invalid signature.");
        for (const event of events) await apply(event);
        await reportStatus(db, "payments", true);
        return json(200, { received: true });
      }
      // Reuse the common object parser after enforcing the raw-byte limit.
      const input = await body(new Request(req.url, { method: "POST", body: raw }));
      const caller = await identifyCaller(req);
      if (!caller) return message(401, "Sign in to continue.");
      if (["/refund", "/cancel"].includes(path) && caller.role !== "owner") return message(403, "Only an owner can move money.");
      if (["/start", "/simulate"].includes(path) && caller.role !== "buyer") return message(403, "Buyer access required.");
      const connection = await readConnection(db, "payments");
      if (connection.mode === "off") return message(409, "Payments are handled manually for this shop.");
      if (connection.mode === "live") {
        const error = `No payment adapter for ${connection.provider}`;
        await reportStatus(db, "payments", false, error); return message(409, error);
      }
      if (deps.simSecret.length < 32) throw new Error("Simulator configuration missing.");
      if (path === "/start") {
        if (!isUuid(input.orderId)) throw new SyntaxError();
        const payment = await db.rpc<Row>("system_create_charge", { order_id: input.orderId, provider: "simulator", buyer_user: caller.id });
        const order = await row("orders", input.orderId);
        const started = await provider.startCharge({ paymentId: String(payment.id), amount: Number(payment.amount), orderNumber: String(order?.number) });
        await reportStatus(db, "payments", true);
        return json(200, { paymentId: payment.id, amount: Number(payment.amount), mode: connection.mode, provider: "simulator", clientParams: started.clientParams });
      }
      if (path === "/simulate") {
        if (!isUuid(input.paymentId) || !["approve", "decline", "delay"].includes(String(input.outcome))) throw new SyntaxError();
        const payment = await row("payments", input.paymentId);
        const order = payment ? await row("orders", String(payment.order_id)) : null;
        const buyer = order ? await row("buyers", String(order.buyer_id)) : null;
        if (!buyer || buyer.user_id !== caller.id) return message(403, "Buyer access required.");
        if (payment!.status !== "pending" || payment!.kind !== "charge" || payment!.provider !== "simulator") return message(409, "Payment is not pending.");
        const event: PaymentEvent = { id: `sim_evt_${randomHex()}`, type: input.outcome === "decline" ? "charge.failed" : "charge.succeeded", paymentId: input.paymentId, ref: `sim_ch_${randomHex()}`, amount: Number(payment!.amount), ...(input.outcome === "decline" ? { failureReason: "card_declined" } : {}) };
        if (input.outcome === "delay") {
          const task = (async () => { await sleep(8000); try { await provider.deliver(event); await reportStatus(db, "payments", true); } catch { await reportStatus(db, "payments", false, "Payment confirmation could not be delivered."); } })();
          if (deps.background) deps.background(task); else await task;
          return json(200, { status: "processing", orderId: order!.id });
        }
        await provider.deliver(event);
        await reportStatus(db, "payments", true);
        return input.outcome === "decline" ? json(200, { status: "failed", message: "The payment was declined." }) : json(200, { status: "succeeded", orderId: order!.id });
      }
      if (!isUuid(input.orderId) || typeof input.reason !== "string" || !input.reason.trim() || input.reason.trim().length > 500) throw new SyntaxError();
      const order = await row("orders", input.orderId);
      if (!order) return message(404, "Order not found.");
      const amount = path === "/cancel" ? Number(order.total) - Number(order.refunded ?? 0) : input.amount;
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) throw new SyntaxError();
      const result = await refund(order, amount, input.reason, path === "/cancel", caller.id);
      await reportStatus(db, "payments", result.status !== "failed", result.failureReason);
      return json(200, { status: result.status });
    } catch (error) {
      if (error instanceof RangeError) return message(413, "Request is too large.");
      if (error instanceof SyntaxError) return message(400, "Check the request and try again.");
      await reportStatus(db, "payments", false, "Payment request could not be completed.");
      return message(path === "/webhook" ? 500 : 400, presentable(error, "Payment request could not be completed. Try again."));
    }
  };
}
