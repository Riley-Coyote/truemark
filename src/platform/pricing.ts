import { taxQuote } from "./tax";
import type { TaxRate } from "./tax";
import type { Address, ShippingMethod, StorefrontSettings } from "./types";

export const defaultSettings: StorefrontSettings = {
  freeShippingThreshold: 150,
  freeShippingMethod: "cold-2day",
  freeBacWaterThreshold: 75,
  insuranceMode: "off",
  insuranceRate: null,
  shippingRatesConfirmed: false,
  taxMode: "off",
  taxShipping: false,
};

export const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

/** Integer arithmetic matches PostgreSQL numeric at half-cent boundaries. */
function fractionOfMoney(amount: number, numerator: number, denominator: number) {
  const cents = BigInt(Math.round(amount * 100));
  const divisor = BigInt(denominator);
  return Number((cents * BigInt(numerator) + divisor / 2n) / divisor) / 100;
}

/** The same cents and after-discount threshold used by public.place_order. */
export function shippingPrice(base: number, method: ShippingMethod, settings: StorefrontSettings): number {
  return settings.freeShippingThreshold !== null && method.id === settings.freeShippingMethod &&
    roundMoney(base) >= settings.freeShippingThreshold ? 0 : method.price;
}

/** The free vial: one BAC Water 10 mL at $0.00 (supabase/migrations/20261019000200_free_bac_water.sql adds it to live orders). */
export const FREE_BAC_WATER_ID = "bacteriostatic-water-10-ml";

/** Whether merchandise after discounts earns the free BAC Water vial: the base and threshold free shipping uses. */
export function earnsFreeBacWater(base: number, settings: Pick<StorefrontSettings, "freeBacWaterThreshold">): boolean {
  const threshold = settings.freeBacWaterThreshold ?? null;
  return threshold !== null && roundMoney(base) >= threshold;
}

/** What an order line charges: its units at their price, less any it was given free. */
export const lineCharge = (line: { quantity: number; unitPrice: number; freeQuantity?: number }) =>
  roundMoney((line.quantity - (line.freeQuantity ?? 0)) * line.unitPrice);

/** A line's price as a buyer reads it: "$10.00 each", "$10.00 each · 1 free", or "Free". */
export function lineUnits(line: { quantity: number; unitPrice: number; freeQuantity?: number }, money: (amount: number) => string) {
  const free = line.freeQuantity ?? 0;
  return free >= line.quantity ? "Free" : `${money(line.unitPrice)} each${free ? ` · ${free} free` : ""}`;
}

/** Live quotes are estimates; the RPC always re-prices from database rows. */
export function insurancePrice(base: number, settings: StorefrontSettings, optedIn = false): number {
  return settings.insuranceMode === "automatic" || (settings.insuranceMode === "optional" && optedIn)
    ? fractionOfMoney(base, Math.round((settings.insuranceRate ?? 0) * 100000), 100000) : 0;
}

export function priceQuote(subtotal: number, percent: number, method: ShippingMethod | null, settings: StorefrontSettings, optedIn = false, address?: Address | null, rates: TaxRate[] = [], benefitAmount?: number) {
  const discountAmount = benefitAmount ?? fractionOfMoney(subtotal, Math.round(percent * 100), 10000);
  const base = roundMoney(subtotal - discountAmount);
  const shipping = method ? shippingPrice(base, method, settings) : 0;
  const insuranceApplied = settings.insuranceMode === "automatic" || (settings.insuranceMode === "optional" && optedIn);
  const insurance = insurancePrice(base, settings, optedIn);
  const tax = taxQuote(base, shipping, settings, address, rates);
  const includedTax: Partial<ReturnType<typeof taxQuote>> = address ? tax : {};
  return { subtotal, discountAmount, base, shipping, insurance, insuranceApplied, ...includedTax, total: roundMoney(base + shipping + insurance + tax.tax) };
}
