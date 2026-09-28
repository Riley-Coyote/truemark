import { createContext, useContext } from "react";
import { products } from "../data";

export type CartItem = { id: string; quantity: number };

export type ShopContextValue = {
  cart: CartItem[];
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

export const CART_STORAGE_KEY = "truemark-preview-cart";

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
        products.some((p) => p.id === item.id && p.price !== undefined) &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 99,
    );
  } catch {
    return [];
  }
}

/** A partner code carried in on a link (?ref=CODE); checkout offers it as the code. */
export const REFERRAL_KEY = "tm-preview-ref";

export function rememberReferral(code: string) {
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
