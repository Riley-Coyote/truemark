import type { Db } from "./db.ts";
import { isUuid } from "./http.ts";

export type Role = "owner" | "staff" | "buyer" | "partner";
export type Caller = { id: string; email: string; role: Role };

/**
 * Who is calling, from their own Supabase session token. The role comes from the
 * SQL-managed profile, never from token metadata. Null when signed out or invalid.
 */
export async function identify(req: Request, url: string, serviceKey: string, db: Db, fetcher: typeof fetch = fetch): Promise<Caller | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token === serviceKey) return null;
  const response = await fetcher(`${url.replace(/\/+$/, "")}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const user = await response.json() as { id?: unknown; email?: unknown };
  if (!isUuid(user.id)) return null;
  const profile = await db.one<{ role: Role }>(`profiles?id=eq.${user.id}&select=role&limit=1`);
  if (!profile) return null;
  return { id: user.id, email: typeof user.email === "string" ? user.email : "", role: profile.role };
}

export const isTeam = (caller: Caller | null): caller is Caller => caller?.role === "owner" || caller?.role === "staff";
