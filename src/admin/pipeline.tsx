/**
 * The orders pipeline, in the tracker's language: five stages on one hairline, a
 * node per stage. Open stages count the orders in them now and say how long the
 * oldest has waited; a stage whose oldest order has waited past its mark takes the
 * pending tone and says so. Delivered and the quiet cancelled count at the end cover the
 * orders placed in the last 30 days, as the Orders page's 30-day filter does. Every stage opens the Orders page filtered to it.
 */
import { useId } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "../app-kit";
import { STAGES, STAGE_LIMIT, formatLimit, formatWait, orderCount } from "./metrics";
import type { OpenStage, Stage, StageFigures } from "./metrics";
import { HOME } from "./nav";
import { CountingCount } from "./pulse";

const NAMES: Record<Stage, string> = { placed: "Placed", paid: "Paid", packed: "Packed", shipped: "Shipped", delivered: "Delivered" };

/** What the stage says under its count, and the same said in full for a screen reader. */
function describe(s: StageFigures) {
  if (s.stage === "delivered") {
    return { wait: "from the last 30 days", late: null, spoken: `${orderCount(s.count)} delivered, of the orders placed in the last 30 days` };
  }
  const limit = formatLimit(STAGE_LIMIT[s.stage as OpenStage]);
  const late = s.late > 0 ? `past ${limit}` : null;
  if (s.oldest === null) return { wait: "none waiting", late, spoken: `no orders waiting` };
  const oldest = formatWait(s.oldest);
  return {
    wait: `oldest ${oldest}`,
    late,
    spoken: `${orderCount(s.count)}, the oldest waiting ${oldest}${late ? `, past its ${limit} mark` : ""}`,
  };
}

function StageItem({ s }: { s: StageFigures }) {
  const { wait, late, spoken } = describe(s);
  return (
    <li className="cc-stage" data-late={late ? "" : undefined} data-empty={s.count === 0 ? "" : undefined}>
      <Link
        className="cc-stage-link"
        to={`${HOME}/orders?status=${s.stage}${s.stage === "delivered" ? "&days=30" : ""}`}
        aria-label={`${NAMES[s.stage]}: ${spoken}. Show these orders.`}
      >
        <span className="cc-stage-node" aria-hidden="true" />
        <span className="cc-stage-name">{NAMES[s.stage]}</span>
        <span className="cc-stage-count">
          <CountingCount value={s.count} />
        </span>
        <span className="cc-stage-wait">
          {wait}
          {late && (
            <>
              {" · "}
              <span className="cc-stage-late">{late}</span>
            </>
          )}
        </span>
      </Link>
    </li>
  );
}

export function Pipeline({ figures, className }: { figures: { stages: StageFigures[]; cancelled: number } | null; className?: string }) {
  const titleId = useId();
  return (
    <section className={`kit-card cc-pipe${className ? ` ${className}` : ""}`} aria-labelledby={titleId}>
      <header className="kit-card-head">
        <h2 id={titleId} className="kit-card-title">
          Pipeline
        </h2>
        <p className="kit-card-meta">Open orders now · delivered and cancelled from the last 30 days</p>
      </header>
      <div className="cc-pipe-body">
        <ol className="cc-pipe-track" aria-label={figures ? "Orders by stage" : "Loading orders by stage"}>
          {figures
            ? figures.stages.map((s) => <StageItem key={s.stage} s={s} />)
            : STAGES.map((stage) => (
                <li key={stage} className="cc-stage" data-empty="">
                  <span className="cc-stage-link" aria-disabled="true">
                    <span className="cc-stage-node" aria-hidden="true" />
                    <span className="cc-stage-name">{NAMES[stage]}</span>
                    <span className="cc-stage-count" aria-hidden="true">
                      <Skeleton width="2ch" height="0.7em" />
                    </span>
                    <span className="cc-stage-wait" aria-hidden="true">
                      <Skeleton width="60%" />
                    </span>
                  </span>
                </li>
              ))}
        </ol>
        {figures && (
          <Link
            className="cc-pipe-cancelled"
            to={`${HOME}/orders?status=cancelled&days=30`}
            aria-label={`${orderCount(figures.cancelled)} cancelled, of the orders placed in the last 30 days. Show them.`}
          >
            <span className="cc-pipe-cancelled-count">
              <CountingCount value={figures.cancelled} /> cancelled
            </span>
            <span className="cc-stage-wait">from the last 30 days</span>
          </Link>
        )}
      </div>
    </section>
  );
}
