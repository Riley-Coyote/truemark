import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  BarChart,
  Button,
  Card,
  DataTable,
  Dot,
  EmptyState,
  LineChart,
  MoneyFigure,
  PageHeader,
  Segmented,
  Skeleton,
  StatGroup,
  StatTile,
  formatAxisMoney,
  formatChange,
  formatCount,
  formatDate,
  formatDifference,
  formatMoney,
} from "../app-kit";
import { store, useResource } from "../platform/store";
import { TODAY_ISO, overview, topCompounds } from "./metrics";
import { HOME } from "./nav";
import { OrderDrawer } from "./OrderDrawer";
import { orderColumns } from "./Orders";
import { useQueryParam } from "./state";

type Attention = { key: string; count: number; one: string; many: string; none: string; to: string; action: string };

export default function Overview() {
  const orders = useResource(() => store.orders.list(), []);
  const lots = useResource(() => store.lots.list(), []);
  const applications = useResource(() => store.applications.list(), []);
  const buyers = useResource(() => store.buyers.list(), []);
  const [chart, setChart] = useState<"revenue" | "orders">("revenue");
  const [openId, setOpenId] = useQueryParam("order");

  const figures = useMemo(() => (orders.data ? overview(orders.data) : null), [orders.data]);
  const top = useMemo(() => (orders.data ? topCompounds(orders.data) : []), [orders.data]);
  const buyerById = useMemo(() => new Map((buyers.data ?? []).map((b) => [b.id, b])), [buyers.data]);
  const recentColumns = useMemo(() => orderColumns(buyerById, true), [buyerById]);
  const recent = orders.data && [...orders.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  const attention: Attention[] | null =
    orders.data && lots.data && applications.data
      ? [
          {
            key: "applications",
            count: applications.data.filter((a) => a.status === "submitted").length,
            one: "application awaiting review",
            many: "applications awaiting review",
            none: "No applications awaiting review",
            to: `${HOME}/applications`,
            action: "Review",
          },
          {
            key: "lots",
            count: lots.data.filter((l) => l.status === "quarantine" || l.status === "testing").length,
            one: "lot in quarantine or testing",
            many: "lots in quarantine or testing",
            none: "No lots in quarantine or testing",
            to: `${HOME}/lots`,
            action: "Open lots",
          },
          {
            key: "orders",
            count: orders.data.filter((o) => o.status === "paid").length,
            one: "order paid, not yet packed",
            many: "orders paid, not yet packed",
            none: "No orders waiting to be packed",
            to: `${HOME}/orders?status=paid`,
            action: "Open orders",
          },
        ]
      : null;

  const loadingFigures = !figures;
  const maxTop = Math.max(...top.map((c) => c.revenue), 1);

  return (
    <div className="kit-grid cc-overview">
      <PageHeader
        description={`Sample data through ${formatDate(TODAY_ISO)}. Figures compare the last 30 days with the 30 days before; cancelled orders are left out.`}
      />

      <div className="kit-span-12">
        {orders.error ? (
          <div className="kit-card">
            <EmptyState
              compact
              title="Figures could not be loaded."
              note={orders.error.message}
              action={<Button onClick={orders.reload}>Try again</Button>}
            />
          </div>
        ) : (
          <StatGroup label="Last 30 days against the prior 30">
            <StatTile
              loading={loadingFigures}
              label="Revenue"
              figure={figures && <MoneyFigure value={figures.current.revenue} />}
              delta={figures ? { ...formatChange(figures.current.revenue, figures.previous.revenue), note: "vs prior 30 days" } : undefined}
              spark={figures?.spark.revenue}
              sparkLabel="Revenue, trailing seven days, across the last 30 days"
            />
            <StatTile
              loading={loadingFigures}
              label="Orders"
              figure={figures && formatCount(figures.current.count)}
              delta={figures ? { ...formatChange(figures.current.count, figures.previous.count), note: "vs prior 30 days" } : undefined}
              spark={figures?.spark.count}
              sparkLabel="Orders, trailing seven days, across the last 30 days"
            />
            <StatTile
              loading={loadingFigures}
              label="Average order"
              figure={figures && <MoneyFigure value={figures.current.average} />}
              delta={figures ? { ...formatChange(figures.current.average, figures.previous.average), note: "vs prior 30 days" } : undefined}
              spark={figures?.spark.average}
              sparkLabel="Average order, trailing seven days, across the last 30 days"
            />
            <StatTile
              loading={loadingFigures}
              label="Open orders"
              figure={figures && formatCount(figures.openNow)}
              delta={figures ? { ...formatDifference(figures.openNow, figures.openBefore), note: "vs 30 days ago" } : undefined}
              spark={figures?.spark.open}
              sparkLabel="Open orders at the end of each of the last 30 days"
            />
          </StatGroup>
        )}
      </div>

      <Card
        className="kit-span-8"
        title="Last 12 weeks"
        meta={
          <Segmented
            label="Chart"
            value={chart}
            onChange={setChart}
            options={[
              { value: "revenue", label: "Revenue" },
              { value: "orders", label: "Orders" },
            ]}
          />
        }
      >
        {!figures ? (
          <div className="cc-chart-loading" aria-label="Loading chart">
            <Skeleton width="100%" height="100%" />
          </div>
        ) : chart === "revenue" ? (
          <LineChart
            label="Revenue by week, last 12 weeks"
            data={figures.weeks.map((w) => ({ key: w.key, label: w.label, title: `Week of ${w.label}`, value: w.revenue }))}
            formatValue={formatMoney}
            formatAxis={formatAxisMoney}
          />
        ) : (
          <BarChart
            label="Orders by week, last 12 weeks"
            data={figures.weeks.map((w) => ({ key: w.key, label: w.label, title: `Week of ${w.label}`, value: w.count }))}
            formatValue={(v) => `${formatCount(v)} ${v === 1 ? "order" : "orders"}`}
            formatAxis={formatCount}
          />
        )}
      </Card>

      <Card className="kit-span-4" title="Needs attention">
        {attention ? (
          <ul className="cc-attention">
            {attention.map((item, i) => (
              <li key={item.key}>
                <Dot tone={item.count ? "pending" : "neutral"} className={item.count ? "cc-breathe" : undefined} />
                <p className="cc-attention-text" style={{ "--cc-i": i } as CSSProperties}>
                  {item.count ? (
                    <>
                      <span className="cc-attention-figure kit-figure">{formatCount(item.count)}</span>
                      {item.count === 1 ? item.one : item.many}
                    </>
                  ) : (
                    item.none
                  )}
                </p>
                {item.count > 0 && (
                  <Link className="kit-link" to={item.to}>
                    {item.action}
                    <ArrowRight aria-hidden="true" strokeWidth={1.6} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="cc-list-loading" aria-label="Loading">
            <Skeleton width="84%" />
            <Skeleton width="72%" />
            <Skeleton width="78%" />
          </div>
        )}
      </Card>

      <Card
        className="kit-span-8"
        title="Recent orders"
        flush
        meta={
          <Link className="kit-link" to={`${HOME}/orders`}>
            All orders
            <ArrowRight aria-hidden="true" strokeWidth={1.6} />
          </Link>
        }
      >
        <DataTable
          caption="Recent orders"
          columns={recentColumns}
          rows={recent}
          rowKey={(o) => o.id}
          loading={orders.loading}
          error={orders.error}
          onRetry={orders.reload}
          onRowClick={(o) => setOpenId(o.id)}
          activeKey={openId}
          stickyHeader={false}
          skeletonRows={6}
          empty={{ title: "No orders yet.", note: "Orders placed through the shop appear here." }}
        />
      </Card>

      <Card className="kit-span-4" title="Top compounds" meta="Last 30 days">
        {!orders.data ? (
          <div className="cc-list-loading" aria-label="Loading">
            <Skeleton width="80%" />
            <Skeleton width="66%" />
            <Skeleton width="74%" />
            <Skeleton width="58%" />
          </div>
        ) : top.length ? (
          <>
            <ol className="cc-top">
              {top.map((compound) => (
                <li key={compound.name}>
                  <span className="cc-top-name">
                    <Dot colour={compound.colour} />
                    {compound.name}
                  </span>
                  <span className="cc-top-value kit-num">{formatMoney(compound.revenue)}</span>
                  <span className="cc-top-bar" aria-hidden="true">
                    <span style={{ width: `${(compound.revenue / maxTop) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ol>
            <p className="cc-chart-note">Line revenue before discounts and shipping.</p>
          </>
        ) : (
          <EmptyState compact title="No sales in the last 30 days." />
        )}
      </Card>

      {openId && <OrderDrawer key={openId} id={openId} onClose={() => setOpenId(null, { replace: true })} />}
    </div>
  );
}
