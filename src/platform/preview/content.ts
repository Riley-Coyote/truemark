import { articles, categoryLabel } from "../../brand/articles";
import { articleMarkdown } from "../../brand/markdown-source";
import { read } from "./storage";
import type { JournalArticle } from "../types";

export function previewArticles(): JournalArticle[] {
  return articles.map((article) => ({
    id: article.id, slug: article.id, title: article.title, kicker: categoryLabel(article.category),
    excerpt: article.dek, bodyMd: articleMarkdown(article.body), coverImage: `images/scenes/${article.image.scene}.webp`,
    readingMinutes: Number.parseInt(article.readTime, 10), status: "published", publishedAt: article.iso,
    updatedAt: article.iso, author: article.author,
  }));
}
export function previewJournal(all = false): JournalArticle[] {
  return [...previewArticles(), ...(all ? read<JournalArticle[]>("tm-preview-assistant-drafts", []) : [])];
}
