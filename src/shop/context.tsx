import { LIVE, storageKey } from "../platform/mode";
import { rememberLink } from "../platform/live/bootstrap";
import { createContext, useContext } from "react";

export type CartItem = { id: string; quantity: number };

export type ShopContextValue = {
  cart: CartItem[];
  catalogChecking?: boolean;
  catalogError?: string | null;
  reloadCatalog?: () => void;
  add: (id: string, quantity: number) => void;
  change: (id: string, quantity: number) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
};

export const ShopContext = createContext<ShopContextValue | null>(null);

export function useShop(): ShopContextValue {
  const value = useContext(ShopContext);
  if (!value) throw new Error("useShop must be used inside ShopContext");
  return value;
}

export const CART_STORAGE_KEY = storageKey("truemark-preview-cart");

export function loadCart(): CartItem[] {
  try {
    const raw: unknown = JSON.parse(
      localStorage.getItem(CART_STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is CartItem =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" && /^[a-z0-9-]+$/.test(item.id) &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 99,
    );
  } catch {
    return [];
  }
}

/** A partner code carried in on a link (?ref=CODE); checkout offers it as the code. */
export const REFERRAL_KEY = storageKey("tm-preview-ref");

export function rememberReferral(code: string) {
  if (LIVE) {
    void rememberLink(code).catch(() => { /* A visit must not prevent browsing. */ });
    return;
  }
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);
  if (!clean) return;
  try {
    localStorage.setItem(REFERRAL_KEY, clean);
  } catch {
    /* Without storage the buyer can still type the code. */
  }
}

export function readReferral(): string | null {
  try {
    return localStorage.getItem(REFERRAL_KEY);
  } catch {
    return null;
  }
}
