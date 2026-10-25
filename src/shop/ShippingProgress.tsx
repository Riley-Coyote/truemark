import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { money } from "../data";
import { store, useResource } from "../platform/store";
import type { StorefrontSettings } from "../platform/types";
import { roundMoney } from "../platform/pricing";
import { offerAmount } from "./offers";
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

/** How far the bar was last drawn, wherever it was: a bar that opens on a new add draws on from there, so it shows
 *  what the add brought rather than the whole bag again. */
let lastDrawn = 0;

/** The share drawn: where it was last seen, then the bag's own share a frame later, so the line travels between them. */
function useDrawnShare(share: number) {
  const [drawn, setDrawn] = useState(lastDrawn);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      lastDrawn = share;
      setDrawn(share);
    });
    return () => cancelAnimationFrame(frame);
  }, [share]);
  return drawn;
}

/**
 * Every reward on one line, as the paper trail draws a lot's path on the home page: a hairline from nothing to the last
 * reward, a station at each, filled once the bag reaches it, and the bag's progress travelling along it. Above it, what
 * the next reward needs; once every one is reached, the last one, unlocked.
 */
export function ShippingProgress({ base, count, settings, bacWater = false }: { base: number; count: number; settings?: StorefrontSettings; bacWater?: boolean }) {
  const milestones = rewardMilestones(settings, bacWater);
  const amount = roundMoney(base);
  const last = milestones[milestones.length - 1];
  const share = (at: number) => (last && last.at > 0 ? Math.min(1, Math.max(0, at / last.at)) : 1);
  const drawn = useDrawnShare(last ? share(amount) : 0);
  if (!count || !last) return null;
  const next = milestones.find((milestone) => amount < milestone.at);
  const status = next ? `${money(Math.max(0, roundMoney(next.at - base)))} more for ${next.reward}` : last.unlocked;
  return (
    <div className="tm-shipping-progress">
      <p role="status">{!next && <Check size={14} aria-hidden="true" />}
        {status}
      </p>
      <div className="tm-rewards" role="progressbar" aria-label="Rewards" aria-valuetext={status}
        aria-valuenow={Math.round(share(amount) * 100)} aria-valuemin={0} aria-valuemax={100}>
        <span className="tm-rewards-line" />
        <span className="tm-rewards-fill" style={{ "--tm-share": drawn } as CSSProperties} />
        {milestones.map((milestone) => (
          <span key={milestone.reward} className="tm-rewards-station" data-reached={amount >= milestone.at ? "" : undefined}
            style={{ "--tm-at": share(milestone.at) } as CSSProperties} />
        ))}
      </div>
      {/* Read from the line's two ends, so the names never meet whatever the thresholds: the nearest reward at its
          start, the last at its end. The stations on the line mark where each one falls. */}
      <ul className="tm-rewards-legend" aria-hidden="true">
        {milestones.map((milestone) => (
          <li key={milestone.reward} data-reached={amount >= milestone.at ? "" : undefined}>
            {milestone.label} <span>{offerAmount(milestone.at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
