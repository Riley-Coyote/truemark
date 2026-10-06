import { LIVE } from "../../platform/mode";
import { store, useResource } from "../../platform/store";
import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Grid2x2, Grid3x3, Search, X } from "lucide-react";
import { categories } from "../../data";
import { useLight } from "../../brand/light";
import { ProductCard } from "../../brand/ProductCard";
import { compoundsForBrowsing, firstOrderOffer } from "../catalog";
import type { Compound } from "../catalog";
import { useReveal } from "../motion";

type Sort = "featured" | "price-asc" | "price-desc" | "name";
type Density = "comfortable" | "dense";

const sortLabels: Record<Sort, string> = {
  featured: "Featured",
  "price-asc": "Lowest price",
  "price-desc": "Highest price",
  name: "Name",
};

function sortCompounds(list: Compound[], sort: Sort): Compound[] {
  const copy = [...list];
  if (sort === "price-asc") copy.sort((a, b) => (a.fromPrice ?? 0) - (b.fromPrice ?? 0));
  if (sort === "price-desc") copy.sort((a, b) => (b.fromPrice ?? 0) - (a.fromPrice ?? 0));
  if (sort === "name") copy.sort((a, b) => a.name.localeCompare(b.name));
  return copy;
}

/** The reader's grid size, kept on this device between visits. */
const DENSITY = "tm-catalog-density";
function savedDensity(): Density {
  try {
    return localStorage.getItem(DENSITY) === "dense" ? "dense" : "comfortable";
  } catch {
    return "comfortable";
  }
}

/**
 * The catalog, as a shop's catalog: a one-line title, the classes (a column on desktop, a row
 * of chips on a phone), search, sort and grid size, and the products straight away.
 */
export default function Catalog() {
  const offer = useResource(() => LIVE ? store.catalog.validateCode("FIRSTLOT") : Promise.resolve(firstOrderOffer), []);
  const firstOffer = LIVE ? offer.data : firstOrderOffer;
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  const shelf = useRef<HTMLElement>(null);
  useLight(shelf, { firstPass: 700, pass: 2950, repeat: false });
  const [params, setParams] = useSearchParams();
  const requestedClass = params.get("class");
  const active = categories.some((c) => c.id === requestedClass) ? requestedClass! : "all";
  const activeClass = categories.find((c) => c.id === active);
  const query = params.get("q") ?? "";
  const sort = (params.get("sort") as Sort) || "featured";
  const [density, setDensity] = useState<Density>(savedDensity);

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

  const choose = (next: Density) => {
    setDensity(next);
    try {
      localStorage.setItem(DENSITY, next);
    } catch {
      /* The size holds for this visit only. */
    }
  };

  return (
    <div className="tm-page tm-page-task" ref={root}>
      <section className="tm tm-shop" aria-labelledby="tm-catalog-title" ref={shelf}>
        <div className="tm-shop-heading">
          <div className="tm-shop-titleline">
            <h1 id="tm-catalog-title" className="tm-shop-title">
              {active === "all" || !activeClass ? "Research compounds" : activeClass.name}
            </h1>
            <p className="tm-shop-count" aria-live="polite">
              {visible.length} {visible.length === 1 ? "compound" : "compounds"}
            </p>
          </div>
          {firstOffer && (
            <Link className="tm-shop-offer" to="/access" data-review="first-order-offer">
              <span className="tm-brand-dot" aria-hidden="true" />
              <span>
                First order? {firstOffer.percent}% off with <span className="tm-offer-code">{firstOffer.code}</span>
              </span>
              <ArrowRight size={14} strokeWidth={1.6} aria-hidden="true" />
            </Link>
          )}
        </div>

        <nav className="tm-shop-classes" aria-label="Compound classes">
          <p className="tm-shop-label">Classes</p>
          <div className="tm-shop-chips" role="group" aria-label="Filter by class">
            {categories.map((c) => (
              <button key={c.id} type="button" className="tm-chip" aria-pressed={active === c.id} onClick={() => update("class", c.id)}>
                {c.short}
                <span>{c.id === "all" ? compoundsForBrowsing.length : counts.get(c.id) ?? 0}</span>
              </button>
            ))}
          </div>
          <p className="tm-shop-assurance">
            Every lot is tested independently and released with its Certificate of Analysis.
          </p>
        </nav>

        <div className="tm-shop-tools">
          <label className="tm-search">
            <Search size={16} strokeWidth={1.6} aria-hidden="true" />
            <span className="sr-only">Search compounds</span>
            <input
              type="search"
              placeholder="Search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="search"
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
          <div className="tm-density" role="group" aria-label="Grid size">
            <button type="button" aria-pressed={density === "comfortable"} aria-label="Larger photos" onClick={() => choose("comfortable")}>
              <Grid2x2 size={16} strokeWidth={1.6} aria-hidden="true" />
            </button>
            <button type="button" aria-pressed={density === "dense"} aria-label="More per row" onClick={() => choose("dense")}>
              <Grid3x3 size={16} strokeWidth={1.6} aria-hidden="true" />
            </button>
          </div>
        </div>

        {visible.length > 0 ? (
          <div className={`tm-grid tm-shop-grid${density === "dense" ? " is-dense" : ""}`} role="list" aria-label="Compounds" data-review="product-tags">
            {visible.map((compound) => (
              <ProductCard key={compound.key} compound={compound} listItem compact={density === "dense"} />
            ))}
          </div>
        ) : (
          <div className="tm-empty tm-shop-empty">
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
