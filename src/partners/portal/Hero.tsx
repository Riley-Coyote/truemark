import { LIVE } from "../../platform/mode";
import {
  MoneyFigure,
  SampleTag,
  Skeleton,
  formatDate,
  formatDay,
  formatMoney,
} from "../../app-kit";
import { CountingMoney } from "../../app-kit/motion";
import type { Partner, Referral } from "../../platform/types";
import { monthToDate, saleAge, upcoming } from "../metrics";
import { goalPace, goalProgress, roundMoney } from "../momentum";
import { Meter } from "./Momentum";

export function Hero({
  partner,
  referrals,
  goal,
  now,
  arrival,
}: {
  partner: Partner;
  referrals: Referral[] | undefined;
  goal: number;
  now: string;
  arrival?: string;
}) {
  const hour = new Date(now).getUTCHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const month = referrals ? monthToDate(referrals) : undefined;
  const progress =
    month && referrals
      ? goalProgress(referrals, month.current, goal)
      : undefined;
  const next = referrals ? upcoming(referrals) : undefined;
  const last =
    referrals?.find((r) => r.id === arrival && r.status !== "void") ??
    referrals
      ?.filter((r) => r.status !== "void")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  return (
    <section className="pp-hero kit-span-8" aria-labelledby="pp-month-title">
      <header className="pp-hero-head">
        <p className="pp-greeting">
          {greeting}, {partner.name.trim().split(/\s+/)[0]}
        </p>
        <p className="pp-sample-date">
          {!LIVE && "Sample · "}<time dateTime={now.slice(0, 10)}>{formatDate(now)}</time>
        </p>
      </header>
      {LIVE && partner.status === "paused" && <p className="kit-note">Your link is paused. Your history and payouts stay here.</p>}
      <div className="pp-hero-main">
        <h2 className="kit-label" id="pp-month-title">
          Your month
        </h2>
        {month ? (
          <>
            <p className="pp-hero-figure kit-num">
              <span className="kit-sr">
                {formatMoney(month.current)} earned in {month.month}
              </span>
              <span className="pp-hero-count" aria-hidden="true">
                <span
                  key={arrival ?? "rest"}
                  className="pp-hero-light"
                  data-arrived={arrival ? "true" : undefined}
                />
                <span className="pp-hero-final">
                  <MoneyFigure value={month.current} />
                </span>
                <span className="pp-hero-live">
                  <CountingMoney value={month.current} from={0} />
                </span>
              </span>
            </p>
            <p className="pp-hero-caption">
              {month.month} earnings · includes pending commissions
            </p>
          </>
        ) : (
          <div className="pp-list-loading" aria-label="Loading earnings">
            <Skeleton width="55%" height="5rem" />
          </div>
        )}
        {progress && month && referrals && (
          <div className="pp-hero-goal">
            <Meter share={progress.share} lit={progress.reached} />
            <p className="pp-hero-goal-line kit-num">
              {Math.round(progress.share * 100)}% of your {roundMoney(goal)}{" "}
              goal ·{" "}
              {progress.reached
                ? `${formatMoney(Math.round((month.current - goal) * 100) / 100)} past it`
                : `${formatMoney(progress.remaining)} to go`}
            </p>
            <p className="pp-hero-pace">
              {goalPace(referrals, month.current, goal, now)}
            </p>
          </div>
        )}
      </div>
      <div className="pp-hero-records">
        <p className="pp-last-sale">
          {last ? (
            <>
              <span>
                Last sale{" "}
                <time dateTime={last.createdAt}>
                  {saleAge(last.createdAt, now)}
                </time>
              </span>
              <span className="kit-num">+{formatMoney(last.commission)}</span>
              <span className="kit-mono">{last.orderNumber}</span>
            </>
          ) : referrals ? (
            "Your first referred sale will appear here."
          ) : (
            <Skeleton width="75%" />
          )}
        </p>
        <div className="pp-next-payout">
          <p className="kit-label">Next payout</p>
          <SampleTag>Sample schedule</SampleTag>
          {next ? (
            <p className="pp-payout-line kit-num">
              {formatMoney(next.approved)} arrives{" "}
              <time dateTime={next.date.slice(0, 10)}>
                {formatDay(next.date)}
              </time>
            </p>
          ) : (
            <Skeleton width="12rem" />
          )}
        </div>
      </div>
    </section>
  );
}
