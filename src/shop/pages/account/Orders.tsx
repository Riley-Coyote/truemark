import { useId, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { Tracker, paymentOf } from "../../../brand/Tracker";
import { money } from "../../../data";
import { store, useResource } from "../../../platform/store";
import type { Buyer, Lot, Order, ShippingMethod } from "../../../platform/types";
import { tone } from "../../ui";
import { BuyerEmail, buyerEmailsFor } from "./emails";
import type { BuyerEmailKind } from "./emails";
import {
  byNewest,
  latestEvent,
  longDate,
  orderStatusLabel,
  orderTone,
  paymentLabel,
  paymentTone,
  productFor,
  shortDate,
  units,
} from "./lib";
import {
  Empty,
  Loading,
  PageHead,
  Problem,
  SampleTag,
  SectionHead,
  StatusChip,
  Thumb,
  attempt,
  useAccount,
  useReorder,
  useTitle,
} from "./parts";

/** Orders as a table whose rows open the order. Shared by the overview. */
export function OrderTable({ orders, label }: { orders: Order[]; label: string }) {
  return (
    <div className="tm-acct-table tm-acct-orders" role="table" aria-label={label}>
      <div role="rowgroup" className="tm-acct-thead">
        <div role="row" className="tm-acct-tr">
          <span role="columnheader" className="c-number">Order</span>
          <span role="columnheader" className="c-date">Placed</span>
          <span role="columnheader" className="c-items">Items</span>
          <span role="columnheader" className="c-total">Total</span>
          <span role="columnheader" className="c-status">Status</span>
        </div>
      </div>
      <div role="rowgroup">
        {orders.map((order) => (
          <div role="row" className="tm-acct-tr is-link" key={order.id}>
            <span role="cell" className="c-number">
              <Link
                className="tm-acct-rowlink tm-mono"
                to={`/account/orders/${order.id}`}
                aria-label={`Order ${order.number}, placed ${shortDate(order.createdAt)}, ${orderStatusLabel[order.status].toLowerCase()}`}
              >
                {order.number}
              </Link>
            </span>
            <span role="cell" className="c-date">
              {shortDate(order.createdAt)}
            </span>
            <span role="cell" className="c-items">
              <span className="tm-acct-names">
                {order.lines.map((line) => {
                  const product = productFor(line.productId);
                  return (
                    <span key={line.productId} style={product ? tone(product) : undefined}>
                      <i aria-hidden="true" />
                      {product ? `${product.name} ${product.size}` : line.productId}
                    </span>
                  );
                })}
              </span>
              <span className="tm-acct-units">{units(order)} vials</span>
            </span>
            <span role="cell" className="c-total">
              {money(order.total)}
            </span>
            <span role="cell" className="c-status">
              <StatusChip tone={orderTone(order.status)}>{orderStatusLabel[order.status]}</StatusChip>
              <ArrowRight className="tm-acct-go" size={16} strokeWidth={1.6} aria-hidden="true" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrderList() {
  useTitle("Your orders");
  const { orders } = useAccount();
  const list = orders.data ? [...orders.data].sort(byNewest) : undefined;
  return (
    <>
      <PageHead eyebrow="Orders" title="Your orders." sub="Each with the lots it carried." />
      {orders.error ? (
        <Problem title="Your orders could not be loaded." onRetry={orders.reload} />
      ) : !list ? (
        <Loading label="Loading your orders" rows={5} />
      ) : list.length === 0 ? (
        <Empty title="No orders yet." text="Orders you place appear here with their lots, delivery and totals.">
          <Link className="tm-textlink" to="/products">
            Shop the collection <ArrowRight size={16} strokeWidth={1.6} />
          </Link>
        </Empty>
      ) : (
        <div className="tm-acct-rise">
          <OrderTable orders={list} label="All orders" />
        </div>
      )}
    </>
  );
}

/**
 * The emails this order has produced, newest last: each opens in place to show
 * exactly what arrived. An email appears only once its step has happened, so a
 * step taken in the command center adds one here while the page is open.
 */
function OrderEmails({
  order,
  buyer,
  method,
  lots,
}: {
  order: Order;
  buyer: Buyer;
  method?: ShippingMethod;
  lots?: Lot[] | null;
}) {
  const emails = buyerEmailsFor(order);
  const [open, setOpen] = useState<BuyerEmailKind | null>(null);
  const baseId = useId();
  return (
    <section className="tm-acct-block tm-acct-rise" aria-labelledby={`${baseId}-title`} style={{ "--tm-i": 3 } as CSSProperties}>
      <SectionHead id={`${baseId}-title`} label="Emails about this order" count={emails.length} />
      <ul className="tm-acct-emails">
        {emails.map((email) => {
          const expanded = open === email.kind;
          const panelId = `${baseId}-${email.kind}`;
          return (
            <li key={email.kind} className="tm-acct-email" data-open={expanded ? "" : undefined}>
              <button
                type="button"
                className="tm-acct-email-row"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? null : email.kind)}
              >
                <span className="tm-acct-email-subject">{email.subject}</span>
                <span className="tm-acct-email-when">{shortDate(email.at)}</span>
                <ChevronDown className="tm-acct-email-chevron" size={16} strokeWidth={1.6} aria-hidden="true" />
                <span className="tm-acct-email-preheader">{email.preheader}</span>
              </button>
              <div id={panelId} className="tm-acct-email-body" hidden={!expanded}>
                {expanded && <BuyerEmail kind={email.kind} order={order} to={buyer} method={method} lots={lots} />}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="tm-acct-email-note">Design preview · emails are sent at launch.</p>
    </section>
  );
}

export function OrderDetail() {
  const { id = "" } = useParams();
  const { buyer, lots } = useAccount();
  const order = useResource(attempt(() => store.orders.get(id)), [id]);
  const methods = useResource(attempt(() => store.catalog.shippingMethods()));
  const reorder = useReorder();
  const [note, setNote] = useState("");
  const found = order.data && order.data.buyerId === buyer.id ? order.data : null;
  useTitle(found ? `Order ${found.number}` : "Order");

  if (order.data === undefined) {
    return order.error ? (
      <Problem title="This order could not be loaded." onRetry={order.reload} />
    ) : (
      <Loading label="Loading the order" rows={5} />
    );
  }
  if (!found) {
    return (
      <>
        <Crumbs number={id} />
        <Empty title="There is no order with that number in your account." text="Check the link, or find the order in your order history.">
          <Link className="tm-textlink" to="/account/orders">
            All orders <ArrowRight size={16} strokeWidth={1.6} />
          </Link>
        </Empty>
      </>
    );
  }

  const latest = latestEvent(found);
  const method = methods.data?.find((m) => m.id === found.shipping.method);
  const { address } = found;
  const vials = units(found);

  function onReorder() {
    const result = reorder(found!);
    setNote(
      result.missing
        ? `Added ${result.added} of ${found!.lines.length} items to your bag. The rest are no longer in the collection.`
        : `Added ${vials} ${vials === 1 ? "vial" : "vials"} to your bag.`,
    );
  }

  return (
    <>
      <Crumbs number={found.number} />
      <PageHead
        eyebrow={
          <>
            Order <span className="tm-mono">{found.number}</span>
          </>
        }
        title={`${orderStatusLabel[found.status]}.`}
        sub={`${longDate(latest.at)}.`}
      >
        <div className="tm-acct-actions">
          <button type="button" className="tm-button tm-button-primary" onClick={onReorder}>
            Reorder
          </button>
          <span className="tm-acct-later">
            <button type="button" className="tm-acct-quiet" disabled aria-describedby="tm-acct-invoice-note">
              Invoice
            </button>
            <span id="tm-acct-invoice-note">Available at launch</span>
          </span>
        </div>
        <p className="tm-acct-live" aria-live="polite">
          {note}
        </p>
      </PageHead>

      <section className="tm-acct-block tm-acct-rise tm-acct-tracking" aria-label="Tracking">
        <Tracker key={found.id} order={found} method={method} lots={lots.error ? null : lots.data} parcel={false} />
      </section>

      <section className="tm-acct-block tm-acct-rise" aria-labelledby="tm-acct-lines-title" style={{ "--tm-i": 1 } as CSSProperties}>
        <div className="tm-acct-section-head">
          <h2 id="tm-acct-lines-title" className="tm-acct-label">
            In this order <span>{vials} vials</span>
          </h2>
        </div>
        <ul className="tm-acct-lines">
          {found.lines.map((line) => {
            const product = productFor(line.productId);
            const record = lots.data?.find((l) => l.lot === line.lot);
            const certificate = lots.data
              ? record?.status === "released" || record?.status === "archived"
                ? "Published"
                : "Pending"
              : undefined;
            return (
              <li className="tm-acct-line" key={`${line.productId}-${line.lot}`} style={product ? tone(product) : undefined}>
                {product && <Thumb product={product} />}
                <span className="tm-acct-line-name">
                  <span>
                    {product?.name ?? line.productId} <span>{product?.size}</span>
                  </span>
                  <span className="tm-acct-line-lot">
                    Lot <span className="tm-mono">{line.lot}</span>
                    <span className="tm-acct-line-cert">
                      <Link
                        className="tm-acct-lotlink"
                        to={`/verify?lot=${encodeURIComponent(line.lot)}`}
                        aria-label={`Certificate for lot ${line.lot}${certificate ? `, ${certificate.toLowerCase()}` : ""}`}
                      >
                        Certificate
                        <ArrowUpRight size={13} strokeWidth={1.6} aria-hidden="true" />
                      </Link>
                      {certificate && <span className="tm-acct-muted">{certificate}</span>}
                    </span>
                  </span>
                </span>
                <span className="tm-acct-line-qty">
                  {line.quantity} × {money(line.unitPrice)}
                </span>
                <span className="tm-acct-line-total">{money(line.quantity * line.unitPrice)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="tm-acct-block tm-acct-split tm-acct-rise" style={{ "--tm-i": 2 } as CSSProperties}>
        <section aria-labelledby="tm-acct-delivery-title">
          <div className="tm-acct-section-head">
            <h2 id="tm-acct-delivery-title" className="tm-acct-label">
              Delivery
            </h2>
          </div>
          <dl className="tm-acct-dl">
            <div>
              <dt>Ship to</dt>
              <dd>
                <address className="tm-acct-address-lines">
                  <span>{address.institution}</span>
                  <span>Attn. {address.attention}</span>
                  <span>{address.line1}</span>
                  {address.line2 && <span>{address.line2}</span>}
                  <span>
                    {address.city}, {address.region} {address.postal}
                  </span>
                  <span>{address.country}</span>
                </address>
              </dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>{method?.label ?? (methods.loading ? "…" : found.shipping.method)}</dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="tm-acct-summary-title">
          <div className="tm-acct-section-head">
            <h2 id="tm-acct-summary-title" className="tm-acct-label">
              Summary
            </h2>
            <SampleTag />
          </div>
          <dl className="tm-acct-dl tm-acct-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{money(found.subtotal)}</dd>
            </div>
            {found.discount && (
              <div>
                <dt>
                  Code <span className="tm-mono">{found.discount.code}</span>
                </dt>
                <dd>−{money(found.discount.amount)}</dd>
              </div>
            )}
            <div>
              <dt>
                Shipping <span className="tm-acct-muted">· sample rate</span>
              </dt>
              <dd>{money(found.shipping.price)}</dd>
            </div>
            {(found.insuranceApplied || (found.insurance ?? 0) > 0) && <div><dt>Insurance</dt><dd>{money(found.insurance ?? 0)}</dd></div>}
            <div className="is-total">
              <dt>Total</dt>
              <dd>{money(found.total)}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>
                <StatusChip tone={paymentTone(paymentOf(found))}>{paymentLabel[paymentOf(found)]}</StatusChip>
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <OrderEmails order={found} buyer={buyer} method={method} lots={lots.error ? null : lots.data} />
    </>
  );
}

function Crumbs({ number }: { number: string }) {
  return (
    <nav className="tm-crumbs tm-acct-crumbs" aria-label="Breadcrumb">
      <Link to="/account/orders">Orders</Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page" className="tm-mono">
        {number}
      </span>
    </nav>
  );
}
