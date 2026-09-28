import { assetUrl } from "../assetUrl";
import type { Product } from "../data";
import { productCutout } from "../shop/catalog";
import { sheenMask } from "./light";
import "./stage.css";

/**
 * The product on its plinth. The photograph carries the plinth and the vial's
 * contact shadow (baked by scripts/stage-vials.py); the page stands the real
 * cut-out on it, so choosing a size swaps only the vial. Every size shares one
 * vial, so the new label simply settles into place.
 */
export function ProductStage({
  items,
  index,
  prev,
  zoomed,
}: {
  items: Product[];
  index: number;
  prev: number;
  zoomed: boolean;
}) {
  return (
    <div className={`tm-pstage${zoomed ? " is-zoomed" : ""}`}>
      <div className="tm-pstage-world">
        <img
          className="tm-pstage-scene"
          src={assetUrl("images/scenes/product-stage.webp")}
          srcSet={`${assetUrl("images/scenes/product-stage-sm.webp")} 600w, ${assetUrl("images/scenes/product-stage.webp")} 900w`}
          sizes="(max-width: 960px) 92vw, 46vw"
          alt=""
          fetchPriority="high"
          draggable={false}
        />
        <div className="tm-pstage-vial" data-sheen>
          {items.map((product, i) => (
            <img
              key={product.id}
              className={i === index ? "is-active" : i === prev ? "is-prev" : undefined}
              src={productCutout(product, "lg")}
              srcSet={`${productCutout(product, "sm")} 289w, ${productCutout(product, "lg")} 578w`}
              sizes="(max-width: 960px) 36vw, 18vw"
              alt={i === index ? `${product.name}, ${product.size} research vial` : ""}
              aria-hidden={i === index ? undefined : true}
              loading={i === index ? "eager" : "lazy"}
              draggable={false}
            />
          ))}
          <span
            className="tm-sheen"
            aria-hidden="true"
            style={sheenMask(productCutout(items[index], "lg"))}
          />
        </div>
      </div>
    </div>
  );
}
