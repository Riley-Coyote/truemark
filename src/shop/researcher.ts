import { useSyncExternalStore } from "react";
import { LAUNCH, storageKey } from "../platform/mode";

/*
 * The researcher confirmation a first visit asks for (ResearcherCheck.tsx): both statements, once, remembered on this
 * browser for a while. Without storage it is asked once per page load.
 */

/** How long a confirmation is remembered on this browser, in days. The client has not settled it yet; change it here. */
export const CONFIRMATION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const KEY = storageKey("tm-researcher-confirmed");

/**
 * Where it is not asked: the Command Center and the partner portal (signed-in workspaces), a lot lookup opened from a
 * vial's QR code, the email-link and sign-in callbacks, the two legal pages the confirmation links to (so they can be
 * read before agreeing), and the review's own pages. Anywhere else in the shop asks again, so none of these is a way
 * around it.
 */
const EXEMPT = /^\/(?:admin|partners\/app|verify|disclaimer|terms)(?:\/|$)|^\/access\/(?:confirm|reset|team)(?:\/|$)/;
/** The review's pages; launch has none, and names none of them. */
const REVIEW = LAUNCH ? null : /^\/(?:review|visual-study|type-study)(?:\/|$)/;
export const confirmationExempt = (path: string) => EXEMPT.test(path) || Boolean(REVIEW?.test(path));

/** Confirmed on this page load, whatever storage allows, and when (for what waits on it: the first-order offer). */
let confirmedNow = false;
let enteredAt = 0;
/** When this page load's confirmation was given (performance.now()), or 0 when it was already held. */
export const confirmedThisVisitAt = () => enteredAt;
const listeners = new Set<() => void>();

/** Whether a confirmation within the last CONFIRMATION_DAYS is held. */
export function researcherConfirmed(now = Date.now()): boolean {
  if (confirmedNow) return true;
  try {
    const at = Number(localStorage.getItem(KEY));
    // A time ahead of this clock is not trusted to extend the window.
    return Number.isFinite(at) && at > 0 && at <= now + DAY_MS && now - at < CONFIRMATION_DAYS * DAY_MS;
  } catch {
    return false;
  }
}

export function confirmResearcher(now = Date.now()) {
  confirmedNow = true;
  enteredAt = typeof performance !== "undefined" ? performance.now() : 0;
  try {
    localStorage.setItem(KEY, String(now));
  } catch {
    /* Remembered for this page load only; the next one asks again. */
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  // Confirmed in another tab: this one stops asking too.
  const stored = (event: StorageEvent) => { if (event.key === KEY) notify(); };
  window.addEventListener("storage", stored);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", stored);
  };
}

export const useResearcherConfirmed = () => useSyncExternalStore(subscribe, () => researcherConfirmed(), () => false);
