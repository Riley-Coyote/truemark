import type { Db } from "../_shared/db.ts";
import { body, json, message, preflight, route } from "../_shared/http.ts";
import { hasFunctionsKey, sha256Hex } from "../_shared/signing.ts";

const TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
export type Deps = { db: Db; url: string; serviceKey: string; functionsKey: string;
  fetch: typeof fetch; now: () => number; random: (length: number) => Uint8Array; uuid: () => string };
export function createHandler(deps: Deps) {
  const headers = { apikey: deps.serviceKey, Authorization: `Bearer ${deps.serviceKey}`, "Content-Type": "application/json" };
  const storage = `${deps.url.replace(/\/+$/, "")}/storage/v1`;
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return preflight();
    if (req.method !== "POST") return json(405, {});
    const path = route(req, "uploads");
    if (path !== "/application" && path !== "/sweep") return json(404, {});
    if (path === "/sweep" && !hasFunctionsKey(req, deps.functionsKey)) return json(401, {});
    try {
      if (path === "/sweep") {
        const cutoff = new Date(deps.now() - 24 * 60 * 60 * 1000).toISOString();
        let deleted = 0;
        for (;;) {
          const rows = await deps.db.select<{ id: string; path: string }>(`application_uploads?select=*&claimed_at=is.null&created_at=lt.${encodeURIComponent(cutoff)}&order=created_at.asc,id.asc&limit=1000`);
          for (const row of rows) {
            const response = await deps.fetch(`${storage}/object/application-files`, {
              method: "DELETE", headers, body: JSON.stringify({ prefixes: [row.path] }), signal: AbortSignal.timeout(15_000),
            });
            if (!response.ok) throw new Error("Storage delete failed");
            await deps.db.rpc("system_delete_application_upload", { upload_id: row.id });
            deleted++;
          }
          if (rows.length < 1000) break;
        }
        return json(200, { deleted });
      }
      let data: Record<string, unknown>;
      try { data = await body(req); } catch { return json(400, {}); }
      if (!Array.isArray(data.files) || data.files.length < 1 || data.files.length > 5) return json(400, {});
      const files: { id: string; name: string; type: string; size: number; path: string }[] = [];
      for (const raw of data.files) {
        if (!raw || typeof raw !== "object" || typeof raw.name !== "string" || !raw.name.trim() ||
          typeof raw.type !== "string" || !TYPES.has(raw.type) || !Number.isInteger(raw.size) || raw.size < 0 || raw.size > 10485760) {
          return json(400, {});
        }
        const name = raw.name.trim().slice(0, 120).replace(/[^A-Za-z0-9 ._-]/g, "-");
        const id = deps.uuid();
        files.push({ id, name, type: raw.type, size: raw.size, path: `incoming/${id}/${name}` });
      }
      const subject = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
      if (!await deps.db.rpc<boolean>("system_take_upload_quota", { subject_hash: await sha256Hex(subject) })) {
        return message(429, "Too many uploads just now. Please try again in an hour.");
      }
      const claim = Array.from(deps.random(32), (v) => v.toString(16).padStart(2, "0")).join("");
      await deps.db.rpc("system_create_application_uploads", { files, claim_hash: await sha256Hex(claim) });
      const signed = [];
      for (const file of files) {
        const response = await deps.fetch(`${storage}/object/upload/sign/application-files/${file.path.split("/").map(encodeURIComponent).join("/")}`, {
          method: "POST", headers, body: JSON.stringify({}), signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error("Storage signing failed");
        const result = await response.json() as { url?: string };
        const token = typeof result.url === "string" ? new URL(result.url, storage + "/").searchParams.get("token") : null;
        if (!token) throw new Error("Storage token missing");
        signed.push({ uploadId: file.id, path: file.path, token });
      }
      return json(200, { claim, files: signed });
    } catch { return json(500, {}); }
  };
}
