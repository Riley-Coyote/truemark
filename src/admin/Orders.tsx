import { useMemo } from "react";
import { DataTable, PageHeader, Segmented, StatusChip, formatDate, formatMoney, plural, statusLabel } from "../app-kit";
import type { Column, SegmentOption } from "../app-kit";
import { paymentOf } from "../brand/Tracker";
import { store, useResource } from "../platform/store";
import type { Buyer, Order, OrderStatus } from "../platform/types";
import { productById } from "../shop/catalog";
import { units } from "./metrics";
import { OrderDrawer } from "./OrderDrawer";
import { matches, useQueryParam, useSearchQuery } from "./state";

const FLOW: OrderStatus[] = ["placed", "paid", "packed", "shipped", "delivered", "cancelled", "refunded"];

export function orderColumns(buyerById: Map<string, Buyer>, compact = false): Column<Order>[] {
  const buyerName = (o: Order) => buyerById.get(o.buyerId)?.name ?? o.address.attention;
  const institution = (o: Order) => buyerById.get(o.buyerId)?.institution ?? o.address.institution;
  const columns: Column<Order>[] = [
    {
      key: "number",
      header: "Order",
      width: compact ? "19%" : "11%",
      mobile: "primary",
      sortValue: (o) => o.number,
      sortFirst: "desc",
      cell: (o) => <span className="kit-mono">{o.number}</span>,
    },
    {
      key: "date",
      header: "Placed",
      width: compact ? "19%" : "12%",
      sortValue: (o) => o.createdAt,
      sortFirst: "desc",
      cell: (o) => formatDate(o.createdAt),
    },
    {
      key: "buyer",
      header: "Buyer",
      width: "16%",
      mobile: "hidden",
      sortValue: buyerName,
      cell: buyerName,
    },
    {
      key: "institution",
      header: "Institution",
      width: compact ? "31%" : "22%",
      mobile: "secondary",
      sortValue: institution,
      cell: institution,
    },
    {
      key: "items",
      header: "Items",
      width: "7%",
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
      width: compact ? "15%" : "11%",
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
      cell: (o) => <StatusChip status={paymentOf(o)} />,
    },
    {
      key: "status",
      header: "Status",
      width: compact ? "16%" : "11%",
      sortValue: (o) => FLOW.indexOf(o.status),
      cell: (o) => <StatusChip status={o.status} />,
    },
  ];
  // The compact table is a fixed "most recent" list, so it does not sort.
  return compact
    ? columns.filter((c) => !["buyer", "items", "payment"].includes(c.key)).map((c) => ({ ...c, sortValue: undefined }))
    : columns;
}

export default function Orders() {
  const orders = useResource(() => store.orders.list(), []);
  const buyers = useResource(() => store.buyers.list(), []);
  const query = useSearchQuery();
  const [statusParam, setStatus] = useQueryParam("status");
  const [openId, setOpenId] = useQueryParam("order");
  const status = FLOW.includes(statusParam as OrderStatus) ? (statusParam as OrderStatus) : "all";

  const buyerById = useMemo(() => new Map((buyers.data ?? []).map((b) => [b.id, b])), [buyers.data]);
  const columns = useMemo(() => orderColumns(buyerById), [buyerById]);

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
  const rows = orders.data && searched.filter((o) => status === "all" || o.status === status);

  const options: SegmentOption<OrderStatus | "all">[] = [
    { value: "all", label: "All", count: searched.length },
    ...FLOW.map((s) => ({ value: s, label: statusLabel(s), count: searched.filter((o) => o.status === s).length })).filter(
      (option) => option.count > 0 || option.value === status,
    ),
  ];

  return (
    <div className="kit-grid">
      <PageHeader
        description="Orders placed through the shop, newest first. Select an order to read its events, lines and lots."
        meta={orders.data && <span>{plural(orders.data.length, "order")}</span>}
      />
      <div className="kit-toolbar">
        <Segmented
          label="Filter orders by status"
          options={options}
          value={status}
          onChange={(value) => setStatus(value === "all" ? null : value, { replace: true })}
        />
        {orders.data && (query || status !== "all") && (
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
          empty={{
            title: query ? "No orders match this search." : "No orders with this status.",
            note: query ? "Search looks at order numbers, buyers, institutions, lots and codes." : "Choose another status above.",
          }}
        />
      </div>
      {openId && <OrderDrawer key={openId} id={openId} onClose={() => setOpenId(null, { replace: true })} />}
    </div>
  );
}
