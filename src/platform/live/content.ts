import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArticleInput, JournalArticle, LotRelease } from "../types";
import { lot as mapLot, type Row } from "./rows";

type Rows = (table: string, select?: string, filters?: Record<string, string>) => Promise<Row[]>;
type RPC = <T>(name: string, args?: Record<string, unknown>) => Promise<T>;
export const uploadRules = {
  certificates: { types: ["application/pdf"], bytes: 10 * 1024 * 1024 },
  journal: { types: ["image/jpeg", "image/png", "image/webp"], bytes: 5 * 1024 * 1024 },
};
export function validateUpload(bucket: keyof typeof uploadRules, file: File) {
  const rule = uploadRules[bucket];
  if (!rule.types.includes(file.type) || file.size === 0 || file.size > rule.bytes)
    throw new Error(bucket === "certificates" ? "Choose a PDF up to 10 MB." : "Choose a JPG, PNG or WebP up to 5 MB.");
}
export function createContentAdapter(client: SupabaseClient, rows: Rows, rpc: RPC, changed: () => void) {
  const publicUrl = (bucket: string, path: string) => client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const lot = (row: Row) => {
    const value = mapLot(row);
    if (value.status === "released" && value.coaPath) value.coaUrl = publicUrl("certificates", value.coaPath);
    return value;
  };
  function article(row: Row): JournalArticle {
    return { id: String(row.id), slug: String(row.slug), title: String(row.title), kicker: String(row.kicker),
      excerpt: String(row.excerpt), bodyMd: String(row.body_md), coverPath: row.cover_path ? String(row.cover_path) : undefined,
      coverImage: row.cover_image ? String(row.cover_image) : undefined,
      coverUrl: row.cover_path ? publicUrl("journal", String(row.cover_path)) : undefined,
      readingMinutes: Number(row.reading_minutes), status: row.status as JournalArticle["status"],
      publishedAt: row.published_at ? String(row.published_at) : undefined, updatedAt: String(row.updated_at), author: String(row.author) };
  }
  async function upload(bucket: keyof typeof uploadRules, path: string, file: File) {
    validateUpload(bucket, file);
    const { error } = await client.storage.from(bucket).upload(path, file, { upsert: bucket === "certificates", contentType: file.type, cacheControl: "60" });
    if (error) throw new Error(error.message);
    return path;
  }
  async function certificatePath(id: string, file: File) {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("This lot number cannot be used as a certificate filename.");
    return upload("certificates", `${id}.pdf`, file);
  }
  return {
    library: async () => (await rows("lots", "*", { status: "released" })).map(lot)
      .sort((a, b) => (b.releasedAt ?? "").localeCompare(a.releasedAt ?? "") || a.lot.localeCompare(b.lot)),
    lot: async (id: string) => { const found = await rows("lots", "*", { lot: id }); return found[0] ? lot(found[0]) : null; },
    async releaseLot(id: string, input: LotRelease, file: File) {
      const path = await certificatePath(id, file);
      const result = lot(await rpc<Row>("release_lot", { lot: id, results: input.results, reference: input.reference, tested_at: input.testedAt, coa_path: path }));
      changed(); return result;
    },
    async replaceCertificate(id: string, file: File) {
      const path = await certificatePath(id, file);
      const result = lot(await rpc<Row>("set_lot_certificate", { lot: id, coa_path: path }));
      changed(); return result;
    },
    async rejectLot(id: string, note: string) {
      const result = lot(await rpc<Row>("reject_lot", { lot: id, note }));
      changed(); return result;
    },
    articles: {
      list: async (all = false) => (await rows("articles", "*", all ? {} : { status: "published" })).map(article)
        .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || b.updatedAt.localeCompare(a.updatedAt) || a.slug.localeCompare(b.slug)),
      get: async (slug: string) => { const found = await rows("articles", "*", { slug, status: "published" }); return found[0] ? article(found[0]) : null; },
      async save(input: ArticleInput) {
        const result = article(await rpc<Row>("upsert_article", { article: {
          id: input.id, slug: input.slug, title: input.title, kicker: input.kicker, excerpt: input.excerpt, body_md: input.bodyMd,
          cover_path: input.coverPath ?? null, cover_image: input.coverPath ? null : input.coverImage ?? null,
          reading_minutes: input.readingMinutes, status: input.status, published_at: input.publishedAt ?? null, author: input.author,
        } }));
        changed(); return result;
      },
      async remove(id: string) { const removed = await rpc<boolean>("delete_article", { id }); changed(); return removed; },
      uploadCover: (file: File) => upload("journal", `${crypto.randomUUID()}.${({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[file.type] ?? "invalid"}`, file),
    },
  };
}
