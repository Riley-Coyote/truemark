import { LIVE } from "./mode";
import { live } from "./live/runtime";
import { store } from "./store";
import { certificateLibrary } from "./certificates";
import { previewArticles, previewJournal } from "./preview/content";
export { previewArticles } from "./preview/content";

/** Preview content is read-only; it never initializes Storage or live Auth. */
export const content = {
  library: () => LIVE ? live().content.library() : store.lots.list().then((lots) => certificateLibrary(lots)),
  articles: {
    list: (all = false) => LIVE ? live().content.articles.list(all) : Promise.resolve(previewJournal(all)),
    get: (slug: string) => LIVE ? live().content.articles.get(slug) : Promise.resolve(previewArticles().find((article) => article.slug === slug) ?? null),
  },
};
