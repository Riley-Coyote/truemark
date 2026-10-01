import { useRef } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, EmptyState } from "../app-kit";
import { content } from "../platform/content";
import { useResource } from "../platform/store";
import { useReveal } from "../shop/motion";
import { articleCategories } from "./articles";
import { JournalCard } from "./JournalCard";
import { presentArticle } from "./journal-data";

export function LiveJournal() {
  const resource = useResource(() => content.articles.list(), []);
  const root = useRef<HTMLDivElement>(null);
  const [params, setParams] = useSearchParams();
  const requested = params.get("category");
  const active = articleCategories.find((item) => item.id === requested)?.label ?? requested ?? "all";
  const articles = resource.data ?? [];
  const visible = articles.filter((article) => active === "all" || article.kicker === active);
  const [lead, ...rest] = visible;
  const foundTopics = [...new Set(articles.map((article) => article.kicker).filter(Boolean))];
  const knownTopics = articleCategories.map((item) => item.label);
  const topics = [...knownTopics.filter((topic) => foundTopics.includes(topic)), ...foundTopics.filter((topic) => !knownTopics.includes(topic))];
  useReveal(root, `${active}:${resource.loading}:${articles.length}`);
  function choose(kicker: string) {
    const next = new URLSearchParams(params);
    if (kicker === "all") next.delete("category");
    else next.set("category", articleCategories.find((item) => item.label === kicker)?.id ?? kicker);
    setParams(next, { replace: true, preventScrollReset: true });
  }
  return <div className="tm-page tm-journal" ref={root}>
    <section className="tm tm-journal-head" aria-labelledby="tm-journal-title">
      <div className="tm-journal-heading"><p className="tm-eyebrow">Research Blog</p><h1 id="tm-journal-title" className="tm-display">Testing, storage, and traceability</h1></div>
      <p className="tm-section-note tm-journal-intro">Guides on analytical testing, certificates of analysis, peptide chemistry, and laboratory handling — written for researchers, with references.</p>
      <div className="tm-filterbar tm-journal-filters">
        <div className="tm-chips" role="group" aria-label="Filter articles by topic">
          {["all", ...topics].map((topic) => <button key={topic} type="button" className="tm-chip" aria-pressed={active === topic} disabled={resource.loading} onClick={() => choose(topic)}>{topic === "all" ? "All" : topic}<span>{topic === "all" ? articles.length : articles.filter((article) => article.kicker === topic).length}</span></button>)}
        </div>
        <p className="tm-result-count" aria-live="polite">{visible.length} {visible.length === 1 ? "article" : "articles"}</p>
      </div>
    </section>
    <section className="tm tm-journal-list" aria-label="Articles" aria-busy={resource.loading}>
      {resource.loading ? <p className="tm-section-note" role="status">Loading articles…</p>
        : resource.error ? <EmptyState title="Articles could not be loaded." note={resource.error.message} action={<Button onClick={resource.reload}>Try again</Button>} />
        : !lead ? <p className="tm-section-note" role="status">{active === "all" ? "Articles appear here when they are published." : "No articles in this topic yet."}</p>
        : <ul className="tm-journal-grid">
          <li key={`lead-${lead.id}`} className="tm-journal-lead" data-reveal><JournalCard article={presentArticle(lead)} lead sizes="(max-width: 960px) 100vw, 56vw" /></li>
          {rest.map((article, i) => <li key={article.id} data-reveal style={{ "--tm-i": i % 3 } as CSSProperties}><JournalCard article={presentArticle(article)} sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 30vw" /></li>)}
        </ul>}
    </section>
  </div>;
}
