/**
 * The Overview's headline: the day, and the business's pulse. The day's four
 * figures count up as orders land. The Live panel lists what just happened, newest
 * first; its history is read from the store, and arrivals come from the platform's
 * event line, so an order placed in another tab, or by the live demo, rises in here
 * and is lit from beneath with the brand's light, as the live demo's frames are.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Button, Dot, EmptyState, Skeleton, formatCount, formatDate, formatDateTime, formatDifference, formatMoney, toneFor } from "../app-kit";
import type { Tone } from "../app-kit";
import { CountingMoney, useCountUp } from "../app-kit/motion";
import { onPlatformEvent } from "../platform/events";
import type { PlatformEvent } from "../platform/events";
import { worldNow } from "../platform/storage";
import type { Buyer, Order, Partner } from "../platform/types";
import { ago } from "./alerts";
import {
  TODAY_ISO,
  formatMoneyChange,
  formatShareChange,
  percentOf,
  pulseSentence,
  referralKey,
  sortPulse,
  stepKey,
  todayFigures,
} from "./metrics";
import type { Change, DayFigures, PulseEvent, PulseKind } from "./metrics";
import { HOME } from "./nav";

/* ---------- The clock ---------- */

/** How often relative times ("12 min ago") are refreshed. */
const CLOCK_MS = 30_000;

/** worldNow(), refreshed every half minute and whenever something happens, so a new event is never "in the future". */
export function usePulseClock(): string {
  const [now, setNow] = useState(worldNow);
  useEffect(() => {
    const tick = () => setNow(worldNow());
    const timer = window.setInterval(tick, CLOCK_MS);
    const stop = onPlatformEvent(tick);
    return () => {
      window.clearInterval(timer);
      stop();
    };
  }, []);
  return now;
}

/* ---------- Figures that count ---------- */

/** A whole count that counts up to each new value. */
export function CountingCount({ value }: { value: number }) {
  const shown = useCountUp(value);
  return <>{formatCount(Math.round(shown))}</>;
}

/** Dollars and cents in running text ("$2,103.00"), counting up to each new value. */
export function CountingMoneyText({ value }: { value: number }) {
  const shown = useCountUp(value);
  return <>{formatMoney(Math.round(shown * 100) / 100)}</>;
}

/** A whole percent, with a quiet sign, that counts up to each new value (from `from`, when it first appears). */
export function CountingPercent({ value, from }: { value: number; from?: number }) {
  const shown = useCountUp(value, from);
  return (
    <>
      {Math.round(shown)}
      <small>%</small>
    </>
  );
}

/** A figure's change and what it is against; without a change, only the note. */
export function DeltaLine({ change, note }: { change: Change | null; note: string }) {
  const Icon = change?.direction === "up" ? ArrowUpRight : change?.direction === "down" ? ArrowDownRight : ArrowRight;
  return (
    <p className="kit-delta">
      {change && <Icon aria-hidden="true" strokeWidth={1.6} />}
      {change && <strong>{change.text}</strong>} {note}
    </p>
  );
}

/* ---------- The day ---------- */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Friday 25 September", and a greeting by the sample world's hour (UTC, as every time here). */
function dayLine(now: string) {
  const d = new Date(now);
  const hour = d.getUTCHours();
  return {
    date: `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
    greeting: hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening",
  };
}

type Figure = { key: string; label: string; figure: ReactNode; change: Change | null; note: string };

/** `from`: where a figure that was empty ("—") starts counting when the day's first order lands. */
function figuresFor(today: DayFigures, lastWeek: DayFigures, against: string, from: 0 | undefined): Figure[] {
  const vs = `vs ${against}`;
  return [
    {
      key: "orders",
      label: "Orders",
      figure: <CountingCount value={today.count} />,
      change: formatDifference(today.count, lastWeek.count),
      note: vs,
    },
    {
      key: "average",
      label: "Average order",
      figure: today.average === null ? <span aria-label="None yet">—</span> : <CountingMoney value={today.average} from={from} />,
      change: today.average !== null && lastWeek.average !== null ? formatMoneyChange(today.average, lastWeek.average) : null,
      note: today.average === null ? "No orders yet" : lastWeek.average === null ? `None ${against}` : vs,
    },
    {
      key: "partners",
      label: "Through partners",
      figure: today.partnerShare === null ? <span aria-label="None yet">—</span> : <CountingPercent value={percentOf(today.partnerShare)} from={from} />,
      change: today.partnerShare !== null && lastWeek.partnerShare !== null ? formatShareChange(today.partnerShare, lastWeek.partnerShare) : null,
      note: today.partnerShare === null ? "No orders yet" : lastWeek.partnerShare === null ? `None ${against}` : vs,
    },
  ];
}

const DAY_LABELS = ["Orders", "Average order", "Through partners"];

/** The left of the band: the date and a greeting, today's revenue as the lead figure, and three on one baseline. */
export function TodayFigures({ orders, now }: { orders: Order[] | undefined; now: string }) {
  const titleId = useId();
  const { date, greeting } = dayLine(now);
  const figures = useMemo(() => (orders ? todayFigures(orders, now) : null), [orders, now]);
  const weekAgo = new Date(Date.parse(TODAY_ISO) - 7 * 86_400_000);
  const against = `last ${WEEKDAYS[weekAgo.getUTCDay()].slice(0, 3)}`;
  // Seen with no orders yet today: the first order's average and share count up from zero, as revenue does.
  const [startedEmpty, setStartedEmpty] = useState<boolean | null>(null);
  if (figures && startedEmpty === null) setStartedEmpty(figures.today.count === 0);

  return (
    <section className="cc-day" aria-labelledby={titleId}>
      <h2 id={titleId} className="cc-day-title">
        <span className="cc-day-date">{date}</span>
        <span className="cc-day-sep" aria-hidden="true">
          ·
        </span>
        <span>{greeting}</span>
      </h2>

      <div className="cc-day-lead">
        <p className="kit-label">Revenue today</p>
        {figures ? (
          <>
            <p className="cc-day-figure kit-num">
              <CountingMoney value={figures.today.revenue} />
            </p>
            <DeltaLine change={formatMoneyChange(figures.today.revenue, figures.lastWeek.revenue)} note={`vs ${against}`} />
          </>
        ) : (
          <>
            <p className="cc-day-figure" aria-hidden="true">
              <Skeleton width="40%" height="0.6em" />
            </p>
            <p className="kit-delta" aria-hidden="true">
              <Skeleton width="28%" />
            </p>
            <span className="kit-sr">Loading today's figures</span>
          </>
        )}
      </div>

      <dl className="cc-day-row">
        {figures
          ? figuresFor(figures.today, figures.lastWeek, against, startedEmpty ? 0 : undefined).map((item) => (
              <div key={item.key} className="cc-day-item">
                <dt className="kit-label">{item.label}</dt>
                <dd className="kit-figure">{item.figure}</dd>
                <dd>
                  <DeltaLine change={item.change} note={item.note} />
                </dd>
              </div>
            ))
          : DAY_LABELS.map((label) => (
              <div key={label} className="cc-day-item">
                <dt className="kit-label">{label}</dt>
                <dd className="kit-figure" aria-hidden="true">
                  <Skeleton width="56%" height="0.7em" />
                </dd>
                <dd className="kit-delta" aria-hidden="true">
                  <Skeleton width="64%" />
                </dd>
              </div>
            ))}
      </dl>

      <p className="cc-day-note">
        Sample data through {formatDate(TODAY_ISO)}. Today is compared with {WEEKDAYS[weekAgo.getUTCDay()]}{" "}
        {weekAgo.getUTCDate()} {MONTHS[weekAgo.getUTCMonth()].slice(0, 3)} up to this hour; cancelled orders are left out.
      </p>
    </section>
  );
}

/* ---------- Live ---------- */

/** About eight events show; two more wait below the fold of the list so a new arrival pushes them in smoothly. */
const VISIBLE = 8;
const RENDERED = VISIBLE + 2;
/** Live arrivals kept in memory until the store's own record replaces them. */
const LIVE_KEEP = 24;
/**
 * How long an arrival waits for the store's record of it, so the row rises in the same
 * moment the figures start to count; if the record is slower, the event shows on its own.
 */
const HOLD_MS = 450;
/** Arrivals this close together are announced as one. */
const ANNOUNCE_TOGETHER_MS = 1500;

type Lookups = { partners: Partner[]; buyers: Buyer[] };

/** A platform event as a stream row, from what the event says and the names we already hold. */
function fromPlatform(event: PlatformEvent, { partners, buyers }: Lookups): PulseEvent | null {
  switch (event.type) {
    case "order.placed":
      return {
        key: stepKey(event.orderId, "placed", event.at),
        kind: "placed",
        at: event.at,
        orderRef: event.orderId,
        number: event.number,
        total: event.total,
        institution: buyers.find((b) => b.id === event.buyerId)?.institution ?? "Research account",
        code: event.partnerId ? partners.find((p) => p.id === event.partnerId)?.code : undefined,
      };
    case "order.status":
      if (!["paid", "packed", "shipped", "delivered", "cancelled"].includes(event.status)) return null;
      return {
        key: stepKey(event.orderId, event.status, event.at),
        kind: event.status as PulseKind,
        at: event.at,
        orderRef: event.orderId,
        number: event.number,
        carrier: event.carrier,
      };
    case "referral.created":
      return {
        key: referralKey(event.referralId),
        kind: "partner",
        at: event.at,
        // The drawer opens an order by its number as well as its id.
        orderRef: event.orderNumber,
        number: event.orderNumber,
        partner: partners.find((p) => p.id === event.partnerId)?.name,
        commission: event.commission,
      };
  }
}

const toneOf = (e: PulseEvent): Tone => (e.kind === "partner" ? "signal" : toneFor(e.kind));

const Mono = ({ children }: { children: ReactNode }) => <span className="kit-mono">{children}</span>;

/** The row's one line. A new order keeps its number, total and code in view; only the institution gives way. */
function PulseLine({ e }: { e: PulseEvent }) {
  switch (e.kind) {
    case "placed":
      // Parts are spaced by the line's gap: a flex line drops the spaces at a part's edges.
      return (
        <span className="cc-pulse-text">
          <span className="cc-pulse-fixed">
            New order <Mono>{e.number}</Mono>
            {e.total !== undefined && <> · {formatMoney(e.total)}</>}
            {e.institution && " ·"}
          </span>
          {e.institution && <span className="cc-pulse-flex">{e.institution}</span>}
          {e.code && (
            <span className="cc-pulse-fixed">
              · via <Mono>{e.code}</Mono>
            </span>
          )}
        </span>
      );
    case "partner":
      return (
        <span className="cc-pulse-text">
          <span className="cc-pulse-flex">
            {e.partner ?? "A partner"} earned {formatMoney(e.commission ?? 0)} on <Mono>{e.number}</Mono>
          </span>
        </span>
      );
    default:
      return (
        <span className="cc-pulse-text">
          <span className="cc-pulse-flex">
            <Mono>{e.number}</Mono> {e.kind}
            {e.kind === "shipped" && e.carrier && <> · {e.carrier}</>}
          </span>
        </span>
      );
  }
}

/**
 * The business's pulse. `history` is every event on file, newest first; arrivals from
 * the event line join it at once and are marked, so they rise in and glow once.
 */
export function LivePanel({
  history,
  partners,
  buyers,
  now,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  history: PulseEvent[] | undefined;
  partners: Partner[];
  buyers: Buyer[];
  now: string;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onOpen: (orderRef: string) => void;
}) {
  const titleId = useId();
  const [live, setLive] = useState<(PulseEvent & { heard: number })[]>([]);
  const [arrived, setArrived] = useState<ReadonlySet<string>>(() => new Set());
  const [held, setHeld] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [inView, setInView] = useState(false);
  const lookups = useRef<Lookups>({ partners, buyers });
  lookups.current = { partners, buyers };
  const sentinel = useRef<HTMLSpanElement>(null);
  const lastSaid = useRef({ at: 0, text: "" });

  useEffect(() => {
    const timers = new Set<number>();
    const stop = onPlatformEvent((event) => {
      const row = fromPlatform(event, lookups.current);
      if (!row) return;
      const heard = Date.now();
      setLive((list) => [{ ...row, heard }, ...list.filter((r) => r.key !== row.key)].slice(0, LIVE_KEEP));
      setArrived((keys) => new Set(keys).add(row.key));
      // Once the hold is over, the event shows even if the store's record has not come.
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        setHeld((n) => n + 1);
      }, HOLD_MS);
      timers.add(timer);
      // Events that land together (an order and the partner sale it made) are read together.
      const sentence = `${pulseSentence(row)}.`;
      const text = heard - lastSaid.current.at < ANNOUNCE_TOGETHER_MS ? `${lastSaid.current.text} ${sentence}` : sentence;
      lastSaid.current = { at: heard, text };
      setAnnouncement(text);
    });
    return () => {
      stop();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  // While the top of the stream is on screen it shows each order as it lands, so the
  // order toasts step aside (admin.css), as they already do for the open bell.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "-112px 0px -64px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);

  const rows = useMemo(() => {
    if (!history) return undefined;
    const byKey = new Map<string, PulseEvent>();
    // An arrival waits for its stored record, which lands with the figures, unless that takes too long.
    const waited = Date.now() - HOLD_MS;
    for (const { heard, ...e } of live) if (heard <= waited) byKey.set(e.key, e);
    // The stored record wins: it knows the order's id, and every name.
    for (const e of history) byKey.set(e.key, e);
    // A step stamped later in the day than the sample clock has not happened yet.
    const time = Date.parse(now);
    return sortPulse([...byKey.values()].filter((e) => Date.parse(e.at) <= time)).slice(0, RENDERED);
    // `held` re-reads the clock once an arrival's hold is over.
  }, [live, history, now, held]);

  return (
    <section className="kit-card cc-pulse" aria-labelledby={titleId} data-in-view={inView ? "" : undefined}>
      <header className="kit-card-head">
        <h2 id={titleId} className="kit-card-title cc-pulse-title">
          <span className="cc-pulse-dot" aria-hidden="true" />
          Live
        </h2>
      </header>

      {error ? (
        <EmptyState compact title="The latest events could not be loaded." note={error.message} action={<Button onClick={onRetry}>Try again</Button>} />
      ) : (
        <div className="cc-pulse-window">
          <span ref={sentinel} className="cc-pulse-sentinel" aria-hidden="true" />
          {loading || !rows ? (
            <ol className="cc-pulse-list" aria-label="Loading the latest events">
              {Array.from({ length: VISIBLE }, (_, i) => (
                <li key={i} className="cc-pulse-item">
                  <span className="cc-pulse-row" aria-disabled="true">
                    <Dot tone="neutral" />
                    <Skeleton width={`${[72, 58, 66, 50, 62, 70, 54, 60][i]}%`} />
                  </span>
                </li>
              ))}
            </ol>
          ) : rows.length ? (
            <ol className="cc-pulse-list" aria-label="The latest events, newest first">
              {rows.map((e, i) => {
                const isNew = arrived.has(e.key);
                const sentence = pulseSentence(e);
                return (
                  <li key={e.key} className="cc-pulse-item" data-arrived={isNew ? "" : undefined} inert={i >= VISIBLE}>
                    <button
                      type="button"
                      className="cc-pulse-row"
                      title={sentence}
                      aria-label={`${sentence}. ${ago(e.at, now)}. Open the order.`}
                      onClick={() => onOpen(e.orderRef)}
                    >
                      {isNew && <span className="cc-pulse-glow" aria-hidden="true" />}
                      <Dot tone={toneOf(e)} />
                      <PulseLine e={e} />
                      <time className="cc-pulse-time" dateTime={e.at} title={formatDateTime(e.at)}>
                        {ago(e.at, now)}
                      </time>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState compact title="Nothing yet." note="Orders appear here the moment they are placed." />
          )}
        </div>
      )}

      <footer className="cc-pulse-foot">
        <Link className="kit-link" to={`${HOME}/orders`}>
          See all orders
          <ArrowRight aria-hidden="true" strokeWidth={1.6} />
        </Link>
      </footer>
      <p className="kit-sr" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
