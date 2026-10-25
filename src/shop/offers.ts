import { LIVE } from "../platform/mode";
import { store, useResource } from "../platform/store";
import { firstOrderOffer } from "./catalog";

/**
 * The offers every visitor gets, for the homepage to state: free shipping from the shop's threshold and the first-order
 * code's discount. Read where the bag and the first-order offer read them (ShippingProgress.tsx, FirstOrderOffer.tsx),
 * so the homepage never promises a figure the bag won't honour. Either is null while it isn't on offer.
 */
export function useStoreOffers() {
  return useResource(async () => {
    const [settings, first] = await Promise.all([
      store.settings.get(),
      LIVE ? store.catalog.validateCode(firstOrderOffer.code) : Promise.resolve(firstOrderOffer),
    ]);
    return {
      freeShipping: settings.freeShippingThreshold,
      firstOrderPercent: first?.active ? first.percent : null,
    };
  });
}

/** Whole dollars as "$200", anything else to the cent. */
export const offerAmount = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
