import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  LineChart,
  Skeleton,
  StatusChip,
  formatCount,
  formatMoney,
  plural,
} from "../../app-kit";
import { onPlatformEvent } from "../../platform/events";
import { store, useResource } from "../../platform/store";
import {
  clickSeries,
  formatRate,
  monthToDate,
  saleAge,
  traffic,
} from "../metrics";
import { usePartnerPrefs } from "../prefs";
import { usePartner, useQueryParam } from "./context";
import { Celebrate } from "./Celebrate";
import { Hero } from "./Hero";
import { Momentum } from "./Momentum";
import { HOME } from "./nav";
import { useSampleNow } from "./parts";
import { ReferralDrawer } from "./Referrals";
import { ShareKit } from "./ShareKit";

import { PartnerAssistant } from "../../assistant/Assistant";

export default function Overview() {
  const partner = usePartner();
  const [prefs] = usePartnerPrefs(partner.id);
  const referrals = useResource(
    () => store.partners.referrals(partner.id),
    [partner.id],
  );
  const payouts = useResource(
    () => store.partners.payouts(partner.id),
    [partner.id],
  );
  const visits = useResource(
    () => store.partners.visits(partner.id),
    [partner.id],
  );
  const [openId, setOpenId] = useQueryParam("referral");
  const [arrivals, setArrivals] = useState<string[]>([]);
  const now = useSampleNow();

  useEffect(
    () =>
      onPlatformEvent((event) => {
        if (event.type !== "referral.created" || event.partnerId !== partner.id)
          return;
        setArrivals((ids) =>
          ids.includes(event.referralId) ? ids : [...ids, event.referralId],
        );
      }),
    [partner.id],
  );

  const recent =
    referrals.data &&
    [...referrals.data]
      .sort((a, b) => {
        // Live arrivals stay first, even across the sample clock's afternoon wrap.
        const live = arrivals.indexOf(b.id) - arrivals.indexOf(a.id);
        return live || b.createdAt.localeCompare(a.createdAt);
      })
      .slice(0, 6);
  const open = openId
    ? referrals.data?.find((r) => r.id === openId)
    : undefined;
  const clicks = visits.data ? clickSeries(visits.data) : undefined;
  const audience =
    visits.data && referrals.data
      ? traffic(visits.data, referrals.data)
      : undefined;
  const month = referrals.data ? monthToDate(referrals.data) : undefined;
  const clickTotal = visits.data?.reduce((sum, v) => sum + v.clicks, 0) ?? 0;
  const arrival = [...arrivals]
    .reverse()
    .find((id) => referrals.data?.some((r) => r.id === id));

  return (
    <div className="kit-grid pp-page pp-overview">
      <Celebrate
        key={partner.id}
        partnerId={partner.id}
        referrals={referrals.data}
        arrivals={arrivals}
        goal={prefs.goal}
      />
      {referrals.error ? (
        <div className="kit-card kit-span-8">
          <EmptyState
            compact
            title="Your figures could not be loaded."
            note={referrals.error.message}
            action={<Button onClick={referrals.reload}>Try again</Button>}
          />
        </div>
      ) : (
        <Hero
          partner={partner}
          referrals={referrals.data}
          goal={prefs.goal}
          now={now}
          arrival={arrival}
        />
      )}
      <ShareKit partner={partner} />
      <PartnerAssistant />
      <div className="pp-overview-details kit-grid kit-span-12">
        {!referrals.error && <Momentum referrals={referrals.data} />}
        <Card
          className="kit-span-6 pp-sales"
          title="Your sales"
          meta={<span>Latest referrals</span>}
          flush
        >
          {referrals.error ? (
            <EmptyState
              compact
              title="Your sales could not be loaded."
              action={<Button onClick={referrals.reload}>Try again</Button>}
            />
          ) : !recent ? (
            <div className="pp-sales-loading" aria-label="Loading sales">
              <Skeleton width="100%" height="20rem" />
            </div>
          ) : recent.length ? (
            <ol className="pp-sales-feed" aria-label="Latest referrals">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="pp-sale-item"
                  data-referral={r.id}
                  data-arrived={arrivals.includes(r.id) ? "true" : undefined}
                >
                  <button
                    type="button"
                    className="pp-sale-row"
                    onClick={() => setOpenId(r.id)}
                    aria-label={`View referral ${r.orderNumber}`}
                    aria-haspopup="dialog"
                  >
                    {arrivals.includes(r.id) && (
                      <span className="pp-sale-light" aria-hidden="true" />
                    )}
                    <span className="pp-sale-order">
                      <span className="kit-mono">{r.orderNumber}</span>
                      <span className="pp-sale-via">via your {r.via}</span>
                    </span>
                    <span className="pp-sale-amount kit-num">
                      {r.status === "void"
                        ? formatMoney(0)
                        : `+${formatMoney(r.commission)}`}
                    </span>
                    <span className="pp-sale-subtotal kit-num">
                      {formatMoney(r.orderSubtotal)} subtotal
                    </span>
                    <span className="pp-sale-status">
                      <StatusChip status={r.status} />
                    </span>
                    <time className="pp-sale-time" dateTime={r.createdAt}>
                      {saleAge(r.createdAt, now)}
                    </time>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              compact
              title="Your first sale starts here."
              note="Orders through your link or code appear here."
            />
          )}
          <div className="pp-sales-foot">
            <Link className="kit-link" to={`${HOME}/referrals`}>
              All referrals
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </Card>
        <Card
          className="kit-span-6 pp-audience"
          title="Audience"
          meta={<span>Clicks · last 60 days</span>}
        >
          {visits.error || referrals.error ? (
            <EmptyState
              compact
              title="Your audience figures could not be loaded."
              action={
                <Button
                  onClick={() => {
                    visits.reload();
                    referrals.reload();
                  }}
                >
                  Try again
                </Button>
              }
            />
          ) : !clicks || !audience || !month ? (
            <div className="pp-chart-loading" aria-label="Loading audience">
              <Skeleton width="100%" height="100%" />
            </div>
          ) : (
            <>
              <div className="pp-audience-figures">
                <div>
                  <span className="pp-audience-number kit-num">
                    {formatCount(clickTotal)}
                  </span>
                  <span>Clicks, 60 days</span>
                </div>
                <div>
                  <span className="pp-audience-number kit-num">
                    {formatRate(audience.conversion)}
                  </span>
                  <span>Conversion, 30 days</span>
                </div>
              </div>
              {clicks.length ? (
                <LineChart
                  label="Clicks on your links by day, last 60 days"
                  height={160}
                  data={clicks}
                  formatValue={(v) => plural(v, "click")}
                  formatAxis={formatCount}
                />
              ) : (
                <EmptyState
                  compact
                  title="No clicks yet."
                  note="Visits through your links appear here."
                />
              )}
              <p className="pp-audience-split">
                {month.month}: {plural(month.viaLink, "order")} via your link ·{" "}
                {plural(month.viaCode, "order")} via your code
              </p>
              <p className="pp-chart-note">
                Codes typed at checkout are not clicks.
              </p>
            </>
          )}
        </Card>
      </div>
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
