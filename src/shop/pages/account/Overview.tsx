import { useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { Order } from "../../../platform/types";
import { productCutout } from "../../catalog";
import { tone } from "../../ui";
import { LotTable } from "./Certificates";
import { byNewest, buyerStatusLabel, firstName, productFor, receivedLots, shortDate, units } from "./lib";
import { OrderTable } from "./Orders";
import { Empty, Loading, PageHead, Problem, SectionHead, useAccount, useReorder, useTitle } from "./parts";

export default function Overview() {
  useTitle("Your account");
  const { buyer, orders, lots } = useAccount();
  const list = orders.data ? [...orders.data].sort(byNewest) : undefined;
  const received = list ? receivedLots(list) : [];
  return (
    <>
      <PageHead eyebrow="Research account" title={`Welcome back, ${firstName(buyer.name)}.`} sub="Every lot on your record.">
        <p className="tm-acct-standing" data-status={buyer.status}>
          <i aria-hidden="true" />
          {buyerStatusLabel[buyer.status]}
          {buyer.status === "verified" && buyer.verifiedAt && (
            <span className="tm-acct-muted">since {shortDate(buyer.verifiedAt)}</span>
          )}
        </p>
      </PageHead>

      {orders.error ? (
        <Problem title="Your orders could not be loaded." onRetry={orders.reload} />
      ) : !list ? (
        <Loading label="Loading your account" rows={4} />
      ) : list.length === 0 ? (
        <Empty title="No orders yet." text="Your orders, their lots and every certificate will be kept here.">
          <Link className="tm-textlink" to="/products">
            Shop the collection <ArrowRight size={16} strokeWidth={1.6} />
          </Link>
        </Empty>
      ) : (
        <>
          <OrderAgain order={list[0]} />

          <section className="tm-acct-block tm-acct-rise" style={{ "--tm-i": 1 } as CSSProperties} aria-labelledby="tm-acct-latest">
            <SectionHead
              id="tm-acct-latest"
              label="Latest orders"
              action={
                <Link className="tm-textlink" to="/account/orders">
                  All orders <ArrowRight size={16} strokeWidth={1.6} />
                </Link>
              }
            />
            <OrderTable orders={list.slice(0, 2)} label="Latest orders" />
          </section>

          <section className="tm-acct-block tm-acct-rise" style={{ "--tm-i": 2 } as CSSProperties} aria-labelledby="tm-acct-onfile">
            <SectionHead
              id="tm-acct-onfile"
              label="Lots on file"
              count={received.length}
              action={
                received.length > 0 && (
                  <Link className="tm-textlink" to="/account/certificates">
                    All certificates <ArrowRight size={16} strokeWidth={1.6} />
                  </Link>
                )
              }
            />
            {received.length > 0 ? (
              <LotTable entries={received.slice(0, 4)} lots={lots.error ? null : lots.data} label="Most recent lots on file" />
            ) : (
              <Empty title="No lots on file yet." text="Lots are added to your record when an order is delivered." />
            )}
          </section>
        </>
      )}
    </>
  );
}

/** The last order, ready to go back in the bag: its vials stand on the studio surface. */
function OrderAgain({ order }: { order: Order }) {
  const reorder = useReorder();
  const [note, setNote] = useState("");
  const lines = order.lines.flatMap((line) => {
    const product = productFor(line.productId);
    return product ? [{ line, product }] : [];
  });
  const vials = units(order);
  return (
    <section className="tm-acct-again tm-acct-rise" aria-labelledby="tm-acct-again-title">
      <div className="tm-acct-again-copy">
        <h2 id="tm-acct-again-title" className="tm-acct-label">
          Order again
        </h2>
        <p className="tm-acct-again-title">Your last order.</p>
        <p className="tm-acct-again-meta">
          <span className="tm-mono">{order.number}</span> · Placed {shortDate(order.createdAt)} · {vials} {vials === 1 ? "vial" : "vials"}
        </p>
        <ul className="tm-acct-again-lines">
          {lines.map(({ line, product }) => (
            <li key={line.productId} style={tone(product)}>
              <i aria-hidden="true" />
              <span>
                {product.name} <span>{product.size}</span>
              </span>
              <span className="tm-acct-again-qty">× {line.quantity}</span>
            </li>
          ))}
        </ul>
        <div className="tm-acct-actions">
          <button
            type="button"
            className="tm-button tm-button-primary"
            onClick={() => {
              const result = reorder(order);
              setNote(
                result.missing
                  ? `Added ${result.added} of ${order.lines.length} items to your bag. The rest are no longer in the collection.`
                  : `Added ${vials} ${vials === 1 ? "vial" : "vials"} to your bag.`,
              );
            }}
          >
            Reorder
          </button>
          <Link className="tm-textlink" to={`/account/orders/${order.id}`}>
            View the order <ArrowRight size={16} strokeWidth={1.6} />
          </Link>
        </div>
        <p className="tm-acct-live" aria-live="polite">
          {note}
        </p>
      </div>
      <div className="tm-acct-again-stage" aria-hidden="true">
        {lines.slice(0, 3).map(({ product }, i) => (
          <span key={product.id} className="tm-acct-again-vial" style={{ ...tone(product), "--tm-i": i } as CSSProperties}>
            <img src={productCutout(product, "sm")} alt="" loading="lazy" draggable={false} />
          </span>
        ))}
      </div>
    </section>
  );
}
