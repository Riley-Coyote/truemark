import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { money } from "../data";
import { storageKey } from "../platform/mode";
import { insurancePrice } from "../platform/pricing";
import type { StorefrontSettings } from "../platform/types";

const key = storageKey("tm-shipment-insurance");
const eventName = "tm-shipment-insurance";
/** Where the shop offers insurance as a choice, a shipment starts insured: the buyer turns it off (the client's request,
 *  October 2026). */
const INSURED_BY_DEFAULT = true;
function readChoice() {
  try {
    const stored = sessionStorage.getItem(key);
    return stored === null ? INSURED_BY_DEFAULT : stored === "true";
  } catch {
    return INSURED_BY_DEFAULT;
  }
}
/** After an order, the next one starts from the default again. */
export function clearInsuranceChoice() {
  try { sessionStorage.removeItem(key); } catch { /* Choice also lives in memory. */ }
  window.dispatchEvent(new CustomEvent(eventName, { detail: INSURED_BY_DEFAULT }));
}
export function useInsuranceChoice() {
  const [chosen, setChosen] = useState(readChoice);
  useEffect(() => {
    const sync = (event: Event) => setChosen((event as CustomEvent<boolean>).detail);
    window.addEventListener(eventName, sync);
    return () => window.removeEventListener(eventName, sync);
  }, []);
  return [chosen, (next: boolean) => {
    setChosen(next);
    try { sessionStorage.setItem(key, String(next)); } catch { /* In-memory choice remains usable. */ }
    window.dispatchEvent(new CustomEvent(eventName, { detail: next }));
  }] as const;
}

export function InsuranceRow({ amount, applied, className = "tm-totals-row" }: { amount?: number; applied?: boolean; className?: string }) {
  if (!applied && !amount) return null;
  return <div className={className}><dt>Insurance</dt><dd>{money(amount ?? 0)}</dd></div>;
}

/** The buyer's own switch for the shipment's insurance, in the cart and at checkout alike, wherever the shop offers it
 *  as a choice. Its price is the bag's, after discounts. */
export function InsuranceChoice({ base, settings }: { base: number; settings?: StorefrontSettings }) {
  const [insured, setInsured] = useInsuranceChoice();
  if (settings?.insuranceMode !== "optional") return null;
  return (
    <label className="tm-check">
      <input type="checkbox" className="tm-check-input" checked={insured} onChange={(event) => setInsured(event.target.checked)} />
      <span className="tm-check-box" aria-hidden="true"><Check size={14} strokeWidth={2.2} /></span>
      <span className="tm-check-text">Insure this shipment · {money(insurancePrice(base, settings, true))}</span>
    </label>
  );
}
