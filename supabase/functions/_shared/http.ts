// Shared by every Round 12 server function. Plain Web APIs only (Deno and Node 22),
// so the handlers stay testable without the Edge runtime.

export const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store",
};

export const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

/** A calm, user-presentable message. Never a stack, a provider payload or a credential. */
export const message = (status: number, text: string) => json(status, { message: text });

export const preflight = () => new Response(null, { status: 204, headers: cors });

/**
 * The route after the function's own name: `/functions/v1/payments/start` and
 * `/payments/start` both give `/start`. The bare function path gives `/`.
 */
export function route(req: Request, name: string): string {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  const marker = `/${name}`;
  const at = path.indexOf(marker);
  if (at < 0) return "/";
  const rest = path.slice(at + marker.length);
  return rest.startsWith("/") ? rest : "/";
}

/** The raw body as text, refused beyond `limit` bytes (webhooks verify the exact text). */
export async function text(req: Request, limit = 262_144): Promise<string> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > limit) throw new RangeError("Body too large");
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > limit) throw new RangeError("Body too large");
  return raw;
}

/** A JSON object body, or a RangeError/SyntaxError the caller turns into a 400. */
export async function body(req: Request, limit = 65_536): Promise<Record<string, unknown>> {
  const raw = await text(req, limit);
  const parsed: unknown = raw ? JSON.parse(raw) : {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new SyntaxError("Expected an object");
  return parsed as Record<string, unknown>;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
