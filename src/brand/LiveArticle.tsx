import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { assetUrl } from "../assetUrl";
import { Button, EmptyState } from "../app-kit";
import { content } from "../platform/content";
import { useResource } from "../platform/store";
import { useReveal } from "../shop/motion";
import NotFound from "../shop/pages/content/NotFound";
import { articleCategories, researchUseNotice } from "./articles";
import { Contents, useCurrentSection } from "./ArticleNavigation";
import { ArticlePhoto, JournalCard } from "./JournalCard";
import { presentArticle } from "./journal-data";
import { Markdown, markdownBlocks } from "./Markdown";

export function LiveArticle() {
  const { id = "" } = useParams();
  const resource = useResource(() => content.articles.get(id), [id]);
  const others = useResource(() => content.articles.list(), [id]);
  const entry = resource.data;
  const root = useRef<HTMLDivElement>(null);
  useReveal(root, `${id}:${resource.loading}:${others.loading}`);
  const sections = useMemo(() => markdownBlocks(entry?.bodyMd ?? "").flatMap((block) => block.kind === "heading" ? [{ id: block.id, text: block.text.replace(/\\([\\`*_\[\]<>|])/g, "$1") }] : []), [entry]);
  const current = useCurrentSection(sections);
  useEffect(() => { if (entry) document.title = `${entry.title} — TrueMark BioLabs`; }, [entry]);
  if (resource.loading) return <div className="tm-page"><section className="tm"><p className="tm-section-note" role="status">Loading article…</p></section></div>;
  if (resource.error) return <div className="tm-page"><section className="tm"><EmptyState title="This article could not be loaded." note={resource.error.message} action={<Button onClick={resource.reload}>Try again</Button>} /></section></div>;
  if (!entry) return <NotFound />;
  const article = presentArticle(entry);
  const category = articleCategories.find((item) => item.label === entry.kicker)?.id ?? entry.kicker;
  const candidates = (others.data ?? []).filter((item) => item.id !== entry.id);
  const related = [...candidates.filter((item) => item.kicker === entry.kicker), ...candidates.filter((item) => item.kicker !== entry.kicker)].slice(0, 3);
  return <div className="tm-page tm-article-page" ref={root} key={entry.id}>
    <article aria-labelledby="tm-article-title">
      <header className="tm tm-article-head">
        <nav className="tm-crumbs" aria-label="Breadcrumb"><ol><li><Link to="/research-blog">Research Blog</Link></li>{entry.kicker && <li><Link to={`/research-blog?category=${encodeURIComponent(category)}`}>{entry.kicker}</Link></li>}</ol></nav>
        <div className="tm-article-intro">
          <p className="tm-eyebrow">{entry.kicker}</p><h1 id="tm-article-title" className="tm-article-title">{entry.title}</h1><p className="tm-article-dek">{entry.excerpt}</p>
          <div className="tm-article-byline"><span className="tm-article-mark" aria-hidden="true"><img src={assetUrl("images/brand/kit/monogram-black.svg")} alt="" /></span>
            <p className="tm-article-author">{entry.author}<span>{article.review && <>{article.review} · </>}<span className="tm-article-when"><time dateTime={article.iso}>{article.date}</time> · {article.readTime}</span></span></p><p className="tm-article-use">Educational use</p>
          </div>
        </div>
        <div className="tm-article-photo"><ArticlePhoto article={article} sizes="(max-width: 960px) 100vw, 66vw" eager /></div>
      </header>
      <div className="tm tm-article-main">
        {sections.length > 1 && <Contents sections={sections} current={current} />}
        <div className="tm-article-body"><Markdown source={entry.bodyMd} /><footer className="tm-article-notice"><p><span>{researchUseNotice.lead}</span> {researchUseNotice.text}</p></footer></div>
      </div>
    </article>
    {!!related.length && <section className="tm tm-article-more" aria-labelledby="tm-article-more-title"><h2 id="tm-article-more-title" className="tm-eyebrow">Keep reading</h2><ul className="tm-journal-grid">
      {related.map((next, i) => <li key={next.id} data-reveal style={{ "--tm-i": i } as CSSProperties}><JournalCard article={presentArticle(next)} level={3} showDek={false} sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 30vw" /></li>)}
    </ul></section>}
  </div>;
}
