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

type Milestone = { at: number; reward: string; unlocked: string; label: string };

/**
 * The rewards a bag works toward, nearest first: the free BAC Water vial (only while one can be sent) and free
 * shipping, each at merchandise after discounts.
 */
export function rewardMilestones(settings: StorefrontSettings | undefined, bacWater: boolean): Milestone[] {
  const shipping = settings?.freeShippingThreshold ?? null;
  const vial = bacWater ? settings?.freeBacWaterThreshold ?? null : null;
  return [
    ...(vial !== null ? [{ at: vial, reward: "free BAC water", unlocked: "Free BAC water unlocked", label: "Free BAC water" }] : []),
    ...(shipping !== null ? [{ at: shipping, reward: "free shipping", unlocked: "Free shipping unlocked", label: "Free shipping" }] : []),
  ].sort((a, b) => a.at - b.at);
}

/** The bar toward the next reward still ahead; once all are reached, the last one, unlocked. */
export function ShippingProgress({ base, count, settings, bacWater = false }: { base: number; count: number; settings?: StorefrontSettings; bacWater?: boolean }) {
  const milestones = rewardMilestones(settings, bacWater);
  if (!count || !milestones.length) return null;
  const next = milestones.find((milestone) => roundMoney(base) < milestone.at) ?? milestones[milestones.length - 1];
  const remaining = Math.max(0, roundMoney(next.at - base));
  const progress = next.at > 0 ? Math.min(1, Math.max(0, base / next.at)) : 1;
  return (
    <div className="tm-shipping-progress">
      <p role="status">{remaining === 0 && <Check size={14} aria-hidden="true" />}
        {remaining === 0 ? next.unlocked : `${money(remaining)} more for ${next.reward}`}
      </p>
      <div className="tm-shipping-track" role="progressbar" aria-label={next.label}
        aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
