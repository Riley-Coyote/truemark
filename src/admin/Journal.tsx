import { useState } from "react";
import type { FormEvent } from "react";
import { Button, DataTable, Drawer, PageHeader, Select, TextAreaField, formatDate } from "../app-kit";
import type { Column } from "../app-kit";
import { content } from "../platform/content";
import { LIVE } from "../platform/mode";
import { live } from "../platform/live/runtime";
import { useResource } from "../platform/store";
import type { ArticleInput, JournalArticle } from "../platform/types";
import { Markdown } from "../brand/Markdown";
import { TextField } from "./fields";
import { ContentUpload } from "./ContentUpload";
import { matches, useSearchQuery } from "./state";
import "../brand/article.css";

const columns: Column<JournalArticle>[] = [
  { key: "title", header: "Title", mobile: "primary", sortValue: (article) => article.title, cell: (article) => article.title },
  { key: "status", header: "Status", mobile: "aside", sortValue: (article) => article.status, cell: (article) => article.status === "published" ? "Published" : "Draft" },
  { key: "published", header: "Published", mobile: "secondary", sortFirst: "desc", sortValue: (article) => article.publishedAt ?? null, cell: (article) => article.publishedAt ? formatDate(article.publishedAt) : <span className="kit-quiet">Not published</span> },
];

export default function Journal() {
  const articles = useResource(() => content.articles.list(true), []);
  const query = useSearchQuery();
  const [editing, setEditing] = useState<JournalArticle | "new" | null>(null);
  const [message, setMessage] = useState("");
  return <div className="kit-grid">
    <PageHeader description={LIVE ? "Write, review and publish the Research Blog." : "Editing works in the live platform."} />
    {LIVE && <div className="kit-toolbar"><Button variant="primary" onClick={() => setEditing("new")}>New article</Button></div>}
    {message && <p className="kit-note kit-span-12" role="status">{message}</p>}
    <div className="kit-card kit-span-12"><DataTable caption="Journal articles" columns={columns} rows={articles.data?.filter((article) => matches(query, article.title, article.slug, article.kicker))} rowKey={(article) => article.id} loading={articles.loading} error={articles.error} onRetry={articles.reload} defaultSort={{ key: "published", dir: "desc" }} onRowClick={LIVE ? setEditing : undefined} empty={{ title: "No articles match.", note: "Search by title, slug or topic." }} /></div>
    {LIVE && editing && <ArticleEditor key={typeof editing === "string" ? editing : editing.id} article={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={(text) => { setEditing(null); setMessage(text); articles.reload(); }} />}
  </div>;
}

const slugFrom = (title: string) => title.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function ArticleEditor({ article, onClose, onSaved }: { article?: JournalArticle; onClose: () => void; onSaved: (message: string) => void }) {
  const [draft, setDraft] = useState<ArticleInput>(article ?? { slug: "", title: "", kicker: "", excerpt: "", bodyMd: "", status: "draft", readingMinutes: 1, author: "" });
  const [slugEdited, setSlugEdited] = useState(!!article);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function field<K extends keyof ArticleInput>(key: K, value: ArticleInput[K]) { setDraft((previous) => ({ ...previous, [key]: value })); }
  async function save(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!draft.title.trim() || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.slug)) { setError("Enter a title and a slug using lowercase letters, numbers and hyphens."); return; }
    if (draft.status === "published" && (!draft.publishedAt || !draft.bodyMd.trim())) { setError("Published articles need a body and publish date."); return; }
    if (!Number.isInteger(draft.readingMinutes) || draft.readingMinutes < 1 || draft.readingMinutes > 240) { setError("Reading minutes must be a whole number from 1 to 240."); return; }
    setBusy(true);
    try {
      let coverPath = draft.coverPath;
      if (file) { coverPath = await live().content.articles.uploadCover(file); field("coverPath", coverPath); setFile(null); }
      await live().content.articles.save({ ...draft, coverPath });
      onSaved(draft.status === "published" ? "Article published." : "Draft saved.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The article could not be saved."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!article) return;
    setBusy(true); setError("");
    try { await live().content.articles.remove(article.id); onSaved("Article deleted."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The article could not be deleted."); }
    finally { setBusy(false); }
  }
  return <Drawer title={article ? "Edit article" : "New article"} eyebrow="Journal" onClose={() => { if (!busy) onClose(); }} footer={confirmDelete ? <div className="cc-confirm" role="group" aria-label="Confirm article deletion">
    <p className="kit-note">Delete “{article?.title}”? It will leave the journal.</p><div className="cc-confirm-actions"><Button variant="danger" onClick={remove} disabled={busy}>{busy ? "Deleting…" : "Confirm delete"}</Button><Button onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</Button></div>
  </div> : <div className="cc-confirm-actions"><Button variant="primary" type="submit" form="cc-article-form" disabled={busy}>{busy ? "Saving…" : "Save article"}</Button>{article && <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={busy}>Delete</Button>}</div>}>
    <form id="cc-article-form" onSubmit={save}><fieldset className="cc-content-fields cc-form" disabled={busy || confirmDelete}>
      <TextField label="Title" value={draft.title} onChange={(title) => setDraft((previous) => ({ ...previous, title, slug: slugEdited ? previous.slug : slugFrom(title) }))} />
      <TextField label="Slug" value={draft.slug} onChange={(slug) => { setSlugEdited(true); field("slug", slug); }} mono />
      <TextField label="Kicker" value={draft.kicker} onChange={(value) => field("kicker", value)} />
      <TextAreaField label="Excerpt" value={draft.excerpt} onChange={(value) => field("excerpt", value)} />
      <ContentUpload bucket="journal" file={file} onChange={setFile} onError={setError} />
      {(draft.coverPath || draft.coverImage) && <p className="kit-note">A cover is on file. Upload a new image to replace it.</p>}
      <Button aria-pressed={preview} onClick={() => setPreview((value) => !value)}>{preview ? "Edit Markdown" : "Preview"}</Button>
      {preview ? <div className="tm tm-article-page cc-markdown-preview"><div className="tm-article-body"><Markdown source={draft.bodyMd} /></div></div>
        : <TextAreaField label="Body (Markdown)" value={draft.bodyMd} onChange={(value) => field("bodyMd", value)} hint="Headings, paragraphs, emphasis, links, lists, quotes, code and images. Raw HTML displays as text." />}
      <TextField label="Author" value={draft.author} onChange={(value) => field("author", value)} />
      <TextField label="Reading minutes" value={String(draft.readingMinutes)} inputMode="numeric" onChange={(value) => field("readingMinutes", Number(value))} />
      <Select label="Status" value={draft.status} onChange={(value) => field("status", value)} options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} />
      <TextField label="Publish date (UTC)" type="date" value={draft.publishedAt?.slice(0, 10) ?? ""} onChange={(value) => field("publishedAt", value ? `${value}T00:00:00Z` : undefined)} />
    </fieldset>{error && <p className="kit-field-error" role="alert">{error}</p>}</form>
  </Drawer>;
}
