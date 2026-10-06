import { signedHeader, verifySignedHeader } from "../_shared/signing.ts";
import { isUuid } from "../_shared/http.ts";

export type PaymentEvent = { id: string; type: string; paymentId: string; ref: string; amount: number; failureReason?: string };
export type Provider = {
  startCharge(input: { paymentId: string; amount: number; orderNumber: string }): Promise<{ clientParams: Record<string, unknown> }>;
  refund(input: { chargeRef: string; amount: number; paymentId: string }): Promise<{ ref: string; status: "succeeded" | "pending" | "failed"; failureReason?: string }>;
  parseWebhook(req: Request, raw: string): Promise<PaymentEvent[] | null>;
};
export type SimulatorDeps = { secret: string; url: string; fetcher: typeof fetch; now: () => number; randomHex: () => string };
export function simulator(deps: SimulatorDeps): Provider & { deliver(event: PaymentEvent): Promise<void> } {
  const deliver = async (event: PaymentEvent) => {
    const raw = JSON.stringify(event);
    const response = await deps.fetcher(`${deps.url.replace(/\/+$/, "")}/functions/v1/payments/webhook`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-sim-signature": await signedHeader(deps.secret, raw, deps.now()) }, body: raw,
    });
    if (!response.ok) throw new Error("Payment confirmation could not be delivered.");
  };
  return {
    deliver,
    async startCharge({ paymentId }) { return { clientParams: { paymentId } }; },
    async refund({ amount, paymentId }) {
      const ref = `sim_rf_${deps.randomHex()}`;
      await deliver({ id: `sim_evt_${deps.randomHex()}`, type: "refund.succeeded", paymentId, ref, amount });
      return { ref, status: "succeeded" };
    },
    async parseWebhook(req, raw) {
      if (deps.secret.length < 32 || !await verifySignedHeader(req.headers.get("x-sim-signature"), raw, deps.secret, deps.now())) return null;
      const value = JSON.parse(raw) as Partial<PaymentEvent>;
      if (typeof value.id !== "string" || !value.id || typeof value.type !== "string" || !isUuid(value.paymentId) || typeof value.ref !== "string" || typeof value.amount !== "number" || !Number.isFinite(value.amount)) throw new SyntaxError("Invalid event");
      return [value as PaymentEvent];
    },
  };
}
