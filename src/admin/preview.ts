import { LIVE } from "../platform/mode";
/**
 * The preview's temporary edits: prices, partner status, codes, batches and
 * rates. Live controls use their checked RPCs; only the preview reads these
 * overrides. Reloading restores the sample data.
 */
import { useSyncExternalStore } from "react";
import type { Discount, PartnerStatus, ShippingMethodId } from "../platform/types";

export const PREVIEW_NOTE = LIVE ? "" : "Preview: changes are not saved";

export type BatchLine = { partnerId: string; referralIds: string[]; amount: number };

export type PayoutBatch = {
  id: string;
  createdAt: string;
  scheduledFor: string;
  method: string;
  lines: BatchLine[];
  total: number;
};

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
};

let state: PreviewState = {
  prices: {},
  partnerStatus: {},
  codeActive: {},
  codes: [],
  batches: [],
  rates: {},
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
};
