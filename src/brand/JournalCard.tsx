import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { assetUrl } from "../assetUrl";
import { categoryLabel } from "./articles";
import type { Article, SceneName } from "./articles";
import "./journal.css";

/** Full widths of the scene photographs; each also exists at half width as `-sm`. */
const sceneSize: Record<SceneName, { width: number; height: number }> = {
  collection: { width: 2400, height: 1357 },
  trio: { width: 2400, height: 1357 },
  lab: { width: 2400, height: 1357 },
  caustics: { width: 2400, height: 1357 },
  powder: { width: 1600, height: 1062 },
  "powder-blue": { width: 1600, height: 1062 },
  frost: { width: 1600, height: 1062 },
};

/** An article's photograph: atmosphere chosen for its subject, so it is decorative. */
export function ArticlePhoto({
  article,
  sizes,
  eager = false,
}: {
  article: Article;
  sizes: string;
  eager?: boolean;
}) {
  const { scene, focus } = article.image;
  const { width, height } = sceneSize[scene];
  const small = assetUrl(`images/scenes/${scene}-sm.webp`);
  const large = assetUrl(`images/scenes/${scene}.webp`);
  return (
    <img
      src={large}
      srcSet={`${small} ${width / 2}w, ${large} ${width}w`}
      sizes={sizes}
      width={width}
      height={height}
      alt=""
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      draggable={false}
      style={{ "--tm-focus": focus } as CSSProperties}
    />
  );
}

/**
 * One article in a list: its photograph, category, title, dek and date. The
 * title's link covers the whole card, so the card is a single target whose
 * name is the title.
 */
export function JournalCard({
  article,
  lead = false,
  level = 2,
  showDek = true,
  sizes,
}: {
  article: Article;
  lead?: boolean;
  level?: 2 | 3;
  showDek?: boolean;
  sizes: string;
}) {
  const Title = level === 2 ? "h2" : "h3";
  return (
    <article className={lead ? "tm-jcard is-lead" : "tm-jcard"}>
      <div className="tm-jcard-photo">
        <ArticlePhoto article={article} sizes={sizes} eager={lead} />
        {lead && article.featured && <span className="tm-jcard-tag">Featured</span>}
      </div>
      <div className="tm-jcard-body">
        <div className="tm-jcard-text">
          <p className="tm-jcard-kicker">{categoryLabel(article.category)}</p>
          <Title className="tm-jcard-title">
            <Link className="tm-jcard-link" to={`/research-blog/${article.id}`}>
              {article.title}
            </Link>
          </Title>
          {showDek && <p className="tm-jcard-dek">{article.dek}</p>}
        </div>
        <p className="tm-jcard-meta">
          <span>
            <time dateTime={article.iso}>{article.date}</time> · {article.readTime}
          </span>
          {lead && (
            <span className="tm-jcard-more" aria-hidden="true">
              Read the article <ArrowRight size={16} strokeWidth={1.6} />
            </span>
          )}
        </p>
      </div>
    </article>
  );
}
