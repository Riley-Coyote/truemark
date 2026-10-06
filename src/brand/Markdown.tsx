import { Fragment } from "react";
import type { ReactNode } from "react";
import { Link, useInRouterContext } from "react-router-dom";
import { SectionLink } from "../SectionLink";
import { BrandDot } from "./HeroShelf";
import { Trace } from "./Trace";
import { sectionId } from "./articles";

/** No HTML parsing, URL decoding or unsanitized element/attribute names. */
export function safeMarkdownUrl(raw: string): string | undefined {
  const url = raw.trim();
  if (!url || /[\u0000-\u0020\u007f\\]/.test(url) || url.startsWith("//")) return undefined;
  if (/^[a-z][a-z\d+.-]*:/i.test(url) && !/^https?:\/\//i.test(url)) return undefined;
  return url;
}

/** App paths and heading anchors must also work under the live HashRouter. */
function MarkdownLink({ href, children }: { href: string; children: ReactNode }) {
  const routed = useInRouterContext();
  if (routed && href.startsWith("#")) return <SectionLink section={href.slice(1)}>{children}</SectionLink>;
  const documentLink = /\.[a-z\d]+(?:[?#]|$)/i.test(href);
  if (routed && !/^https?:/i.test(href) && !documentLink) return <Link to={href} relative="path">{children}</Link>;
  return <a href={href}>{children}</a>;
}

/** With `words`, plain text is set word by word in spans (keyed by place, so a growing answer keeps the
 *  words it has), which lets the chat settle each new word as it is written. */
export function inlineMarkdown(text: string, depth = 0, words = false): ReactNode[] {
  if (depth > 8) return [text];
  const result: ReactNode[] = [];
  let plain = "", start = 0;
  const flush = () => {
    if (plain && words) plain.split(/(\s+)/).forEach((part, j) => result.push(!part || /^\s/.test(part) ? part : <span key={`${start}:${j}`} className="tm-word">{part}</span>));
    else if (plain) result.push(plain);
    plain = "";
  };
  for (let i = 0; i < text.length;) {
    if (!plain) start = i;
    if (text[i] === "\\" && i + 1 < text.length) { plain += text[i + 1]; i += 2; continue; }
    const remaining = text.slice(i);
    const link = remaining.match(/^\[([^\]\n]*)\]\(([^)\n]*)\)/);
    if (link) {
      flush(); const href = safeMarkdownUrl(link[2]);
      result.push(href ? <MarkdownLink key={i} href={href}>{inlineMarkdown(link[1], depth + 1, words)}</MarkdownLink> : <Fragment key={i}>{inlineMarkdown(link[1], depth + 1, words)}</Fragment>);
      i += link[0].length; continue;
    }
    const code = remaining.match(/^`([^`\n]+)`/);
    if (code) { flush(); result.push(<code key={i}>{code[1]}</code>); i += code[0].length; continue; }
    const strong = remaining.match(/^\*\*(.+?)\*\*/);
    if (strong) { flush(); result.push(<strong key={i}>{inlineMarkdown(strong[1], depth + 1, words)}</strong>); i += strong[0].length; continue; }
    const emphasis = remaining.match(/^(?:\*([^*]+)\*|_([^_]+)_)/);
    if (emphasis) { flush(); result.push(<em key={i}>{inlineMarkdown(emphasis[1] ?? emphasis[2], depth + 1, words)}</em>); i += emphasis[0].length; continue; }
    plain += text[i++];
  }
  flush(); return result;
}

type Block = { kind: "heading"; level: 2 | 3; text: string; id: string }
  | { kind: "paragraph" | "quote"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; rows: string[][] }
  | { kind: "image"; alt: string; url: string };
const unescape = (text: string) => text.replace(/\\([\\`*_\[\]<>|])/g, "$1");
const tableRow = (line: string) => line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((cell) => cell.trim());
const startsBlock = (line: string) => /^(?:#{2,3} |>|[-*] |\d+\. |!\[|\|)/.test(line);
export function markdownBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  const ids = new Map<string, number>();
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const heading = line.match(/^(#{2,3}) (.+)$/);
    if (heading) {
      const base = sectionId(unescape(heading[2])) || "section";
      const count = (ids.get(base) ?? 0) + 1; ids.set(base, count);
      blocks.push({ kind: "heading", level: heading[1].length as 2 | 3, text: heading[2], id: count === 1 ? base : `${base}-${count}` }); i++; continue;
    }
    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) { blocks.push({ kind: "image", alt: unescape(image[1]), url: image[2] }); i++; continue; }
    if (line.startsWith("|") && /^\|(?:\s*:?-+:?\s*\|)+$/.test(lines[i + 1] ?? "")) {
      const rows = [tableRow(line)]; i += 2;
      while (i < lines.length && lines[i].startsWith("|")) rows.push(tableRow(lines[i++]));
      blocks.push({ kind: "table", rows: rows.filter((row) => row.some(Boolean)) }); continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) quote.push(lines[i++].replace(/^> ?/, ""));
      blocks.push({ kind: "quote", text: quote.join("\n") }); continue;
    }
    if (/^(?:[-*] |\d+\. )/.test(line)) {
      const ordered = /^\d/.test(line); const items: string[] = [];
      const pattern = ordered ? /^\d+\. / : /^[-*] /;
      while (i < lines.length && pattern.test(lines[i])) items.push(lines[i++].replace(pattern, ""));
      blocks.push({ kind: "list", ordered, items }); continue;
    }
    const paragraph = [line]; i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) paragraph.push(lines[i++]);
    blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
  }
  return blocks;
}

/** Published pages, editor previews and chat share the same safe inline parser. */
export function Markdown({ source, variant = "article", words = false }: { source: string; variant?: "article" | "chat"; words?: boolean }) {
  const chat = variant === "chat";
  // Word spans are for an answer being written in the chat; everywhere else text stays plain.
  const inline = (text: string) => inlineMarkdown(text, 0, chat && words);
  // Chat headings are body-sized labels, regardless of the model's heading level.
  const markdown = chat ? source.replace(/^#{1,6} +/gm, "### ") : source;
  let lastHeading: string | undefined;
  return <>{markdownBlocks(markdown).map((block, i) => {
    switch (block.kind) {
      case "heading": {
        if (chat) return <p key={i}><strong>{inline(block.text)}</strong></p>;
        lastHeading = block.id; const Heading = block.level === 2 ? "h2" : "h3";
        return <Heading key={i} id={block.id}>{inlineMarkdown(block.text)}</Heading>;
      }
      case "paragraph": return <p key={i}>{inline(block.text)}</p>;
      case "quote": return chat ? <blockquote key={i}><p>{inline(block.text)}</p></blockquote> : <blockquote key={i} className="tm-article-quote"><p>{inlineMarkdown(block.text.endsWith(".") ? block.text.slice(0, -1) : block.text)}{block.text.endsWith(".") && <BrandDot />}</p></blockquote>;
      case "list": {
        const List = block.ordered ? "ol" : "ul";
        return <List key={i} className={chat ? undefined : block.ordered ? "tm-article-refs" : "tm-article-list"}>{block.items.map((item, index) => {
          const term = !chat && !block.ordered && item.match(/^\*\*(.+?)\*\* (.*)$/);
          return <li key={index}>{term ? <><dfn>{inlineMarkdown(term[1])}</dfn> {inlineMarkdown(term[2])}</> : inline(item)}</li>;
        })}</List>;
      }
      case "table": return chat
        ? <div key={i} className="assistant-text-table">{block.rows.map((row, index) => <p key={index}>{inline(row.join(" · "))}</p>)}</div>
        : <table key={i} className="tm-article-table" aria-labelledby={lastHeading}><tbody>{block.rows.map(([name, ...rest], index) => <tr key={index}><th scope="row">{inlineMarkdown(name)}</th>{rest.map((cell, c) => <td key={c}>{inlineMarkdown(cell)}</td>)}</tr>)}</tbody></table>;
      case "image": {
        // Answers may link out, but never load model-selected remote images.
        if (chat) return <p key={i}>{block.alt}</p>;
        const url = safeMarkdownUrl(block.url);
        return <figure key={i} className="tm-article-figure is-visible">
          {url === "#chromatogram" ? <Trace peakAt={0.38} height={132} caption="Main peak" /> : url ? <img src={url} alt={block.alt} loading="lazy" /> : null}
          <figcaption>{block.alt}</figcaption>
        </figure>;
      }
    }
  })}</>;
}
