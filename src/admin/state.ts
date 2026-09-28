import { createContext, useCallback, useContext } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * The top bar's search query. It lives in memory, not in the URL, because it
 * often holds a person's or an institution's name.
 */
export const SearchQuery = createContext("");
export const useSearchQuery = () => useContext(SearchQuery);

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

/** Case- and accent-insensitive "contains" across several fields. */
export function matches(query: string, ...fields: (string | undefined)[]): boolean {
  const q = normalise(query);
  if (!q) return true;
  return fields.some((field) => field && normalise(field).includes(q));
}

const normalise = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
