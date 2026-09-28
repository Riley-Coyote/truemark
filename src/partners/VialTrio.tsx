import type { Product } from "../data";
import { productById, productCutout } from "../shop/catalog";
import "./trio.css";

/** The three vials of the trio photograph, as the cut-outs partners receive. */
const trio = ["bpc-157-10-mg", "retatrutide-10-mg", "ghk-cu-100-mg"]
  .map(productById)
  .filter((p): p is Product => Boolean(p));

/** Three cut-out vials standing in the lilac studio, each on its own soft contact shadow. Decorative. */
export function VialTrio({ className = "" }: { className?: string }) {
  return (
    <div className={`pp-trio ${className}`.trim()} aria-hidden="true">
      {trio.map((product) => (
        <span key={product.id} className="pp-trio-vial">
          <span className="pp-trio-shadow" />
          <img
            src={productCutout(product, "lg")}
            srcSet={`${productCutout(product, "sm")} 289w, ${productCutout(product, "lg")} 578w`}
            sizes="(max-width: 960px) 26vw, 12vw"
            alt=""
            loading="lazy"
            draggable={false}
          />
        </span>
      ))}
    </div>
  );
}
