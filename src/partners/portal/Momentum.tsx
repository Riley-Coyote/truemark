import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import {
  Card,
  Skeleton,
  formatCount,
  formatDay,
  formatMoney,
  plural,
} from "../../app-kit";
import type { Referral } from "../../platform/types";
import { levelProgress, milestones, roundMoney } from "../momentum";
import { percent } from "../program";

/** The adjacent words carry the numbers; the thin line is decorative. */
export function Meter({
  share,
  lit = false,
}: {
  share: number;
  lit?: boolean;
}) {
  return (
    <span
      className="pp-meter"
      style={{ "--pp-fill": Math.max(0, Math.min(share, 1)) } as CSSProperties}
      data-lit={lit ? "true" : undefined}
      aria-hidden="true"
    >
      <span className="pp-meter-fill" />
    </span>
  );
}

/** One path, then the compact current-to-next level ladder. */
export function Momentum({ referrals }: { referrals: Referral[] | undefined }) {
  const progress = referrals ? milestones(referrals) : undefined;
  const level = progress ? levelProgress(progress.orders) : undefined;
  return (
    <Card
      className="kit-span-6 pp-path"
      title="Your path"
      meta={
        progress && `${progress.reached} of ${progress.list.length} reached`
      }
    >
      {!progress || !level ? (
        <div className="pp-list-loading" aria-label="Loading your path">
          <Skeleton width="100%" />
          <Skeleton width="75%" />
          <Skeleton width="100%" />
        </div>
      ) : (
        <>
          <ol className="pp-path-stops" aria-label="Your milestones">
            {progress.list.map((m, i) => {
              const state = m.reachedAt
                ? "reached"
                : m === progress.next
                  ? "next"
                  : "ahead";
              return (
                <li
                  key={m.id}
                  data-state={state}
                  data-joined={
                    progress.list[i + 1]?.reachedAt ? "true" : undefined
                  }
                >
                  <span className="pp-path-node" aria-hidden="true" />
                  <span className="pp-path-title">
                    {m.title}
                    <span className="kit-sr">, {state}</span>
                  </span>
                  {m.reachedAt && (
                    <time dateTime={m.reachedAt} className="pp-path-date">
                      {formatDay(m.reachedAt)}
                    </time>
                  )}
                  {state === "next" && (
                    <div className="pp-path-progress">
                      <span className="pp-path-next">Up next</span>
                      <Meter share={m.current / m.target} />
                      <span>
                        {m.kind === "earned"
                          ? `${formatMoney(m.current)} of ${roundMoney(m.target)}`
                          : `${formatCount(m.current)} of ${formatCount(m.target)} orders`}
                      </span>
                      <strong>
                        {m.kind === "earned"
                          ? formatMoney(m.target - m.current)
                          : formatCount(m.target - m.current)}{" "}
                        to go
                      </strong>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="pp-path-levels" data-review="partner-levels">
            <div className="pp-path-ladder">
              <div>
                <span className="kit-label">Your level</span>
                <p>
                  {level.current.name}{" "}
                  <span className="kit-num">{percent(level.current.rate)}</span>
                </p>
              </div>
              {level.next && (
                <>
                  <ArrowRight aria-hidden="true" />
                  <div>
                    <span className="kit-label">Next level</span>
                    <p>
                      {level.next.name}{" "}
                      <span className="kit-num">
                        {percent(level.next.rate)}
                      </span>
                    </p>
                  </div>
                </>
              )}
            </div>
            <p className="pp-path-to-go">
              {level.next
                ? `${plural(level.toGo, "more referred order")} to ${level.next.name.toLowerCase()}`
                : `${plural(level.orders, "referred order")} · highest sample level reached`}
            </p>
            <p className="pp-path-sample">
              Sample levels — TrueMark sets these
            </p>
          </div>
        </>
      )}
    </Card>
  );
}
