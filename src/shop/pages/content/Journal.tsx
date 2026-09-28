import { useRef } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { articleCategories, articles, isArticleCategory } from "../../../brand/articles";
import type { ArticleCategory } from "../../../brand/articles";
import { JournalCard } from "../../../brand/JournalCard";
import { useReveal } from "../../motion";

/** The client's Research Blog: their heading and lead, the featured article large, the rest as a grid. */
export default function Journal() {
  const root = useRef<HTMLDivElement>(null);
  const [params, setParams] = useSearchParams();
  const requested = params.get("category");
  const active: ArticleCategory | "all" = isArticleCategory(requested) ? requested : "all";
  useReveal(root, active);

  const visible = active === "all" ? articles : articles.filter((a) => a.category === active);
  const [lead, ...rest] = visible;

  function choose(category: ArticleCategory | "all") {
    const next = new URLSearchParams(params);
    if (category === "all") next.delete("category");
    else next.set("category", category);
    setParams(next, { replace: true, preventScrollReset: true });
  }

  const filters: { id: ArticleCategory | "all"; label: string; count: number }[] = [
    { id: "all", label: "All", count: articles.length },
    ...articleCategories.map((c) => ({
      id: c.id,
      label: c.label,
      count: articles.filter((a) => a.category === c.id).length,
    })),
  ];

  return (
    <div className="tm-page tm-journal" ref={root}>
      <section className="tm tm-journal-head" aria-labelledby="tm-journal-title">
        <div className="tm-journal-heading">
          <p className="tm-eyebrow">Research Blog</p>
          <h1 id="tm-journal-title" className="tm-display">
            Testing, storage, and traceability
          </h1>
        </div>
        <p className="tm-section-note tm-journal-intro">
          Guides on analytical testing, certificates of analysis, peptide
          chemistry, and laboratory handling — written for researchers, with
          references.
        </p>
        <div className="tm-filterbar tm-journal-filters">
          <div className="tm-chips" role="group" aria-label="Filter articles by topic">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                className="tm-chip"
                aria-pressed={active === f.id}
                onClick={() => choose(f.id)}
              >
                {f.label}
                <span>{f.count}</span>
              </button>
            ))}
          </div>
          <p className="tm-result-count" aria-live="polite">
            {visible.length} {visible.length === 1 ? "article" : "articles"}
          </p>
        </div>
      </section>

      <section className="tm tm-journal-list" aria-label="Articles">
        <ul className="tm-journal-grid">
          <li key={`lead-${lead.id}`} className="tm-journal-lead" data-reveal>
            <JournalCard article={lead} lead sizes="(max-width: 960px) 100vw, 56vw" />
          </li>
          {rest.map((article, i) => (
            <li key={article.id} data-reveal style={{ "--tm-i": i % 3 } as CSSProperties}>
              <JournalCard
                article={article}
                sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 30vw"
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
