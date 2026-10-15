import { defineConfig } from "vite";
import type { HtmlTagDescriptor, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { OPENING_MEDIA, TALL_SCREEN } from "./src/brand/opening-media";

/**
 * The live site's head: the client's own share card (brand kit, 08_Web_Assets) and its words, in place
 * of the design preview's. Absolute addresses, as link scrapers need, on the build's own base.
 */
function liveHead(): Plugin {
  let base = "/";
  return {
    name: "truemark-live-head",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml(html) {
      const site = `${process.env.VITE_SITE_ORIGIN || "https://riley-coyote.github.io"}${base}`;
      const head: Record<string, string> = {
        description: "Research peptides. Third-party tested. Certificate of analysis for every lot.",
        "og:title": "TrueMark BioLabs — Research peptides. Third-party tested.",
        "og:description": "Certificate of analysis for every lot. For research use only, not for human consumption.",
        "og:url": site,
        "og:image": `${site}og-live.jpg`,
        "og:image:alt": "The TrueMark BioLabs lockup on the brand gradient: Research peptides. Third-party tested.",
        "twitter:image": `${site}og-live.jpg`,
      };
      return Object.entries(head).reduce((page, [key, content]) => {
        const tag = new RegExp(`(<meta (?:name|property)="${key}" content=")[^"]*(")`);
        if (!tag.test(page)) throw new Error(`index.html has no single-line meta for ${key}`);
        return page.replace(tag, `$1${content.replace(/"/g, "&quot;")}$2`);
      }, html);
    },
  };
}

/**
 * The built page's head, readied for its first screen:
 * - the shop's code and styles are asked for alongside the site's own start, not after it (every page needs them);
 * - on the opening, the room for the screen's shape (the largest thing on the first screen) is asked for at once, before
 *   any code has run (its faces are not: WebKit reported the preloaded faces unused, a console warning on every
 *   visit), and the page's first paint is the room's own haze rather than a blank white page;
 * - search engines are asked not to index a preview (set VITE_INDEX=1 for the site that should be found), and the
 *   canonical address is the one the share card names.
 */
function startHead(): Plugin {
  let base = "./";
  return {
    name: "truemark-start-head",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const files = Object.values(ctx.bundle ?? {});
        const tags: HtmlTagDescriptor[] = [];
        // The shop's chunk, and the review bar's code and styles (ReviewShell.tsx; launch has none): every page waits
        // for them before its first render.
        const first = /\/src\/(AppRoutes\.tsx|review\/index\.ts|review\/review\.css|review\.css)$/;
        for (const file of files) {
          if (file.type !== "chunk" || !(file.name === "shop" || file.moduleIds.some((id) => first.test(id)))) continue;
          if (file.code.trim()) tags.push({ tag: "link", attrs: { rel: "modulepreload", crossorigin: true, href: base + file.fileName }, injectTo: "head" });
          for (const sheet of file.viteMetadata?.importedCss ?? []) {
            tags.push({ tag: "link", attrs: { rel: "preload", as: "style", crossorigin: true, href: base + sheet }, injectTo: "head" });
          }
        }
        // The review bar's own two stylesheets, imported on their own (their chunks hold only styles).
        for (const file of files) {
          if (file.type === "asset" && file.fileName.endsWith(".css") && file.names.includes("review.css")) {
            tags.push({ tag: "link", attrs: { rel: "preload", as: "style", crossorigin: true, href: base + file.fileName }, injectTo: "head" });
          }
        }
        // The opening is "#/" in a build with hash addresses (or no hash at all, which the router reads as "#/"), and the
        // site's root in one with paths (but there the first visit of a tab is sent to sign in, as main.tsx's enterRoot
        // does: nothing is readied for it).
        const atOpening = process.env.VITE_ROUTER === "path"
          ? `(location.pathname===${JSON.stringify(base)}||location.pathname+"/"===${JSON.stringify(base)})&&sessionStorage.getItem("tm-entered")==="1"`
          : `(!location.hash||${/^#\/(\?|$)/}.test(location.hash))`;
        // The opening's first paint is the room's own haze, not a blank white page: the room, seen through a lens not yet
        // focused, which the room then comes into focus out of (mist-word.css --tm-dawn-haze, the same gradient). The
        // opening puts it away once the room is drawn; if the opening never draws, it goes anyway.
        const ready = [
          "(function(){try{",
          `if(!(${atOpening}))return;`,
          "var d=document,h=d.head,r=d.documentElement;",
          "r.setAttribute('data-tm-dawn','');setTimeout(function(){r.removeAttribute('data-tm-dawn')},4000);",
          "function l(u,a){var e=d.createElement('link');e.rel='preload';e.as=a;e.href=u;e.setAttribute('fetchpriority','high');h.appendChild(e);}",
          `l(matchMedia(${JSON.stringify(TALL_SCREEN)}).matches?${JSON.stringify(base + OPENING_MEDIA.tall.poster)}:${JSON.stringify(base + OPENING_MEDIA.wide.poster)},'image');`,
          "}catch(e){}})();",
        ].join("");
        const haze = "html[data-tm-dawn]{background:#968fa9 radial-gradient(46% 80% at 50% 48%,#e3dcec 0%,#d9d1e4 30%,#b4abc6 68%,#8f88a2 100%) no-repeat fixed}";
        if (process.env.VITE_INDEX !== "1") tags.push({ tag: "meta", attrs: { name: "robots", content: "noindex, nofollow" }, injectTo: "head" });
        const shared = /<meta property="og:url" content="([^"]*)"/.exec(html)?.[1];
        const canonical = shared ? html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${shared}$2`) : html;
        // Right after the viewport, ahead of the stylesheets (a script waits for those above it before it runs).
        const viewport = /<meta name="viewport"[^>]*>/;
        if (!viewport.test(canonical)) throw new Error("index.html has no viewport meta to ready the opening after");
        return { html: canonical.replace(viewport, (tag) => `${tag}\n    <style>${haze}</style>\n    <script>${ready}</script>`), tags };
      },
    },
  };
}

/**
 * Presses and hovers, as a finger means them (src/press.ts). For a mouse every :active and :hover in the site's styles
 * stays the browser's own; under a finger (html[data-touch]):
 * - :active gives way to [data-pressed], which press.ts sets only for a tap, never for a scroll that starts on
 *   something;
 * - :hover holds off: a phone hovers whatever was tapped last and keeps it hovered until a tap lands elsewhere, so a
 *   story's pause button kept a lit disc behind its play icon once tapped.
 * Each rewrite weighs what it replaced in the cascade, and passes over a state it has already reached.
 */
const fingerStates = {
  postcssPlugin: "truemark-finger-states",
  Rule(rule: { selector: string }) {
    const selector = rule.selector
      .replace(/(?<!:where\(html:not\(\[data-touch\]\)\) ):active(?![\w-])/g, ":is(:where(html:not([data-touch])) :active, [data-pressed])")
      .replace(/(?<!:where\(html:not\(\[data-touch\]\)\) ):hover(?![\w-])/g, ":is(:where(html:not([data-touch])) :hover)");
    if (selector !== rule.selector) rule.selector = selector;
  },
};

export default defineConfig({
  base: "./",
  plugins: [react(), process.env.VITE_PLATFORM === "live" && liveHead(), startHead()],
  css: { postcss: { plugins: [fingerStates] } },
  // Agents' worktrees live under .claude/; they are separate checkouts, not part of this site.
  server: { watch: { ignored: ["**/.claude/**"] } },
  optimizeDeps: { entries: ["index.html"] },
  build: {
    rollupOptions: {
      output: {
        // The site starts in two files: what src/main.tsx needs to start ("core"), then the shop's frame and its opening,
        // everything src/AppRoutes.tsx imports that isn't loaded lazily ("shop"). One request each, not dozens of small
        // shared files before the opening can draw. Every other page arrives with its route (src/pages.tsx), carrying
        // only what the shop doesn't already have. (A module given a chunk brings its unassigned imports with it, so
        // core is named too, and the live platform's client is kept to the chunk that loads it.)
        manualChunks(id, { getModuleInfo }) {
          chunks ??= startChunks(getModuleInfo);
          if (LIVE_ONLY.test(id)) return "live-client";
          return chunks.core.has(id) ? "core" : chunks.shop.has(id) ? "shop" : undefined;
        },
      },
    },
  },
});

let chunks: { core: Set<string>; shop: Set<string> } | undefined;
type ModuleInfoOf = (id: string) => { importedIds: readonly string[] } | null;
/** The live platform's client (and the review notes'), loaded only by the code that uses it. */
const LIVE_ONLY = /\/node_modules\/(@supabase|iceberg-js|tslib)\//;
/** The modules src/main.tsx reaches through static imports (core), and those src/AppRoutes.tsx reaches beyond them
 *  (shop), neither counting the live platform's client. */
function startChunks(info: ModuleInfoOf) {
  const walk = (from: string[]) => {
    const seen = new Set<string>();
    const queue = [...from];
    while (queue.length) {
      const id = queue.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(...(info(id)?.importedIds ?? []));
    }
    return seen;
  };
  const root = fileURLToPath(new URL("./src/", import.meta.url));
  const routes = `${root}AppRoutes.tsx`;
  const main = `${root}main.tsx`;
  const entry = walk([main]);
  const core = new Set([...entry].filter((id) => id !== main && !LIVE_ONLY.test(id)));
  return { core, shop: new Set([...walk([routes])].filter((id) => !entry.has(id) && !LIVE_ONLY.test(id))) };
}
