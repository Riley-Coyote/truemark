import { LIVE } from "../platform/mode";
import { worldNow } from "../platform/storage";
import { getClient } from "../platform/live/client";
import { storedKey, keyFromSearch } from "../review/key";
import { recordFromLot } from "../shop/records";
import { disclosure, partnerLink, doRules, dontRules, disclosurePlacement } from "../partners/program";
import { readPrefs } from "../partners/prefs";
import { milestones } from "../partners/momentum";
import { shippingCopy, siteAnswers } from "./copy";
import { store } from "./store";
import { createToolRuntime, type Scope } from "./runtime";
import { createTransport } from "./client";
import { OFFLINE, type Persona } from "./protocol";

const endpoint = import.meta.env.VITE_REVIEW_SUPABASE_URL ? `${import.meta.env.VITE_REVIEW_SUPABASE_URL}/functions/v1/assistant` : "";
export function reviewKey() {
  const hash = window.location.hash.split("?")[1] ?? "";
  return keyFromSearch(hash) ?? keyFromSearch(window.location.search) ?? storedKey();
}
async function headers() {
  const key = import.meta.env.VITE_REVIEW_SUPABASE_ANON_KEY;
  if (!key) throw new Error(OFFLINE);
  const token = LIVE ? (await getClient().auth.getSession()).data.session?.access_token : undefined;
  return { "Content-Type": "application/json", apikey: key, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
export async function previewGate(persona: Persona, signal?: AbortSignal) {
  if (LIVE) return true;
  const key = reviewKey(); if (!key || !endpoint) return false;
  try {
    const response = await fetch(endpoint, { method: "POST", headers: await headers(), body: JSON.stringify({ action: "gate", mode: "preview", persona, reviewKey: key }), signal });
    return (response.ok || response.status === 503) && (await response.json()).allowed === true;
  } catch { return false; }
}
export async function currentScope(previewPersona: Persona): Promise<Scope> {
  if (!LIVE) {
    const person = previewPersona === "partner" ? await store.partners.me() : previewPersona === "visitor" ? await store.session.get() : null;
    return { persona: previewPersona, role: previewPersona === "visitor" ? person ? "buyer" : "anonymous" : previewPersona, id: person?.id ?? `preview-${previewPersona}`, sample: true };
  }
  const profile = await store.assistant.identity();
  const persona = profile?.role === "owner" || profile?.role === "staff" ? "owner" : profile?.role === "partner" && await store.partners.me() ? "partner" : "visitor";
  return { persona, role: profile?.role ?? "anonymous", id: profile?.id ?? "anonymous", sample: false };
}
export function browserAssistant(persona: Persona, authorizedKey: string | null, addToBag?: (id: string, quantity: number) => void) {
  return {
    transport: createTransport({ endpoint, headers, context: () => ({ mode: LIVE ? "live" : "preview", ...(!LIVE ? { persona, reviewKey: reviewKey() } : {}) }) }),
    prepare: createToolRuntime({ store, now: worldNow, scope: async () => {
      if (!LIVE && (!authorizedKey || reviewKey() !== authorizedKey)) throw new Error("Open a valid review link to continue.");
      return currentScope(persona);
    }, addToBag, verify: (lot) => lot ? recordFromLot(lot) : null, siteAnswers, shippingCopy,
    program: { disclosure, link: partnerLink, rules: { do: doRules, dont: dontRules, disclosurePlacement } },
    goal: (id) => readPrefs(id).goal, milestones: (refs) => { const result = milestones(refs); return { next: result.next, reached: result.reached, orders: result.orders, earned: result.earned }; },
    async qr(url) {
      // @ts-expect-error qrcode's JavaScript API is typed at the boundary, like ShareKit.
      const module = await import("qrcode");
      const qr = module.default as { toDataURL: (url: string, options: { width: number; margin: number }) => Promise<string> };
      return qr.toDataURL(url, { width: 240, margin: 2 });
    },
    }),
  };
}

/** Owner management calls use the same authenticated function boundary as chat. */
export async function assistantSettingsRequest<T>(action: "settings" | "test", persona?: Persona, signal?: AbortSignal): Promise<T> {
  if (!LIVE || !endpoint) throw new Error(OFFLINE);
  const response = await fetch(endpoint, { method: "POST", headers: await headers(), signal,
    body: JSON.stringify({ mode: "live", action, ...(persona ? { persona } : {}) }) });
  const data = await response.json();
  const offlineSettings = action === "settings" && response.status === 503 && data.provider === "Not connected" && data.models && data.spend;
  if (!response.ok && !offlineSettings) throw new Error(typeof data.message === "string" ? data.message : OFFLINE);
  return data as T;
}
