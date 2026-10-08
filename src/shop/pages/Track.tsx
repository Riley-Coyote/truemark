import { LIVE } from "../../platform/mode";
import type { TrackedOrder } from "../../platform/live/rows";
import { EMAIL, ORDER_NUMBER, lookUp, normaliseNumber } from "../track-lookup";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CircleAlert } from "lucide-react";
import { assetUrl } from "../../assetUrl";
import { Tracker, estimatedDelivery, eventAt, weekdayDate } from "../../brand/Tracker";
import { useMediaQuery } from "../motion";
import { store, useResource } from "../../platform/store";
import type { Lot, Order, ShippingMethod } from "../../platform/types";
import "../../brand/track-page.css";

/*
 * Where an order is, for anyone who placed one: the order number and the email it
 * was placed with open its tracker, no account needed. The signed-in owner of an
 * order goes straight to it from /track/<number>.
 */

const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const longDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${LONG_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/** The order's state in a line, and a softer second line. */
function headline(order: Order): [string, string] {
  switch (order.status) {
    case "placed":
      return ["Order placed.", "It is packed cold once payment is confirmed."];
    case "paid":
      return ["Payment confirmed.", "Next, it is packed cold."];
    case "packed":
      return ["Packed cold.", "Held cold until it ships."];
    case "shipped": {
      const estimate = estimatedDelivery(order);
      return ["On its way.", estimate ? `Estimated ${weekdayDate(estimate)}.` : "Shipped with temperature control when applicable."];
    }
    case "delivered": {
      const at = eventAt(order, "delivered");
      return ["Delivered.", at ? `On ${weekdayDate(at)}.` : "The certificate for each lot is below."];
    }
    default:
      return [order.status === "refunded" ? "Refunded." : "Cancelled.", "Nothing in it will ship."];
  }
}

const rise = (i: number) => ({ "--tm-i": i }) as CSSProperties;

export default function Track() {
  const { number: param } = useParams();
  const navigate = useNavigate();
  const { key } = useLocation();
  const wanted = param ? normaliseNumber(param) : "";

  const session = useResource(() => store.session.get(), []);
  const methods = useResource(() => store.catalog.shippingMethods(), []);
  const lots = useResource(() => store.lots.list(), []);
  const [tracked, setTracked] = useState<TrackedOrder | null>(null);
  const [unlocked, setUnlocked] = useState<string | null>(null);
  const buyerId = session.data?.id;

  // The page reads an order only when it may show it: unlocked by its email in this
  // visit, or possibly the signed-in buyer's own (checked against the owner below).
  const target = wanted && ((!LIVE && unlocked === wanted) || buyerId) ? wanted : "";
  const order = useResource(() => (target ? store.orders.get(target) : Promise.resolve(null)), [target]);
  const direct =
    order.data && order.data.number === target && (unlocked === order.data.number || order.data.buyerId === buyerId)
      ? order.data
      : null;
  const found = direct ?? (LIVE && tracked?.number === wanted ? tracked : null);
  const owner = Boolean(direct && buyerId && direct.buyerId === buyerId);
  const resolving = session.loading && session.data === undefined ? true : Boolean(target) && order.loading && !found;

  useEffect(() => {
    document.title = `${found ? `Order ${found.number} · Tracking` : "Track an order"} — TrueMark BioLabs`;
  }, [found, key]);

  return (
    <div className="tm-page tm-trackpage">
      {found ? (
        <Status
          order={found}
          owner={owner}
          method={methods.data?.find((m) => m.id === found.shipping.method)}
          lots={lots.error ? null : lots.data}
          onAnother={() => {
            setUnlocked(null); setTracked(null);
            navigate("/track");
          }}
        />
      ) : resolving ? (
        <section className="tm tm-trackpage-lookup" aria-busy="true" aria-label="Track an order">
          <p className="tm-trackpage-finding" role="status">
            Finding the order…
          </p>
        </section>
      ) : (
        <Lookup
          key={wanted}
          wanted={wanted}
          signedIn={Boolean(buyerId)}
          onFound={(match) => {
            setUnlocked(match.number);
            if (LIVE && "city" in match) setTracked(match);
            navigate(`/track/${match.number}`, { replace: Boolean(param) });
          }}
        />
      )}
      <Help />
    </div>
  );
}

function Lookup({ wanted, signedIn, onFound }: { wanted: string; signedIn: boolean; onFound: (order: Order | TrackedOrder) => void }) {
  const [number, setNumber] = useState(wanted);
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ number?: string; email?: string }>({});
  const [checking, setChecking] = useState(false);
  const [missed, setMissed] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const missRef = useRef<HTMLParagraphElement>(null);
  const wide = useMediaQuery("(min-width: 961px)");
  const frost = {
    src: assetUrl("images/scenes/frost.webp"),
    srcSet: `${assetUrl("images/scenes/frost-sm.webp")} 800w, ${assetUrl("images/scenes/frost.webp")} 1600w`,
  };

  // Arriving at /track/<number>, the number is known: the email is what's left.
  useEffect(() => {
    if (wanted) emailRef.current?.focus({ preventScroll: true });
  }, [wanted]);

  useEffect(() => {
    if (missed) missRef.current?.focus();
  }, [missed]);

  const numberError = (value: string) =>
    ORDER_NUMBER.test(normaliseNumber(value)) ? undefined : "Enter the order number from your confirmation: TM- and five digits.";
  const emailError = (value: string) => (EMAIL.test(value.trim()) ? undefined : "Enter the email the order was placed with.");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = { number: numberError(number), email: emailError(email) };
    setErrors(next);
    setMissed(false);
    setFailed(null);
    if (next.number) return numberRef.current?.focus();
    if (next.email) return emailRef.current?.focus();
    setChecking(true);
    try {
      const match = await lookUp(normaliseNumber(number), email);
      if (match) onFound(match);
      else {
        setChecking(false);
        setMissed(true);
      }
    } catch (error) {
      setChecking(false);
      setFailed(LIVE && error instanceof Error && error.message === "Too many lookups for this order. Try again in an hour." ? error.message : "The order could not be looked up just now. Nothing was changed; try again.");
    }
  }

  return (
    <section className="tm tm-trackpage-lookup" aria-labelledby="tm-track-title">
      <div className="tm-trackpage-copy tm-trackpage-rise">
        <p className="tm-eyebrow">Track an order</p>
        <h1 id="tm-track-title" className="tm-page-title">
          Cold from our freezer
          <br />
          <span>to your dock.</span>
        </h1>
        <p className="tm-section-note">
          {wanted
            ? `Enter the email order ${wanted} was placed with to see where it is.`
            : "Enter your order number and the email it was placed with to see where it is."}
        </p>

        <form className="tm-trackpage-form" onSubmit={submit} noValidate aria-label="Find an order">
          <div className={`tm-trackpage-field${errors.number ? " is-invalid" : ""}`}>
            <label htmlFor="tm-track-number">Order number</label>
            <input
              ref={numberRef}
              id="tm-track-number"
              className="tm-mono"
              value={number}
              onChange={(e) => {
                setNumber(e.target.value);
                if (errors.number) setErrors((current) => ({ ...current, number: numberError(e.target.value) }));
              }}
              placeholder="TM-00000"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={16}
              aria-invalid={errors.number ? true : undefined}
              aria-describedby={errors.number ? "tm-track-number-error" : "tm-track-number-hint"}
            />
            {errors.number ? (
              <p id="tm-track-number-error" className="tm-trackpage-error">
                <CircleAlert size={14} strokeWidth={1.8} aria-hidden="true" />
                {errors.number}
              </p>
            ) : (
              <p id="tm-track-number-hint" className="tm-trackpage-hint">
                On your order confirmation.
              </p>
            )}
          </div>
          <div className={`tm-trackpage-field${errors.email ? " is-invalid" : ""}`}>
            <label htmlFor="tm-track-email">Email</label>
            <input
              ref={emailRef}
              id="tm-track-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((current) => ({ ...current, email: emailError(e.target.value) }));
              }}
              placeholder="name@institution.edu"
              autoComplete="email"
              spellCheck={false}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "tm-track-email-error" : undefined}
            />
            {errors.email && (
              <p id="tm-track-email-error" className="tm-trackpage-error">
                <CircleAlert size={14} strokeWidth={1.8} aria-hidden="true" />
                {errors.email}
              </p>
            )}
          </div>
          <div className="tm-trackpage-actions">
            <button type="submit" className="tm-button tm-button-primary" disabled={checking}>
              {checking ? "Finding the order…" : "Track order"}
            </button>
          </div>
          <div className="tm-trackpage-live" aria-live="polite">
            {missed && (
              <p ref={missRef} className="tm-trackpage-miss" tabIndex={-1}>
                No order matches that number and email. Check both against your order confirmation, or write to{" "}
                <a className="tm-trackpage-mail" href="mailto:orders@truemarkbiolabs.com">
                  orders@truemarkbiolabs.com
                </a>
                .
              </p>
            )}
            {failed && (
              <p className="tm-trackpage-miss">
                {failed}
              </p>
            )}
          </div>
        </form>

        <p className="tm-trackpage-account">
          {signedIn ? "Every order you place is also in " : "Research account holders can also follow every order in "}
          <Link className="tm-textlink" to="/account/orders">
            {signedIn ? "your account" : "their account"}
            <ArrowRight size={16} strokeWidth={1.6} />
          </Link>
        </p>
      </div>
      <figure className="tm-trackpage-photo tm-trackpage-rise" style={rise(1)}>
        {/* Narrow screens hide the photograph (track-page.css), so they never download it. */}
        {wide && <img src={frost.src} srcSet={frost.srcSet} sizes="40vw" width={1600} height={1062} alt="" />}
      </figure>
    </section>
  );
}

function Status({
  order,
  owner,
  method,
  lots,
  onAnother,
}: {
  order: Order | TrackedOrder;
  owner: boolean;
  method?: ShippingMethod;
  lots?: Lot[] | null;
  onAnother: () => void;
}) {
  // Tracker reads only status, events, shipping and parcel lines. The public
  // result deliberately lacks money and buyer identity; no fields are invented.
  const presentation = order as Order;
  const [title, line] = headline(presentation);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // A found order takes focus, so its state is what a screen reader reads next.
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [order.number]);

  return (
    <section className="tm tm-trackpage-status" aria-labelledby="tm-track-title">
      <header className="tm-trackpage-head tm-trackpage-rise">
        <p className="tm-eyebrow">
          Order <span className="tm-mono">{order.number}</span> · Placed {longDate(order.createdAt)}
        </p>
        <h1 id="tm-track-title" ref={titleRef} className="tm-page-title" tabIndex={-1}>
          {title}
          <br />
          <span>{line}</span>
        </h1>
      </header>
      <div className="tm-trackpage-aside tm-trackpage-rise" style={rise(1)}>
        {owner ? (
          <Link className="tm-textlink" to={`/account/orders/${(order as Order).id}`}>
            Open it in your account <ArrowRight size={16} strokeWidth={1.6} />
          </Link>
        ) : (
          <button type="button" className="tm-textlink tm-trackpage-another" onClick={onAnother}>
            Track another order <ArrowRight size={16} strokeWidth={1.6} />
          </button>
        )}
      </div>
      <div className="tm-trackpage-tracker tm-trackpage-rise" style={rise(2)}>
        <Tracker key={order.number} order={presentation} method={method} lots={lots} />
      </div>
    </section>
  );
}

/** The client's route for shipping questions, and the Handling page's closing prompt. */
function Help() {
  return (
    <section className="tm tm-trackpage-help" aria-labelledby="tm-track-help-title">
      <div className="tm-trackpage-help-contact">
        <h2 id="tm-track-help-title" className="tm-trackpage-help-title">
          Orders &amp; shipping
        </h2>
        <p className="tm-trackpage-help-text">Order status, cold-chain shipments, receiving questions, and returns.</p>
        <a className="tm-textlink" href="mailto:orders@truemarkbiolabs.com">
          orders@truemarkbiolabs.com
        </a>
        <p className="tm-trackpage-help-hours">Mon–Fri · 9:00–17:00 ET · Response within 1 business day</p>
      </div>
      <div className="tm-trackpage-help-verify">
        <p className="tm-trackpage-help-line">
          Checking a delivery?
          <br />
          <span>Verify each vial&rsquo;s lot now.</span>
        </p>
        <Link className="tm-button tm-button-outline" to="/verify">
          Verify a lot
        </Link>
      </div>
    </section>
  );
}
