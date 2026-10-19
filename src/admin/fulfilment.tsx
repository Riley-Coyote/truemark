import { useEffect, useRef, useState } from "react";
import { Button } from "../app-kit";
import { store } from "../platform/store";
import type { Order, OrderStatus } from "../platform/types";
import type { Shipment } from "../platform/shipping";
import { LIVE } from "../platform/mode";
import { live } from "../platform/live/runtime";

export const CARRIERS = ["UPS", "FedEx"] as const;
export type Carrier = (typeof CARRIERS)[number];

/** Tracking numbers as each carrier prints them: UPS is 1Z and sixteen letters or digits; FedEx is 12, 15, 20 or 22 digits. */
const FORMATS: Record<Carrier, RegExp> = {
  UPS: /^1Z[0-9A-Z]{16}$/,
  FedEx: /^(\d{12}|\d{15}|\d{20}|\d{22})$/,
};
/** Spaces and dashes are how labels print numbers, not part of them. */
export const cleanTracking = (value: string) => value.replace(/[\s-]/g, "").toUpperCase();

export function trackingError(carrier: Carrier, value: string): string | undefined {
  const clean = cleanTracking(value);
  if (!clean) return `Enter the tracking number from the ${carrier} label.`;
  if (FORMATS[carrier].test(clean)) return undefined;
  const other = CARRIERS.find((c) => c !== carrier && FORMATS[c].test(clean));
  if (other) return `That looks like a ${other} number. Choose ${other}, or check the number.`;
  return carrier === "UPS"
    ? "A UPS tracking number starts with 1Z and has 18 characters."
    : "A FedEx tracking number has 12, 15, 20 or 22 digits.";
}

/** The confirmation an operator gives when an order is packed; it is kept with the step. */
export const PACKED_NOTE = "Items, quantities and lot numbers checked against this order. Label attached and package sealed.";

type Next = { status: OrderStatus; action: string; hint: string; done: string };

export const NEXT: Partial<Record<OrderStatus, Next>> = {
  placed: {
    status: "paid",
    action: "Mark paid",
    hint: "Once the payment has cleared.",
    done: "Marked paid.",
  },
  paid: {
    status: "packed",
    action: "Mark packed",
    hint: "Check the items and label, then confirm the package is ready.",
    done: "Marked packed. The customer sees it on their tracker.",
  },
  packed: {
    status: "shipped",
    action: "Mark shipped",
    hint: "Waiting for carrier confirmation. A label alone does not mean shipped.",
    done: "Marked shipped. Customer notified with the tracking number.",
  },
  shipped: {
    status: "delivered",
    action: "Mark delivered",
    hint: "The customer is emailed the certificates for their lots.",
    done: "Marked delivered. Customer notified.",
  },
};

/** Printing and packing are operator tasks; shipment is a separate carrier event. */
export function Fulfilment({ order, shipment, onDone, onAdvance = store.orders.advance, onPrintLabel }: {
  order: Order;
  shipment?: Shipment | null;
  onDone: (message: string) => void;
  onAdvance?: (id: string, status: OrderStatus, extra: { carrier?: string; tracking?: string; note?: string }) => Promise<unknown>;
  /** An isolated lab may supply a fixture action; never call a provider there. */
  onPrintLabel?: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [previewLabel, setPreviewLabel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const confirmationState = useRef<HTMLParagraphElement>(null);
  const previousStatus = useRef(order.status);
  const confirm = useRef<HTMLButtonElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (confirming) confirm.current?.focus(); }, [confirming]);
  useEffect(() => {
    if (previousStatus.current === order.status) return;
    previousStatus.current = order.status;
    setConfirming(false);
    (confirmationState.current ?? primary.current)?.focus({ preventScroll: true });
  }, [order.status]);
  const labelReady = Boolean(shipment?.status === "pushed" && !shipment.cancelRequested && shipment.labelCreatedAt) || (!LIVE && previewLabel);
  const previousLabel = useRef(labelReady);
  useEffect(() => {
    if (saving) return;
    if (previousLabel.current !== labelReady && labelReady) primary.current?.focus({ preventScroll: true });
    previousLabel.current = labelReady;
  }, [labelReady, saving]);
  const next = order.status === "placed" && order.payment !== "authorized" ? undefined : NEXT[order.status];
  if (!next) return null;

  async function perform(action: () => Promise<unknown>, message: string) {
    if (saving) return;
    setSaving(true); setFailed(null);
    try { await action(); onDone(message); }
    catch (error) { setFailed(error instanceof Error ? error.message : "The step was not saved. Try again."); }
    finally { setSaving(false); }
  }
  async function printPreview() {
    if (onPrintLabel) await onPrintLabel();
    else if (LIVE && shipment?.provider === "simulator") await live().shipping.simulate(order.id, "label");
    if (!LIVE) setPreviewLabel(true);
  }
  const problem = failed && <p className="kit-field-error" role="alert">{failed}</p>;
  if ((order.status === "paid" || (order.status === "packed" && shipment?.status === "pushed")) && !labelReady) {
    const simulated = !LIVE || shipment?.provider === "simulator";
    const available = !LIVE || (shipment?.status === "pushed" && !shipment.cancelRequested);
    return <div className="cc-actions"><div className="cc-fulfil">
      {simulated ? <Button variant="primary" disabled={saving || !available}
        onClick={() => void perform(printPreview, "Sample label created. Check the items and label before carrier handoff.")}>
        {saving ? "Preparing label…" : "Print label (simulated)"}
      </Button> : <a className="kit-button kit-button-primary" href="https://ship.shipstation.com/" target="_blank" rel="noreferrer">Print label in ShipStation ↗</a>}
      <p className="cc-footnote">{!LIVE ? "Preview only: no label is purchased or printed." :
        !shipment ? "Shipping is not connected for this order. Label details must sync before packing." :
        shipment.status === "failed" ? "Resolve the shipping error below, then print the label." :
        shipment.provider === "simulator" ? "Create a sample label, then confirm the items are packed. No label is purchased or printed." :
        shipment.cancelRequested || shipment.status === "cancelled" ? "This shipment is being cancelled. Refresh the order before proceeding." :
        "Find this order in ShipStation and print its label. Packing becomes available when the label details arrive."}</p>
    </div>{problem}</div>;
  }
  if (order.status === "paid" && confirming) return <div className="cc-confirm" role="group" aria-label={`Confirm ${order.number} is packed`}>
    <p className="cc-confirm-text">{PACKED_NOTE}</p>
    <p className="cc-footnote">This confirms packing only. The customer sees shipped after carrier confirmation.</p>
    {problem}<div className="cc-confirm-actions">
      <button ref={confirm} className="kit-button kit-button-primary" disabled={saving}
        onClick={() => void perform(() => onAdvance(order.id, "packed", { note: PACKED_NOTE }), "Packing confirmed.")}>
        {saving ? "Saving…" : "Confirm packed"}
      </button>
      <Button disabled={saving} onClick={() => { setConfirming(false); requestAnimationFrame(() => primary.current?.focus()); }}>Cancel</Button>
    </div>
  </div>;
  if (order.status === "packed" || order.status === "shipped") return <div className="cc-actions"><div className="cc-fulfil">
    <p ref={confirmationState} tabIndex={-1} className="cc-footnote">{order.status === "packed" ? "Packed · awaiting carrier confirmation. Printing a label does not mark the order shipped." : "Shipped · delivery updates follow the carrier."}</p>
    {!LIVE && <Button disabled={saving} onClick={() => void perform(() => onAdvance(order.id, next!.status, order.status === "packed" ? {
      carrier: "UPS", tracking: order.shipping?.tracking ?? "1ZSIM0000000000000",
    } : {}), next!.done)}>{order.status === "packed" ? "Simulate carrier pickup" : "Simulate delivery scan"}</Button>}
  </div>{problem}</div>;
  return <div className="cc-actions"><div className="cc-fulfil">
    <button ref={primary} className="kit-button kit-button-primary" disabled={saving || Boolean(shipment?.cancelRequested)}
      onClick={() => order.status === "paid" ? setConfirming(true) : void perform(() => onAdvance(order.id, next!.status, {}), next!.done)}>
      {saving ? "Saving…" : next.action}
    </button><p className="cc-footnote">{next.hint}</p>
  </div>{problem}</div>;
}
