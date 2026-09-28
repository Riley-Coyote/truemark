import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check } from "lucide-react";
import {
  Button,
  Dot,
  Drawer,
  EmptyState,
  Facts,
  SampleTag,
  Section,
  Skeleton,
  StatusChip,
  formatDateTime,
  formatMoney,
  statusLabel,
  toneFor,
} from "../app-kit";
import { estimatedDelivery, paymentOf, weekdayDate } from "../brand/Tracker";
import { store, useResource } from "../platform/store";
import type { Address, OrderStatus } from "../platform/types";
import { productById } from "../shop/catalog";
import { BuyerEmail, buyerEmailsFor } from "../shop/pages/account/emails";
import type { BuyerEmailKind } from "../shop/pages/account/emails";
import { Fulfilment, NEXT } from "./fulfilment";
import { HOME } from "./nav";
import { units } from "./metrics";

const MINUS = "−";

/** The steps that email the customer, and the email each one sends. */
const EMAIL_FOR: Partial<Record<OrderStatus, BuyerEmailKind>> = {
  placed: "confirmed",
  shipped: "shipped",
  delivered: "delivered",
};

export function DrawerLoading() {
  return (
    <div className="cc-drawer-loading" aria-label="Loading">
      {["40%", "72%", "58%", "66%", "34%", "62%"].map((width, i) => (
        <Skeleton key={i} width={width} />
      ))}
    </div>
  );
}

export function AddressLines({ address }: { address: Address }) {
  return (
    <address className="cc-address">
      <span>{address.institution}</span>
      <span>Attn. {address.attention}</span>
      <span>{address.line1}</span>
      {address.line2 && <span>{address.line2}</span>}
      <span>
        {address.city}, {address.region} {address.postal}
      </span>
      <span>{address.country}</span>
      {address.phone && <span className="kit-quiet">{address.phone}</span>}
    </address>
  );
}

export function OrderDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const order = useResource(() => store.orders.get(id), [id]);
  const context = useResource(
    () => Promise.all([store.buyers.list(), store.partners.list(), store.catalog.shippingMethods(), store.lots.list()]),
    [],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [openEmail, setOpenEmail] = useState<BuyerEmailKind | null>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const baseId = useId();
  const o = order.data;
  const next = o ? NEXT[o.status] : undefined;

  // The last step leaves no action to focus: the note that says it landed takes focus, in view, instead.
  useEffect(() => {
    if (message && !next) liveRef.current?.focus();
  }, [message, next]);

  if (!o) {
    return (
      <Drawer title="Order" eyebrow="Order" onClose={onClose}>
        {order.loading ? (
          <DrawerLoading />
        ) : order.error ? (
          <EmptyState
            compact
            title="This order could not be loaded."
            note={order.error.message}
            action={<Button onClick={order.reload}>Try again</Button>}
          />
        ) : (
          <EmptyState
            compact
            title="No order matches this link."
            note={
              <>
                Nothing is on file for <span className="kit-mono">{id}</span>. Orders placed in the preview are kept only in
                the browser that placed them.
              </>
            }
          />
        )}
      </Drawer>
    );
  }

  const [buyers, partners, methods, lots] = context.data ?? [[], [], [], undefined];
  const buyer = buyers.find((b) => b.id === o.buyerId);
  const partner = o.discount?.partnerId ? partners.find((p) => p.id === o.discount?.partnerId) : undefined;
  const method = methods.find((m) => m.id === o.shipping.method);
  const events = [...o.events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const count = units(o);
  const payment = paymentOf(o);
  const estimate = estimatedDelivery(o);
  const sent = buyerEmailsFor(o);

  return (
    <Drawer
      mono
      title={o.number}
      eyebrow="Order"
      subtitle={`Placed ${formatDateTime(o.createdAt)} · ${count} ${count === 1 ? "item" : "items"} · ${formatMoney(o.total)}`}
      tags={
        <>
          <StatusChip status={o.status} />
          <StatusChip status={payment} label={`Payment ${statusLabel(payment).toLowerCase()}`} />
        </>
      }
      footer={next ? <Fulfilment order={o} onDone={setMessage} /> : undefined}
      onClose={onClose}
    >
      <div className="cc-live" aria-live="polite">
        {message && (
          <p ref={liveRef} className="kit-note cc-landed" tabIndex={-1}>
            <Check aria-hidden="true" strokeWidth={1.8} />
            {message}
          </p>
        )}
      </div>

      <Section title="Timeline">
        <ol className="kit-timeline cc-journey" aria-label={`Events for ${o.number}`}>
          {events.map((event, i) => {
            // Only a step on the order's journey sent its email; nothing after a cancellation did.
            const kind = EMAIL_FOR[event.status];
            const email = kind && sent.some((s) => s.kind === kind && s.at === event.at) ? kind : undefined;
            const panelId = `${baseId}-email-${i}`;
            const open = Boolean(email && openEmail === email);
            return (
              <li key={`${event.status}-${i}`}>
                <Dot tone={toneFor(event.status)} />
                <div className="kit-timeline-text">
                  <span className="kit-timeline-title">{statusLabel(event.status)}</span>
                  <span className="kit-timeline-meta">
                    {formatDateTime(event.at)}
                    {event.note ? ` · ${event.note}` : ""}
                  </span>
                  {email && buyer && (
                    <>
                      <span className="cc-notified">
                        <span className="cc-notified-text">
                          <Check aria-hidden="true" strokeWidth={1.8} />
                          Customer notified
                        </span>
                        <button
                          type="button"
                          className="cc-inline-link cc-notified-toggle"
                          aria-expanded={open}
                          aria-controls={panelId}
                          onClick={() => setOpenEmail(open ? null : email)}
                        >
                          {open ? "Hide email" : "View email"}
                        </button>
                      </span>
                      <div id={panelId} className="cc-email-reveal" hidden={!open}>
                        {open && <BuyerEmail kind={email} order={o} to={buyer} method={method} lots={lots} />}
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="cc-footnote">Emails are previews. Sending arrives with the backend.</p>
      </Section>

      <Section title="Lines">
        <ul className="cc-lines">
          {o.lines.map((line) => {
            const product = productById(line.productId);
            return (
              <li key={`${line.productId}-${line.lot}`}>
                <Dot colour={product?.color} />
                <div className="cc-line-main">
                  <span className="cc-line-name">
                    {product?.name ?? line.productId} <span className="kit-quiet">{product?.size}</span>
                  </span>
                  <Link
                    className="cc-lot-link"
                    to={`/verify?lot=${encodeURIComponent(line.lot)}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Public record for lot ${line.lot}, opens in a new tab`}
                  >
                    <span className="kit-mono">{line.lot}</span>
                    <ArrowUpRight aria-hidden="true" strokeWidth={1.6} />
                  </Link>
                </div>
                <span className="cc-line-qty kit-num">
                  {line.quantity} × {formatMoney(line.unitPrice)}
                </span>
                <span className="cc-line-total kit-num">{formatMoney(line.unitPrice * line.quantity)}</span>
              </li>
            );
          })}
        </ul>
        <dl className="cc-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(o.subtotal)}</dd>
          </div>
          {o.discount && (
            <div>
              <dt>
                Discount <span className="kit-mono">{o.discount.code}</span>
              </dt>
              <dd>
                {MINUS}
                {formatMoney(o.discount.amount)}
              </dd>
            </div>
          )}
          <div>
            <dt>
              Shipping <SampleTag>Sample rate</SampleTag>
            </dt>
            <dd>{formatMoney(o.shipping.price)}</dd>
          </div>
          <div className="is-total">
            <dt>Total</dt>
            <dd className="kit-figure">{formatMoney(o.total)}</dd>
          </div>
        </dl>
      </Section>

      <Section title="Buyer">
        <Facts
          items={[
            {
              label: "Name",
              value: buyer ? (
                <Link className="cc-inline-link" to={`${HOME}/customers?customer=${buyer.id}`}>
                  {buyer.name}
                </Link>
              ) : (
                o.address.attention
              ),
            },
            { label: "Institution", value: buyer?.institution ?? o.address.institution },
            { label: "Email", value: buyer?.email ?? "Not on file" },
          ]}
        />
      </Section>

      <Section title="Shipping">
        <Facts
          items={[
            { label: "Method", value: method?.label ?? o.shipping.method },
            ...(o.shipping.carrier ? [{ label: "Carrier", value: o.shipping.carrier }] : []),
            ...(o.shipping.tracking ? [{ label: "Tracking", value: <span className="kit-mono">{o.shipping.tracking}</span> }] : []),
            ...(estimate ? [{ label: "Estimated delivery", value: weekdayDate(estimate) }] : []),
            { label: "Ship to", value: <AddressLines address={o.address} /> },
          ]}
        />
      </Section>

      {o.discount && (
        <Section title="Partner">
          <Facts
            items={[
              { label: "Code", value: <span className="kit-mono">{o.discount.code}</span> },
              {
                label: "Partner",
                value: partner ? (
                  <>
                    {partner.name} <span className="kit-quiet">{partner.handle}</span>
                  </>
                ) : (
                  "Promotional code, no partner"
                ),
              },
            ]}
          />
        </Section>
      )}
    </Drawer>
  );
}
