import type { CSSProperties, ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { money } from "../../../data";
import { store, useResource } from "../../../platform/store";
import type { Order, OrderStatus, ShippingMethod } from "../../../platform/types";
import { productById } from "../../catalog";
import { Thumb, itemCount, minus } from "./Bag";
import "./checkout.css";

const NEXT = [
  { title: "Confirmed", text: "Your order is on record, with the lot number of every vial." },
  { title: "Packed and held cold", text: "Your vials are packed and held cold until they ship." },
  {
    title: "Shipped",
    text: "Sent with temperature control to your institutional address. Tracking appears in your account once it ships.",
  },
  { title: "Certificates in your account", text: "The certificate for each lot you receive is kept in your account." },
];

/** How far along "What happens next" an order is. */
const REACHED: Partial<Record<OrderStatus, number>> = { placed: 0, paid: 0, packed: 1, shipped: 2, delivered: 3 };

// In UTC, as the account and the tracker read it, so the day matches wherever it is opened.
const longDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

const stagger = (i: number) => ({ "--tm-i": i }) as CSSProperties;

function Shell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="tm-page tm-purchase">
      <section className="tm tm-purchase-empty" aria-label={label}>
        <div className="tm-empty-page">{children}</div>
      </section>
    </div>
  );
}

export default function Confirmation() {
  const { orderId = "" } = useParams();
  const order = useResource(() => store.orders.get(orderId), [orderId]);
  const methods = useResource(() => store.catalog.shippingMethods(), []);

  if (order.data === undefined && order.error) {
    return (
      <Shell label="Order">
        <p className="tm-eyebrow">Order</p>
        <h1 className="tm-display">
          The order
          <br />
          <span>could not be loaded.</span>
        </h1>
        <button type="button" className="tm-button tm-button-primary" onClick={order.reload}>
          Try again
        </button>
      </Shell>
    );
  }
  if (order.data === undefined) {
    return (
      <div className="tm-page tm-purchase">
        <section className="tm tm-night tm-confirm-hero is-loading" aria-busy="true" aria-label="Order">
          <p className="tm-confirm-loading" role="status">
            Loading the order…
          </p>
        </section>
      </div>
    );
  }
  if (order.data === null) {
    return (
      <Shell label="Order not found">
        <p className="tm-eyebrow">Order not found</p>
        <h1 className="tm-display">
          No order matches
          <br />
          <span className="tm-mono tm-confirm-missing">{orderId || "this link"}</span>
        </h1>
        <p className="tm-section-note">
          Orders placed in this design preview are kept in the browser that placed them. Check the
          link, or find the order in your research account.
        </p>
        <div className="tm-step-actions">
          <Link className="tm-button tm-button-primary" to="/account">
            Your research account
          </Link>
          <Link className="tm-textlink" to="/products">
            Shop the collection <ArrowRight size={16} strokeWidth={1.6} />
          </Link>
        </div>
      </Shell>
    );
  }

  const placed = order.data;
  return <Placed order={placed} method={methods.data?.find((m) => m.id === placed.shipping.method)} />;
}

function Placed({ order, method }: { order: Order; method?: ShippingMethod }) {
  const cancelled = order.status === "cancelled" || order.status === "refunded";
  const reached = REACHED[order.status] ?? 0;
  const count = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const { address } = order;

  return (
    <div className="tm-page tm-purchase tm-confirm">
      <section className="tm tm-night tm-confirm-hero" aria-labelledby="tm-confirm-title">
        <div className="tm-confirm-copy">
          <p className="tm-eyebrow">
            {cancelled ? "Order cancelled" : "Order placed"} · {longDate(order.createdAt)}
          </p>
          <h1 id="tm-confirm-title" className="tm-display">
            Order <span className="tm-mono tm-confirm-number">{order.number}</span>
            <br />
            <span>{cancelled ? "was cancelled." : "is placed."}</span>
          </h1>
          <p className="tm-lead">
            {cancelled
              ? "Nothing in it will ship. The record stays in your research account."
              : "It is on file in your research account, with the lot number of every vial."}
          </p>
          {!cancelled && (
            <div className="tm-actions">
              <Link className="tm-textlink" to={`/track/${order.number}`}>
                Track this order <ArrowRight size={16} strokeWidth={1.6} />
              </Link>
            </div>
          )}
        </div>

        {!cancelled && (
          <div className="tm-next">
            <h2 className="tm-eyebrow tm-next-title">What happens next</h2>
            <ol className="tm-next-steps">
              {NEXT.map((step, i) => {
                const state = i < reached ? "is-done" : i === reached ? "is-current" : "";
                return (
                  <li
                    key={step.title}
                    className={`tm-next-step ${state}`}
                    style={stagger(i)}
                    aria-current={i === reached ? "step" : undefined}
                  >
                    <span className="tm-next-mark" aria-hidden="true">
                      <i />
                    </span>
                    <span className="tm-next-index">0{i + 1}</span>
                    <h3 className="tm-next-name">{step.title}</h3>
                    <p className="tm-next-text">{step.text}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>

      <section className="tm tm-confirm-details" aria-labelledby="tm-confirm-lines-title">
        <div className="tm-confirm-lines">
          <div className="tm-confirm-lines-head">
            <h2 id="tm-confirm-lines-title" className="tm-confirm-subtitle">
              In this order
            </h2>
            <p className="tm-confirm-count">{itemCount(count)}</p>
          </div>
          <ul className="tm-confirm-list">
            {order.lines.map((line) => {
              const product = productById(line.productId);
              return (
                <li className="tm-confirm-line" key={`${line.productId}-${line.lot}`}>
                  {product && <Thumb product={product} size="lg" />}
                  <div className="tm-confirm-line-body">
                    <p className="tm-confirm-name">{product?.name ?? line.productId}</p>
                    <p className="tm-confirm-price">{money(line.unitPrice * line.quantity)}</p>
                    <p className="tm-line-meta">
                      {product ? `${product.size} · ` : ""}Qty {line.quantity} · {money(line.unitPrice)} each
                    </p>
                    <Link className="tm-lot-card" to={`/verify?lot=${encodeURIComponent(line.lot)}`}>
                      <span className="tm-lot-card-label">Lot</span>
                      <span className="tm-mono tm-lot-card-number">{line.lot}</span>
                      <span className="tm-lot-card-action">
                        Read the record <ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" />
                      </span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="tm-summary tm-confirm-summary" aria-label="Order details">
          <dl className="tm-totals">
            <div className="tm-totals-row">
              <dt>Subtotal</dt>
              <dd>{money(order.subtotal)}</dd>
            </div>
            {order.discount && (
              <div className="tm-totals-row">
                <dt>
                  {order.discount.partnerId ? "Partner code" : "Promo code"}{" "}
                  <span className="tm-mono">{order.discount.code}</span>
                </dt>
                <dd>{minus(order.discount.amount)}</dd>
              </div>
            )}
            <div className="tm-totals-row">
              <dt>
                Shipping<span className="tm-totals-sub"> · sample rate</span>
              </dt>
              <dd>{money(order.shipping.price)}</dd>
            </div>
            <div className="tm-totals-row">
              <dt>Tax</dt>
              <dd className="tm-totals-quiet">Calculated at launch</dd>
            </div>
          </dl>
          <p className="tm-totals-row tm-totals-total">
            <span>Total</span>
            <span>{money(order.total)}</span>
          </p>

          <div className="tm-confirm-facts">
            <div>
              <h3 className="tm-confirm-fact-title">Ship to</h3>
              <p className="tm-confirm-fact">
                {address.institution}
                <br />
                Attn. {address.attention}
                <br />
                {address.line1}
                {address.line2 && `, ${address.line2}`}
                <br />
                {address.city}, {address.region} {address.postal}
              </p>
            </div>
            <div>
              <h3 className="tm-confirm-fact-title">Delivery</h3>
              <p className="tm-confirm-fact">
                {method ? method.label : "Cold chain"}
                {method && (
                  <>
                    <br />
                    {method.detail}
                  </>
                )}
              </p>
            </div>
          </div>

          <Link className="tm-button tm-button-primary tm-button-block" to={`/account/orders/${order.id}`}>
            View in your account
          </Link>
          <p className="tm-summary-note">Design preview · sample data. No payment was collected.</p>
        </aside>
      </section>
    </div>
  );
}
