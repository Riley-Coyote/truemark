import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  PageHeader,
  Segmented,
  formatDate,
} from "../../app-kit";
import { LIVE } from "../../platform/mode";
import {
  DeviceNote,
  ExportButton,
  HelpCard,
  Kpis,
  Table,
  isObject,
  useBusiness,
  useDeviceState,
} from "./shared";

type Review = {
  id: string;
  productId: string;
  author: string;
  rating: number;
  body: string;
  at: string;
  state: "Pending" | "Approved" | "Hidden";
  note: string;
};
const reviewsValid = (v: unknown): v is Review[] =>
  Array.isArray(v) &&
  v.every(
    (r) =>
      isObject(r) &&
      ["id", "productId", "author", "body", "at", "note"].every(
        (k) => typeof r[k] === "string",
      ) &&
      typeof r.rating === "number" &&
      ["Pending", "Approved", "Hidden"].includes(String(r.state)),
  );

export function Reviews() {
  const data = useBusiness();
  const initial: Review[] = LIVE
    ? []
    : data.products.slice(0, 5).map((p, i) => ({
        id: `sample-review-${p.id}`,
        productId: p.id,
        author: `Sample research purchaser ${i + 1}`,
        rating: i % 2 ? 4 : 5,
        body: [
          "The lot information was easy to locate and the package was clearly labeled.",
          "The research account process was clear. I would appreciate a more prominent tracking link.",
          "The documentation and product identifiers were straightforward to review.",
        ][i % 3],
        at: data.asOf,
        state: i === 0 ? "Approved" : "Pending",
        note: "",
      }));
  const [reviews, setReviews, warning] = useDeviceState<Review[]>(
    "review-moderation",
    initial,
    reviewsValid,
  );
  const [filter, setFilter] = useState("Pending"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Review | null>(null),
    [message, setMessage] = useState("");
  const catalog = new Map(data.products.map((p) => [p.id, p]));
  const rows = reviews.filter(
    (r) =>
      (filter === "all" || r.state === filter) &&
      `${r.author} ${r.body} ${catalog.get(r.productId)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function moderate(state: Review["state"]) {
    if (!selected) return;
    setReviews((r) =>
      r.map((x) => (x.id === selected.id ? { ...selected, state } : x)),
    );
    setSelected(null);
    setMessage(
      `Review marked ${state.toLowerCase()} in this device’s moderation plan. Nothing was published.`,
    );
  }
  return (
    <div className="bi-page">
      <PageHeader description="Review service and documentation feedback before publication." />
      <p className="bi-source">
        {LIVE
          ? "Shared review source not connected"
          : "Fictional review moderation sample"}{" "}
        · Moderation decisions are local · No public reviews are changed
      </p>
      <Kpis
        items={[
          {
            label: "Pending in this plan",
            value: reviews.filter((r) => r.state === "Pending").length,
          },
          {
            label: "Approved in this plan",
            value: reviews.filter((r) => r.state === "Approved").length,
          },
          {
            label: "Hidden in this plan",
            value: reviews.filter((r) => r.state === "Hidden").length,
          },
        ]}
      />
      {LIVE && !reviews.length ? (
        <EmptyState
          title="Connect the shared review source."
          note="This workspace supports a review queue, moderation notes and exports. Production submissions and publication require shared storage and a publication service."
        />
      ) : (
        <Card
          title="Review queue"
          meta={
            <ExportButton
              name="review-moderation-plan"
              headers={[
                "Review ID",
                "Product",
                "Author",
                "Rating",
                "Review",
                "State",
                "Moderation note",
              ]}
              rows={rows.map((r) => [
                r.id,
                catalog.get(r.productId)?.name ?? r.productId,
                r.author,
                r.rating,
                r.body,
                r.state,
                r.note,
              ])}
            />
          }
        >
          <div className="bi-toolbar">
            <Segmented
              label="Moderation state"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "Pending", label: "Pending" },
                { value: "Approved", label: "Approved" },
                { value: "Hidden", label: "Hidden" },
                { value: "all", label: "All" },
              ]}
            />
            <label className="bi-field">
              Find a review
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Product or review text"
              />
            </label>
          </div>
          <Table
            label="Local review moderation queue"
            rows={rows}
            rowKey={(r) => r.id}
            onSelect={setSelected}
            columns={[
              {
                key: "product",
                label: "Product",
                get: (r) => catalog.get(r.productId)?.name ?? r.productId,
              },
              {
                key: "review",
                label: "Feedback",
                get: (r) => (
                  <>
                    {r.body}
                    <span className="bi-cell-note">{r.author}</span>
                  </>
                ),
              },
              {
                key: "rating",
                label: "Rating",
                get: (r) => `${r.rating} / 5`,
                numeric: true,
              },
              { key: "state", label: "State", get: (r) => r.state },
            ]}
          />
        </Card>
      )}
      <DeviceNote warning={warning} />
      <HelpCard title="Moderation review">
        <p>
          Check authenticity, privacy, relevance and research-use language
          before publishing. This sample feedback discusses service and
          documentation. Approval in this local plan does not publish a
          testimonial or establish product efficacy.
        </p>
      </HelpCard>
      {selected && (
        <Drawer
          title="Review feedback"
          eyebrow={catalog.get(selected.productId)?.name ?? selected.productId}
          onClose={() => setSelected(null)}
          footer={
            <>
              <Button onClick={() => moderate("Hidden")}>Hide in plan</Button>
              <Button variant="primary" onClick={() => moderate("Approved")}>
                Approve in plan
              </Button>
            </>
          }
        >
          <p>{selected.body}</p>
          <p className="bi-small">
            {selected.author} · {selected.rating} / 5 ·{" "}
            {formatDate(selected.at)}
          </p>
          <label className="bi-field">
            Moderation note
            <textarea
              rows={5}
              maxLength={2000}
              value={selected.note}
              onChange={(e) =>
                setSelected({ ...selected, note: e.target.value })
              }
            />
          </label>
          <p className="bi-small">
            Decision is saved on this device. No public content is changed.
          </p>
        </Drawer>
      )}
      <p className="bi-small" role="status">
        {message}
      </p>
    </div>
  );
}

type MetaDraft = { title: string; description: string };
const metaValid = (v: unknown): v is Record<string, MetaDraft> =>
  isObject(v) &&
  Object.values(v).every(
    (m) =>
      isObject(m) &&
      typeof m.title === "string" &&
      typeof m.description === "string",
  );

export function SearchReadiness() {
  const data = useBusiness();
  const [drafts, setDrafts, warning] = useDeviceState<
    Record<string, MetaDraft>
  >("search-metadata", {}, metaValid);
  const [query, setQuery] = useState(""),
    [issuesOnly, setIssuesOnly] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [draft, setDraft] = useState<MetaDraft>({ title: "", description: "" });
  const rows = data.products
    .filter((p) => p.active !== false)
    .map((p) => {
      const issues = [
        ...(!p.image ? ["Image missing"] : []),
        ...(p.price == null || p.price <= 0 ? ["Price needs review"] : []),
        ...(!p.description?.trim() ? ["Description missing"] : []),
      ];
      return { ...p, issues };
    });
  const shown = rows.filter(
    (p) =>
      `${p.name} ${p.size} ${p.id}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!issuesOnly || p.issues.length),
  );
  const product = rows.find((p) => p.id === selected);
  const existing = (id: string): MetaDraft => {
    const p = rows.find((p) => p.id === id)!;
    return (
      drafts[id] ?? {
        title: `${p.name} ${p.size} | TrueMark BioLabs`,
        description: p.description ?? "",
      }
    );
  };
  return (
    <div className="bi-page">
      <PageHeader description="Check catalog content and prepare search snippets for the eventual production domain." />
      <p className="bi-source">
        Content readiness · Search rankings, indexing and Core Web Vitals are
        not connected
      </p>
      <Kpis
        items={[
          { label: "Active product pages", value: rows.length },
          {
            label: "Content checks to review",
            value: rows.filter((p) => p.issues.length).length,
          },
          {
            label: "Metadata drafts",
            value: Object.keys(drafts).filter((id) =>
              rows.some((p) => p.id === id),
            ).length,
            note: "Saved locally, not published",
          },
          {
            label: "Search performance",
            value: "Not connected",
            note: "Owner-verified production property needed",
          },
        ]}
      />
      <Card
        title="Product content checks"
        meta={
          <ExportButton
            name="search-readiness-plan"
            headers={[
              "Product ID",
              "Name",
              "Size",
              "Content checks",
              "Draft title",
              "Draft description",
            ]}
            rows={shown.map((p) => {
              const m = existing(p.id);
              return [
                p.id,
                p.name,
                p.size,
                p.issues.join("; ") || "Checks complete",
                m.title,
                m.description,
              ];
            })}
          />
        }
      >
        <div className="bi-toolbar">
          <label className="bi-field">
            Find a product
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label className="bi-check">
            <input
              type="checkbox"
              checked={issuesOnly}
              onChange={(e) => setIssuesOnly(e.target.checked)}
            />{" "}
            Content issues only
          </label>
        </div>
        <Table
          label="Catalog content readiness"
          rows={shown}
          rowKey={(p) => p.id}
          onSelect={(p) => {
            setSelected(p.id);
            setDraft(existing(p.id));
          }}
          columns={[
            {
              key: "name",
              label: "Product page",
              get: (p) => (
                <>
                  {p.name}
                  <span className="bi-cell-note">
                    {p.size} · /product/{p.id}
                  </span>
                </>
              ),
            },
            {
              key: "checks",
              label: "Content checks",
              get: (p) => p.issues.join(" · ") || "Basic checks complete",
            },
            {
              key: "draft",
              label: "Search snippet",
              get: (p) =>
                drafts[p.id] ? "Local draft saved" : "No local override",
            },
          ]}
        />
      </Card>
      <div className="bi-two">
        <HelpCard title="Before indexing the real store">
          <p>
            The public GitHub review site is intentionally a sample preview.
            Domain ownership, production canonicals, indexing policy and an
            owner-verified Search Console property need to be confirmed before
            search performance is reported.
          </p>
          <Link className="bi-link" to="/admin/integrations">
            Review search integration requirements ↗
          </Link>
        </HelpCard>
        <HelpCard title="Improve the source content">
          <p>
            These checks inspect existing product fields, not a remote crawler.
            Edit catalog records for shared product changes. Snippet drafts
            below are a planning tool and do not alter production metadata.
          </p>
          <Link className="bi-link" to="/admin/products">
            Open product records ↗
          </Link>
          <Link className="bi-link" to="/admin/journal">
            Review journal content ↗
          </Link>
        </HelpCard>
      </div>
      <DeviceNote warning={warning} />
      {product && (
        <Drawer
          title="Search snippet draft"
          eyebrow={`${product.name} · ${product.size}`}
          onClose={() => setSelected(null)}
          footer={
            <Button
              variant="primary"
              disabled={!draft.title.trim()}
              onClick={() => {
                setDrafts((d) => ({ ...d, [product.id]: draft }));
                setSelected(null);
              }}
            >
              Save snippet draft
            </Button>
          }
        >
          <div className="bi-form">
            <label className="bi-field">
              Title draft · {draft.title.length} characters
              <input
                maxLength={200}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label className="bi-field">
              Description draft · {draft.description.length} characters
              <textarea
                rows={5}
                maxLength={1000}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <div className="bi-snippet">
              <span>Production domain · /product/{product.id}</span>
              <h3>{draft.title}</h3>
              <p>
                {draft.description ||
                  "Write a concise, accurate description of this research product and its documentation."}
              </p>
            </div>
            <p className="bi-small">
              Illustrative snippet. Search engines choose their own display and
              may rewrite titles or descriptions. No search result or indexing
              change is promised.
            </p>
            <DeviceNote />
          </div>
        </Drawer>
      )}
    </div>
  );
}
