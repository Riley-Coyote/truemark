import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";

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
      const site = `${process.env.VITE_SITE_ORIGIN ?? "https://riley-coyote.github.io"}${base}`;
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

export default defineConfig({
  base: "./",
  plugins: [react(), process.env.VITE_PLATFORM === "live" && liveHead()],
  // Agents' worktrees live under .claude/; they are separate checkouts, not part of this site.
  server: { watch: { ignored: ["**/.claude/**"] } },
  optimizeDeps: { entries: ["index.html"] },
});
