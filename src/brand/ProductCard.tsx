import { useEffect, useId, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { money } from "../data";
import { productCutout } from "../shop/catalog";
import type { Compound } from "../shop/catalog";
import { useShop } from "../shop/context";
import { tone } from "../shop/ui";
import { sheenMask } from "./light";
import "./cards.css";

/**
 * A compound in the shop: its vial standing in the lilac studio, the colour
 * carried by the label alone. The whole card opens the product; the + adds
 * it to the bag, asking for a size first when the compound comes in several.
 */
export function ProductCard({ compound, listItem = false }: { compound: Compound; listItem?: boolean }) {
  const { lead, variants, fromPrice, name } = compound;
  const { add } = useShop();
  const [picking, setPicking] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLElement>(null);
  const multi = variants.length > 1;
  const tag = variants.find((v) => v.tag)?.tag;
  const sizes = multi ? `${variants.map((v) => v.size.replace(/ mg$/, "")).join(" · ")} mg` : lead.size;
  const detail = lead.category === "lab-supplies" ? "Sterile solution" : "Lyophilized powder · ≥99% (HPLC)";
  const buyable = variants.filter((v) => v.price !== undefined);

  useEffect(() => {
    if (picking) root.current?.querySelector<HTMLButtonElement>(".tm-card-sizes button")?.focus();
  }, [picking]);

  function choose(id: string) {
    add(id, 1);
    setPicking(false);
  }

  function closeOnLeave(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPicking(false);
  }

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && picking) {
      event.stopPropagation();
      setPicking(false);
      root.current?.querySelector<HTMLButtonElement>(".tm-card-plus")?.focus();
    }
  }

  return (
    <article ref={root} role={listItem ? "listitem" : undefined} className="tm-card" style={tone(lead)}>
      <div className="tm-card-stage">
        {tag && <span className="tm-card-tag">{tag}</span>}
        <span className="tm-card-shadow" aria-hidden="true" />
        <span className="tm-card-vial" data-sheen>
          <img
            src={productCutout(lead, "sm")}
            srcSet={`${productCutout(lead, "sm")} 289w, ${productCutout(lead, "lg")} 578w`}
            sizes="(max-width: 760px) 40vw, (max-width: 1100px) 26vw, 18vw"
            alt=""
            loading="lazy"
            draggable={false}
          />
          <span className="tm-sheen" aria-hidden="true" style={sheenMask(productCutout(lead, "sm"))} />
        </span>
      </div>
      <div className="tm-card-body">
        <h3 className="tm-card-name">
          <Link className="tm-card-link" to={`/product/${lead.id}`}>
            {name}
          </Link>
        </h3>
        {fromPrice !== undefined && (
          <p className="tm-card-price">
            {multi && <span>From </span>}
            {money(fromPrice)}
          </p>
        )}
        <p className="tm-card-meta">
          {sizes}
          <span>{detail}</span>
        </p>
      </div>

      {buyable.length > 0 && (
        <div className="tm-card-add" onBlur={closeOnLeave} onKeyDown={closeOnEscape}>
          {picking && (
            <div className="tm-card-sizes" id={menuId} role="group" aria-label={`Choose a size of ${name}`}>
              {buyable.map((v) => (
                <button key={v.id} type="button" onClick={() => choose(v.id)}>
                  {v.size}
                  <span>{money(v.price!)}</span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="tm-card-plus"
            aria-label={multi ? `Add ${name} to bag, choose a size` : `Add ${name} ${lead.size} to bag`}
            aria-expanded={multi ? picking : undefined}
            aria-controls={multi && picking ? menuId : undefined}
            onClick={() => (multi ? setPicking((p) => !p) : choose(lead.id))}
          >
            <Plus size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>
      )}
    </article>
  );
}
