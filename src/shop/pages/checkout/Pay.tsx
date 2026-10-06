import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { money } from "../../../data";
import { LIVE } from "../../../platform/mode";
import { live } from "../../../platform/live/runtime";
import type { Outcome } from "../../../platform/live/payments";
import { store, useResource } from "../../../platform/store";
import { productById } from "../../catalog";
import Confirmation from "./Confirmation";
import "./checkout.css";

export function PaymentOutcomes({ value, onChange, disabled = false }: { value: Outcome; onChange: (value: Outcome) => void; disabled?: boolean }) {
  return <fieldset className="tm-choices" disabled={disabled}>
    <legend className="tm-step-lead">Payment outcome</legend>
    {([['approve', 'Approved'], ['decline', 'Declined'], ['delay', 'Approved after a short delay']] as const).map(([outcome, label]) => <label className="tm-choice" key={outcome}>
      <input className="tm-choice-input" type="radio" name="payment-outcome" checked={value === outcome} onChange={() => onChange(outcome)} />
      <span className="tm-choice-top"><span className="tm-choice-title">{label}</span><span className="tm-choice-mark" aria-hidden="true" /></span>
    </label>)}
  </fieldset>;
}

export default function Pay() {
  const { orderId = "" } = useParams();
  const navigate = useNavigate();
  const resource = useResource(() => LIVE ? store.orders.get(orderId) : Promise.resolve(null), [orderId]);
  const buyer = useResource(() => store.session.get());
  const mode = useResource(() => LIVE ? live().payments.mode() : Promise.resolve("off" as const));
  const [outcome, setOutcome] = useState<Outcome>("approve");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const order = resource.data;
  if (!LIVE) return null;
  if (resource.loading || buyer.loading || mode.loading) return <p className="tm-step-note" role="status">Loading the order…</p>;
  if (resource.error || buyer.error || mode.error) return <div className="tm tm-purchase-empty"><p role="alert">{resource.error?.message ?? buyer.error?.message ?? mode.error?.message}</p><button className="tm-button" onClick={() => { resource.reload(); buyer.reload(); mode.reload(); }}>Try again</button></div>;
  if (!order || order.buyerId !== buyer.data?.id) return <div className="tm tm-purchase-empty"><p className="tm-step-note">No order matches this link.</p><Link className="tm-textlink" to="/access">Sign in</Link></div>;
  if (order.payment !== "pending" || order.status !== "placed" || (order.paymentExpiresAt && Date.parse(order.paymentExpiresAt) <= Date.now())) return <Confirmation released={order.payment === "pending"} />;
  async function pay(cancel = false) {
    if (!order) return;
    setBusy(true); setError(null);
    try {
      if (cancel) await live().payments.cancelUnpaid(order.id);
      else {
        const result = await live().payments.pay(order.id, outcome);
        if (result.status === "failed") { setError("The payment was declined. Choose an outcome and try again."); return; }
      }
      navigate(`/checkout/confirmation/${order.id}`, { replace: true });
    } catch (e) { setError(e instanceof Error ? e.message : "Payment request could not be completed. Try again."); }
    finally { setBusy(false); }
  }
  return <div className="tm-page tm-purchase"><section className="tm tm-checkout" aria-labelledby="tm-pay-title">
    <header className="tm-purchase-head"><p className="tm-eyebrow">Order <span className="tm-mono">{order.number}</span></p><h1 id="tm-pay-title" className="tm-heading">Complete payment.</h1></header>
    <div className="tm-secure"><h2 className="tm-secure-title">Payment {mode.data === "simulated" && <span className="tm-step-tag">Simulated</span>}</h2>
      {mode.data === "simulated" ? <><p className="tm-step-note">Payments are simulated on this site. No card is charged.</p><PaymentOutcomes value={outcome} onChange={setOutcome} disabled={busy} /></> : <p className="tm-step-note">{mode.data === "live" ? "Card payments are being connected. Please try again soon." : "Payments are handled manually for this shop."}</p>}
      {error && <p className="tm-field-error" role="alert">{error}</p>}
      <div className="tm-step-actions"><button className="tm-button tm-button-primary" disabled={busy || mode.data !== "simulated"} onClick={() => void pay()} aria-busy={busy}>{busy ? "Processing" : `Pay ${money(order.total)}`}</button><button className="tm-text-button" disabled={busy} onClick={() => void pay(true)}>Cancel order</button></div>
      {mode.data === "simulated" && <p className="tm-step-fine">Simulated payment. No card is charged.</p>}
    </div>
    <aside className="tm-summary tm-checkout-summary" aria-label="Order summary"><h2 className="tm-summary-title">Order summary</h2><ul className="tm-summary-lines">{order.lines.map((line) => <li className="tm-summary-line" key={line.productId}><span>{productById(line.productId)?.name ?? line.productId} · Qty {line.quantity}</span><span>{money(line.unitPrice * line.quantity)}</span></li>)}</ul>
      <dl className="tm-totals"><div className="tm-totals-row"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>{order.discount && <div className="tm-totals-row"><dt>Discount</dt><dd>−{money(order.discount.amount)}</dd></div>}<div className="tm-totals-row"><dt>Shipping</dt><dd>{money(order.shipping.price)}</dd></div>{order.insuranceApplied && <div className="tm-totals-row"><dt>Insurance</dt><dd>{money(order.insurance ?? 0)}</dd></div>}<div className="tm-totals-row"><dt>Tax</dt><dd>{money(order.tax ?? 0)}</dd></div><div className="tm-totals-row tm-totals-total"><dt>Total</dt><dd>{money(order.total)}</dd></div></dl>
    </aside>
  </section></div>;
}
