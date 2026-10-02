import { useState } from "react";
import { Download } from "lucide-react";
import { Button, Card, Dot, Segmented } from "../../app-kit";
import { assetUrl } from "../../assetUrl";
import { products } from "../../data";
import type { Product } from "../../data";
import { productCutout, productImage } from "../../shop/catalog";
import { tone } from "../../shop/ui";
import { BrandDot } from "../../brand/HeroShelf";
import { VialTrio } from "../VialTrio";
import { disclosure, disclosurePlacement, doRules, dontRules, releaseChecks } from "../program";
import type { Rule } from "../program";
import { usePartner } from "./context";
import { CheckItem, CopyButton } from "./parts";

type Library = "renders" | "cutouts" | "logo";

const index = (i: number) => String(i + 1).padStart(2, "0");

const libraryNotes: Record<Library, string> = {
  renders:
    "The supplied product renders, as they come from the studio. Keep the label whole and legible; don’t crop into it, recolour it or add words to the image.",
  cutouts:
    "The same vials cut from their backgrounds, with transparent edges, for your own layouts. Keep each vial upright and its label legible.",
  logo: "The logo as supplied: black on light backgrounds, white on dark ones. Don’t redraw, recolour or stretch it.",
};

const logos = [
  { id: "black", name: "Logo, black", note: "For light backgrounds", file: "lockup-black.svg", dark: false },
  { id: "white", name: "Logo, white", note: "For dark backgrounds", file: "lockup-white.svg", dark: true },
];

function RuleList({ rules, label }: { rules: Rule[]; label: string }) {
  return (
    <ol className="pp-g-rules" aria-label={label}>
      {rules.map((rule, i) => (
        <li key={rule.title}>
          <span className="pp-g-rule-index kit-num">{index(i)}</span>
          <span className="pp-g-rule-title">{rule.title}</span>
          <span className="pp-g-rule-detail">{rule.detail}</span>
        </li>
      ))}
    </ol>
  );
}

function ProductAsset({ product, kind }: { product: Product; kind: "renders" | "cutouts" }) {
  const render = kind === "renders";
  const href = render ? productImage(product, "lg") : productCutout(product, "lg");
  const thumb = render ? productImage(product, "sm") : productCutout(product, "sm");
  const what = render ? "render" : "cut-out";
  return (
    <li className="pp-asset" style={tone(product)}>
      <span className={`pp-asset-frame${render ? " is-render" : " is-cutout"}`}>
        <img src={thumb} alt="" loading="lazy" draggable={false} />
      </span>
      <span className="pp-asset-name">
        {product.name}
        <span>{product.size}</span>
      </span>
      <a
        className="kit-button kit-button-quiet pp-asset-download"
        href={href}
        download={`truemark-${product.id}-${render ? "render" : "cutout"}.webp`}
        aria-label={`Download the ${product.name} ${product.size} ${what}, WebP`}
      >
        <Download aria-hidden="true" strokeWidth={1.6} />
        WebP
      </a>
    </li>
  );
}

export default function Guidelines() {
  const partner = usePartner();
  const [checked, setChecked] = useState<string[]>([]);
  const [library, setLibrary] = useState<Library>("renders");
  const ready = checked.length === releaseChecks.length;
  const line = disclosure(partner.code);

  return (
    <div className="kit-grid pp-page pp-guidelines">
      <section className="kit-card kit-span-12 pp-guide-hero" aria-labelledby="pp-guide-title">
        <div className="pp-guide-copy">
          <p className="kit-label">Compliance</p>
          <h2 id="pp-guide-title" className="pp-display">
            Guidelines come first
            <BrandDot />
          </h2>
          <p className="pp-guide-lead">
            You speak for a supplier of research compounds. Talk about the material, its testing and its record, and
            say plainly that you earn a commission.
          </p>
          <p className="pp-guide-scope">
            These apply to every post, video, caption, story, reply and newsletter that mentions TrueMark.
          </p>
        </div>
        <VialTrio className="pp-guide-trio" />
      </section>

      <Card
        className="kit-span-6 pp-rules-card"
        title="Do"
        meta={<Dot tone="signal" />}
      >
        <RuleList rules={doRules} label="Do" />
      </Card>
      <Card className="kit-span-6 pp-rules-card" title="Don’t" meta={<Dot tone="danger" />}>
        <RuleList rules={dontRules} label="Don’t" />
      </Card>

      <Card className="kit-span-8 pp-disclosure-card" title="Your disclosure">
        <blockquote className="pp-disclosure">
          <p>{line}</p>
        </blockquote>
        <div className="pp-disclosure-actions">
          <CopyButton variant="primary" text={line} label="Copy disclosure" what="Disclosure" />
        </div>
        <ul className="pp-g-placement">
          {disclosurePlacement.map((placement) => (
            <li key={placement}>{placement}</li>
          ))}
        </ul>
      </Card>

      <Card className="kit-span-4 pp-check-card" title="Before you publish">
        <p className="pp-check-intro">
          Every lot is checked before it is released. Check every post the same way before it goes out.
        </p>
        <div role="group" aria-label="Before you publish">
          {releaseChecks.map((item) => (
            <CheckItem
              key={item.id}
              id={`pp-check-${item.id}`}
              label={item.label}
              checked={checked.includes(item.id)}
              onChange={(on) => setChecked((list) => (on ? [...list, item.id] : list.filter((id) => id !== item.id)))}
            />
          ))}
        </div>
        <div className="pp-check-state" data-ready={ready ? "true" : "false"}>
          <p className="pp-check-status" role="status">
            <Dot tone={ready ? "signal" : "neutral"} />
            {ready ? "Ready to publish." : `${checked.length} of ${releaseChecks.length} checked`}
          </p>
          {checked.length > 0 && (
            <Button variant="text" onClick={() => setChecked([])}>
              Start again
            </Button>
          )}
        </div>
        <p className="pp-footnote">Kept on this page for this post only; nothing is recorded.</p>
      </Card>

      <Card
        className="kit-span-12 pp-library"
        title="Assets"
        meta={
          <Segmented
            label="Asset library"
            value={library}
            onChange={setLibrary}
            options={[
              { value: "renders", label: "Renders", count: products.length },
              { value: "cutouts", label: "Cut-outs", count: products.length },
              { value: "logo", label: "Logo", count: logos.length },
            ]}
          />
        }
      >
        <div className="pp-library-head">
          <p className="pp-library-note">{libraryNotes[library]}</p>
          <p className="pp-library-spec kit-num">
            {library === "renders"
              ? "WebP · 1254 × 1254 px"
              : library === "cutouts"
                ? "WebP · 578 × 1112 px · transparent"
                : "SVG · scales to any size"}
          </p>
        </div>
        {library === "logo" ? (
          <ul className="pp-assets is-logo">
            {logos.map((logo) => (
              <li key={logo.id} className="pp-asset">
                <span className={`pp-asset-frame is-logo${logo.dark ? " is-dark" : ""}`}>
                  <img src={assetUrl(`images/brand/kit/${logo.file}`)} alt="" draggable={false} />
                </span>
                <span className="pp-asset-name">
                  {logo.name}
                  <span>{logo.note}</span>
                </span>
                <a
                  className="kit-button kit-button-quiet pp-asset-download"
                  href={assetUrl(`images/brand/kit/${logo.file}`)}
                  download={`truemark-${logo.file}`}
                  aria-label={`Download the ${logo.name.toLowerCase()}, SVG`}
                >
                  <Download aria-hidden="true" strokeWidth={1.6} />
                  SVG
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="pp-assets" aria-label={library === "renders" ? "Product renders" : "Cut-outs"}>
            {products.map((product) => (
              <ProductAsset key={product.id} product={product} kind={library} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
