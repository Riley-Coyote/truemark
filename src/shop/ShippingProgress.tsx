import { Check } from "lucide-react";
import { money } from "../data";
import { store, useResource } from "../platform/store";
import type { StorefrontSettings } from "../platform/types";
import { roundMoney } from "../platform/pricing";
import "./shipping.css";

export function useShipping() {
  return useResource(async () => {
    const [settings, methods] = await Promise.all([store.settings.get(), store.catalog.shippingMethods()]);
    return { settings, methods };
  });
}

export function ShippingProgress({ base, count, settings }: { base: number; count: number; settings?: StorefrontSettings }) {
  const threshold = settings?.freeShippingThreshold;
  if (!count || threshold === undefined || threshold === null) return null;
  const remaining = Math.max(0, roundMoney(threshold - base));
  const progress = threshold > 0 ? Math.min(1, Math.max(0, base / threshold)) : 1;
  return (
    <div className="tm-shipping-progress">
      <p role="status">{remaining === 0 && <Check size={14} aria-hidden="true" />}
        {remaining === 0 ? "Free shipping unlocked" : `${money(remaining)} more for free shipping`}
      </p>
      <div className="tm-shipping-track" role="progressbar" aria-label="Free shipping"
        aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
