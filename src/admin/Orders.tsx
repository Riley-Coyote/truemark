import { useMemo } from "react";
import { X } from "lucide-react";
import { DataTable, PageHeader, Segmented, Select, formatDate, formatMoney, plural, statusLabel } from "../app-kit";
import type { Column, SegmentOption } from "../app-kit";
import { paymentOf } from "../brand/Tracker";
import { store, useResource } from "../platform/store";
import { worldNow } from "../platform/storage";
import type { Buyer, Order, OrderStatus, Partner } from "../platform/types";
import { productById } from "../shop/catalog";
import { useWorldNow } from "./alerts";
import { placedWithin, units } from "./metrics";
import { OrderDrawer, OrderStatusChip, PaymentChip } from "./OrderDrawer";
import { matches, useQueryParam, useSearchQuery } from "./state";

const FLOW: OrderStatus[] = ["placed", "paid", "packed", "shipped", "delivered", "cancelled", "refunded"];

/** A partner's code as a quiet chip; the partner's name is its title and is read with it. A direct order shows a dash. */
function Via({ order, partner }: { order: Order; partner: Partner | undefined }) {
  if (!order.discount?.partnerId) {
    return (
      <>
        <span className="cc-via-none" aria-hidden="true">
          —
        </span>
        <span className="kit-sr">Direct</span>
      </>
    );
  }
  return (
    <span className="cc-via" title={partner?.name}>
      <span className="kit-mono">{order.discount.code}</span>
      {partner && <span className="kit-sr">, {partner.name}</span>}
    </span>
  );
}

/**
 * The orders table's columns. The compact table (the Overview's recent orders, a customer's
 * orders) is a fixed "most recent" list: it does not sort, and leaves out buyer, items,
 * payment and via. `now` decides which open orders are past their stage's limit.
 */
export function orderColumns(
  buyerById: Map<string, Buyer>,
  compact = false,
  { partnerById, now }: { partnerById?: Map<string, Partner>; now?: string } = {},
): Column<Order>[] {
  const buyerName = (o: Order) => buyerById.get(o.buyerId)?.name ?? o.address.attention;
  const institution = (o: Order) => buyerById.get(o.buyerId)?.institution ?? o.address.institution;
  const partnerOf = (o: Order) => (o.discount?.partnerId ? partnerById?.get(o.discount.partnerId) : undefined);
  const columns: Column<Order>[] = [
    {
      key: "number",
      header: "Order",
      width: compact ? "16%" : "9.5%",
      mobile: "primary",
      sortValue: (o) => o.number,
      sortFirst: "desc",
      cell: (o) => <span className="kit-mono">{o.number}</span>,
    },
    {
      key: "date",
      header: "Placed",
      width: compact ? "17%" : "10%",
      sortValue: (o) => o.createdAt,
      sortFirst: "desc",
      cell: (o) => formatDate(o.createdAt),
    },
    {
      key: "buyer",
      header: "Buyer",
      width: "12%",
      mobile: "hidden",
      sortValue: buyerName,
      cell: buyerName,
    },
    {
      key: "institution",
      header: "Institution",
      width: compact ? "30%" : "16%",
      mobile: "secondary",
      sortValue: institution,
      cell: institution,
    },
    {
      key: "via",
      header: "Via",
      width: "11%",
      mobile: "meta",
      // Partner orders by code, then direct orders.
      sortValue: (o) => (o.discount?.partnerId ? `0${o.discount.code}` : "1"),
      cell: (o) => <Via order={o} partner={partnerOf(o)} />,
    },
    {
      key: "items",
      header: "Items",
      width: "6.5%",
      align: "end",
      sortValue: units,
      sortFirst: "desc",
      cell: (o) => {
        const n = units(o);
        return (
          <>
            {n}
            <span className="kit-sr"> {n === 1 ? "item" : "items"}</span>
          </>
        );
      },
    },
    {
      key: "total",
      header: "Total",
      width: compact ? "14%" : "8.5%",
      align: "end",
      mobile: "aside",
      sortValue: (o) => o.total,
      sortFirst: "desc",
      cell: (o) => formatMoney(o.total),
    },
    {
      key: "payment",
      header: "Payment",
      width: "10%",
      mobile: "hidden",
      sortValue: (o) => paymentOf(o),
      cell: (o) => <PaymentChip payment={paymentOf(o)} />,
    },
    {
      key: "status",
      header: "Status",
      width: compact ? "23%" : "16.5%",
      sortValue: (o) => FLOW.indexOf(o.status),
      cell: (o) => <OrderStatusChip order={o} now={now ?? worldNow()} />,
    },
  ];
  return compact
    ? columns.filter((c) => !["buyer", "via", "items", "payment"].includes(c.key)).map((c) => ({ ...c, sortValue: undefined }))
    : columns;
}

/** `?via=`: every order, direct orders, orders through any partner, or one partner's by id. */
type ViaFilter = "all" | "direct" | "partners" | (string & {});

/** `?days=N`: a whole number of days, 1 to 365; anything else is no filter. */
function parseDays(value: string | null): number | null {
  if (!value || !/^\d{1,3}$/.test(value)) return null;
  const days = Number(value);
  return days >= 1 && days <= 365 ? days : null;
}

const daysLabel = (days: number) => (days === 1 ? "Today" : `Last ${days} days`);

export default function Orders() {
  const orders = useResource(() => store.orders.list(), []);
  const buyers = useResource(() => store.buyers.list(), []);
  const partners = useResource(() => store.partners.list(), []);
  const query = useSearchQuery();
  const now = useWorldNow();
  const [statusParam, setStatus] = useQueryParam("status");
  const [viaParam, setVia] = useQueryParam("via");
  const [daysParam, setDays] = useQueryParam("days");
  const [openId, setOpenId] = useQueryParam("order");
  const status = FLOW.includes(statusParam as OrderStatus) ? (statusParam as OrderStatus) : "all";
  const days = parseDays(daysParam);

  const buyerById = useMemo(() => new Map((buyers.data ?? []).map((b) => [b.id, b])), [buyers.data]);
  const partnerById = useMemo(() => new Map((partners.data ?? []).map((p) => [p.id, p])), [partners.data]);
  // A partner's id is kept while the partners load, so a link to one never shows every order first.
  const via: ViaFilter =
    viaParam === "direct" || viaParam === "partners" || (viaParam && (!partners.data || partnerById.has(viaParam))) ? viaParam : "all";
  const columns = useMemo(() => orderColumns(buyerById, false, { partnerById, now }), [buyerById, partnerById, now]);

  const searched = useMemo(
    () =>
      (orders.data ?? []).filter((o) => {
        const buyer = buyerById.get(o.buyerId);
        return matches(
          query,
          o.number,
          buyer?.name,
          buyer?.institution,
          o.address.institution,
          o.discount?.code,
          ...o.lines.flatMap((l) => [l.lot, productById(l.productId)?.name]),
        );
      }),
    [orders.data, buyerById, query],
  );
  // Every filter but the status one: the status chips count what these leave.
  const scoped = useMemo(
    () =>
      searched.filter((o) => {
        const partnerId = o.discount?.partnerId;
        const byVia = via === "all" || (via === "direct" ? !partnerId : via === "partners" ? Boolean(partnerId) : partnerId === via);
        return byVia && (days === null || placedWithin(o, days));
      }),
    [searched, via, days],
  );
  const rows = orders.data && scoped.filter((o) => status === "all" || o.status === status);

  const options: SegmentOption<OrderStatus | "all">[] = [
    { value: "all", label: "All", count: scoped.length },
    ...FLOW.map((s) => ({ value: s, label: statusLabel(s), count: scoped.filter((o) => o.status === s).length })).filter(
      (option) => option.count > 0 || option.value === status,
    ),
  ];
  const viaOptions = [
    { value: "all", label: "All orders" },
    { value: "direct", label: "Direct" },
    { value: "partners", label: "Through partners" },
    ...[...(partners.data ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ value: p.id, label: `${p.name} · ${p.code}` })),
  ];
  const filtered = Boolean(query) || status !== "all" || via !== "all" || days !== null;
  const narrowed = via !== "all" || days !== null;

  return (
    <div className="kit-grid cc-orders">
      <PageHeader
        description="Orders placed through the shop, newest first. Select an order to read its events, lines and lots."
        meta={orders.data && <span>{plural(orders.data.length, "order")}</span>}
      />
      <div className="kit-toolbar cc-filters">
        <div className="cc-filters-set">
          <Segmented
            label="Filter orders by status"
            options={options}
            value={status}
            onChange={(value) => setStatus(value === "all" ? null : value, { replace: true })}
          />
          <Select
            label="Filter orders by partner"
            value={via}
            onChange={(value) => setVia(value === "all" ? null : value, { replace: true })}
            options={viaOptions}
            disabled={!partners.data}
          />
          {days !== null && (
            <button
              type="button"
              className="cc-filter-chip"
              aria-label={`${daysLabel(days)}. Remove this filter`}
              onClick={() => setDays(null, { replace: true })}
            >
              {daysLabel(days)}
              <X aria-hidden="true" strokeWidth={1.7} />
            </button>
          )}
        </div>
        {orders.data && filtered && (
          <p className="cc-result-count" aria-live="polite">
            {plural(rows?.length ?? 0, "result")}
          </p>
        )}
      </div>
      <div className="kit-card kit-span-12">
        <DataTable
          caption="Orders"
          columns={columns}
          rows={rows}
          rowKey={(o) => o.id}
          loading={orders.loading}
          error={orders.error}
          onRetry={orders.reload}
          onRowClick={(o) => setOpenId(o.id)}
          activeKey={openId}
          defaultSort={{ key: "date", dir: "desc" }}
          skeletonRows={10}
          empty={
            query
              ? { title: "No orders match this search.", note: "Search looks at order numbers, buyers, institutions, lots and codes." }
              : narrowed
                ? { title: "No orders match these filters.", note: "Choose another status or partner above, or remove a filter." }
                : { title: "No orders with this status.", note: "Choose another status above." }
          }
        />
      </div>
      {openId && <OrderDrawer key={openId} id={openId} onClose={() => setOpenId(null, { replace: true })} />}
    </div>
  );
}
