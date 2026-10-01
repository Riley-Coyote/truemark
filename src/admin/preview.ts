import { LIVE } from "../platform/mode";
/**
 * Changes the command center can make before the backend exists: product
 * prices, partner status, discount codes, payout batches and settings. The
 * store has no mutations for these yet, so they live in memory for this visit
 * only; every screen that makes one says so, and a reload restores the sample
 * data. Each field names the endpoint the backend needs to provide.
 */
import { useSyncExternalStore } from "react";
import type { Discount, PartnerStatus, ShippingMethodId } from "../platform/types";

export const PREVIEW_NOTE = LIVE ? "Saving arrives next" : "Preview: changes are not saved";

export type BatchLine = { partnerId: string; referralIds: string[]; amount: number };

export type PayoutBatch = {
  id: string;
  createdAt: string;
  scheduledFor: string;
  method: string;
  lines: BatchLine[];
  total: number;
};

export type Compliance = { attestation: boolean; certificates: boolean };

export type PreviewState = {
  /** PATCH /products/:id { price } */
  prices: Record<string, number>;
  /** POST /partners/:id/status { status }: approve, pause, resume */
  partnerStatus: Record<string, PartnerStatus>;
  /** PATCH /discounts/:code { active } */
  codeActive: Record<string, boolean>;
  /** POST /discounts */
  codes: Discount[];
  /** POST /payouts/batches { referralIds } */
  batches: PayoutBatch[];
  /** PATCH /settings/shipping/:method { price } */
  rates: Partial<Record<ShippingMethodId, number>>;
  /** PATCH /settings/compliance */
  compliance: Compliance;
};

let state: PreviewState = {
  prices: {},
  partnerStatus: {},
  codeActive: {},
  codes: [],
  batches: [],
  rates: {},
  compliance: { attestation: true, certificates: true },
};

const listeners = new Set<() => void>();

function update(change: (current: PreviewState) => Partial<PreviewState>) {
  state = { ...state, ...change(state) };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const without = <T,>(record: Record<string, T>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

/** The preview's changes, re-rendering whenever one is made. */
export function usePreview(): PreviewState {
  return useSyncExternalStore(subscribe, () => state);
}

export const preview = {
  setPrice: (productId: string, price: number) => update((s) => ({ prices: { ...s.prices, [productId]: price } })),
  restorePrice: (productId: string) => update((s) => ({ prices: without(s.prices, productId) })),
  setPartnerStatus: (partnerId: string, status: PartnerStatus) =>
    update((s) => ({ partnerStatus: { ...s.partnerStatus, [partnerId]: status } })),
  setCodeActive: (code: string, active: boolean) => update((s) => ({ codeActive: { ...s.codeActive, [code]: active } })),
  addCode: (discount: Discount) => update((s) => ({ codes: [discount, ...s.codes] })),
  addBatch: (batch: PayoutBatch) => update((s) => ({ batches: [batch, ...s.batches] })),
  setRates: (rates: Partial<Record<ShippingMethodId, number>>) => update((s) => ({ rates: { ...s.rates, ...rates } })),
  setCompliance: (key: keyof Compliance, value: boolean) =>
    update((s) => ({ compliance: { ...s.compliance, [key]: value } })),
};
