import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { policies, policyByPath } from "../../../brand/policies";
import type { PolicyBlock } from "../../../brand/policies";
import NotFound from "./NotFound";
import "../../../brand/legal.css";

/** A block's words with its page's own bold and links set over them, the words themselves unchanged. */
function marked({ text, strong = [], links = [] }: PolicyBlock): ReactNode {
  const marks: [phrase: string, href: string][] = [...strong.map((phrase): [string, string] => [phrase, ""]), ...links];
  if (!marks.length) return text;
  const out: ReactNode[] = [];
  let at = 0;
  while (at < text.length) {
    let next: { index: number; phrase: string; href: string } | null = null;
    for (const [phrase, href] of marks) {
      const index = text.indexOf(phrase, at);
      if (index >= 0 && (!next || index < next.index)) next = { index, phrase, href };
    }
    if (!next) {
      out.push(text.slice(at));
      break;
    }
    if (next.index > at) out.push(text.slice(at, next.index));
    const key = out.length;
    out.push(!next.href ? <strong key={key}>{next.phrase}</strong>
      : next.href.startsWith("/") ? <Link key={key} to={next.href}>{next.phrase}</Link>
      : <a key={key} href={next.href}>{next.phrase}</a>);
    at = next.index + next.phrase.length;
  }
  return out;
}

/** Consecutive list items become one list; everything else renders in order. */
function renderBlocks(blocks: PolicyBlock[]) {
  const out: ReactNode[] = [];
  let items: PolicyBlock[] = [];
  const flush = () => {
    if (!items.length) return;
    out.push(
      <ul key={`list-${out.length}`}>
        {items.map((item) => (
          <li key={item.text}>{marked(item)}</li>
        ))}
      </ul>,
    );
    items = [];
  };
  blocks.forEach((block, i) => {
    if (block.kind === "item") {
      items.push(block);
      return;
    }
    flush();
    out.push(block.kind === "heading" ? <h2 key={i}>{block.text}</h2>
      : <p key={i} className={block.kind === "signoff" ? "tm-legal-signoff" : undefined}>{marked(block)}</p>);
  });
  flush();
  return out;
}

/** The client's legal pages: their words, set for reading. */
export default function Policy({ path }: { path: string }) {
  const policy = policyByPath(path);
  if (!policy) return <NotFound />;
  return (
    <section className="tm tm-legal" aria-labelledby="tm-legal-title">
      <nav className="tm-legal-index" aria-label="Legal pages">
        <p className="tm-eyebrow">Legal</p>
        {policies.map((p) => (
          <NavLink key={p.path} to={p.path}>
            {p.title}
          </NavLink>
        ))}
      </nav>
      <article className="tm-legal-doc">
        <h1 id="tm-legal-title" className="tm-legal-title">
          {policy.title}
        </h1>
        {policy.standfirst && <p className="tm-legal-standfirst">{policy.standfirst}</p>}
        <p className="tm-legal-updated">Last updated {policy.updated}</p>
        <div className="tm-legal-body">{renderBlocks(policy.blocks)}</div>
      </article>
    </section>
  );
}
