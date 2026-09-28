import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Card, Facts, PageHeader, Segmented, Select, Skeleton, StatusChip } from "../../app-kit";
import { store, useResource } from "../../platform/store";
import { productCutout } from "../../shop/catalog";
import { tone } from "../../shop/ui";
import { compoundDestinations, destinations, disclosure, partnerLink, percent } from "../program";
import type { DestinationKind } from "../program";
import { usePartner } from "./context";
import { HOME } from "./nav";
import { CopyButton, PartnerUrl } from "./parts";

export default function Links() {
  const partner = usePartner();
  const discounts = useResource(() => store.partners.discounts(), []);
  const [kind, setKind] = useState<DestinationKind>("compound");
  const [compoundId, setCompoundId] = useState(compoundDestinations[0].value);

  const discount = discounts.data?.find((d) => d.code === partner.code);
  const compound = compoundDestinations.find((c) => c.value === compoundId) ?? compoundDestinations[0];
  const destination = destinations.find((d) => d.value === kind) ?? destinations[0];
  const path = kind === "compound" ? `/product/${compound.value}` : destination.path;
  const url = partnerLink(path, partner.code);
  const line = disclosure(partner.code);

  return (
    <div className="kit-grid pp-page pp-links">
      <PageHeader
        description={`Your code works at checkout, and every link below carries it there. Either way your audience gets ${percent(partner.codeDiscount)} off, and the order is recorded as your referral.`}
      />

      <Card className="kit-span-4 pp-code-card" title="Your code">
        <p className="pp-code kit-mono">{partner.code}</p>
        <CopyButton variant="primary" text={partner.code} label="Copy code" what="Code" />
        {discounts.data ? (
          <Facts
            items={[
              {
                label: "At checkout",
                value: discount ? (
                  <StatusChip status={discount.active ? "active" : "paused"} tone={discount.active ? "signal" : "neutral"} />
                ) : (
                  <StatusChip status="pending" label="Not issued yet" />
                ),
              },
              { label: "Your audience", value: `${discount?.percent ?? partner.codeDiscount * 100}% off their order` },
              { label: "Your commission", value: `${percent(partner.rate)} of the order subtotal after discount` },
            ]}
          />
        ) : discounts.error ? (
          <p className="kit-note">The code’s status could not be loaded. The code itself is shown above.</p>
        ) : (
          <div className="pp-list-loading" aria-label="Loading">
            <Skeleton width="80%" />
            <Skeleton width="64%" />
            <Skeleton width="72%" />
          </div>
        )}
      </Card>

      <Card className="kit-span-8 pp-builder" title="Link builder">
        <div className="pp-builder-controls">
          <Segmented
            label="Link to"
            options={destinations.map((d) => ({ value: d.value, label: d.label }))}
            value={kind}
            onChange={setKind}
          />
          {kind === "compound" && (
            <Select
              label="Compound"
              value={compoundId}
              onChange={setCompoundId}
              options={compoundDestinations.map((c) => ({ value: c.value, label: c.label }))}
            />
          )}
        </div>

        <div className="pp-builder-result">
          <p className="pp-builder-url" aria-live="polite">
            <PartnerUrl path={path} code={partner.code} />
          </p>
          <CopyButton variant="primary" text={url} label="Copy link" what="Link" />
        </div>

        <div className="pp-builder-preview">
          {kind === "compound" ? (
            <div className="pp-builder-product" style={tone(compound.product)}>
              <span className="pp-builder-stage" aria-hidden="true">
                <img src={productCutout(compound.product, "sm")} alt="" draggable={false} />
              </span>
              <span className="pp-builder-name">
                {compound.label}
                <span>{compound.sizes.join(" · ")}</span>
              </span>
            </div>
          ) : (
            <p className="pp-builder-note">{destination.note}</p>
          )}
          <Link className="kit-link" to={`${path}?ref=${encodeURIComponent(partner.code)}`} target="_blank" rel="noreferrer">
            Open in this preview
            <ArrowUpRight aria-hidden="true" strokeWidth={1.6} />
          </Link>
        </div>
        <p className="pp-footnote pp-builder-foot">
          When someone arrives through your link, the shop remembers your code and applies it at checkout.
        </p>
      </Card>

      <Card className="kit-span-12 pp-disclosure-card" title="Disclosure">
        <div className="pp-disclosure-body">
          <blockquote className="pp-disclosure">
            <p>{line}</p>
          </blockquote>
          <div className="pp-disclosure-side">
            <CopyButton text={line} label="Copy disclosure" what="Disclosure" />
            <p className="pp-disclosure-note">
              Put it in the post itself, in words, before the link or code. A line in your profile or a hashtag alone is
              not enough.
            </p>
            <Link className="kit-link" to={`${HOME}/guidelines`}>
              The full guidelines
              <ArrowRight aria-hidden="true" strokeWidth={1.6} />
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
