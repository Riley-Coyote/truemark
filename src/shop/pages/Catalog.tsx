import { useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Search, X } from "lucide-react";
import { categories } from "../../data";
import { useLight } from "../../brand/light";
import { ProductCard } from "../../brand/ProductCard";
import { compoundsForBrowsing, firstOrderOffer } from "../catalog";
import type { Compound } from "../catalog";
import { useReveal } from "../motion";

type Sort = "featured" | "price-asc" | "price-desc" | "name";

const sortLabels: Record<Sort, string> = {
  featured: "Featured",
  "price-asc": "Price, low to high",
  "price-desc": "Price, high to low",
  name: "Name",
};

function sortCompounds(list: Compound[], sort: Sort): Compound[] {
  const copy = [...list];
  if (sort === "price-asc") copy.sort((a, b) => (a.fromPrice ?? 0) - (b.fromPrice ?? 0));
  if (sort === "price-desc") copy.sort((a, b) => (b.fromPrice ?? 0) - (a.fromPrice ?? 0));
  if (sort === "name") copy.sort((a, b) => a.name.localeCompare(b.name));
  return copy;
}

export default function Catalog() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  const grid = useRef<HTMLElement>(null);
  useLight(grid, { firstPass: 700, pass: 2950, repeat: false });
  const [params, setParams] = useSearchParams();
  const requestedClass = params.get("class");
  const active = categories.some((c) => c.id === requestedClass) ? requestedClass! : "all";
  const query = params.get("q") ?? "";
  const sort = (params.get("sort") as Sort) || "featured";

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of compoundsForBrowsing) {
      map.set(c.lead.category, (map.get(c.lead.category) ?? 0) + 1);
    }
    return map;
  }, [compoundsForBrowsing]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = compoundsForBrowsing.filter(
      (c) =>
        (active === "all" || c.lead.category === active) &&
        (!q || `${c.name} ${c.variants.map((v) => v.size).join(" ")}`.toLowerCase().includes(q)),
    );
    return sortCompounds(filtered, sort);
  }, [active, query, sort, compoundsForBrowsing]);

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === "" || (key === "class" && value === "all") || (key === "sort" && value === "featured")) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setParams(next, { replace: true, preventScrollReset: true });
  };

  return (
    <div className="tm-page" ref={root}>
      <section className="tm tm-catalog-head" aria-labelledby="tm-catalog-title">
        <div className="tm-catalog-title">
          <p className="tm-eyebrow">Catalog</p>
          <h1 id="tm-catalog-title" className="tm-display">
            Research compounds
          </h1>
        </div>
        <div className="tm-catalog-note">
          <p className="tm-section-note">
            Every compound ships as lyophilized powder with lot-level
            traceability. Each lot is independently tested and released with a
            Certificate of Analysis.
          </p>
          <Link className="tm-offer" to="/access" data-review="first-order-offer">
            <span className="tm-brand-dot" aria-hidden="true" />
            First order? Take {firstOrderOffer.percent}% off with code{" "}
            <span className="tm-offer-code">{firstOrderOffer.code}</span>
            <ArrowRight size={14} strokeWidth={1.6} aria-hidden="true" />
          </Link>
        </div>
        <div className="tm-filterbar">
          <div className="tm-chips" role="group" aria-label="Filter by class">
            {categories.map((c) => (
                <button
                  key={c.id}
                  className="tm-chip"
                  aria-pressed={active === c.id}
                  onClick={() => update("class", c.id)}
                >
                  {c.short}
                  <span>{c.id === "all" ? compoundsForBrowsing.length : counts.get(c.id) ?? 0}</span>
                </button>
              ))}
          </div>
        </div>
        <div className="tm-filter-meta">
          <p className="tm-result-count" aria-live="polite">
            {visible.length} {visible.length === 1 ? "compound" : "compounds"}
          </p>
          <div className="tm-filter-tools">
            <label className="tm-search">
              <Search size={16} strokeWidth={1.6} aria-hidden="true" />
              <span className="sr-only">Search compounds</span>
              <input
                type="search"
                placeholder="Search compounds"
                value={query}
                onChange={(e) => update("q", e.target.value)}
              />
              {query && (
                <button type="button" aria-label="Clear search" onClick={() => update("q", null)}>
                  <X size={14} strokeWidth={1.8} />
                </button>
              )}
            </label>
            <label className="tm-select">
              <span className="sr-only">Sort</span>
              <select value={sort} onChange={(e) => update("sort", e.target.value)}>
                {(Object.keys(sortLabels) as Sort[]).map((key) => (
                  <option key={key} value={key}>
                    {sortLabels[key]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="tm tm-catalog-grid" aria-label="Compounds" ref={grid}>
        {visible.length > 0 ? (
          <div className="tm-grid" role="list" data-review="product-tags">
            {visible.map((compound) => (
              <ProductCard key={compound.key} compound={compound} listItem />
            ))}
          </div>
        ) : (
          <div className="tm-empty">
            <p className="tm-empty-title">Nothing matches “{query}”.</p>
            <p className="tm-section-note">Try a compound name, or clear the filters to see the full collection.</p>
            <button
              className="tm-button tm-button-primary"
              onClick={() => setParams(new URLSearchParams(), { replace: true, preventScrollReset: true })}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

      <section className="tm tm-night tm-band" aria-label="Verify a vial">
        <div className="tm-band-copy" data-reveal>
          <h2 className="tm-heading">Have a vial in hand?</h2>
        </div>
        <div className="tm-band-action" data-reveal>
          <p className="tm-section-note">
            Enter its lot number to read the Certificate of Analysis for that
            batch.
          </p>
          <Link className="tm-textlink" to="/verify">
            Verify a lot <ArrowRight size={16} strokeWidth={1.6} />
          </Link>
        </div>
      </section>
    </div>
  );
}
