/**
 * Moving an order along, from its drawer: one decisive action per step. Placed →
 * Mark paid; paid → Mark packed (confirming the cold pack); packed → Mark shipped
 * (carrier and tracking number); shipped → Mark delivered. Each calls
 * store.orders.advance, which records the step with its time and tells the buyer.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button, Segmented } from "../app-kit";
import { store } from "../platform/store";
import type { Order, OrderStatus } from "../platform/types";
import { TextField } from "./fields";

export const CARRIERS = ["UPS", "FedEx"] as const;
export type Carrier = (typeof CARRIERS)[number];

/** Tracking numbers as each carrier prints them: UPS is 1Z and sixteen letters or digits; FedEx is 12, 15, 20 or 22 digits. */
const FORMATS: Record<Carrier, RegExp> = {
  UPS: /^1Z[0-9A-Z]{16}$/,
  FedEx: /^(\d{12}|\d{15}|\d{20}|\d{22})$/,
};
const HINTS: Record<Carrier, string> = {
  UPS: "As printed on the UPS label: 1Z, then 16 letters or digits.",
  FedEx: "As printed on the FedEx label: 12, 15, 20 or 22 digits.",
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
export const PACKED_NOTE = "Packed cold, with gel packs rated for the route.";

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
    hint: "Confirms the cold pack. The customer sees it on their tracker.",
    done: "Marked packed. The customer sees it on their tracker.",
  },
  packed: {
    status: "shipped",
    action: "Mark shipped",
    hint: "With the carrier and tracking number. The customer is emailed both.",
    done: "Marked shipped. Customer notified with the tracking number.",
  },
  shipped: {
    status: "delivered",
    action: "Mark delivered",
    hint: "The customer is emailed the certificates for their lots.",
    done: "Marked delivered. Customer notified.",
  },
};

type Step = { kind: "idle" } | { kind: "pack" } | { kind: "ship"; carrier: Carrier; tracking: string; error?: string };

/** The drawer's footer while an order still has a step to take. */
export function Fulfilment({ order, onDone }: { order: Order; onDone: (message: string) => void }) {
  const next = NEXT[order.status];
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const hintId = useId();
  const primary = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const tracking = useRef<HTMLInputElement>(null);
  const status = useRef(order.status);
  /** Where focus goes once the footer has re-rendered: the footer's content changes under the keyboard. */
  const focusNext = useRef<"primary" | "confirm" | "tracking" | null>(null);

  // When a step lands, the next action takes focus, ready for the next click.
  useEffect(() => {
    if (status.current === order.status) return;
    status.current = order.status;
    focusNext.current = "primary";
    setStep({ kind: "idle" });
  }, [order.status]);

  useEffect(() => {
    const target = focusNext.current;
    const el =
      target === "primary" && step.kind === "idle"
        ? primary.current
        : target === "confirm" && step.kind === "pack"
          ? confirm.current
          : target === "tracking" && step.kind === "ship"
            ? tracking.current
            : null;
    // A control still saving is disabled and cannot take focus; try again on the next render.
    if (!el || (el instanceof HTMLButtonElement && el.disabled)) return;
    focusNext.current = null;
    el.focus({ preventScroll: true });
  });

  const go = (to: Step, focus: "primary" | "confirm" | "tracking") => {
    focusNext.current = focus;
    setStep(to);
  };

  if (!next) return null;

  async function advance(extra: { carrier?: string; tracking?: string; note?: string } = {}) {
    if (!next) return;
    setSaving(true);
    setFailed(null);
    try {
      await store.orders.advance(order.id, next.status, extra);
      onDone(next.done);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "The step was not saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function ship(event: FormEvent) {
    event.preventDefault();
    if (step.kind !== "ship") return;
    const error = trackingError(step.carrier, step.tracking);
    if (error) {
      setStep({ ...step, error });
      tracking.current?.focus();
      return;
    }
    void advance({ carrier: step.carrier, tracking: cleanTracking(step.tracking) });
  }

  const problem = failed && (
    <p className="kit-field-error" role="alert">
      {failed}
    </p>
  );

  if (step.kind === "pack") {
    return (
      <div className="cc-confirm" role="group" aria-label={`Confirm ${order.number} is packed`}>
        <p className="cc-confirm-text">{PACKED_NOTE}</p>
        <p className="cc-footnote">Kept with this step, and the customer sees the order packed on their tracker.</p>
        {problem}
        <div className="cc-confirm-actions">
          <button
            ref={confirm}
            type="button"
            className="kit-button kit-button-primary"
            onClick={() => void advance({ note: PACKED_NOTE })}
            disabled={saving}
          >
            {saving ? "Saving" : "Confirm packed"}
          </button>
          <Button onClick={() => go({ kind: "idle" }, "primary")} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (step.kind === "ship") {
    return (
      <form className="cc-confirm cc-ship" onSubmit={ship} noValidate aria-label={`Ship ${order.number}`}>
        <div className="kit-field">
          {/* The segmented group carries the same name for screen readers. */}
          <p className="kit-field-label" aria-hidden="true">
            Carrier
          </p>
          <Segmented
            label="Carrier"
            options={CARRIERS.map((carrier) => ({ value: carrier, label: carrier }))}
            value={step.carrier}
            onChange={(carrier) =>
              setStep({ ...step, carrier, error: step.error ? trackingError(carrier, step.tracking) : undefined })
            }
          />
        </div>
        <TextField
          label="Tracking number"
          mono
          value={step.tracking}
          onChange={(value) =>
            setStep({ ...step, tracking: value, error: step.error ? trackingError(step.carrier, value) : undefined })
          }
          hint={HINTS[step.carrier]}
          error={step.error}
          inputRef={tracking}
        />
        {problem}
        <div className="cc-confirm-actions">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving" : "Confirm shipped"}
          </Button>
          <Button onClick={() => go({ kind: "idle" }, "primary")} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="cc-actions">
      <div className="cc-fulfil">
        <button
          ref={primary}
          type="button"
          className="kit-button kit-button-primary"
          aria-describedby={hintId}
          disabled={saving}
          onClick={() => {
            if (order.status === "paid") go({ kind: "pack" }, "confirm");
            else if (order.status === "packed") go({ kind: "ship", carrier: "UPS", tracking: "" }, "tracking");
            else void advance();
          }}
        >
          {saving ? "Saving" : next.action}
        </button>
        <p id={hintId} className="cc-footnote">
          {next.hint}
        </p>
      </div>
      {problem}
    </div>
  );
}
