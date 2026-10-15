import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandler, type Deps } from "../supabase/functions/uploads/server.ts";
import { sha256Hex } from "../supabase/functions/_shared/signing.ts";
import type { Db } from "../supabase/functions/_shared/db.ts";

globalThis.fetch = async () => { throw new Error("Unexpected network access"); };
const file = { name: " letter (signed).pdf ", type: "application/pdf", size: 10485760 };
const key = "fixture-functions-key-0000000000000000";
const ids = ["00000000-0000-4000-8000-000000000027", "00000000-0000-4000-8000-000000000028"];
function fixture(options: { quota?: boolean; storageFail?: boolean; rows?: { id: string; path: string }[] } = {}) {
  const calls: { name: string; args?: Record<string, unknown> }[] = [];
  const requests: { url: string; init?: RequestInit }[] = [];
  let counter = 0;
  const db: Db = {
    async select<T>(path: string) { calls.push({ name: path }); return (options.rows ?? []) as T[]; },
    async one<T>() { return null as T | null; },
    async rpc<T>(name: string, args?: Record<string, unknown>) { calls.push({ name, args }); return (name === "system_take_upload_quota" ? options.quota !== false : null) as T; },
  };
  const deps: Deps = { db, url: "https://storage.fixture.test", serviceKey: "fixture-service-key", functionsKey: key,
    now: () => Date.UTC(2026, 9, 5, 12), random: (length) => new Uint8Array(length).fill(27), uuid: () => `00000000-0000-4000-8000-${String(27 + counter++).padStart(12, "0")}`,
    fetch: async (input, init) => {
      requests.push({ url: String(input), init });
      return new Response(JSON.stringify({ url: "/object/upload/sign/application-files/fixture?token=fixture-upload-token" }), { status: options.storageFail ? 500 : 200 });
    },
  };
  const handler = createHandler(deps);
  const request = (payload: unknown = { files: [file] }, path = "/application", headers: Record<string, string> = {}) => handler(new Request(`https://functions.fixture.test/functions/v1/uploads${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.27, 192.0.2.28", ...headers }, body: JSON.stringify(payload),
  }));
  return { handler, request, calls, requests };
}

test("OPTIONS, methods, unknown routes and sweep key are checked locally", async () => {
  const f = fixture();
  const preflight = await f.handler(new Request("https://fixture.test/uploads/application", { method: "OPTIONS" }));
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get("Cache-Control"), "no-store");
  assert.equal((await f.handler(new Request("https://fixture.test/uploads/application"))).status, 405);
  assert.equal((await f.request({}, "/unknown")).status, 404);
  assert.equal((await f.request({}, "/sweep")).status, 401);
  assert.equal((await f.request({}, "/sweep", { "x-functions-key": "wrong" })).status, 401);
  assert.equal(f.calls.length, 0); assert.equal(f.requests.length, 0);
});

test("validation rejects malformed bodies, counts, names, sizes and types before quota/storage", async () => {
  const invalid = [null, [], {}, { files: [] }, { files: Array(6).fill(file) },
    ...[null, {}, { ...file, name: " " }, { ...file, name: 27 }, { ...file, type: "text/plain" },
      { ...file, size: 10485761 }, { ...file, size: -1 }, { ...file, size: 1.5 }, { ...file, size: "1" }].map((f) => ({ files: [f] }))];
  for (const payload of invalid) {
    const f = fixture(); assert.equal((await f.request(payload)).status, 400);
    assert.equal(f.calls.length, 0); assert.equal(f.requests.length, 0);
  }
  const f = fixture();
  assert.equal((await f.handler(new Request("https://fixture.test/uploads/application", { method: "POST", body: "{" }))).status, 400);
  assert.equal((await f.handler(new Request("https://fixture.test/uploads/application", { method: "POST", body: "x".repeat(65537) }))).status, 400);
});

test("quota hashes only the first forwarded address and refuses before creating rows or URLs", async () => {
  const f = fixture({ quota: false });
  const response = await f.request();
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { message: "Too many uploads just now. Please try again in an hour." });
  assert.deepEqual(f.calls, [{ name: "system_take_upload_quota", args: { subject_hash: await sha256Hex("192.0.2.27") } }]);
  assert.equal(f.requests.length, 0);
});

test("claim is 32 random bytes; rows are RPC-only and signed URL shape uses the service key", async () => {
  const f = fixture();
  const response = await f.request();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.claim, "1b".repeat(32));
  const path = `incoming/${ids[0]}/letter -signed-.pdf`;
  assert.deepEqual(result.files, [{ uploadId: ids[0], path, token: "fixture-upload-token" }]);
  assert.equal(f.calls[1].name, "system_create_application_uploads");
  assert.equal(f.calls[1].args?.claim_hash, await sha256Hex(result.claim));
  assert.deepEqual(f.calls[1].args?.files, [{ id: ids[0], path, name: "letter -signed-.pdf", type: "application/pdf", size: 10485760 }]);
  assert.equal(f.requests[0].url, `https://storage.fixture.test/storage/v1/object/upload/sign/application-files/incoming/${ids[0]}/letter%20-signed-.pdf`);
  assert.equal(f.requests[0].init?.method, "POST");
  assert.deepEqual(f.requests[0].init?.headers, { apikey: "fixture-service-key", Authorization: "Bearer fixture-service-key", "Content-Type": "application/json" });
  assert.deepEqual(JSON.parse(String(f.requests[0].init?.body)), {});
  assert(!JSON.stringify(result).includes("fixture-service-key"));
});

test("all allowed MIME types and five files are accepted; names are cleaned and capped", async () => {
  for (const type of ["application/pdf", "image/png", "image/jpeg", "image/webp"]) {
    const f = fixture(); assert.equal((await f.request({ files: [{ ...file, type, name: "é".repeat(130) }] })).status, 200);
    assert.equal((f.calls[1].args?.files as { name: string }[])[0].name, "-".repeat(120));
  }
  const f = fixture(); assert.equal((await f.request({ files: Array(5).fill(file) })).status, 200);
  assert.equal(f.requests.length, 5);
});

test("sweep selects whole rows older than 24h, deletes Storage before its row and retains rows on failure", async () => {
  const f = fixture({ rows: [{ id: ids[0], path: "incoming/fixture/letter.pdf" }] });
  const response = await f.request({}, "/sweep", { "x-functions-key": key });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { deleted: 1 });
  assert.match(f.calls[0].name, /^application_uploads\?select=\*&claimed_at=is.null&created_at=lt.2026-10-04T12/);
  assert.equal(f.requests[0].url, "https://storage.fixture.test/storage/v1/object/application-files");
  assert.equal(f.requests[0].init?.method, "DELETE");
  assert.deepEqual(JSON.parse(String(f.requests[0].init?.body)), { prefixes: ["incoming/fixture/letter.pdf"] });
  assert.deepEqual(f.calls[1], { name: "system_delete_application_upload", args: { upload_id: ids[0] } });
  const failure = fixture({ storageFail: true, rows: [{ id: ids[0], path: "incoming/fixture/letter.pdf" }] });
  assert.equal((await failure.request({}, "/sweep", { "x-functions-key": key })).status, 500);
  assert.equal(failure.calls.length, 1);
});

test("provider failures return no unspecified copy or internal details", async () => {
  const f = fixture({ storageFail: true });
  const response = await f.request(); assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {});
});
