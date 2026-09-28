import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Facts,
  LineChart,
  MoneyFigure,
  PageHeader,
  SampleTag,
  Skeleton,
  StatGroup,
  StatTile,
  formatChange,
  formatCount,
  formatDate,
  formatMoney,
  plural,
} from "../../app-kit";
import { store, useResource } from "../../platform/store";
import { TODAY_ISO, clickSeries, formatPoints, formatRate, monthToDate, paidToDate, traffic, upcoming } from "../metrics";
import { usePartnerPrefs } from "../prefs";
import { partnerLink, percent } from "../program";
import { usePartner, useQueryParam } from "./context";
import { CountingMoney } from "./Moments";
import { Momentum } from "./Momentum";
import { HOME } from "./nav";
import { CopyButton } from "./parts";
import { ReferralDrawer, referralColumns } from "./Referrals";

export default function Overview() {
  const partner = usePartner();
  const [prefs] = usePartnerPrefs(partner.id);
  const referrals = useResource(() => store.partners.referrals(partner.id), [partner.id]);
  const payouts = useResource(() => store.partners.payouts(partner.id), [partner.id]);
  const visits = useResource(() => store.partners.visits(partner.id), [partner.id]);
  const [openId, setOpenId] = useQueryParam("referral");
  const columns = useMemo(() => referralColumns(true), []);

  const figures = useMemo(() => {
    if (!referrals.data || !payouts.data || !visits.data) return null;
    const paid = paidToDate(payouts.data);
    const since = paid.running[paid.running.length - 1] - paid.running[paid.running.length - 31];
    return {
      month: monthToDate(referrals.data),
      paid,
      paidRecently: Math.round(since * 100) / 100,
      traffic: traffic(visits.data, referrals.data),
      next: upcoming(referrals.data),
    };
  }, [referrals.data, payouts.data, visits.data]);

  const error = referrals.error ?? payouts.error ?? visits.error;
  const retry = () => {
    referrals.reload();
    payouts.reload();
    visits.reload();
  };
  const recent = referrals.data && [...referrals.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const open = openId ? referrals.data?.find((r) => r.id === openId) : undefined;
  const clicks = visits.data ? clickSeries(visits.data) : null;
  const clickTotal = visits.data?.reduce((sum, v) => sum + v.clicks, 0) ?? 0;
  const homeLink = partnerLink("/", partner.code);

  return (
    <div className="kit-grid pp-page pp-overview">
      <PageHeader
        description={`Sample data through ${formatDate(TODAY_ISO)}. Your commission is ${percent(partner.rate)} of each referred order’s subtotal, after your audience’s ${percent(partner.codeDiscount)} discount (sample terms).`}
      />

      <div className="kit-span-12">
        {error ? (
          <div className="kit-card">
            <EmptyState compact title="Your figures could not be loaded." note={error.message} action={<Button onClick={retry}>Try again</Button>} />
          </div>
        ) : (
          <StatGroup label="Your figures">
            <StatTile
              loading={!figures}
              label="This month"
              figure={figures && <CountingMoney value={figures.month.current} />}
              delta={
                figures
                  ? { ...formatChange(figures.month.current, figures.month.previous), note: `vs ${figures.month.comparison}` }
                  : undefined
              }
              spark={figures?.month.cumulative}
              sparkLabel={`Commission earned in ${figures?.month.month ?? "this month"}, day by day`}
            />
            <StatTile
              loading={!figures}
              label="Lifetime paid"
              figure={figures && <MoneyFigure value={figures.paid.amount} />}
              delta={
                figures
                  ? {
                      text: figures.paidRecently > 0 ? `+${formatMoney(figures.paidRecently)}` : formatMoney(0),
                      direction: figures.paidRecently > 0 ? "up" : "flat",
                      note: "in the last 30 days",
                    }
                  : undefined
              }
              spark={figures?.paid.running}
              sparkLabel="Total paid to you, across the last 60 days"
            />
            <StatTile
              loading={!figures}
              label="Clicks, 30 days"
              figure={figures && formatCount(figures.traffic.clicks)}
              delta={
                figures
                  ? { ...formatChange(figures.traffic.clicks, figures.traffic.previousClicks), note: "vs prior 30 days" }
                  : undefined
              }
              spark={figures?.traffic.daily}
              sparkLabel="Clicks on your links, day by day, across the last 30 days"
            />
            <StatTile
              loading={!figures}
              label="Conversion, 30 days"
              figure={figures && formatRate(figures.traffic.conversion)}
              delta={
                figures
                  ? {
                      ...formatPoints(figures.traffic.conversion, figures.traffic.previousConversion),
                      note: "vs prior 30 days",
                    }
                  : undefined
              }
              spark={figures?.traffic.trailing}
              sparkLabel="Referred orders over clicks, for the 30 days ending on each of the last 30 days"
            />
          </StatGroup>
        )}
      </div>

      {!error && (
        <Momentum referrals={referrals.data} current={figures?.month.current} month={figures?.month.month} goal={prefs.goal} />
      )}

      <Card className="kit-span-8" title="Clicks, last 60 days" meta={visits.data && <span className="kit-num">{formatCount(clickTotal)} in all</span>}>
        {!clicks ? (
          <div className="pp-chart-loading" aria-label="Loading chart">
            <Skeleton width="100%" height="100%" />
          </div>
        ) : clicks.length ? (
          <>
            <LineChart
              label="Clicks on your links by day, last 60 days"
              data={clicks}
              formatValue={(v) => `${formatCount(v)} ${v === 1 ? "click" : "clicks"}`}
              formatAxis={formatCount}
            />
            <p className="pp-chart-note">Visits that arrived through any of your links. Codes typed at checkout are not clicks.</p>
          </>
        ) : (
          <EmptyState compact title="No clicks yet." note="Visits through your links appear here." />
        )}
      </Card>

      <Card className="kit-span-4 pp-figure-card" title="Next payout" meta={<SampleTag>Sample schedule</SampleTag>}>
        {!figures ? (
          <div className="pp-list-loading" aria-label="Loading">
            <Skeleton width="60%" height="1.5rem" />
            <Skeleton width="84%" />
            <Skeleton width="72%" />
          </div>
        ) : (
          <>
            <p className="kit-figure pp-next-date">
              <time dateTime={figures.next.date.slice(0, 10)}>{formatDate(figures.next.date)}</time>
            </p>
            <p className="pp-next-note">Pays every commission approved by then. Payouts go out on the 5th of each month.</p>
            <Facts
              items={[
                {
                  label: "Approved",
                  value: (
                    <span className="pp-fact-figure">
                      <span className="kit-num">{formatMoney(figures.next.approved)}</span>
                      <span className="kit-quiet">{plural(figures.next.approvedCount, "referral")}</span>
                    </span>
                  ),
                },
                {
                  label: "Pending",
                  value: (
                    <span className="pp-fact-figure">
                      <span className="kit-num">{formatMoney(figures.next.pending)}</span>
                      <span className="kit-quiet">{plural(figures.next.pendingCount, "referral")}</span>
                    </span>
                  ),
                },
              ]}
            />
            <Link className="kit-link pp-card-link" to={`${HOME}/payouts`}>
              Payouts
              <ArrowRight aria-hidden="true" strokeWidth={1.6} />
            </Link>
          </>
        )}
      </Card>

      <Card
        className="kit-span-8"
        title="Recent referrals"
        flush
        meta={
          <Link className="kit-link" to={`${HOME}/referrals`}>
            All referrals
            <ArrowRight aria-hidden="true" strokeWidth={1.6} />
          </Link>
        }
      >
        <DataTable
          caption="Recent referrals"
          columns={columns}
          rows={recent}
          rowKey={(r) => r.id}
          loading={referrals.loading}
          error={referrals.error}
          onRetry={referrals.reload}
          onRowClick={(r) => setOpenId(r.id)}
          activeKey={openId}
          stickyHeader={false}
          skeletonRows={5}
          empty={{ title: "No referrals yet.", note: "Orders placed with your code or through your link appear here." }}
        />
      </Card>

      <Card className="kit-span-4 pp-share" title="Your code">
        <p className="pp-share-code kit-mono">{partner.code}</p>
        <p className="pp-share-note">
          {percent(partner.codeDiscount)} off for your audience. Your links carry it to checkout on their own.
        </p>
        <div className="pp-share-actions">
          <CopyButton text={partner.code} label="Copy code" what="Code" />
          <CopyButton text={homeLink} label="Copy link" what="Link" />
        </div>
        <p className="pp-share-rule">
          <span className="pp-share-rule-mark" aria-hidden="true" />
          Disclose the commission before your link or code, in every post.
        </p>
        <Link className="kit-link pp-card-link" to={`${HOME}/guidelines`}>
          Guidelines & assets
          <ArrowRight aria-hidden="true" strokeWidth={1.6} />
        </Link>
      </Card>

      {open && (
        <ReferralDrawer
          key={open.id}
          referral={open}
          payouts={payouts.data ?? []}
          rate={partner.rate}
          onClose={() => setOpenId(null, { replace: true })}
        />
      )}
    </div>
  );
}

