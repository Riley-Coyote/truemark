import { useSyncExternalStore } from "react";
import { storageKey } from "../platform/mode";
import type { Plan } from "./planner";

/* The one order plan kept on this device, so it waits through a sign-in or a return visit. */

const KEY = storageKey("tm-desk-plan");
const WEEK = 7 * 24 * 60 * 60 * 1000;
let current: Plan | null | undefined;
const listeners = new Set<() => void>();

function read(): Plan | null {
  if (current !== undefined) return current;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Plan | null;
    current = saved && Date.now() - saved.updatedAt < WEEK && Array.isArray(saved.picks) ? saved : null;
  } catch { current = null; }
  return current;
}
function write(plan: Plan | null) {
  current = plan;
  try { if (plan) localStorage.setItem(KEY, JSON.stringify(plan)); else localStorage.removeItem(KEY); } catch { /* The plan still lives for this visit. */ }
  listeners.forEach((notify) => notify());
}
export const savedPlan = () => read();
/** A plan worth returning to: one that got past its first question and has not gone into the bag. */
export const planInProgress = () => { const plan = read(); return plan && !plan.added && plan.picks.length > 0 ? plan : null; };
export function startPlan(seed: Partial<Plan> = {}): Plan {
  const plan: Plan = { id: crypto.randomUUID(), step: "why", picks: [], amounts: {}, ...seed, updatedAt: Date.now() };
  write(plan);
  return plan;
}
export function updatePlan(change: (plan: Plan) => Partial<Plan>) {
  const plan = read();
  if (plan) write({ ...plan, ...change(plan), updatedAt: Date.now() });
}
export function usePlan() {
  return useSyncExternalStore((notify) => { listeners.add(notify); return () => { listeners.delete(notify); }; }, read, () => null);
}
