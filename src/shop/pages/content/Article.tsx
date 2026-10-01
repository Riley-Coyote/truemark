import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { assetUrl } from "../../../assetUrl";
import {
  articleById,
  categoryLabel,
  relatedArticles,
  researchUseNotice,
  sectionId,
} from "../../../brand/articles";
import type { ArticleBlock } from "../../../brand/articles";
import { BrandDot } from "../../../brand/HeroShelf";
import { ArticlePhoto, JournalCard } from "../../../brand/JournalCard";
import { Trace } from "../../../brand/Trace";
import { useReveal } from "../../motion";
import NotFound from "./NotFound";
import { Contents, useCurrentSection, type Section } from "../../../brand/ArticleNavigation";
import { LIVE } from "../../../platform/mode";
import { LiveArticle } from "../../../brand/LiveArticle";
import "../../../brand/article.css";

/** The chromatogram the HPLC article describes, drawn as the brand's trace. */
function Chromatogram() {
  return (
    <figure className="tm-article-figure" data-reveal>
      <Trace peakAt={0.38} height={132} caption="Main peak" />
      <figcaption>Illustration of a chromatogram, not a result for any lot.</figcaption>
    </figure>
  );
}

/** A sentence that ends the way the logo does: with its dot. */
function withBrandStop(text: string): ReactNode {
  return text.endsWith(".") ? (
    <>
      {text.slice(0, -1)}
      <BrandDot />
    </>
  ) : (
    text
  );
}

function Body({ blocks }: { blocks: ArticleBlock[] }) {
  let lastHeading = "";
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "heading":
            lastHeading = sectionId(block.text);
            return (
              <h2 key={i} id={lastHeading}>
                {block.text}
              </h2>
            );
          case "paragraph":
            return <p key={i}>{block.text}</p>;
          case "list":
            return (
              <ul key={i} className="tm-article-list">
                {block.items.map((item) =>
                  typeof item === "string" ? (
                    <li key={item}>{item}</li>
                  ) : (
                    <li key={item.term}>
                      <dfn>{item.term}</dfn> {item.text}
                    </li>
                  ),
                )}
              </ul>
            );
          case "table":
            return (
              <table key={i} className="tm-article-table" aria-labelledby={lastHeading || undefined}>
                <tbody>
                  {block.rows.map(([name, meaning]) => (
                    <tr key={name}>
                      <th scope="row">{name}</th>
                      <td>{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          case "quote":
            return (
              <blockquote key={i} className="tm-article-quote">
                <p>{withBrandStop(block.text)}</p>
              </blockquote>
            );
          case "references":
            return (
              <ol key={i} className="tm-article-refs">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            );
          case "figure":
            return <Chromatogram key={i} />;
          default:
            return null;
        }
      })}
    </>
  );
}

/** One of the client's articles, set for reading. */
export default function Article() {
  return LIVE ? <LiveArticle /> : <PreviewArticle />;
}

function PreviewArticle() {
  const { id } = useParams();
  const article = articleById(id);
  const location = useLocation();
  const root = useRef<HTMLDivElement>(null);
  // The id is the reveal key: moving between articles keeps this page mounted.
  useReveal(root, id);

  const sections = useMemo<Section[]>(
    () =>
      (article?.body ?? []).flatMap((block) =>
        block.kind === "heading" ? [{ id: sectionId(block.text), text: block.text }] : [],
      ),
    [article],
  );
  const current = useCurrentSection(sections);

  useEffect(() => {
    if (article) document.title = `${article.title} — TrueMark BioLabs`;
  }, [article, location]);

  if (!article) return <NotFound />;
  const category = categoryLabel(article.category);
  const related = relatedArticles(article);

  return (
    <div className="tm-page tm-article-page" ref={root} key={article.id}>
      <article aria-labelledby="tm-article-title">
        <header className="tm tm-article-head">
          <nav className="tm-crumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link to="/research-blog">Research Blog</Link>
              </li>
              <li>
                <Link to={`/research-blog?category=${article.category}`}>{category}</Link>
              </li>
            </ol>
          </nav>
          <div className="tm-article-intro">
            <p className="tm-eyebrow">{category}</p>
            <h1 id="tm-article-title" className="tm-article-title">
              {article.title}
            </h1>
            <p className="tm-article-dek">{article.dek}</p>
            <div className="tm-article-byline">
              <span className="tm-article-mark" aria-hidden="true">
                <img src={assetUrl("images/brand/kit/monogram-black.svg")} alt="" />
              </span>
              <p className="tm-article-author">
                {article.author}
                <span>
                  {article.review} ·{" "}
                  <span className="tm-article-when">
                    <time dateTime={article.iso}>{article.date}</time> · {article.readTime}
                  </span>
                </span>
              </p>
              <p className="tm-article-use">Educational use</p>
            </div>
          </div>
          <div className="tm-article-photo">
            <ArticlePhoto article={article} sizes="(max-width: 960px) 100vw, 66vw" eager />
          </div>
        </header>

        <div className="tm tm-article-main">
          {sections.length > 1 && <Contents sections={sections} current={current} />}
          <div className="tm-article-body">
            <Body blocks={article.body} />
            <footer className="tm-article-notice">
              <p>
                <span>{researchUseNotice.lead}</span> {researchUseNotice.text}
              </p>
            </footer>
          </div>
        </div>
      </article>

      <section className="tm tm-article-more" aria-labelledby="tm-article-more-title">
        <h2 id="tm-article-more-title" className="tm-eyebrow">
          Keep reading
        </h2>
        <ul className="tm-journal-grid">
          {related.map((next, i) => (
            <li key={next.id} data-reveal style={{ "--tm-i": i } as CSSProperties}>
              <JournalCard
                article={next}
                level={3}
                showDek={false}
                sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 30vw"
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
