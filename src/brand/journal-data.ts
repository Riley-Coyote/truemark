import { assetUrl } from "../assetUrl";
import { formatDate } from "../app-kit/format";
import type { JournalArticle } from "../platform/types";
import { articleById, articleCategories } from "./articles";
import { articleMarkdown } from "./markdown-source";
import type { ArticlePresentation } from "./JournalCard";

/** Only presentational metadata comes from the old seed; all article copy is DB data. */
export function presentArticle(entry: JournalArticle): ArticlePresentation {
  const original = articleById(entry.slug);
  const sameCover = original && !entry.coverPath && entry.coverImage === `images/scenes/${original.image.scene}.webp`;
  const category = articleCategories.find((item) => item.label === entry.kicker)?.id ?? "quality-testing";
  return {
    id: entry.slug, title: entry.title, dek: entry.excerpt, category, kicker: entry.kicker,
    author: entry.author, review: original && entry.bodyMd === articleMarkdown(original.body) ? original.review : "",
    iso: entry.publishedAt ?? "", date: entry.publishedAt ? formatDate(entry.publishedAt) : "",
    readTime: `${entry.readingMinutes} min read`, featured: original?.featured,
    image: original?.image ?? { scene: "lab", focus: "50% 50%" }, body: [],
    ...(sameCover ? {} : { coverUrl: entry.coverUrl ?? (entry.coverImage ? assetUrl(entry.coverImage) : null) }),
  };
}
