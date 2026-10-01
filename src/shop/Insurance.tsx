import { useEffect, useState } from "react";
import { money } from "../data";
import { storageKey } from "../platform/mode";

const key = storageKey("tm-shipment-insurance");
const eventName = "tm-shipment-insurance";
function readChoice() {
  try { return sessionStorage.getItem(key) === "true"; } catch { return false; }
}
export function clearInsuranceChoice() {
  try { sessionStorage.removeItem(key); } catch { /* Choice also lives in memory. */ }
  window.dispatchEvent(new CustomEvent(eventName, { detail: false }));
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
