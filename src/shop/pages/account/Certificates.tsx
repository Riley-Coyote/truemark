import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Lot } from "../../../platform/types";
import { tone } from "../../ui";
import { productFor, receivedLots, shortDate } from "./lib";
import type { ReceivedLot } from "./lib";
import { Empty, Loading, PageHead, Problem, StatusChip, Thumb, useAccount, useTitle } from "./parts";

/**
 * Lots the buyer has received. A released lot links to its public record, which
 * carries the laboratory's certificate; every other state reads as pending.
 * `lots` is undefined while loading and null when the statuses could not be read.
 */
export function LotTable({ entries, lots, label }: { entries: ReceivedLot[]; lots: Lot[] | null | undefined; label: string }) {
  return (
    <div className="tm-acct-table tm-acct-lots" role="table" aria-label={label}>
      <div role="rowgroup" className="tm-acct-thead">
        <div role="row" className="tm-acct-tr">
          <span role="columnheader" className="c-product">Product</span>
          <span role="columnheader" className="c-lot">Lot</span>
          <span role="columnheader" className="c-date">Received</span>
          <span role="columnheader" className="c-cert">Certificate</span>
        </div>
      </div>
      <div role="rowgroup">
        {entries.map((entry) => {
          const product = productFor(entry.productId);
          const record = lots?.find((l) => l.lot === entry.lot);
          return (
            <div role="row" className="tm-acct-tr" key={entry.lot} style={product ? tone(product) : undefined}>
              <span role="cell" className="c-product">
                {product && <Thumb product={product} size="sm" />}
                <span className="tm-acct-product">
                  {product?.name ?? entry.productId} <span>{product?.size}</span>
                </span>
              </span>
              <span role="cell" className="c-lot tm-mono">
                {entry.lot}
              </span>
              <span role="cell" className="c-date">
                {shortDate(entry.receivedAt)}
              </span>
              <span role="cell" className="c-cert">
                {lots === undefined ? (
                  <span className="tm-acct-muted">Checking…</span>
                ) : lots === null ? (
                  <span className="tm-acct-muted">Status unavailable</span>
                ) : record?.status === "released" ? (
                  <Link className="tm-acct-link" to={`/verify?lot=${encodeURIComponent(entry.lot)}`}>
                    Read the record <ArrowUpRight size={14} strokeWidth={1.6} aria-hidden="true" />
                  </Link>
                ) : (
                  <StatusChip tone="pending">Certificate pending</StatusChip>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Certificates() {
  useTitle("Certificates");
  const { orders, lots } = useAccount();
  const entries = orders.data ? receivedLots(orders.data) : undefined;
  return (
    <>
      <PageHead eyebrow="Certificates" title="Every lot you have received." sub="Each with its own record.">
        <p className="tm-acct-intro">
          A lot’s certificate opens here once its laboratory results are published. Until then it reads as pending.
        </p>
      </PageHead>
      {orders.error ? (
        <Problem title="Your lots could not be loaded." onRetry={orders.reload} />
      ) : !entries ? (
        <Loading label="Loading your lots" rows={6} />
      ) : entries.length === 0 ? (
        <Empty title="No lots on file yet." text="Lots are added to your record when an order is delivered.">
          <Link className="tm-textlink" to="/account/orders">
            Your orders <ArrowRight size={16} strokeWidth={1.6} />
          </Link>
        </Empty>
      ) : (
        <div className="tm-acct-rise">
          {lots.error && <Problem title="Certificate status could not be checked." onRetry={lots.reload} />}
          <LotTable entries={entries} lots={lots.error ? null : lots.data} label="Lots on file" />
        </div>
      )}
    </>
  );
}
