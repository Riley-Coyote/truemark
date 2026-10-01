import { useCallback, useEffect, useState } from "react";
import { LIVE } from "./mode";
import * as preview from "./preview/store";
import * as live from "./live/store";
import { STORE_CHANGE } from "./storage";
export const store = LIVE ? live.store : preview.store;
export const quote = LIVE ? live.quote : preview.quote;

export type Resource<T> = { data: T | undefined; loading: boolean; error: Error | null; reload: () => void };

/**
 * Load async data for a screen and re-load when the preview store changes.
 * `deps` works like an effect's dependency list.
 */
export function useResource<T>(load: () => Promise<T>, deps: unknown[] = []): Resource<T> {
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: Error | null }>({
    data: undefined,
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    load().then(
      (data) => live && setState({ data, loading: false, error: null }),
      (error: unknown) => live && setState({ data: undefined, loading: false, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      live = false;
    };
  }, [...deps, tick]);
  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener(STORE_CHANGE, onChange);
    return () => window.removeEventListener(STORE_CHANGE, onChange);
  }, [reload]);
  return { ...state, reload };
}

