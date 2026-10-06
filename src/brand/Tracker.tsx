import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { LIVE } from "../platform/mode";
import type { Lot, Order, OrderEvent, OrderStatus, PaymentStatus, ShippingMethod } from "../platform/types";
import { productById, productCutout } from "../shop/catalog";
import { usePrefersReducedMotion } from "../shop/motion";
import { tone } from "../shop/ui";
import "./tracker.css";

/** The carrier's own tracking page, for the carriers a ShipStation label can name. */
function carrierTracking(carrier: string | undefined, tracking: string): string | null {
  const name = (carrier ?? "").toLowerCase();
  const number = encodeURIComponent(tracking);
  if (name.startsWith("ups")) return `https://www.ups.com/track?tracknum=${number}`;
  if (name.startsWith("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${number}`;
  if (name.includes("usps") || name.includes("stamps")) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`;
  if (name.startsWith("dhl")) return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${number}`;
  return null;
}

/*
 * An order's journey, in the home page's paper-trail language: five stations on a
 * hairline and the logo's dot travelling to where the parcel is now. When the order
 * moves on while the page is open, the dot travels the next leg.
 */

/** The client's own words: Handling (shipping and cold chain) and the Shipping Policy. */
export const COLD_CHAIN = [
  "When applicable, vials ship in insulated packs sized to the transit time, with gel packs rated for the route.",
  "Orders ship with signature on delivery.",
] as const;
export const ON_ARRIVAL = "Move vials to −20 °C promptly, check seals, and verify each lot number against its CoA.";
export const ESTIMATES_NOTE = "Delivery times are estimates and are not guaranteed.";
export const PROCESSING_NOTE = "Orders are typically processed within 1–3 business days after payment is confirmed.";

export const JOURNEY: OrderStatus[] = ["placed", "paid", "packed", "shipped", "delivered"];

export const STATION_LABEL: Record<OrderStatus, string> = {
  placed: "Placed",
  paid: "Paid",
  packed: "Packed cold",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const SENTENCE: Record<OrderStatus, string> = {
  placed: "is placed",
  paid: "is paid",
  packed: "is packed cold",
  shipped: "has shipped",
  delivered: "was delivered",
  cancelled: "was cancelled",
  refunded: "was refunded",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 86_400_000;
/** The pause before the dot sets off, and one leg of its journey (matches --tm-tracker-leg). */
const LEAD_IN_MS = 400;
const LEG_MS = 720;
/** How long "Copied" stays before the button reads "Copy" again. */
const COPIED_MS = 2400;

/**
 * Dates read in UTC, as everywhere in the account, so a record reads the same
 * wherever it is opened. A date never breaks across lines.
 */
export const dayMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
/** "Tue 29 Sep" */
export const weekdayDate = (iso: string) => `${WEEKDAYS[new Date(iso).getUTCDay()]} ${dayMonth(iso)}`;
const clock = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
};

const closes = (status: OrderStatus) => status === "cancelled" || status === "refunded";
export const isClosed = (order: Order) => closes(order.status);

/** The steps an order took, in time order. A cancellation or refund ends the journey: nothing after it counts. */
export function journeyEvents(order: Order): OrderEvent[] {
  const sorted = [...order.events].sort((a, b) => a.at.localeCompare(b.at));
  const end = sorted.findIndex((event) => closes(event.status));
  return end === -1 ? sorted : sorted.slice(0, end + 1);
}

/** When the order reached a step on its journey, if it did. */
export const eventAt = (order: Order, status: OrderStatus) => journeyEvents(order).find((e) => e.status === status)?.at;

/**
 * The payment as it should read. Marking an order paid records the step, but the
 * preview store leaves its payment "authorized"; once the paid step exists, the
 * payment has been captured.
 */
export const paymentOf = (order: Order): PaymentStatus =>
  order.payment === "authorized" && eventAt(order, "paid") ? "captured" : order.payment;

/** Business days in transit for the order's cold-chain method: two, or overnight. */
export const transitDays = (order: Order) => (order.shipping.method === "cold-overnight" ? 1 : 2);

/** A date some business days after a moment, skipping Saturdays and Sundays. */
export function addBusinessDays(iso: string, days: number): string {
  const d = new Date(iso);
  let date = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12);
  let left = days;
  while (left > 0) {
    date += DAY_MS;
    const weekday = new Date(date).getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return new Date(date).toISOString();
}

/** When a shipped order should arrive: two business days after shipping, or the next business day. */
export function estimatedDelivery(order: Order): string | undefined {
  const shipped = eventAt(order, "shipped");
  return shipped && !eventAt(order, "delivered") ? addBusinessDays(shipped, transitDays(order)) : undefined;
}

/** The estimate before there is a shipping date. */
export const transitPhrase = (order: Order) =>
  order.shipping.method === "cold-overnight" ? "The next business day after it ships" : "2 business days after it ships";

export const statusSentence = (order: Order) => `Order ${order.number} ${SENTENCE[order.status]}.`;

type Station = { status: OrderStatus; at?: string; estimate?: string };

function stationsFor(order: Order): Station[] {
  if (isClosed(order)) {
    // A closed order shows only the steps it took, ending where it stopped.
    const seen = new Set<OrderStatus>();
    return journeyEvents(order)
      .filter((event) => {
        if (seen.has(event.status)) return false;
        seen.add(event.status);
        return true;
      })
      .map((event) => ({ status: event.status, at: event.at }));
  }
  const estimate = estimatedDelivery(order);
  return JOURNEY.map((status) => ({
    status,
    at: eventAt(order, status),
    estimate: status === "delivered" ? estimate : undefined,
  }));
}

/**
 * Where the dot is. It waits until the track is in view, then travels one leg at a
 * time to the order's station; a later step arriving live travels the next leg.
 * Reduced motion: it is simply there.
 */
function useTravel(target: number) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [shown, setShown] = useState(-1);
  const [moving, setMoving] = useState(false);
  const lastMove = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  useEffect(() => {
    if (reduced || !inView || shown >= target) return;
    const since = performance.now() - lastMove.current;
    const delay = shown < 0 ? LEAD_IN_MS : Math.max(0, LEG_MS - since);
    const timer = window.setTimeout(() => {
      lastMove.current = performance.now();
      setMoving(true);
      setShown((s) => Math.min(s + 1, target));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [reduced, inView, shown, target]);

  // The line only animates while a leg is travelled; at rest it simply sits at its
  // station, so a resize (or a full-page capture) never replays a leg.
  useEffect(() => {
    if (!moving) return;
    const timer = window.setTimeout(() => setMoving(false), LEG_MS);
    return () => window.clearTimeout(timer);
  }, [moving, shown]);

  return { ref, at: reduced ? target : Math.min(shown, target), moving: moving && !reduced };
}

function CopyNumber({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "selected">("idle");
  const valueId = useId();

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      // Without clipboard access, select the number so it can be copied by hand.
      const el = document.getElementById(valueId);
      const selection = window.getSelection();
      if (el && selection) {
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setState("selected");
    }
  }

  return (
    <span className="tm-tracker-number">
      <span id={valueId} className="tm-tracker-value tm-mono">
        {text}
      </span>
      <button type="button" className="tm-tracker-copy" onClick={copy} aria-describedby={valueId}>
        {state === "copied" ? <Check size={14} strokeWidth={1.8} aria-hidden="true" /> : <Copy size={14} strokeWidth={1.6} aria-hidden="true" />}
        {state === "copied" ? "Copied" : state === "selected" ? "Selected" : "Copy"}
      </button>
      <span className="sr-only" aria-live="polite">
        {state === "copied" ? "Tracking number copied." : state === "selected" ? "Tracking number selected." : ""}
      </span>
    </span>
  );
}

export function Tracker({
  order,
  method,
  lots,
  parcel = true,
}: {
  order: Order;
  /** The order's shipping method, for its name ("Cold chain · 2 business days"). */
  method?: ShippingMethod;
  /** Lot records, to say whether each certificate is published yet. */
  lots?: Lot[] | null;
  /** List the parcel's lots with their certificates (the account lists them with its lines instead). */
  parcel?: boolean;
}) {
  const closed = isClosed(order);
  const stations = stationsFor(order);
  const target = closed ? stations.length - 1 : JOURNEY.indexOf(order.status);
  const { ref, at, moving } = useTravel(closed ? -1 : target);
  const settled = at === target;
  const parcelId = useId();

  const shippedAt = eventAt(order, "shipped");
  const deliveredAt = eventAt(order, "delivered");
  const estimate = estimatedDelivery(order);
  const { carrier, tracking } = order.shipping;
  const closingNote = [...order.events].reverse().find((e) => e.status === order.status)?.note;
  const vials = order.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="tm-tracker">
      <div
        ref={ref}
        className="tm-tracker-rail"
        data-started={!closed && at >= 0 ? "" : undefined}
        data-moving={moving ? "" : undefined}
        data-live={!closed && settled && !moving && order.status !== "delivered" ? "" : undefined}
        style={{ "--tm-tracker-n": stations.length, "--tm-tracker-at": closed ? stations.length - 1 : Math.max(at, 0) } as CSSProperties}
      >
        <ol className="tm-tracker-track" aria-label={`Progress of order ${order.number}`}>
          {stations.map((station, i) => {
            const lit = closed || i <= at;
            const ending = closed && i === stations.length - 1;
            return (
              <li
                key={station.status}
                className="tm-tracker-stop"
                data-lit={lit ? "" : undefined}
                data-ending={ending ? "" : undefined}
                aria-current={i === target ? "step" : undefined}
              >
                <span className="tm-tracker-node" aria-hidden="true" />
                <span className="tm-tracker-date">
                  {station.at ? (
                    <time dateTime={station.at}>{dayMonth(station.at)}</time>
                  ) : station.estimate ? (
                    <time dateTime={station.estimate.slice(0, 10)}>{dayMonth(station.estimate)}</time>
                  ) : (
                    <>
                      <span aria-hidden="true">—</span>
                      <span className="sr-only">Not yet</span>
                    </>
                  )}
                </span>
                <span className="tm-tracker-step">{STATION_LABEL[station.status]}</span>
                <span className="tm-tracker-detail">
                  {station.at ? clock(station.at) : station.estimate ? "Estimated" : " "}
                </span>
              </li>
            );
          })}
        </ol>
        {/* A closed order keeps the path it took, in ink, but no parcel travels it. */}
        <span className="tm-tracker-progress" aria-hidden="true" />
      </div>
      <p className="sr-only" aria-live="polite">
        {statusSentence(order)}
      </p>

      {closed ? (
        <p className="tm-tracker-closing">{closingNote ?? "Nothing in it will ship."}</p>
      ) : (
        <>
          <div className="tm-tracker-shipment">
            <dl className="tm-tracker-facts">
              <div>
                <dt>{deliveredAt ? "Delivered" : "Estimated delivery"}</dt>
                <dd>
                  {deliveredAt ? (
                    <span className="tm-tracker-figure">{weekdayDate(deliveredAt)}</span>
                  ) : estimate ? (
                    <span className="tm-tracker-figure">
                      {weekdayDate(estimate)}
                      <span className="tm-tracker-tag">Estimated</span>
                    </span>
                  ) : (
                    <>
                      <span className="tm-tracker-value">{transitPhrase(order)}</span>
                      {!eventAt(order, "packed") && <span className="tm-tracker-sub">{PROCESSING_NOTE}</span>}
                    </>
                  )}
                  {method && (deliveredAt || estimate) && <span className="tm-tracker-sub">{method.label}</span>}
                </dd>
              </div>
              <div>
                <dt>Carrier</dt>
                <dd>
                  {carrier ? (
                    <span className="tm-tracker-value">{carrier}</span>
                  ) : (
                    <span className="tm-tracker-sub">Named when it ships</span>
                  )}
                  {shippedAt && <span className="tm-tracker-sub">Shipped {weekdayDate(shippedAt)}</span>}
                </dd>
              </div>
              <div>
                <dt>Tracking number</dt>
                <dd>
                  {tracking ? (
                    <>
                      <CopyNumber text={tracking} />
                      {!LIVE ? (
                        <span className="tm-tracker-sub">The carrier&rsquo;s tracking page opens at launch</span>
                      ) : carrierTracking(carrier, tracking) ? (
                        <a className="tm-tracker-link" href={carrierTracking(carrier, tracking)!} target="_blank" rel="noreferrer">
                          Track with {carrier} <ArrowUpRight size={14} strokeWidth={1.6} aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="tm-tracker-sub">Use it on the carrier&rsquo;s site</span>
                      )}
                    </>
                  ) : (
                    <span className="tm-tracker-sub">Appears here once it ships</span>
                  )}
                </dd>
              </div>
            </dl>
            {!deliveredAt && <p className="tm-tracker-note">{ESTIMATES_NOTE}</p>}
          </div>

          <div className="tm-tracker-cold" data-arrival={shippedAt ? "" : undefined}>
            <p className="tm-tracker-label tm-tracker-cold-label">Cold chain</p>
            <p className="tm-tracker-text tm-tracker-cold-pack">{COLD_CHAIN[0]}</p>
            <p className="tm-tracker-text tm-tracker-cold-sign">{COLD_CHAIN[1]}</p>
            {shippedAt && (
              <>
                <p className="tm-tracker-label tm-tracker-arrival-label">On arrival</p>
                <p className="tm-tracker-text tm-tracker-arrival">{ON_ARRIVAL}</p>
              </>
            )}
          </div>
        </>
      )}

      {parcel && (
        <section className="tm-tracker-parcel" aria-labelledby={parcelId}>
          <h3 id={parcelId} className="tm-tracker-label">
            {closed ? "In the order" : "In the parcel"} <span>{vials === 1 ? "1 vial" : `${vials} vials`}</span>
          </h3>
          <ul className="tm-tracker-lots">
            {order.lines.map((line) => {
              const product = productById(line.productId);
              const record = lots?.find((l) => l.lot === line.lot);
              const published = record?.status === "released" || record?.status === "archived";
              const state = lots ? (published ? "Published" : "Pending") : undefined;
              return (
                <li key={`${line.productId}-${line.lot}`} className="tm-tracker-lot" style={product ? tone(product) : undefined}>
                  <span className="tm-tracker-vial" aria-hidden="true">
                    {product && <img src={productCutout(product, "sm")} alt="" loading="lazy" draggable={false} />}
                  </span>
                  <span className="tm-tracker-lot-name">
                    <span className="tm-tracker-lot-product">
                      {product?.name ?? line.productId} <span>{product?.size}</span>
                    </span>
                    <span className="tm-tracker-lot-id">
                      Lot <span className="tm-mono">{line.lot}</span>
                    </span>
                  </span>
                  <span className="tm-tracker-lot-qty">
                    {line.quantity} {line.quantity === 1 ? "vial" : "vials"}
                  </span>
                  <span className="tm-tracker-lot-cert">
                    <Link
                      className="tm-tracker-link"
                      to={`/verify?lot=${encodeURIComponent(line.lot)}`}
                      aria-label={`Certificate for lot ${line.lot}${state ? `, ${state.toLowerCase()}` : ""}`}
                    >
                      Certificate <ArrowUpRight size={14} strokeWidth={1.6} aria-hidden="true" />
                    </Link>
                    {state && <span className="tm-tracker-cert-state">{state}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
