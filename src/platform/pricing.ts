import type { ShippingMethod, StorefrontSettings } from "./types";

export const defaultSettings: StorefrontSettings = {
  freeShippingThreshold: 150,
  freeShippingMethod: "cold-2day",
  insuranceMode: "off",
  insuranceRate: null,
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

/** Live quotes are estimates; the RPC always re-prices from database rows. */
export function insurancePrice(base: number, settings: StorefrontSettings, optedIn = false): number {
  return settings.insuranceMode === "automatic" || (settings.insuranceMode === "optional" && optedIn)
    ? fractionOfMoney(base, Math.round((settings.insuranceRate ?? 0) * 100000), 100000) : 0;
}

export function priceQuote(subtotal: number, percent: number, method: ShippingMethod | null, settings: StorefrontSettings, optedIn = false) {
  const discountAmount = fractionOfMoney(subtotal, Math.round(percent * 100), 10000);
  const base = roundMoney(subtotal - discountAmount);
  const shipping = method ? shippingPrice(base, method, settings) : 0;
  const insuranceApplied = settings.insuranceMode === "automatic" || (settings.insuranceMode === "optional" && optedIn);
  const insurance = insurancePrice(base, settings, optedIn);
  return { subtotal, discountAmount, base, shipping, insurance, insuranceApplied, total: roundMoney(base + shipping + insurance) };
}
