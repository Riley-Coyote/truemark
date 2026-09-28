import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  DataTable,
  Drawer,
  EmptyState,
  Facts,
  MoneyFigure,
  PageHeader,
  Section,
  StatusChip,
  formatCount,
  formatDate,
  formatMoney,
  plural,
} from "../app-kit";
import type { Column } from "../app-kit";
import { store, useResource } from "../platform/store";
import type { Buyer, Order } from "../platform/types";
import { isCounted } from "./metrics";
import { HOME } from "./nav";
import { AddressLines, DrawerLoading } from "./OrderDrawer";
import { orderColumns } from "./Orders";
import { matches, useQueryParam, useSearchQuery } from "./state";

type Row = Buyer & { orders: Order[]; count: number; value: number };

const columns: Column<Row>[] = [
  { key: "institution", header: "Institution", width: "25%", mobile: "primary", sortValue: (r) => r.institution, cell: (r) => r.institution },
  { key: "name", header: "Name", width: "17%", mobile: "secondary", sortValue: (r) => r.name, cell: (r) => r.name },
  { key: "role", header: "Role", width: "17%", sortValue: (r) => r.role, cell: (r) => r.role },
  { key: "status", header: "Status", width: "11%", sortValue: (r) => r.status, cell: (r) => <StatusChip status={r.status} /> },
  {
    key: "orders",
    header: "Orders",
    width: "8%",
    align: "end",
    sortValue: (r) => r.count,
    sortFirst: "desc",
    cell: (r) => (
      <>
        {formatCount(r.count)}
        <span className="kit-sr"> {r.count === 1 ? "order" : "orders"}</span>
      </>
    ),
  },
  {
    key: "value",
    header: "Lifetime value",
    width: "12%",
    align: "end",
    mobile: "aside",
    sortValue: (r) => r.value,
    sortFirst: "desc",
    cell: (r) => formatMoney(r.value),
  },
  {
    key: "joined",
    header: "Joined",
    width: "10%",
    sortValue: (r) => r.joinedAt,
    sortFirst: "desc",
    cell: (r) => formatDate(r.joinedAt),
  },
];

function withOrders(buyers: Buyer[], orders: Order[]): Row[] {
  return buyers.map((buyer) => {
    const own = orders.filter((o) => o.buyerId === buyer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const counted = own.filter(isCounted);
    return {
      ...buyer,
      orders: own,
      count: counted.length,
      value: Math.round(counted.reduce((sum, o) => sum + o.total, 0) * 100) / 100,
    };
  });
}

export default function Customers() {
  const buyers = useResource(() => store.buyers.list(), []);
  const orders = useResource(() => store.orders.list(), []);
  const query = useSearchQuery();
  const [openId, setOpenId] = useQueryParam("customer");

  const all = useMemo(
    () => (buyers.data && orders.data ? withOrders(buyers.data, orders.data) : undefined),
    [buyers.data, orders.data],
  );
  const rows = useMemo(
    () => all?.filter((r) => matches(query, r.name, r.institution, r.role, r.email)),
    [all, query],
  );
  const error = buyers.error ?? orders.error;

  return (
    <div className="kit-grid">
      <PageHeader
        description="Research buyers with an account, with their orders and lifetime value. Cancelled orders are left out of the totals."
        meta={buyers.data && <span>{plural(buyers.data.length, "customer")}</span>}
      />
      <div className="kit-card kit-span-12">
        <DataTable
          caption="Customers"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={buyers.loading || orders.loading}
          error={error}
          onRetry={() => {
            buyers.reload();
            orders.reload();
          }}
          onRowClick={(r) => setOpenId(r.id)}
          activeKey={openId}
          defaultSort={{ key: "value", dir: "desc" }}
          skeletonRows={10}
          empty={{ title: "No customers match this search.", note: "Search looks at names, institutions, roles and emails." }}
        />
      </div>
      {openId && (
        <CustomerDrawer
          key={openId}
          row={all?.find((r) => r.id === openId)}
          loading={!all && !error}
          onClose={() => setOpenId(null, { replace: true })}
          onRetry={() => {
            buyers.reload();
            orders.reload();
          }}
          failed={error}
        />
      )}
    </div>
  );
}

function CustomerDrawer({
  row,
  loading,
  failed,
  onRetry,
  onClose,
}: {
  row: Row | undefined;
  loading: boolean;
  failed: Error | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const columns = useMemo(() => orderColumns(new Map(), true).filter((c) => c.key !== "institution"), []);

  if (!row) {
    return (
      <Drawer title="Customer" eyebrow="Customer" onClose={onClose}>
        {loading ? (
          <DrawerLoading />
        ) : failed ? (
          <EmptyState compact title="This customer could not be loaded." note={failed.message} action={<Button onClick={onRetry}>Try again</Button>} />
        ) : (
          <EmptyState compact title="No customer matches this link." />
        )}
      </Drawer>
    );
  }

  return (
    <Drawer
      title={row.name}
      eyebrow="Customer"
      subtitle={`${row.role} · ${row.institution}`}
      tags={
        <>
          <StatusChip status={row.status} />
          <span className="cc-tag-text">Joined {formatDate(row.joinedAt)}</span>
        </>
      }
      onClose={onClose}
    >
      <dl className="cc-figures">
        <div>
          <dt className="kit-label">Orders</dt>
          <dd className="kit-figure">{formatCount(row.count)}</dd>
        </div>
        <div>
          <dt className="kit-label">Lifetime value</dt>
          <dd className="kit-figure">
            <MoneyFigure value={row.value} />
          </dd>
        </div>
      </dl>

      <Section title="Account">
        <Facts
          items={[
            { label: "Name", value: row.name },
            { label: "Institution", value: row.institution },
            { label: "Role", value: row.role },
            { label: "Email", value: row.email },
            { label: "Status", value: <StatusChip status={row.status} /> },
            { label: "Verified", value: row.verifiedAt ? formatDate(row.verifiedAt) : <span className="kit-quiet">Not verified</span> },
          ]}
        />
      </Section>

      <Section title="Addresses">
        {row.addresses.length ? (
          <ul className="cc-addresses">
            {row.addresses.map((address) => (
              <li key={address.id}>
                <p className="kit-label">{address.label}</p>
                <AddressLines address={address} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="kit-note">No addresses on file.</p>
        )}
      </Section>

      <Section title="Orders">
        <div className="cc-drawer-table">
          <DataTable
            caption={`Orders from ${row.name}`}
            columns={columns}
            rows={row.orders}
            rowKey={(o) => o.id}
            onRowClick={(o) => navigate(`${HOME}/orders?order=${o.id}`)}
            stickyHeader={false}
            empty={{ title: "No orders yet." }}
          />
        </div>
      </Section>
    </Drawer>
  );
}
