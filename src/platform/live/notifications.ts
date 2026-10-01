import { useEffect, useState } from "react";
import type { Audience, Notice } from "../preview/notifications";
import { live } from "./runtime";
import { STORE_CHANGE } from "./storage";
export const notices = {
  list: (audience: Audience) => live().notices.list(audience),
  add: (_notice: Omit<Notice, "id" | "read" | "at"> & { at?: string }): Notice => live().notices.add(),
  markRead: (audience: Audience, ids?: string[]) => {
    // Legacy callers are synchronous. Keep the notice unread if the RPC fails.
    void live().notices.markRead(audience, ids).catch((error: Error) => console.error("Could not mark notifications read:", error.message));
  },
};
export function useNotices(audience: Audience | null) {
  const [items, setItems] = useState<Notice[]>([]);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let mounted = true;
    let request = 0;
    setItems([]);
    const refresh = async () => {
      const own = ++request;
      try {
        const next = audience ? await live().notices.load(audience) : [];
        if (mounted && own === request) { setItems(next); setError(null); }
      } catch (failure) {
        if (mounted && own === request) { setItems([]); setError(failure instanceof Error ? failure : new Error(String(failure))); }
      }
    };
    void refresh();
    window.addEventListener(STORE_CHANGE, refresh);
    return () => { mounted = false; window.removeEventListener(STORE_CHANGE, refresh); };
  }, [audience]);
  const mark = (ids?: string[]) => {
    if (audience) void live().notices.markRead(audience, ids).catch((failure: Error) => setError(failure));
  };
  return { items, unread: items.filter((n) => !n.read).length, markAllRead: () => mark(), markRead: (id: string) => mark([id]), error };
}
