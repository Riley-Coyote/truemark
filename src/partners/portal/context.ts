import { createContext, useCallback, useContext } from "react";
import { useSearchParams } from "react-router-dom";
import type { Partner } from "../../platform/types";

/** The signed-in partner. Every portal page reads only this partner's records. */
export const PartnerContext = createContext<Partner | null>(null);

export function usePartner(): Partner {
  const partner = useContext(PartnerContext);
  if (!partner) throw new Error("usePartner must be used inside the partner portal");
  return partner;
}

/**
 * One URL search parameter as state (filters and open drawers), keeping the
 * others intact. Opening pushes history so Back closes a drawer.
 */
export function useQueryParam(name: string): [string | null, (value: string | null, options?: { replace?: boolean }) => void] {
  const [params, setParams] = useSearchParams();
  const set = useCallback(
    (value: string | null, options: { replace?: boolean } = {}) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value) next.set(name, value);
          else next.delete(name);
          return next;
        },
        { replace: options.replace ?? false, preventScrollReset: true },
      );
    },
    [name, setParams],
  );
  return [params.get(name), set];
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
