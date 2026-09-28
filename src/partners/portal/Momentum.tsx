/**
 * Momentum on the overview: this month against the partner's own goal, the
 * milestones they have reached (lit with the logo's dot, and dated), and the
 * sample levels ahead. Every figure comes from their own referrals; nothing
 * compares one partner with another.
 */
import { useId } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Skeleton, formatCount, formatDate, formatDay, formatMoney, plural } from "../../app-kit";
import type { Referral } from "../../platform/types";
import { SAMPLE_LEVELS, bestMonth, goalProgress, levelProgress, milestones, roundMoney } from "../momentum";
import type { Milestone } from "../momentum";
import { percent } from "../program";
import { useCountUp } from "./Moments";
import { HOME } from "./nav";

/** A card in the kit's own markup, so it can carry a review anchor. */
function MomentumCard({
  title,
  meta,
  className,
  review,
  children,
}: {
  title: string;
  meta?: ReactNode;
  className: string;
  review?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={`kit-card kit-span-4 pp-momentum ${className}`} aria-labelledby={id} data-review={review}>
      <header className="kit-card-head">
        <h2 id={id} className="kit-card-title">
          {title}
        </h2>
        {meta && <div className="kit-card-meta">{meta}</div>}
      </header>
      <div className="kit-card-body">{children}</div>
    </section>
  );
}

/** A thin line filled to a share (0–1). Decorative: the words beside it carry the figures. */
function Meter({ share, mark, lit = false }: { share: number; mark?: number; lit?: boolean }) {
  const style = { "--pp-fill": Math.max(0, Math.min(share, 1)) } as CSSProperties;
  return (
    <span className="pp-meter" style={style} data-lit={lit ? "true" : undefined} aria-hidden="true">
      <span className="pp-meter-fill" />
      {mark !== undefined && mark > 0 && mark < 1 && (
        <span className="pp-meter-mark" style={{ "--pp-at": mark } as CSSProperties} />
      )}
    </span>
  );
}

function LoadingBody() {
  return (
    <div className="pp-list-loading" aria-label="Loading">
      <Skeleton width="48%" height="1.5rem" />
      <Skeleton width="100%" />
      <Skeleton width="76%" />
    </div>
  );
}

/* ---------- This month against the goal ---------- */

function GoalCard({ referrals, current, month, goal }: { referrals: Referral[]; current: number; month: string; goal: number }) {
  const progress = goalProgress(referrals, current, goal);
  const best = bestMonth(referrals);
  const shown = useCountUp(Math.round(progress.share * 100));
  // The best month is marked on the line when it falls short of the goal; the tick beside its words is the legend.
  const mark = best && best.amount < goal ? best.amount / goal : undefined;
  const past = Math.round((current - goal) * 100) / 100;
  return (
    <MomentumCard title="Monthly goal" meta={<span className="pp-card-aside">{month}</span>} className="pp-goal">
      <p className="kit-figure pp-goal-figure">
        {Math.round(shown)}
        <small>%</small>
        <span className="pp-goal-of"> of {roundMoney(goal)}</span>
      </p>
      <Meter share={progress.share} mark={mark} lit={progress.reached} />
      <p className="pp-goal-status kit-num">
        {progress.reached ? (
          <>
            Goal reached{progress.reachedAt ? ` ${formatDay(progress.reachedAt)}` : ""}
            {past > 0 ? ` · ${formatMoney(past)} past it` : ""}
          </>
        ) : (
          <>
            {formatMoney(current)} so far · {formatMoney(progress.remaining)} to go
          </>
        )}
      </p>
      <p className="pp-goal-best">
        {mark !== undefined && <span className="pp-goal-best-mark" aria-hidden="true" />}
        {best ? (
          <span>
            Best month so far: <span className="kit-num">{formatMoney(best.amount)}</span> ({best.label})
          </span>
        ) : (
          <span>Your best month appears once a commission is approved.</span>
        )}
      </p>
      <Link className="kit-link pp-card-link" to={`${HOME}/settings`} state={{ focus: "goal", keepScroll: true }}>
        Set your goal
        <ArrowRight aria-hidden="true" strokeWidth={1.6} />
      </Link>
    </MomentumCard>
  );
}

/* ---------- Milestones ---------- */

function howFar(m: Milestone) {
  if (m.kind === "orders") {
    return {
      share: m.current / m.target,
      text: `${formatCount(m.current)} of ${formatCount(m.target)} orders · ${formatCount(m.target - m.current)} to go`,
    };
  }
  return {
    share: m.current / m.target,
    text: `${formatMoney(m.current)} of ${roundMoney(m.target)} · ${formatMoney(m.target - m.current)} to go`,
  };
}

function MilestonesCard({ referrals }: { referrals: Referral[] }) {
  const { list, next, reached } = milestones(referrals);
  return (
    <MomentumCard
      title="Milestones"
      meta={<span className="pp-card-aside kit-num">{`${reached} of ${list.length} reached`}</span>}
      className="pp-miles-card"
    >
      <ol className="pp-miles">
        {list.map((m, i) => {
          const state = m.reachedAt ? "reached" : m === next ? "next" : "ahead";
          const far = state === "next" ? howFar(m) : null;
          return (
            <li key={m.id} data-state={state} data-joined={list[i + 1]?.reachedAt ? "true" : undefined}>
              <span className="pp-mile-node" aria-hidden="true" />
              <span className="pp-mile-title">
                {m.title}
                <span className="kit-sr">{state === "reached" ? ", reached" : state === "next" ? ", next" : ", ahead"}</span>
              </span>
              {m.reachedAt && (
                <time className="pp-mile-date kit-num" dateTime={m.reachedAt.slice(0, 10)}>
                  {formatDate(m.reachedAt)}
                </time>
              )}
              {far && (
                <span className="pp-mile-far">
                  <Meter share={far.share} />
                  <span className="pp-mile-far-text kit-num">{far.text}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </MomentumCard>
  );
}

/* ---------- Levels (sample) ---------- */

function LevelsCard({ referrals }: { referrals: Referral[] }) {
  const { orders } = milestones(referrals);
  const level = levelProgress(orders);
  return (
    <MomentumCard
      title="Levels"
      meta={<span className="pp-card-aside">Sample levels — TrueMark sets these</span>}
      className="pp-levels"
      review="partner-levels"
    >
      <ol className="pp-ladder">
        {SAMPLE_LEVELS.map((l, i) => {
          const state = i < level.index ? "passed" : i === level.index ? "current" : "ahead";
          const style = state === "current" ? ({ "--pp-fill": level.share } as CSSProperties) : undefined;
          return (
            <li key={l.id} data-state={state} style={style}>
              <span className="pp-ladder-node" aria-hidden="true" />
              <span className="pp-ladder-name">
                {l.name}
                {state === "current" && <span className="kit-sr">, your level</span>}
              </span>
              <span className="pp-ladder-rate kit-num">{percent(l.rate)}</span>
              <span className="pp-ladder-note kit-num">
                {state === "current"
                  ? `Your level · ${plural(orders, "referred order")}`
                  : state === "passed"
                    ? l.from === 0
                      ? "Where every partner starts"
                      : `Reached at ${formatCount(l.from)} referred orders`
                    : i === level.index + 1
                      ? `At ${formatCount(l.from)} referred orders · ${formatCount(level.toGo)} to go`
                      : `At ${formatCount(l.from)} referred orders`}
              </span>
            </li>
          );
        })}
      </ol>
    </MomentumCard>
  );
}

/** The three momentum cards, or their loading state. */
export function Momentum({
  referrals,
  current,
  month,
  goal,
}: {
  referrals: Referral[] | undefined;
  current: number | undefined;
  month: string | undefined;
  goal: number;
}) {
  if (!referrals || current === undefined || !month) {
    return (
      <>
        <MomentumCard title="Monthly goal" className="pp-goal">
          <LoadingBody />
        </MomentumCard>
        <MomentumCard title="Milestones" className="pp-miles-card">
          <LoadingBody />
        </MomentumCard>
        <MomentumCard title="Levels" className="pp-levels" review="partner-levels">
          <LoadingBody />
        </MomentumCard>
      </>
    );
  }
  return (
    <>
      <GoalCard referrals={referrals} current={current} month={month} goal={goal} />
      <MilestonesCard referrals={referrals} />
      <LevelsCard referrals={referrals} />
    </>
  );
}
