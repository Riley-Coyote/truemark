import type { ArticleBlock } from "./articles";

/** Escape source prose, so punctuation can never accidentally become Markdown. */
const prose = (text: string) => text.replace(/([\\`*_\[\]<>|])/g, "\\$1");
export function articleMarkdown(blocks: ArticleBlock[]): string {
  return blocks.map((block) => {
    switch (block.kind) {
      case "heading": return `## ${prose(block.text)}`;
      case "paragraph": return prose(block.text);
      case "quote": return `> ${prose(block.text)}`;
      case "list": return block.items.map((item) => `- ${typeof item === "string" ? prose(item) : `**${prose(item.term)}** ${prose(item.text)}`}`).join("\n");
      case "references": return block.items.map((item, i) => `${i + 1}. ${prose(item)}`).join("\n");
      // An empty header preserves the original two-column, row-heading table.
      case "table": return `| | |\n| --- | --- |\n${block.rows.map((row) => `| ${row.map(prose).join(" | ")} |`).join("\n")}`;
      // A local, explicit illustration token; never an arbitrary HTML/embed hook.
      case "figure": return "![Illustration of a chromatogram, not a result for any lot.](#chromatogram)";
    }
  }).join("\n\n");
}
