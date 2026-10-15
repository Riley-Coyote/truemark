/**
 * WP-28: release the client's certificates in a TrueMark database. Re-runnable.
 *
 *   TM_IMPORT_EMAIL=… TM_IMPORT_PASSWORD=… TM_SUPABASE_ANON_KEY=… npx tsx scripts/import-certificates.ts [--url <api>] [--hosted]
 *
 * Signs in as an owner (or staff), uploads each certificate's PDF, unmodified, to certificates/<lot>.pdf
 * and releases the lot through release_lot with the manifest's results (src/platform/certificate-manifest.json).
 * A lot already released with the same certificate is skipped. One line per lot; nothing secret is printed.
 * It targets the local stack (http://127.0.0.1:54321) and refuses any other address without --hosted.
 */
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { certificates, pendingCertificates, resultsFor } from "../src/platform/certificate-records.ts";

const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined; };
const url = (option("--url") ?? process.env.TM_SUPABASE_URL ?? "http://127.0.0.1:54321").replace(/\/+$/, "");
const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
if (!local && !args.includes("--hosted")) {
  console.error(`Refusing ${url}: this script releases lots in the local stack only. Pass --hosted to target another database.`);
  process.exit(2);
}
const key = process.env.TM_SUPABASE_ANON_KEY ?? process.env.VITE_REVIEW_SUPABASE_ANON_KEY;
const email = process.env.TM_IMPORT_EMAIL, password = process.env.TM_IMPORT_PASSWORD;
if (!key || !email || !password) {
  console.error("Set TM_SUPABASE_ANON_KEY (the project's publishable key), TM_IMPORT_EMAIL and TM_IMPORT_PASSWORD (an owner or staff account).");
  process.exit(2);
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await client.auth.signInWithPassword({ email, password });
if (signedIn.error) {
  console.error(`Sign-in failed: ${signedIn.error.message}`);
  process.exit(1);
}
console.log(`Importing ${certificates.length} certificates into ${url}`);

const tally = { released: 0, skipped: 0, failed: 0 };
for (const entry of certificates) {
  const { data: rows, error: readError } = await client.from("lots").select("lot,status,reference").eq("lot", entry.lot);
  if (readError || !rows?.length) {
    tally.failed++; console.log(`${entry.lot}  failed: ${readError?.message ?? "no such lot (team access required)"}`); continue;
  }
  const lot = rows[0] as { status: string; reference: string | null };
  if (lot.status === "released" && lot.reference === entry.certificate) {
    tally.skipped++; console.log(`${entry.lot}  already released with ${entry.certificate}; skipped`); continue;
  }
  if (!["quarantine", "testing"].includes(lot.status)) {
    tally.skipped++; console.log(`${entry.lot}  is ${lot.status}${lot.reference ? ` with ${lot.reference}` : ""}; left as it is`); continue;
  }
  const pdf = await readFile(new URL(`../docs/client-documents/certificates/${entry.pdf}`, import.meta.url));
  const upload = await client.storage.from("certificates").upload(`${entry.lot}.pdf`, pdf, { upsert: true, contentType: "application/pdf", cacheControl: "60" });
  if (upload.error) {
    tally.failed++; console.log(`${entry.lot}  failed to upload ${entry.pdf}: ${upload.error.message}`); continue;
  }
  const results = resultsFor(entry);
  const { error } = await client.rpc("release_lot", { lot: entry.lot, results, reference: entry.certificate, tested_at: entry.analyzed, coa_path: `${entry.lot}.pdf` });
  if (error) {
    tally.failed++; console.log(`${entry.lot}  failed to release: ${error.message}`); continue;
  }
  tally.released++; console.log(`${entry.lot}  released with ${entry.certificate} (${results.length} results, PDF ${pdf.length} bytes)`);
}
for (const pending of pendingCertificates) console.log(`${pending.lot}  pending, not touched: ${pending.reason}`);
await client.auth.signOut();
console.log(`Done: ${tally.released} released, ${tally.skipped} skipped, ${tally.failed} failed.`);
process.exit(tally.failed ? 1 : 0);
