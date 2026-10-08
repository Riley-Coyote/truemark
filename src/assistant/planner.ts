import type { Product } from "../data";
import type { ShippingMethod, StorefrontSettings } from "../platform/types";

/*
 * The order planner: a few questions about what a lab needs, how much and by when, and a plan built
 * from the catalog's own sizes, prices, lots and shipping. It asks about the order, never about a body.
 * The plan itself is kept on this device by planner-store.
 */

export type PlanStep = "why" | "what" | "amount" | "when" | "storage" | "plan";
export type Plan = {
  id: string;
  /** The conversation card the plan is answered in; an earlier card gives way to a later one. */
  card?: string;
  step: PlanStep;
  why?: "new" | "restock" | "first";
  /** Compounds, by name, in the order they were chosen. */
  picks: string[];
  /** Per compound: milligrams for a compound sold by the milligram, else a count of vials. */
  amounts: Record<string, number>;
  when?: "soon" | "week" | "flexible";
  freezer?: "yes" | "later";
  /** Set once the whole plan has gone into the bag. */
  added?: boolean;
  updatedAt: number;
};

export const STEPS: PlanStep[] = ["why", "what", "amount", "when", "storage", "plan"];

/* ---------- The catalog, by compound ---------- */

export type Size = { id: string; size: string; mg: number | null; price: number | null; lot: string; image?: string };
export type Compound = { name: string; category: string; sizes: Size[]; /** Sold by the milligram: every size is a plain "N mg". */ byMg: boolean };

const milligrams = (size: string) => { const m = /^(\d+(?:\.\d+)?)\s*mg$/i.exec(size.trim()); return m ? Number(m[1]) : null; };

export function compoundsOf(products: Product[]): Compound[] {
  const out: Compound[] = [];
  for (const p of products) {
    if (p.active === false) continue;
    let c = out.find((x) => x.name === p.name);
    if (!c) { c = { name: p.name, category: p.category, sizes: [], byMg: true }; out.push(c); }
    c.sizes.push({ id: p.id, size: p.size, mg: milligrams(p.size), price: p.price ?? null, lot: p.lot, image: p.image });
  }
  for (const c of out) {
    c.byMg = c.sizes.every((s) => s.mg != null);
    c.sizes.sort((a, b) => (a.mg ?? 0) - (b.mg ?? 0));
  }
  return out;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** The slider's range for a compound: milligrams in steps every size can make, or one to ten vials. */
export function rangeOf(c: Compound) {
  if (!c.byMg) return { min: 1, max: 10, step: 1, unit: "vials" as const };
  const mgs = c.sizes.map((s) => s.mg!);
  const step = mgs.reduce((a, b) => gcd(a, b));
  return { min: mgs[0], max: Math.max(mgs[0] * 10, mgs[mgs.length - 1] * 4), step, unit: "mg" as const };
}
export const defaultAmount = (c: Compound) => rangeOf(c).min;
export const amountLabel = (c: Compound, amount: number) => (c.byMg ? `${amount} mg` : `${amount} ${amount === 1 ? "vial" : "vials"}`);

export type Fill = { lines: { size: Size; quantity: number }[]; vials: number; mg: number | null; cost: number | null; saves: number | null };

/**
 * The vials that make up an amount: the cheapest mix of sizes that reaches it (the nearest, in the fewest
 * vials, when prices are not open), and what that saves against buying the smallest size alone.
 */
export function fill(c: Compound, amount: number): Fill {
  if (!c.byMg) {
    const size = c.sizes[0];
    return { lines: [{ size, quantity: amount }], vials: amount, mg: null, cost: size.price == null ? null : round(size.price * amount), saves: null };
  }
  const { step } = rangeOf(c);
  const priced = c.sizes.every((s) => s.price != null);
  const units = c.sizes.map((s) => s.mg! / step);
  const target = Math.ceil(amount / step), limit = target + Math.max(...units);
  // Least cost (or fewest vials) for every exact total up to the target plus one largest vial.
  const best: ({ cost: number; vials: number; from: number; size: number } | null)[] = Array(limit + 1).fill(null);
  best[0] = { cost: 0, vials: 0, from: -1, size: -1 };
  for (let t = 1; t <= limit; t++) {
    for (let i = 0; i < units.length; i++) {
      const prev = t - units[i];
      if (prev < 0 || !best[prev]) continue;
      const cost = best[prev]!.cost + (priced ? c.sizes[i].price! : 1), vials = best[prev]!.vials + 1;
      const here = best[t];
      if (!here || cost < here.cost - 1e-9 || (Math.abs(cost - here.cost) < 1e-9 && vials < here.vials)) best[t] = { cost, vials, from: prev, size: i };
    }
  }
  // Priced: the least cost, then the least over the amount. Without prices: as near the amount as the
  // sizes allow, then the fewest vials.
  let pick = -1;
  for (let t = target; t <= limit; t++) {
    const b = best[t]; if (!b) continue;
    if (pick < 0) { pick = t; if (!priced) break; continue; }
    if (b.cost < best[pick]!.cost - 1e-9) pick = t;
  }
  const counts = new Map<number, number>();
  for (let t = pick; t > 0; t = best[t]!.from) counts.set(best[t]!.size, (counts.get(best[t]!.size) ?? 0) + 1);
  const lines = [...counts].sort((a, b) => b[0] - a[0]).map(([i, quantity]) => ({ size: c.sizes[i], quantity }));
  const cost = priced ? round(best[pick]!.cost) : null;
  const smallest = c.sizes[0];
  const alone = priced ? round(Math.ceil(amount / smallest.mg!) * smallest.price!) : null;
  return { lines, vials: best[pick]!.vials, mg: pick * step, cost, saves: cost != null && alone != null && alone - cost > 0.005 ? round(alone - cost) : null };
}
const round = (n: number) => Math.round(n * 100) / 100;

/** A past order as a plan: the same compounds and amounts, at today's sizes, prices and lots. */
export function planFromLines(lines: { id?: string; name: string; size: string; quantity: number }[], compounds: Compound[]): Pick<Plan, "picks" | "amounts"> {
  const picks: string[] = [], amounts: Record<string, number> = {};
  for (const line of lines) {
    const c = compounds.find((x) => x.name === line.name || x.sizes.some((s) => s.id === line.id));
    if (!c) continue;
    if (!picks.includes(c.name)) picks.push(c.name);
    const mg = milligrams(line.size);
    amounts[c.name] = (amounts[c.name] ?? 0) + (c.byMg && mg != null ? mg * line.quantity : line.quantity);
  }
  return { picks, amounts };
}

/** The shipping a plan suggests: the fastest method when it is needed soon, else the standard one, free over the threshold. */
export function shippingFor(when: Plan["when"], subtotal: number | null, methods: ShippingMethod[], settings: StorefrontSettings | null) {
  const open = methods.filter((m) => m.active !== false).sort((a, b) => a.price - b.price);
  if (!open.length) return null;
  const method = when === "soon" ? open[open.length - 1] : open[0];
  const threshold = settings?.freeShippingThreshold ?? null;
  const free = threshold != null && subtotal != null && subtotal >= threshold && method.id === settings?.freeShippingMethod;
  return { method, price: free ? 0 : method.price, threshold, remaining: threshold != null && subtotal != null ? Math.max(0, round(threshold - subtotal)) : null };
}
