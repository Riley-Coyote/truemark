import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus } from "lucide-react";
import { money } from "../data";
import { productCutout } from "../shop/catalog";
import type { Compound } from "../shop/catalog";
import { useShop } from "../shop/context";
import { announceMobileAdd } from "../shop/MobileAdd";
import { rememberVial } from "../Navigation";
import { ProductName, pictureLoading, tone } from "../shop/ui";
import { sheenMask } from "./light";
import "./cards.css";

/**
 * A compound in the shop: its vial standing in the lilac studio, the colour
 * carried by the label alone. The whole card opens the product; the + adds
 * one vial to the bag (asking for a size first when the compound comes in
 * several) without opening the bag. Once it is in the bag, the + becomes a
 * counter, − and + around the count, on every card. Across several sizes the +
 * asks which size, and the − takes one away at once when only one size is in
 * the bag, or else asks which; in the sizes, each one in the bag has its own
 * − and +.
 */
export function ProductCard({ compound, listItem = false, compact = false }: { compound: Compound; listItem?: boolean; compact?: boolean }) {
  const { lead, variants, fromPrice, name } = compound;
  const { add, change, cart } = useShop();
  const [picking, setPicking] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLElement>(null);
  const multi = variants.length > 1;
  const outOfStock = variants.every((product) => product.stock === 0);
  const tag = variants.find((v) => v.tag)?.tag;
  const sizes = multi ? `${variants.map((v) => v.size.replace(/ mg$/, "")).join(" · ")} mg` : lead.size;
  // The separator stays with the words before it, so a line never starts with "·".
  const detail = lead.category === "lab-supplies" ? "Sterile solution" : "Lyophilized powder\u00a0· ≥99%\u00a0(HPLC)";
  const buyable = variants.filter((v) => v.price !== undefined);
  const inBag = (id: string) => cart.find((item) => item.id === id)?.quantity ?? 0;
  const atLimit = (id: string) => {
    const product = variants.find((item) => item.id === id);
    return !product || inBag(id) >= Math.min(99, product.stock ?? 99);
  };
  const total = buyable.reduce((sum, v) => sum + inBag(v.id), 0);
  const sizesInBag = buyable.filter((v) => inBag(v.id) > 0);
  const full = buyable.every((v) => atLimit(v.id));
  // Keep keyboard focus on the control as it changes shape (+ ⇄ counter).
  const refocus = useRef<string | null>(null);
  // Opened by + the sizes offer the ones to add first; opened by −, the ones to take from.
  const openedBy = useRef<"more" | "less">("more");

  useEffect(() => {
    const menu = root.current?.querySelector(".tm-card-sizes");
    if (!picking || !menu) return;
    const first = openedBy.current === "less" ? ".tm-card-size-row button" : ".tm-card-size-add:not(:disabled)";
    (menu.querySelector<HTMLButtonElement>(first) ?? menu.querySelector<HTMLButtonElement>("button:not(:disabled)"))?.focus();
  }, [picking]);

  // The sizes open beside a narrow card; near the screen's edge they move in to stay in view.
  useLayoutEffect(() => {
    const menu = root.current?.querySelector<HTMLElement>(".tm-card-sizes");
    if (!picking || !menu) return;
    menu.style.translate = "";
    const box = menu.getBoundingClientRect();
    const edge = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const shift = box.left < edge ? edge - box.left : box.right > window.innerWidth - edge ? window.innerWidth - edge - box.right : 0;
    if (shift) menu.style.translate = `${shift}px 0`;
  }, [picking]);

  // A tap anywhere else puts the sizes away. (A tap does not move focus on an iPhone, so the
  // blur below is not enough there.)
  useEffect(() => {
    if (!picking) return;
    const away = (event: PointerEvent) => {
      if (!root.current?.querySelector(".tm-card-add")?.contains(event.target as Node)) setPicking(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [picking]);

  useEffect(() => {
    if (!refocus.current) return;
    root.current?.querySelector<HTMLButtonElement>(refocus.current)?.focus();
    refocus.current = null;
  }, [total]);

  /** One more of a size. From the card's own + the sizes close; adjusting inside them, they stay. */
  function addOne(id: string, close = true) {
    if (atLimit(id)) return;
    add(id, 1);
    // The vial flies to the bag; on phones the added bar also rises.
    announceMobileAdd(id, root.current?.querySelector<HTMLImageElement>(".tm-card-vial img"));
    if (!close) return;
    // The + just pressed may have become the counter's +, or the sizes may close over it.
    if (total === 0 || picking) refocus.current = ".tm-card-step.is-more";
    setPicking(false);
  }

  function removeOne(id: string) {
    const current = inBag(id);
    if (current <= 0) return;
    if (total === 1) {
      refocus.current = ".tm-card-plus";
      setPicking(false);
    } else if (current === 1 && picking) {
      // The size's own counter gives way to its add button, which keeps the focus.
      refocus.current = `.tm-card-size-add[data-size="${CSS.escape(id)}"]`;
    }
    change(id, current - 1);
  }

  /** The counter's −: one size in the bag takes one away at once; with several, ask which. */
  function less() {
    if (!multi) return removeOne(lead.id);
    if (sizesInBag.length === 1) return removeOne(sizesInBag[0].id);
    openedBy.current = "less";
    setPicking(true);
  }

  /** The counter's +: one more of the only size, or the choice of sizes. */
  function more() {
    if (!multi) return addOne(lead.id);
    openedBy.current = "more";
    setPicking((open) => !open);
  }

  // Tabbing away puts the sizes away. Focus that goes nowhere is not leaving: Safari drops focus on
  // a tap, even a tap on a size, and closing then would swallow the tap. Taps elsewhere close
  // them through the listener above.
  function closeOnLeave(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;
    if (next && !event.currentTarget.contains(next)) setPicking(false);
  }

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && picking) {
      event.stopPropagation();
      setPicking(false);
      root.current?.querySelector<HTMLButtonElement>(".tm-card-step.is-more, .tm-card-plus")?.focus();
    }
  }

  return (
    <article ref={root} role={listItem ? "listitem" : undefined} className={`tm-card${compact ? " is-compact" : ""}`} style={tone(lead)}>
      <div className="tm-card-stage">
        {(tag || outOfStock) && !compact && <span className="tm-card-tag">{outOfStock ? "Out of stock" : tag}</span>}
        <span className="tm-card-shadow" aria-hidden="true" />
        <span className="tm-card-vial" data-sheen>
          <img
            src={productCutout(lead, "sm")}
            srcSet={`${productCutout(lead, "sm")} 289w, ${productCutout(lead, "lg")} 578w`}
            sizes="(max-width: 760px) 40vw, (max-width: 1100px) 26vw, 18vw"
            alt=""
            {...pictureLoading(productCutout(lead, "sm"))}
            draggable={false}
            data-vial={lead.id}
          />
          <span className="tm-sheen" aria-hidden="true" style={sheenMask(productCutout(lead, "sm"))} />
        </span>
      </div>
      <div className="tm-card-body">
        <h3 className="tm-card-name">
          <Link
            className="tm-card-link"
            to={`/product/${lead.id}`}
            onClick={() => rememberVial(lead.id, root.current?.querySelector<HTMLElement>(".tm-card-vial img"))}
          >
            <ProductName name={name} />
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
        {/* A compact card has no room in its corner: the tag reads last, so names stay in line. */}
        {(tag || outOfStock) && compact && <p className="tm-card-flag">{outOfStock ? "Out of stock" : tag}</p>}
      </div>

      {buyable.length > 0 && (
        <div className={`tm-card-add${total > 0 ? " is-in" : ""}`} onBlur={closeOnLeave} onKeyDown={closeOnEscape}>
          {picking && (
            <div className="tm-card-sizes" id={menuId} role="group" aria-label={`Choose a size of ${name}`}>
              {buyable.map((v) => {
                const count = inBag(v.id);
                const soldOut = v.stock === 0;
                return count > 0 ? (
                  <div key={v.id} className="tm-card-size-row" data-size={v.id} role="group" aria-label={`${name} ${v.size} in your bag`}>
                    <span className="tm-card-size">
                      {v.size}
                      <em>{money(v.price!)}</em>
                    </span>
                    <span className="tm-card-size-step">
                      <button type="button" aria-label={`Remove one ${name} ${v.size}`} onClick={() => removeOne(v.id)}>
                        <Minus size={14} strokeWidth={1.8} aria-hidden="true" />
                      </button>
                      <span className="tm-card-count" aria-live="polite" aria-atomic="true">
                        <span className="sr-only">In your bag: </span>{count}
                      </span>
                      <button type="button" aria-label={`Add one more ${name} ${v.size}`} disabled={atLimit(v.id)} onClick={() => addOne(v.id, false)}>
                        <Plus size={14} strokeWidth={1.8} aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                ) : (
                  <button key={v.id} type="button" className="tm-card-size-add" data-size={v.id} disabled={soldOut || atLimit(v.id)} onClick={() => addOne(v.id)}>
                    <span className="tm-card-size">
                      {v.size}
                      {soldOut ? " · Out of stock" : ""}
                    </span>
                    <span>{money(v.price!)}</span>
                  </button>
                );
              })}
            </div>
          )}
          {total > 0 ? (
            <div className="tm-card-stepper" role="group" aria-label={multi ? `${name} in your bag` : `${name} ${lead.size} in your bag`}>
              <button
                type="button"
                className="tm-card-step is-less"
                aria-label={multi && sizesInBag.length > 1 ? `Remove one ${name}, choose a size` : `Remove one ${name} ${(multi ? sizesInBag[0] : lead).size}`}
                aria-expanded={multi && sizesInBag.length > 1 ? picking : undefined}
                onClick={less}
              >
                <Minus size={16} strokeWidth={1.6} aria-hidden="true" />
              </button>
              <span className="tm-card-count" aria-live="polite" aria-atomic="true">
                <span className="sr-only">In your bag: </span>{total}
              </span>
              <button
                type="button"
                className="tm-card-step is-more"
                aria-label={multi ? `Add ${name} to bag, choose a size` : `Add one more ${name} ${lead.size}`}
                aria-expanded={multi ? picking : undefined}
                aria-controls={multi && picking ? menuId : undefined}
                disabled={full}
                onClick={more}
              >
                <Plus size={16} strokeWidth={1.6} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="tm-card-plus"
              disabled={outOfStock || full}
              aria-label={multi ? `Add ${name} to bag, choose a size` : `Add ${name} ${lead.size} to bag`}
              aria-expanded={multi ? picking : undefined}
              aria-controls={multi && picking ? menuId : undefined}
              onClick={more}
            >
              <Plus size={18} strokeWidth={1.6} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </article>
  );
}
