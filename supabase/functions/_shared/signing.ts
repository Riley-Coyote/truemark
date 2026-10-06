// HMAC-SHA256 helpers for keys and signed webhooks, on WebCrypto (Deno and Node 22).

const encoder = new TextEncoder();

export async function hmacHex(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(text));
  return Array.from(new Uint8Array(signature), (v) => v.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two strings' UTF-8 bytes. */
export function safeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return difference === 0;
}

/** The functions' shared key, as the database's wake-up calls and scheduled sweeps send it. */
export function hasFunctionsKey(req: Request, expected: string): boolean {
  const given = req.headers.get("x-functions-key") ?? "";
  return Boolean(expected) && expected.length >= 32 && safeEqual(given, expected);
}

/** `t=<unix seconds>,v1=<hex>` over `<t>.<body>`, the shape the simulators send. */
export async function signedHeader(secret: string, body: string, now = Date.now()): Promise<string> {
  const t = Math.floor(now / 1000);
  return `t=${t},v1=${await hmacHex(secret, `${t}.${body}`)}`;
}

export async function verifySignedHeader(header: string | null, body: string, secret: string, now = Date.now(), toleranceSeconds = 300): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((part) => {
    const at = part.indexOf("=");
    return at < 0 ? ["", ""] : [part.slice(0, at).trim(), part.slice(at + 1).trim()];
  }));
  const t = Number(parts.t);
  if (!Number.isInteger(t) || !/^[0-9a-f]{64}$/.test(parts.v1 ?? "")) return false;
  if (Math.abs(Math.floor(now / 1000) - t) > toleranceSeconds) return false;
  return safeEqual(parts.v1, await hmacHex(secret, `${t}.${body}`));
}
