/**
 * The emails a buyer receives about an order, at the three moments that matter:
 * confirmed, shipped (with tracking) and delivered (with the lots' certificates).
 * Built from the order itself and composed with the platform's email parts. They
 * are previews; sending arrives with the backend. The command center shows the
 * same emails beside the step that sent them.
 */
import type { ReactNode } from "react";
import { money } from "../../../data";
import {
  COLD_CHAIN,
  ESTIMATES_NOTE,
  ON_ARRIVAL,
  addBusinessDays,
  eventAt,
  transitDays,
  weekdayDate,
} from "../../../brand/Tracker";
import { EmailButton, EmailFigure, EmailHeading, EmailNote, EmailPreview, EmailRows, EmailText } from "../../../platform/email/EmailPreview";
import type { Lot, Order, ShippingMethod } from "../../../platform/types";
import { productById } from "../../catalog";

export type BuyerEmailKind = "confirmed" | "shipped" | "delivered";

export type BuyerEmailEntry = { kind: BuyerEmailKind; at: string; subject: string; preheader: string };

/** Who an email goes to. */
export type Recipient = { name: string; email: string };

const vialsIn = (order: Order) => order.lines.reduce((sum, line) => sum + line.quantity, 0);
const lineName = (productId: string) => {
  const product = productById(productId);
  return product ? `${product.name} ${product.size}` : productId;
};

/** The day a shipped order was expected, as the shipping email said. */
function estimateAtShipping(order: Order): string | undefined {
  const shipped = eventAt(order, "shipped");
  return shipped ? addBusinessDays(shipped, transitDays(order)) : undefined;
}

/** The emails an order has produced so far: each one only once its step has happened. */
export function buyerEmailsFor(order: Order): BuyerEmailEntry[] {
  const list: BuyerEmailEntry[] = [
    {
      kind: "confirmed",
      at: eventAt(order, "placed") ?? order.createdAt,
      subject: `Order confirmed · ${order.number}`,
      preheader: "We'll write again when it ships.",
    },
  ];
  const shipped = eventAt(order, "shipped");
  const estimate = estimateAtShipping(order);
  if (shipped) {
    list.push({
      kind: "shipped",
      at: shipped,
      subject: `Your order has shipped · ${order.number}`,
      preheader: [order.shipping.carrier, order.shipping.tracking, estimate && `Estimated ${weekdayDate(estimate)}`]
        .filter(Boolean)
        .join(" · "),
    });
  }
  const delivered = eventAt(order, "delivered");
  if (delivered) {
    list.push({
      kind: "delivered",
      at: delivered,
      subject: `Delivered — certificates for your lots · ${order.number}`,
      preheader: `Delivered ${weekdayDate(delivered)}. The certificate for each lot you receive is kept in your account.`,
    });
  }
  return list;
}

const FOOTER = "You receive this because you placed an order with your TrueMark research account.";

export function BuyerEmail({
  kind,
  order,
  to,
  method,
  lots,
}: {
  kind: BuyerEmailKind;
  order: Order;
  to: Recipient;
  method?: ShippingMethod;
  lots?: Lot[] | null;
}) {
  const entry = buyerEmailsFor(order).find((e) => e.kind === kind);
  if (!entry) return null;
  const common = {
    to: `${to.name} <${to.email}>`,
    subject: entry.subject,
    preheader: entry.preheader,
    footer: FOOTER,
  };
  const vials = vialsIn(order);

  if (kind === "confirmed") {
    return (
      <EmailPreview {...common}>
        <EmailHeading>Your order is confirmed.</EmailHeading>
        <EmailText>{`Order ${order.number} is on file in your research account, with the lot number of every vial.`}</EmailText>
        <EmailFigure
          label="Order total"
          value={money(order.total)}
          note={`${vials} ${vials === 1 ? "vial" : "vials"} · ${method?.label ?? "Cold chain"}`}
        />
        <EmailRows
          rows={[
            ...order.lines.map((line): [string, string] => [
              `${lineName(line.productId)} × ${line.quantity}`,
              money(line.unitPrice * line.quantity),
            ]),
            ...(order.discount ? [[`Code ${order.discount.code}`, `−${money(order.discount.amount)}`] as [string, string]] : []),
            ["Shipping", money(order.shipping.price)],
            ...((order.insuranceApplied || (order.insurance ?? 0) > 0) ? [["Insurance", money(order.insurance ?? 0)] as [string, string]] : []),
            ["Total", money(order.total)],
          ]}
        />
        <EmailText>We&rsquo;ll write again when it ships.</EmailText>
        <EmailButton>View your order</EmailButton>
      </EmailPreview>
    );
  }

  if (kind === "shipped") {
    const estimate = estimateAtShipping(order);
    const { address } = order;
    return (
      <EmailPreview {...common}>
        <EmailHeading>Your order has shipped.</EmailHeading>
        {estimate && (
          <EmailFigure
            label="Estimated delivery"
            value={weekdayDate(estimate)}
            note={`${method?.label ?? "Cold chain"}. ${ESTIMATES_NOTE}`}
          />
        )}
        <EmailRows
          rows={[
            ["Carrier", order.shipping.carrier ?? "—"],
            ["Tracking number", order.shipping.tracking ?? "—"],
            ["Order", order.number],
            ["Ship to", `${address.institution}, ${address.city}, ${address.region}`],
          ]}
        />
        <EmailText>{COLD_CHAIN[0]}</EmailText>
        <EmailButton>Track your order</EmailButton>
        <EmailNote>{COLD_CHAIN[1]}</EmailNote>
      </EmailPreview>
    );
  }

  const delivered = eventAt(order, "delivered")!;
  // The compound on the left; its lot, and where its certificate stands, on the right.
  const lotRows = order.lines.map((line): [string, ReactNode] => {
    const record = lots?.find((l) => l.lot === line.lot);
    const published = record?.status === "released" || record?.status === "archived";
    return [
      lineName(line.productId),
      <>
        {line.lot}
        <br />
        {lots ? (published ? "Certificate published" : "Certificate pending") : "On record"}
      </>,
    ];
  });
  return (
    <EmailPreview {...common}>
      <EmailHeading>Your order was delivered.</EmailHeading>
      <EmailFigure label="Delivered" value={weekdayDate(delivered)} note={`Order ${order.number} · ${vials} ${vials === 1 ? "vial" : "vials"}`} />
      <EmailText>{ON_ARRIVAL}</EmailText>
      <EmailText>Certificates for your lots:</EmailText>
      <EmailRows rows={lotRows} />
      <EmailButton>Read your certificates</EmailButton>
      <EmailNote>The certificate for each lot you receive is kept in your account.</EmailNote>
    </EmailPreview>
  );
}
