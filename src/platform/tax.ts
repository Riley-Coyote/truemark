import type { Address, StorefrontSettings } from "./types";

export const US_STATES: readonly (readonly [string, string])[] = [["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"]];

const compact = (value: string) => value.replace(/\s/g, "").toLowerCase();
export function usRegionCode(region: string, country: string): string | null {
  if (!["us", "usa", "unitedstates", "unitedstatesofamerica"].includes(compact(country))) return null;
  return US_STATES.find(([code, name]) => [compact(code), compact(name)].includes(compact(region)))?.[0] ?? null;
}
export type TaxRate = { region: string; rate: number };
/** Positive integer cents and five-place rates match PostgreSQL numeric rounding. */
export function taxQuote(base: number, shipping: number, settings: StorefrontSettings, address?: Pick<Address, "region" | "country"> | null, rates: TaxRate[] = []) {
  if (settings.taxMode !== "rates" || !address) return { tax: 0, taxRate: null, taxRegion: null };
  const taxRegion = usRegionCode(address.region, address.country);
  const taxRate = rates.find((r) => r.region === taxRegion)?.rate ?? 0;
  const cents = BigInt(Math.round(base * 100)) + (settings.taxShipping ? BigInt(Math.round(shipping * 100)) : 0n);
  const tax = Number((cents * BigInt(Math.round(taxRate * 100000)) + 50000n) / 100000n) / 100;
  return { tax, taxRate, taxRegion };
}
