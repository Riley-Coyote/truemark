import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  Button,
  Card,
  DataTable,
  Dot,
  EmptyState,
  Segmented,
  Skeleton,
  formatAxisMoney,
  formatChange,
  formatCount,
  formatDifference,
  formatMoney,
} from "../app-kit";
import { CountingMoney } from "../app-kit/motion";
import { store, useResource } from "../platform/store";
import {
  PERIODS,
  STAGE_LIMIT,
  formatLimit,
  orderCount,
  partnerFigures,
  periodFigures,
  pipeline,
  pulseHistory,
  topCompounds,
} from "./metrics";
import type { OpenStage, Period, PeriodFigures, StageFigures } from "./metrics";
import { HOME } from "./nav";
import { OrderDrawer } from "./OrderDrawer";
import { orderColumns } from "./Orders";
import { PartnerPanel, nextPayout } from "./PartnerPanel";
import { Pipeline } from "./pipeline";
import { usePreview } from "./preview";
import { partnerRows } from "./program";
import { CountingCount, DeltaLine, LivePanel, TodayFigures, usePulseClock } from "./pulse";
import { useQueryParam } from "./state";
import { TraceChart } from "./TraceChart";

type Series = "revenue" | "orders";

/** How many recent orders the table lists: about the height of the column beside it. */
const RECENT = 12;

/** "$3,020" for the peak's label: whole dollars; the tooltip keeps the cents. */
const wholeDollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/* ---------- Revenue: the period and its trace ---------- */

function PeriodCard({
  figures,
  days,
  onDays,
  series,
  onSeries,
}: {
  figures: PeriodFigures | null;
  days: Period;
  onDays: (days: Period) => void;
  series: Series;
  onSeries: (series: Series) => void;
}) {
  const vs = `vs prior ${days} days`;
  const items = figures
    ? [
        {
          key: "revenue",
          label: "Revenue",
          figure: <CountingMoney value={figures.current.revenue} />,
          change: formatChange(figures.current.revenue, figures.previous.revenue),
          note: vs,
        },
        {
          key: "orders",
          label: "Orders",
          figure: <CountingCount value={figures.current.count} />,
          change: formatChange(figures.current.count, figures.previous.count),
          note: vs,
        },
        {
          key: "average",
          label: "Average order",
          figure: <CountingMoney value={figures.current.average} />,
          change: formatChange(figures.current.average, figures.previous.average),
          note: vs,
        },
        {
          key: "open",
          label: "Open orders",
          figure: <CountingCount value={figures.openNow} />,
          change: formatDifference(figures.openNow, figures.openBefore),
          note: `vs ${days} days ago`,
        },
      ]
    : null;

  const noun = series === "revenue" ? "revenue" : "orders";
  return (
    <Card
      className="kit-span-8 cc-period"
      title={`Last ${days} days`}
      meta={
        <Segmented
          label="Period"
          value={String(days)}
          onChange={(value) => onDays(Number(value) as Period)}
          options={PERIODS.map((p) => ({ value: String(p), label: `${p} days` }))}
        />
      }
    >
      <dl className="cc-period-figures">
        {items
          ? items.map((item) => (
              <div key={item.key}>
                <dt className="kit-label">{item.label}</dt>
                <dd className="kit-figure">{item.figure}</dd>
                <dd>
                  <DeltaLine change={item.change} note={item.note} />
                </dd>
              </div>
            ))
          : ["Revenue", "Orders", "Average order", "Open orders"].map((label) => (
              <div key={label}>
                <dt className="kit-label">{label}</dt>
                <dd className="kit-figure" aria-hidden="true">
                  <Skeleton width="60%" height="0.7em" />
                </dd>
                <dd className="kit-delta" aria-hidden="true">
                  <Skeleton width="70%" />
                </dd>
              </div>
            ))}
      </dl>

      <div className="cc-period-chart-head">
        <p className="kit-label">Daily {noun}</p>
        <Segmented
          label="Chart"
          value={series}
          onChange={onSeries}
          options={[
            { value: "revenue", label: "Revenue" },
            { value: "orders", label: "Orders" },
          ]}
        />
      </div>
      {figures ? (
        <TraceChart
          key={`${days}-${series}`}
          label={`Daily ${noun}, last ${days} days`}
          data={figures.daily.map((d) => ({ key: d.key, iso: d.iso, label: d.label, value: series === "revenue" ? d.revenue : d.count }))}
          formatValue={series === "revenue" ? formatMoney : orderCount}
          formatAxis={series === "revenue" ? formatAxisMoney : formatCount}
          formatPeak={series === "revenue" ? (v) => wholeDollars.format(v) : orderCount}
        />
      ) : (
        <div className="cc-chart-loading" aria-label="Loading chart">
          <Skeleton width="100%" height="100%" />
        </div>
      )}
      <p className="cc-chart-note">Order totals by day, as the Orders page lists them; cancelled orders are left out.</p>
    </Card>
  );
}

/* ---------- Needs attention ---------- */

type Attention = { key: string; count: number; text: string; spoken?: string; none?: string; to: string; action: string };

/** A stage past its mark, in the pipeline's words on the row, and in full for a screen reader. */
const NEXT_STEP: Record<OpenStage, string> = { placed: "paid", paid: "packed", packed: "shipped", shipped: "delivered" };
const lateText = (stage: OpenStage, n: number) => {
  const noun = n === 1 ? "order" : "orders";
  const limit = formatLimit(STAGE_LIMIT[stage]);
  return {
    text: `${stage} ${noun} past ${limit}`,
    spoken: `${noun} ${stage} more than ${limit} ago, not yet ${NEXT_STEP[stage]}`,
  };
};

function attentionItems(applications: number, lots: number, stages: StageFigures[]): Attention[] {
  const late = stages.filter((s) => s.stage !== "delivered" && s.late > 0);
  return [
    {
      key: "applications",
      count: applications,
      text: applications === 1 ? "application awaiting review" : "applications awaiting review",
      none: "No applications awaiting review",
      to: `${HOME}/applications`,
      action: "Review",
    },
    {
      key: "lots",
      count: lots,
      text: lots === 1 ? "lot in quarantine or testing" : "lots in quarantine or testing",
      none: "No lots in quarantine or testing",
      to: `${HOME}/lots`,
      action: "Open lots",
    },
    ...(late.length
      ? late.map((s) => ({
          key: `late-${s.stage}`,
          count: s.late,
          ...lateText(s.stage as OpenStage, s.late),
          to: `${HOME}/orders?status=${s.stage}`,
          action: "Open orders",
        }))
      : [{ key: "late", count: 0, text: "", none: "No orders waiting past their time", to: `${HOME}/orders`, action: "" }]),
  ];
}

/* ---------- The Overview ---------- */

export default function Overview() {
  const orders = useResource(() => store.orders.list(), []);
  const lots = useResource(() => store.lots.list(), []);
  const applications = useResource(() => store.applications.list(), []);
  const buyers = useResource(() => store.buyers.list(), []);
  const partners = useResource(() => store.partners.list(), []);
  const referrals = useResource(() => store.partners.referrals(), []);
  const changes = usePreview();
  const now = usePulseClock();
  const [days, setDays] = useState<Period>(30);
  const [series, setSeries] = useState<Series>("revenue");
  const [openId, setOpenId] = useQueryParam("order");

  const period = useMemo(() => (orders.data ? periodFigures(orders.data, days) : null), [orders.data, days]);
  const stages = useMemo(() => (orders.data ? pipeline(orders.data, now) : null), [orders.data, now]);
  const history = useMemo(
    () => (orders.data && referrals.data && partners.data && buyers.data ? pulseHistory(orders.data, referrals.data, partners.data, buyers.data) : undefined),
    [orders.data, referrals.data, partners.data, buyers.data],
  );
  const partnerFigs = useMemo(
    () => (orders.data && referrals.data && partners.data ? partnerFigures(orders.data, referrals.data, partners.data, days) : null),
    [orders.data, referrals.data, partners.data, days],
  );
  const payout = useMemo(
    () => (partners.data && referrals.data ? nextPayout(partnerRows(partners.data, referrals.data, changes), changes.batches) : null),
    [partners.data, referrals.data, changes],
  );
  const top = useMemo(() => (orders.data ? topCompounds(orders.data) : []), [orders.data]);
  const buyerById = useMemo(() => new Map((buyers.data ?? []).map((b) => [b.id, b])), [buyers.data]);
  const recentColumns = useMemo(() => orderColumns(buyerById, true), [buyerById]);
  // Enough rows to sit level with the column beside it; phones show the first six.
  const recent = orders.data && [...orders.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT);

  const attention =
    lots.data && applications.data && stages
      ? attentionItems(
          applications.data.filter((a) => a.status === "submitted").length,
          lots.data.filter((l) => l.status === "quarantine" || l.status === "testing").length,
          stages.stages,
        )
      : null;
  const maxTop = Math.max(...top.map((c) => c.revenue), 1);
  const streamError = orders.error ?? referrals.error ?? partners.error ?? buyers.error;

  return (
    <div className="kit-grid cc-overview">
      {orders.error ? (
        <div className="kit-card kit-span-12">
          <EmptyState compact title="Figures could not be loaded." note={orders.error.message} action={<Button onClick={orders.reload}>Try again</Button>} />
        </div>
      ) : (
        <div className="cc-band kit-span-12">
          <TodayFigures orders={orders.data} now={now} />
          <LivePanel
            history={history}
            partners={partners.data ?? []}
            buyers={buyers.data ?? []}
            now={now}
            loading={!history && !streamError}
            error={streamError}
            onRetry={() => {
              orders.reload();
              referrals.reload();
              partners.reload();
              buyers.reload();
            }}
            onOpen={(ref) => setOpenId(ref)}
          />
        </div>
      )}

      <Pipeline className="kit-span-12" figures={stages} />

      <PeriodCard figures={period} days={days} onDays={setDays} series={series} onSeries={setSeries} />
      <PartnerPanel className="kit-span-4" figures={partnerFigs} payout={payout} days={days} />

      <Card
        className="kit-span-8 cc-recent"
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
          loading={orders.loading && !orders.data}
          error={orders.error}
          onRetry={orders.reload}
          onRowClick={(o) => setOpenId(o.id)}
          activeKey={openId}
          stickyHeader={false}
          skeletonRows={6}
          empty={{ title: "No orders yet.", note: "Orders placed through the shop appear here." }}
        />
      </Card>

      <div className="kit-span-4 cc-side">
        <Card title="Needs attention">
          {attention ? (
            <ul className="cc-attention">
              {attention.map((item) => (
                <li key={item.key}>
                  <Dot tone={item.count ? "pending" : "neutral"} />
                  <p className="cc-attention-text">
                    {item.count ? (
                      <>
                        <span className="cc-attention-figure kit-figure">{formatCount(item.count)}</span>
                        {item.spoken ? (
                          <>
                            <span aria-hidden="true">{item.text}</span>
                            <span className="kit-sr">{item.spoken}</span>
                          </>
                        ) : (
                          item.text
                        )}
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

        <Card title="Top compounds" meta="Last 30 days">
          {!orders.data ? (
            <div className="cc-list-loading" aria-label="Loading">
              <Skeleton width="80%" />
              <Skeleton width="66%" />
              <Skeleton width="74%" />
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
      </div>

      {openId && <OrderDrawer key={openId} id={openId} onClose={() => setOpenId(null, { replace: true })} />}
    </div>
  );
}
