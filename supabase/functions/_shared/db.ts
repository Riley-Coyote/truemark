// The server functions reach the database through PostgREST with the service role
// the Edge runtime injects. They write only through `system_*` functions.

export class DbError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "DbError";
  }
}

export type Db = {
  /** A REST path under /rest/v1, e.g. `orders?id=eq.<id>&select=*`. */
  select<T>(path: string): Promise<T[]>;
  /** One row or null. */
  one<T>(path: string): Promise<T | null>;
  rpc<T>(name: string, args?: Record<string, unknown>): Promise<T>;
};

type Fetch = typeof fetch;

export function createDb(url: string, serviceKey: string, fetcher: Fetch = fetch, timeoutMs = 15_000): Db {
  if (!url || !serviceKey) throw new Error("Database configuration missing");
  const base = `${url.replace(/\/+$/, "")}/rest/v1/`;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  async function call<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetcher(base + path, { ...init, headers: { ...headers, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(timeoutMs) });
    const raw = await response.text();
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (!response.ok) {
      const detail = (data && typeof data === "object" ? data : {}) as { message?: string; code?: string };
      throw new DbError(detail.message ?? `Database request failed (${response.status})`, response.status, detail.code);
    }
    return data as T;
  }
  return {
    select: <T,>(path: string) => call<T[]>(path, { method: "GET" }),
    async one<T>(path: string) {
      const rows = await call<T[]>(path, { method: "GET" });
      return rows[0] ?? null;
    },
    rpc: <T,>(name: string, args: Record<string, unknown> = {}) => call<T>(`rpc/${name}`, { method: "POST", body: JSON.stringify(args) }),
  };
}

/** Database messages raised on purpose (`raise exception '...' using errcode = '22023'`) are safe to show. */
export function presentable(error: unknown, fallback: string): string {
  if (error instanceof DbError && (error.code === "22023" || error.code === "P0002") && error.message.length <= 200) return error.message;
  return fallback;
}
