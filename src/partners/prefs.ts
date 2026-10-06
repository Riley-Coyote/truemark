/**
 * A partner's own preferences in the preview: a monthly goal, which alerts
 * arrive by which channel, and a mobile number for text messages. They are
 * kept in this browser only, per partner, and every open view follows a
 * change (here through the store's change event, in other tabs through
 * storage). The backend keeps them at launch.
 */
import { useCallback, useEffect, useState } from "react";
import { LIVE } from "../platform/mode";
import { live } from "../platform/live/runtime";
import { STORE_CHANGE, read, write } from "../platform/storage";

export const DEFAULT_GOAL = 250;
export const MAX_GOAL = 100_000;

export type AlertEvent = "newOrder" | "approved" | "payout" | "milestone" | "weekly";
export type AlertChannel = "email" | "text" | "dashboard";
export type AlertMatrix = Record<AlertEvent, Record<AlertChannel, boolean>>;

export const alertEvents: { id: AlertEvent; label: string; hint: string }[] = [
  { id: "newOrder", label: "New order", hint: "An order is placed with your code or through your link." },
  { id: "approved", label: "Commission approved", hint: "A referral’s commission is confirmed for the next payout." },
  { id: "payout", label: "Payout sent", hint: "With its statement." },
  { id: "milestone", label: "Milestone reached", hint: "Your first order, 10 orders, $500 earned, and on." },
  { id: "weekly", label: "Weekly summary", hint: "Clicks, orders and earnings for the week." },
];

export const alertChannels: { id: AlertChannel; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "text", label: "Text message" },
  { id: "dashboard", label: "Dashboard" },
];

export type PartnerPrefs = {
  goal: number;
  alerts: AlertMatrix;
  /** A US mobile number as "(415) 555-0132", or null until the partner adds one. */
  phone: string | null;
};

const on = (email: boolean, text: boolean, dashboard: boolean) => ({ email, text, dashboard });

export const DEFAULT_PREFS: PartnerPrefs = {
  goal: DEFAULT_GOAL,
  alerts: {
    newOrder: on(true, false, true),
    approved: on(true, false, true),
    payout: on(true, false, true),
    milestone: on(true, false, true),
    weekly: on(true, false, false),
  },
  phone: null,
};

const keyFor = (partnerId: string) => `${LIVE ? "tm-live" : "tm-preview"}-partner-prefs-${partnerId}`;

/** Stored preferences over the defaults, so a missing or older record never breaks a screen. */
export function readPrefs(partnerId: string): PartnerPrefs {
  const stored = read<Partial<PartnerPrefs> | null>(keyFor(partnerId), null) ?? {};
  const alerts = { ...DEFAULT_PREFS.alerts };
  for (const event of alertEvents) {
    alerts[event.id] = { ...DEFAULT_PREFS.alerts[event.id], ...stored.alerts?.[event.id] };
  }
  const goal = typeof stored.goal === "number" && stored.goal >= 1 && stored.goal <= MAX_GOAL ? stored.goal : DEFAULT_GOAL;
  const phone = typeof stored.phone === "string" ? normalizePhone(stored.phone) : null;
  return { goal, alerts, phone };
}

export function savePrefs(partnerId: string, patch: Partial<PartnerPrefs>) {
  write(keyFor(partnerId), { ...readPrefs(partnerId), ...patch });
}

/** One partner's preferences, kept current as they change in this tab or another. */
export function usePartnerPrefs(partnerId: string): [PartnerPrefs, (patch: Partial<PartnerPrefs>) => void] {
  const [prefs, setPrefs] = useState(() => readPrefs(partnerId));
  useEffect(() => {
    setPrefs(readPrefs(partnerId));
    let active = true;
    const loadLive = () => {
      if (!LIVE) return;
      void live().messages.preferences().then(p => { if (active) setPrefs(current => ({...current,phone:p.phone,
        alerts:Object.fromEntries(alertEvents.map(e=>[e.id,{...DEFAULT_PREFS.alerts[e.id],...p.alerts[e.id],dashboard:true}])) as AlertMatrix})); }).catch(() => {});
    };
    loadLive();
    const refresh = (event: Event) => {
      if (LIVE) { setPrefs(current => ({...current,goal:readPrefs(partnerId).goal})); loadLive(); return; }
      const key = (event as CustomEvent<string | null>).detail;
      if (key === null || key === undefined || key === keyFor(partnerId)) setPrefs(readPrefs(partnerId));
    };
    window.addEventListener(STORE_CHANGE, refresh);
    return () => { active = false; window.removeEventListener(STORE_CHANGE, refresh); };
  }, [partnerId]);
  const update = useCallback((patch: Partial<PartnerPrefs>) => savePrefs(partnerId, patch), [partnerId]);
  return [prefs, update];
}

/**
 * A US mobile number, formatted "(415) 555-0132", or null when the input is not one:
 * ten digits (a leading 1 or +1 is allowed) whose area code and exchange do not start with 0 or 1.
 */
export function normalizePhone(input: string): string | null {
  if (/[a-z]/i.test(input)) return null;
  const digits = input.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(ten)) return null;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

/** A goal typed as "$250", "250" or "1,000.50": at least $1 and at most the maximum, or null. */
export function parseGoal(input: string): number | null {
  const clean = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const value = Number(clean);
  return value >= 1 && value <= MAX_GOAL ? Math.round(value * 100) / 100 : null;
}
