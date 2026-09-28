import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { policies, policyByPath } from "../../../brand/policies";
import type { PolicyBlock } from "../../../brand/policies";
import NotFound from "./NotFound";
import "../../../brand/legal.css";

/** Consecutive list items become one list; everything else renders in order. */
function renderBlocks(blocks: PolicyBlock[]) {
  const out: ReactNode[] = [];
  let items: string[] = [];
  const flush = () => {
    if (!items.length) return;
    out.push(
      <ul key={`list-${out.length}`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>,
    );
    items = [];
  };
  blocks.forEach((block, i) => {
    if (block.kind === "item") {
      items.push(block.text);
      return;
    }
    flush();
    out.push(block.kind === "heading" ? <h2 key={i}>{block.text}</h2> : <p key={i}>{block.text}</p>);
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
