/**
 * The partner program on the Overview, the client's first priority: the share of the
 * period's revenue that came through partners, the period's top three partners, and
 * the next payout, from the same numbers the Partners screen uses.
 */
import { useId } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Skeleton, formatDate, formatMoney, plural } from "../app-kit";
import { orderCount, percentOf } from "./metrics";
import type { NextPayout, PartnerFigures } from "./metrics";
import { HOME } from "./nav";
import { CountingMoneyText, CountingPercent } from "./pulse";

/** The next payout's figures live in metrics.ts, which the Partners screen shares. */
export { nextPayout } from "./metrics";
export type { NextPayout } from "./metrics";

export function PartnerPanel({
  figures,
  payout,
  days,
  className,
}: {
  figures: PartnerFigures | null;
  payout: NextPayout | null;
  days: number;
  className?: string;
}) {
  const titleId = useId();
  const share = figures?.share ?? 0;
  return (
    <section className={`kit-card cc-partners${className ? ` ${className}` : ""}`} aria-labelledby={titleId}>
      <header className="kit-card-head">
        <h2 id={titleId} className="kit-card-title">
          Partners
        </h2>
        <p className="kit-card-meta">Last {days} days</p>
      </header>
      <div className="kit-card-body cc-partners-body">
        {figures ? (
          <div className="cc-share">
            <p className="cc-share-line">
              <span className="kit-figure cc-share-figure">
                <CountingPercent value={percentOf(share)} />
              </span>
              <span className="cc-share-text">
                of revenue came through partners ·{" "}
                <span className="kit-num">
                  <CountingMoneyText value={figures.partnerRevenue} />
                </span>
              </span>
            </p>
            <span className="cc-share-bar" aria-hidden="true">
              <span style={{ "--cc-share": share } as CSSProperties} />
            </span>
          </div>
        ) : (
          <div className="cc-share" aria-hidden="true">
            <p className="cc-share-line">
              <span className="kit-figure cc-share-figure">
                <Skeleton width="2.4ch" height="0.7em" />
              </span>
            </p>
            <span className="cc-share-bar" />
          </div>
        )}

        <div className="cc-partners-section">
          <h3 className="kit-label">Top partners</h3>
          {!figures ? (
            <div className="cc-list-loading" aria-label="Loading partners">
              <Skeleton width="76%" />
              <Skeleton width="64%" />
              <Skeleton width="70%" />
            </div>
          ) : figures.top.length ? (
            <ol className="cc-partner-list">
              {figures.top.map((line) => (
                <li key={line.partner.id}>
                  <span className="cc-partner-name">
                    {line.partner.name} <span className="kit-mono kit-quiet">{line.partner.code}</span>
                  </span>
                  <span className="cc-partner-revenue kit-num">
                    <CountingMoneyText value={line.revenue} />
                  </span>
                  <span className="cc-partner-meta kit-num">
                    {orderCount(line.orders)} · {formatMoney(line.commission)} earned
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="cc-partners-empty">No partner orders in the last {days} days.</p>
          )}
        </div>

        <div className="cc-partners-section cc-payout">
          <h3 className="kit-label">Next payout</h3>
          {payout ? (
            <p className="cc-payout-line">
              <span className="cc-payout-date">{formatDate(payout.date)}</span>
              <span className="cc-payout-amount kit-num">
                <CountingMoneyText value={payout.amount} />
              </span>
              <span className="cc-partner-meta">
                {payout.partners ? `To ${plural(payout.partners, "partner")} by bank transfer, a sample schedule` : "Nothing approved to pay yet"}
              </span>
            </p>
          ) : (
            <Skeleton width="68%" />
          )}
        </div>

        <Link className="kit-link cc-partners-all" to={`${HOME}/partners`}>
          All partners
          <ArrowRight aria-hidden="true" strokeWidth={1.6} />
        </Link>
      </div>
    </section>
  );
}
