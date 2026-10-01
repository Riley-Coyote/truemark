import { LIVE } from "../platform/mode";
import { ProductEditor, ClassesEditor } from "./Commerce";
import { compareNullable, sumTracked } from "../platform/inventory";
import { useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronsUpDown } from "lucide-react";
import {
  Button,
  DataTable,
  Dot,
  Drawer,
  EmptyState,
  Facts,
  MoneyFigure,
  PageHeader,
  Section,
  Select,
  Skeleton,
  StatusChip,
  formatCount,
  formatMoney,
  plural,
} from "../app-kit";
import type { Column, MobileRole } from "../app-kit";
import { categoryName, products } from "../data";
import type { Product, Category } from "../data";
import { store, useResource } from "../platform/store";
import type { Lot, LotStatus } from "../platform/types";
import { productCutout } from "../shop/catalog";
import { Mark, keepTogether } from "./fields";
import { HOME } from "./nav";
import { DrawerLoading } from "./OrderDrawer";
import { matches, useQueryParam, useSearchQuery } from "./state";

/** Lots whose units count as on hand. Rejected and archived lots do not. */
const ON_HAND: LotStatus[] = ["quarantine", "testing", "released"];
const LOT_ORDER: LotStatus[] = ["quarantine", "testing", "released", "rejected", "archived"];
const position = new Map(products.map((p, i) => [p.id, i]));

type Row = {
  product: Product;
  /** The current catalog price. */
  price: number | undefined;
  /** The record of the lot new orders are assigned. */
  current: Lot | undefined;
  /** Every lot of this product, the current one first. */
  lots: Lot[];
  /** The lots that count toward units on hand. */
  counted: Lot[];
  onHand: number | null;
};

function buildRows(catalog: Product[], lots: Lot[]): Row[] {
  return catalog.map((product) => {
    const own = lots
      .filter((lot) => lot.productId === product.id)
      .sort((a, b) => Number(b.lot === product.lot) - Number(a.lot === product.lot) || compareNullable(a.receivedAt, b.receivedAt, "desc"));
    const counted = own.filter((lot) => ON_HAND.includes(lot.status));
    return {
      product,
      price: product.price,
      current: own.find((lot) => lot.lot === product.lot),
      lots: own,
      counted,
      onHand: LIVE ? product.stock ?? null : sumTracked(counted.map((lot) => lot.units)),
    };
  });
}

/* ---------- The grouped table ---------- */

type SortKey = "compound" | "size" | "price" | "lot" | "units" | "status";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const COLUMNS: { key: SortKey; header: string; width: string; mobile: MobileRole; end?: boolean; first: "asc" | "desc" }[] = [
  { key: "compound", header: "Compound", width: "25%", mobile: "primary", first: "asc" },
  { key: "size", header: "Size", width: "14%", mobile: "hidden", first: "asc" },
  { key: "price", header: "Price", width: "12%", mobile: "aside", end: true, first: "desc" },
  { key: "lot", header: "Current lot", width: "21%", mobile: "secondary", first: "asc" },
  { key: "units", header: LIVE ? "Stock" : "On hand", width: "12%", mobile: "meta", end: true, first: "desc" },
  { key: "status", header: "Lot status", width: "16%", mobile: "meta", first: "asc" },
];

const sizeValue = (size: string) => Number.parseFloat(size) || 0;
const byName = (a: Row, b: Row) => a.product.name.localeCompare(b.product.name);
const bySize = (a: Row, b: Row) => (position.get(a.product.id) ?? 0) - (position.get(b.product.id) ?? 0);

const VALUES: Record<Exclude<SortKey, "compound">, (row: Row) => number | string | null> = {
  size: (row) => sizeValue(row.product.size),
  price: (row) => row.price ?? -1,
  lot: (row) => row.product.lot,
  units: (row) => row.onHand,
  status: (row) => (row.current ? LOT_ORDER.indexOf(row.current.status) : LOT_ORDER.length),
};

/** Sizes of one compound stay together, smallest first, whichever way the compounds sort. */
function sortRows(rows: Row[], sort: Sort): Row[] {
  const factor = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sort.key === "compound") return byName(a, b) * factor || bySize(a, b);
    const va = VALUES[sort.key](a);
    const vb = VALUES[sort.key](b);
    return compareNullable(va, vb, sort.dir) || byName(a, b) || bySize(a, b);
  });
}

const SKELETON_WIDTHS = ["72%", "54%", "80%", "46%", "64%", "58%", "40%"];

/**
 * The kit's DataTable has no nested rows, so this table composes the kit's
 * table classes directly: sizes of one compound read as one block, with the
 * compound named once and no rule between its sizes.
 */
function ProductTable({
  rows,
  loading,
  error,
  onRetry,
  onOpen,
  activeId,
  empty,
}: {
  rows: Row[] | undefined;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onOpen: (row: Row) => void;
  activeId: string | null;
  empty: { title: string; note?: ReactNode };
}) {
  const [sort, setSort] = useState<Sort>({ key: "compound", dir: "asc" });
  const sorted = useMemo(() => (rows ? sortRows(rows, sort) : []), [rows, sort]);
  const span = COLUMNS.length;

  function toggle(key: SortKey, first: "asc" | "desc") {
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: first }));
  }

  let body: ReactNode;
  if (loading && !rows) {
    body = (
      <tbody aria-hidden="true">
        {Array.from({ length: 12 }, (_, r) => (
          <tr key={r} className="kit-skeleton-row">
            {COLUMNS.map((column, c) => (
              <td key={column.key} className={column.end ? "is-end" : undefined} data-mobile={column.mobile}>
                <Skeleton width={SKELETON_WIDTHS[(r + c) % SKELETON_WIDTHS.length]} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    );
  } else if (error) {
    body = (
      <tbody>
        <tr>
          <td className="kit-empty-cell" colSpan={span} data-mobile="secondary">
            <EmptyState compact title="Products could not be loaded." note={error.message} action={<Button onClick={onRetry}>Try again</Button>} />
          </td>
        </tr>
      </tbody>
    );
  } else if (!sorted.length) {
    body = (
      <tbody>
        <tr>
          <td className="kit-empty-cell" colSpan={span} data-mobile="secondary">
            <EmptyState compact title={empty.title} note={empty.note} />
          </td>
        </tr>
      </tbody>
    );
  } else {
    body = (
      <tbody>
        {sorted.map((row, i) => (
          <ProductRow
            key={row.product.id}
            row={row}
            continued={sorted[i - 1]?.product.name === row.product.name}
            continues={sorted[i + 1]?.product.name === row.product.name}
            active={activeId === row.product.id}
            onOpen={onOpen}
          />
        ))}
      </tbody>
    );
  }

  return (
    <div className="kit-table-wrap">
      <table className="kit-table cc-product-table" aria-busy={loading || undefined}>
        <caption className="kit-sr">Products, grouped by compound. Select a row to open its details.</caption>
        <colgroup>
          {COLUMNS.map((column) => (
            <col key={column.key} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const active = sort.key === column.key ? sort.dir : null;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={column.end ? "is-end" : undefined}
                  aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}
                >
                  <button type="button" className="kit-sort" onClick={() => toggle(column.key, column.first)}>
                    {column.header}
                    {active === "asc" ? (
                      <ArrowUp aria-hidden="true" strokeWidth={1.8} />
                    ) : active === "desc" ? (
                      <ArrowDown aria-hidden="true" strokeWidth={1.8} />
                    ) : (
                      <ChevronsUpDown aria-hidden="true" strokeWidth={1.8} />
                    )}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        {body}
      </table>
    </div>
  );
}

function ProductRow({
  row,
  continued,
  continues,
  active,
  onOpen,
}: {
  row: Row;
  continued: boolean;
  continues: boolean;
  active: boolean;
  onOpen: (row: Row) => void;
}) {
  const { product } = row;
  return (
    <tr
      className="kit-row"
      tabIndex={0}
      data-active={active ? "true" : undefined}
      data-continued={continued ? "true" : undefined}
      data-continues={continues ? "true" : undefined}
      onClick={() => onOpen(row)}
      onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(row);
        }
      }}
    >
      <td data-mobile="primary">
        <span className="kit-cell-name">
          <Dot colour={product.color} />
          <span className="cc-compound-name">
            {product.name}
            <span className="kit-cell-sub cc-size-sub">{product.size}</span>
          </span>
          {product.active === false && <Mark>Inactive</Mark>}
        </span>
      </td>
      <td data-mobile="hidden">{product.size}</td>
      <td className="is-end" data-mobile="aside">
        {row.price !== undefined ? formatMoney(row.price) : <span className="kit-quiet">Not priced</span>}
      </td>
      <td data-mobile="secondary">
        <span className="kit-mono">{product.lot}</span>
      </td>
      <td className="is-end" data-mobile="meta">
        {row.onHand === null ? <span className="kit-note">Not tracked</span> : <>
          {formatCount(row.onHand)}
          <span className="cc-unit"> on hand</span>
        </>}
      </td>
      <td data-mobile="meta">
        {row.current ? <StatusChip status={row.current.status} /> : <span className="kit-quiet">No lot on file</span>}
      </td>
    </tr>
  );
}

/* ---------- The page ---------- */

export default function Products() {
  const lots = useResource(() => store.lots.list(), []);
  const catalog = useResource(() => store.catalog.products(true));
  const classes = useResource(() => store.catalog.categories());
  const reload = () => { catalog.reload(); lots.reload(); classes.reload(); };
  const query = useSearchQuery();
  const [category, setCategory] = useState("all");
  const [openId, setOpenId] = useQueryParam("product");

  const all = useMemo(() => (lots.data && catalog.data ? buildRows(catalog.data, lots.data) : undefined), [lots.data, catalog.data]);
  const rows = useMemo(
    () =>
      all?.filter(
        (row) =>
          (category === "all" || row.product.category === category) &&
          matches(query, row.product.name, row.product.size, row.product.lot, categoryName(row.product.category)),
      ),
    [all, category, query],
  );
  const onHand = sumTracked((all ?? []).map((row) => row.onHand));
  const compoundCount = new Set((catalog.data ?? []).map((p) => p.name)).size;

  const options = [
    { value: "all", label: `All categories (${catalog.data?.length ?? 0})` },
    ...(classes.data ?? [])
      .filter((c) => c.id !== "all")
      .map((c) => ({ id: c.id, name: c.name, count: (catalog.data ?? []).filter((p) => p.category === c.id).length }))
      .filter((c) => c.count > 0)
      .map((c) => ({ value: c.id, label: `${c.name} (${c.count})` })),
  ];

  return (
    <div className="kit-grid">
      <PageHeader
        description={LIVE ? "Everything the shop sells, grouped by compound. Stock is the quantity available to order; blank means not tracked." : "Everything the shop sells, grouped by compound. The current lot is the one new orders are assigned; units on hand count every lot in quarantine, testing or released."}
        meta={
          <>
            {all && <span>{`${plural(catalog.data?.length ?? 0, "product")} · ${plural(compoundCount, "compound")} · ${onHand === null ? "Not tracked" : `${formatCount(onHand)} units on hand`}`}</span>}
            {!LIVE && <span className="kit-note">Saving works in the live platform.</span>}
          </>
        }
      />
      <div className="kit-toolbar">
        <Select label="Which category to show" value={category} onChange={setCategory} options={options} />
        {all && (query || category !== "all") && (
          <p className="cc-result-count" aria-live="polite">
            {plural(rows?.length ?? 0, "result")}
          </p>
        )}
      </div>
      <div className="kit-card kit-span-12">
        <ProductTable
          rows={rows}
          loading={lots.loading || catalog.loading || classes.loading}
          error={lots.error ?? catalog.error ?? classes.error}
          onRetry={reload}
          onOpen={(row) => setOpenId(row.product.id)}
          activeId={openId}
          empty={{
            title: query ? "No products match this search." : "No products in this category.",
            note: query ? "Search looks at compounds, sizes, categories and lot numbers." : undefined,
          }}
        />
      </div>
      {classes.data && <ClassesEditor classes={classes.data} onSaved={classes.reload} />}
      {openId && (
        <ProductDrawer
          key={openId}
          productId={openId}
          classes={classes.data ?? []}
          row={all?.find((row) => row.product.id === openId)}
          loading={!all && !lots.error && !catalog.error}
          failed={lots.error ?? catalog.error}
          onRetry={reload}
          onClose={() => setOpenId(null, { replace: true })}
        />
      )}
    </div>
  );
}

/* ---------- The drawer ---------- */

const lotColumns = (currentLot: string): Column<Lot>[] => [
  {
    key: "lot",
    header: "Lot",
    width: "52%",
    mobile: "primary",
    cell: (lot) => (
      <span className="cc-lot-cell">
        <span className="kit-mono">{lot.lot}</span>
        {lot.lot === currentLot && <Mark>Current</Mark>}
        {lot.sample && <Mark>Sample</Mark>}
      </span>
    ),
  },
  { key: "status", header: "Status", width: "30%", mobile: "secondary", cell: (lot) => <StatusChip status={lot.status} /> },
  {
    key: "units",
    header: "Units",
    width: "18%",
    align: "end",
    mobile: "aside",
    cell: (lot) =>
      lot.units === null ? <span className="kit-note">Not tracked</span> : ON_HAND.includes(lot.status) ? (
        <>
          {formatCount(lot.units)}
          <span className="cc-unit"> units</span>
        </>
      ) : (
        <span className="kit-quiet">
          {formatCount(lot.units)}
          <span className="cc-unit"> units</span>
          <span className="kit-sr">, not counted</span>
        </span>
      ),
  },
];

function ProductDrawer({
  productId,
  classes,
  row,
  loading,
  failed,
  onRetry,
  onClose,
}: {
  productId: string;
  classes: Category[];
  row: Row | undefined;
  loading: boolean;
  failed: Error | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const columns = useMemo(() => lotColumns(row?.product.lot ?? ""), [row?.product.lot]);

  if (!row) {
    return (
      <Drawer title="Product" eyebrow="Product" onClose={onClose}>
        {loading ? (
          <DrawerLoading />
        ) : failed ? (
          <EmptyState compact title="This product could not be loaded." note={failed.message} action={<Button onClick={onRetry}>Try again</Button>} />
        ) : (
          <EmptyState
            compact
            title="No product matches this link."
            note={
              <>
                Nothing in the catalog is called <span className="kit-mono">{productId}</span>.
              </>
            }
          />
        )}
      </Drawer>
    );
  }

  const { product, current } = row;
  const tracked = row.counted.filter((lot) => lot.units !== null);
  const lotUnits = sumTracked(row.counted.map((lot) => lot.units));
  const sum = lotUnits === null ? <span className="kit-note">Not tracked</span> : keepTogether(
    tracked.length > 1
      ? `${tracked.map((lot) => formatCount(lot.units!)).join(" + ")} = ${formatCount(lotUnits!)} units`
      : `${formatCount(lotUnits!)} units`,
  );

  return (
    <Drawer
      title={product.name}
      eyebrow="Product"
      subtitle={`${product.size} · ${product.form} · ${categoryName(product.category)}`}
      tags={
        <>
          {current ? <StatusChip status={current.status} label={`Current lot ${current.status}`} /> : <StatusChip status="none" label="No current lot" />}
          {product.active === false && <Mark>Inactive</Mark>}
        </>
      }
      onClose={onClose}
    >
      <div className="cc-product-head">
        <span className="cc-vial" aria-hidden="true">
          <img src={productCutout(product, "sm")} alt="" />
        </span>
        <dl className="cc-figures">
          <div>
            <dt className="kit-label">Price</dt>
            <dd className="kit-figure">{row.price !== undefined ? <MoneyFigure value={row.price} /> : "None"}</dd>
          </div>
          <div>
            <dt className="kit-label">{LIVE ? "Available stock" : "Units on hand"}</dt>
            <dd className="kit-figure">{row.onHand === null ? <span className="kit-note">Not tracked</span> : formatCount(row.onHand)}</dd>
          </div>
        </dl>
      </div>

      <Section title="Edit product">
        <ProductEditor product={product} classes={classes} onSaved={onRetry} />
      </Section>

      <Section title="Record">
        <Facts
          items={[
            {
              label: "Compound",
              value: (
                <span className="cc-dot-name">
                  <Dot colour={product.color} />
                  {product.name}
                </span>
              ),
            },
            { label: "Size", value: product.size },
            { label: "Form", value: product.form },
            { label: "Category", value: categoryName(product.category) },
            {
              label: "Current lot",
              value: (
                <Link className="cc-inline-link" to={`${HOME}/lots?lot=${encodeURIComponent(product.lot)}`}>
                  <span className="kit-mono">{product.lot}</span>
                </Link>
              ),
            },
          ]}
        />
      </Section>

      <Section title="Lots">
        <div className="cc-drawer-table">
          <DataTable
            caption={`Lots of ${product.name} ${product.size}`}
            columns={columns}
            rows={row.lots}
            rowKey={(lot) => lot.lot}
            onRowClick={(lot) => navigate(`${HOME}/lots?lot=${encodeURIComponent(lot.lot)}`)}
            stickyHeader={false}
            empty={{ title: "No lots on file." }}
          />
        </div>
        <p className="cc-footnote">{LIVE ? "Lot counts are separate from available product stock" : "On hand counts lots in quarantine, testing or released"}: {sum}.</p>
      </Section>

      <Section title="In the shop">
        <Link className="cc-public-link" to={`/product/${product.id}`} target="_blank" rel="noreferrer">
          <span className="kit-mono">/product/{product.id}</span>
          <ArrowUpRight aria-hidden="true" strokeWidth={1.6} />
          <span className="kit-sr">, opens in a new tab</span>
        </Link>
      </Section>
    </Drawer>
  );
}
