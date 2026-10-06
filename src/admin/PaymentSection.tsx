import { useState } from "react";
import type { FormEvent } from "react";
import { Button, Dot, Drawer, Facts, Section, formatDateTime, formatMoney, statusLabel } from "../app-kit";
import type { Tone } from "../app-kit";
import type { Order } from "../platform/types";
import { useResource } from "../platform/store";
import { live } from "../platform/live/runtime";

const PAYMENT_TONE: Record<string, Tone> = { succeeded: "signal", pending: "pending", failed: "danger", abandoned: "neutral" };

/** Processor and system codes, said plainly. Anything unknown reads as the processor sent it. */
const REASONS: Record<string, string> = {
  card_declined: "Card declined",
  replaced: "Replaced by a newer attempt",
  cancelled: "Order cancelled before payment",
  expired: "Payment window ended",
};
const reasonLabel = (code: string) => REASONS[code] ?? code;

export function PaymentSection({ order }: { order: Order }) {
  const payments = useResource(() => live().payments.list(order.id), [order.id]);
  const profile = useResource(() => live().auth.profile());
  const [action, setAction] = useState<"refund" | "cancel" | null>(null);
  // Charges capture in full, so an order holds its total once paid, and nothing before then:
  // an unpaid, failed or cancelled order has nothing left to refund.
  const collected = ["captured", "partially_refunded", "refunded"].includes(order.payment) ? order.total : 0;
  const remaining = Math.max(0, Math.round((collected - (order.refunded ?? 0)) * 100) / 100);
  const [amount, setAmount] = useState(remaining.toFixed(2));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owner = profile.data?.role === "owner";
  async function submit(event?: FormEvent) {
    event?.preventDefault(); setBusy(true); setError(null);
    try {
      if (order.payment === "pending") await live().payments.cancelUnpaid(order.id);
      else if (action === "cancel") await live().payments.cancel(order.id, reason);
      else await live().payments.refund(order.id, Number(amount), reason);
      setAction(null); payments.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Payment request could not be completed. Try again."); }
    finally { setBusy(false); }
  }
  return <Section title="Payment">
    {order.paymentProvider === "simulator" || payments.data?.some((p) => p.provider === "simulator") ? <span className="kit-chip">Simulated</span> : null}
    {payments.loading && <p className="kit-note" role="status">Loading payments…</p>}
    {payments.error && <p className="kit-field-error" role="alert">{payments.error.message} <Button onClick={payments.reload}>Try again</Button></p>}
    <ul className="cc-payment-list">{payments.data?.map((p) => <li key={p.id} className="cc-payment-row">
      <span className="cc-payment-head"><span className="cc-payment-what">{statusLabel(p.kind)} · {formatMoney(p.amount)}</span><span className="cc-payment-status"><Dot tone={PAYMENT_TONE[p.status]} />{p.status === "abandoned" ? "Not completed" : statusLabel(p.status)}</span></span>
      <span className="cc-payment-meta">{formatDateTime(p.createdAt)}{p.reference && <> · <span className="kit-mono">{p.reference}</span></>}</span>
      {(p.reason || p.failureReason) && <span className="cc-payment-why">{p.reason ?? reasonLabel(p.failureReason!)}</span>}
    </li>)}</ul>
    <Facts items={[{ label: "Paid", value: formatMoney(payments.data?.filter((p) => p.kind === "charge" && p.status === "succeeded").reduce((sum,p) => sum+p.amount,0) ?? 0) }, { label: "Refunded", value: formatMoney(order.refunded ?? 0) }, { label: "Remaining", value: formatMoney(remaining) }]} />
    {error && !action && <p className="kit-field-error" role="alert">{error}</p>}
    <div className="cc-confirm-actions">
      {order.payment === "pending" && <Button disabled={busy || !profile.data} onClick={() => void submit()}>Cancel order</Button>}
      {owner && order.paymentProvider && ["paid", "packed"].includes(order.status) && <Button disabled={busy} onClick={() => { setAction("cancel"); setReason(""); setError(null); }}>Cancel and refund</Button>}
      {owner && order.paymentProvider && ["captured", "partially_refunded"].includes(order.payment) && <Button disabled={busy} onClick={() => { setAction("refund"); setAmount(remaining.toFixed(2)); setReason(""); setError(null); }}>Refund</Button>}
    </div>
    {profile.data?.role === "staff" && <p className="cc-footnote">Refunds and cancellations that move money are for owners.</p>}
    {action && <Drawer title={action === "cancel" ? "Cancel and refund" : "Refund"} eyebrow={order.number} onClose={() => { if (!busy) setAction(null); }}>
      <form className="cc-confirm" onSubmit={submit}>
        {action === "refund" ? <label className="kit-field"><span className="kit-field-label">Amount</span><span className="cc-control" data-disabled={busy || undefined}><input className="cc-input" type="number" min="0.01" max={remaining} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required disabled={busy} /></span></label> : <p className="kit-note">{formatMoney(remaining)}</p>}
        <label className="kit-field"><span className="kit-field-label">Reason</span><textarea className="kit-textarea" value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={500} disabled={busy} /></label>
        {error && <p className="kit-field-error" role="alert">{error}</p>}
        <div className="cc-confirm-actions"><Button type="submit" variant="primary" disabled={busy || !reason.trim() || (action === "refund" && (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > remaining))}>{busy ? "Processing" : action === "cancel" ? "Cancel and refund" : "Refund"}</Button><Button disabled={busy} onClick={() => setAction(null)}>Cancel</Button></div>
      </form>
    </Drawer>}
  </Section>;
}
