import { stockProblem } from "../../../platform/commerce";
import { InsuranceRow, useInsuranceChoice } from "../../Insurance";
import { LIVE, storageKey } from "../../../platform/mode";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CircleAlert } from "lucide-react";
import { money, products } from "../../../data";
import type { Product } from "../../../data";
import { store } from "../../../platform/store";
import type { Discount } from "../../../platform/types";
import { productCutout } from "../../catalog";
import { readReferral, useShop } from "../../context";
import { Quantity } from "../../ui";
import { ShippingProgress, useShipping } from "../../ShippingProgress";
import { priceQuote, defaultSettings, roundMoney } from "../../../platform/pricing";
import "./checkout.css";

/* ---------- Shared by the bag, checkout and confirmation ---------- */

export { roundMoney };

/** A discount shown as a negative amount, with a true minus sign. */
export const minus = (n: number) => `−${money(n)}`;

/** The store's own formula, so the preview shows exactly what the order will record. */
export const discountOn = (subtotal: number, discount: Discount) =>
  priceQuote(subtotal, discount.percent, null, defaultSettings).discountAmount;

export type BagLine = { product: Product; quantity: number; total: number };

export function useBagLines() {
  const { cart, catalogChecking, catalogError, reloadCatalog } = useShop();
  const lines: BagLine[] = cart.flatMap((item) => {
    const product = products.find((p) => p.id === item.id);
    if (!product || product.price === undefined) return [];
    return [{ product, quantity: item.quantity, total: roundMoney(product.price * item.quantity) }];
  });
  const issues = cart.flatMap((item) => {
    const product = products.find((p) => p.id === item.id);
    const message = product ? stockProblem(product, item.quantity) : `Product ${item.id} is no longer available. Remove it to continue.`;
    return message ? [{ id: item.id, message }] : [];
  });
  return {
    issues, catalogChecking, catalogError, reloadCatalog,
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: roundMoney(lines.reduce((sum, line) => sum + line.total, 0)),
  };
}

export function StockNotice({ issues, checking, error, onRetry }: {
  issues: { id: string; message: string }[]; checking?: boolean; error?: string | null; onRetry?: () => void;
}) {
  const { change } = useShop();
  return <div className="tm-stock-notice" aria-live="polite">
    {checking && <p className="tm-summary-note">Checking availability…</p>}
    {error && <p role="alert">Availability could not be checked. <button type="button" className="tm-text-button" onClick={onRetry}>Try again</button></p>}
    {issues.map((issue) => <p key={issue.id} role="alert">{issue.message} <button type="button" className="tm-text-button" onClick={() => change(issue.id, 0)}>Remove item</button></p>)}
  </div>;
}

export const itemCount = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

/** The vial standing in a small square of the lilac studio. */
export function Thumb({ product, size = "sm" }: { product: Product; size?: "xs" | "sm" | "lg" }) {
  return (
    <span className={`tm-thumb tm-thumb-${size}`}>
      <img src={productCutout(product, "sm")} alt="" loading="lazy" draggable={false} />
    </span>
  );
}

/* The discount code travels from the bag to checkout within this browser session. */
const CODE_KEY = storageKey("tm-preview-bag-code");

export type CodeSource = "typed" | "link";
type Stored = { discount: Discount | null; source: CodeSource };

function readStored(): Stored | undefined {
  try {
    const raw = sessionStorage.getItem(CODE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : undefined;
  } catch {
    return undefined;
  }
}
function writeStored(value: Stored | null) {
  try {
    if (value) sessionStorage.setItem(CODE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(CODE_KEY);
  } catch {
    /* Without storage the code still applies on this page. */
  }
  window.dispatchEvent(new CustomEvent("tm-bag-code", { detail: value }));
}
function readRef(): string | null {
  return readReferral()?.trim().toUpperCase() || null;
}

/** Forget the bag's code once an order is placed; a partner link applies again next time. */
export function clearBagCode() {
  writeStored(null);
}

export type BagCode = {
  discount: Discount | null;
  source: CodeSource | null;
  checking: boolean;
  error: string | null;
  apply: (raw: string) => Promise<boolean>;
  remove: () => void;
  clearError: () => void;
};

type CodeState = Omit<BagCode, "apply" | "remove" | "clearError">;

export function useBagCode(): BagCode {
  const [state, setState] = useState<CodeState>(() => {
    const stored = readStored();
    if (stored) {
      return { discount: stored.discount, source: stored.discount ? stored.source : null, checking: false, error: null };
    }
    return { discount: null, source: null, checking: readRef() !== null, error: null };
  });

  useEffect(() => {
    const sync = (event: Event) => {
      const stored = (event as CustomEvent<Stored | null>).detail;
      setState({ discount: stored?.discount ?? null, source: stored?.discount ? stored.source : null, checking: false, error: null });
    };
    window.addEventListener("tm-bag-code", sync);
    return () => window.removeEventListener("tm-bag-code", sync);
  }, []);

  useEffect(() => {
    let live = true;
    const stored = readStored();
    if (stored) {
      // Re-check a remembered code: a partner can be paused between visits.
      const code = stored.discount?.code;
      if (code) {
        store.catalog.validateCode(code).then(
          (discount) => {
            if (!live) return;
            if (discount) {
              if (LIVE) {
                writeStored({ discount, source: stored.source });
                setState({ discount, source: stored.source, checking: false, error: null });
              }
              return;
            }
            writeStored({ discount: null, source: stored.source });
            setState({ discount: null, source: null, checking: false, error: `Code ${code} is no longer active.` });
          },
          () => undefined,
        );
      }
      return () => {
        live = false;
      };
    }
    const ref = readRef();
    if (!ref) return;
    store.catalog.validateCode(ref).then(
      (discount) => {
        // A code the buyer entered meanwhile always wins over the link.
        if (!live || readStored()) return;
        if (discount) {
          writeStored({ discount, source: "link" });
          setState({ discount, source: "link", checking: false, error: null });
        } else {
          setState((s) => ({ ...s, checking: false }));
        }
      },
      () => live && setState((s) => ({ ...s, checking: false })),
    );
    return () => {
      live = false;
    };
  }, []);

  async function apply(raw: string) {
    const code = raw.trim().toUpperCase();
    if (!code) {
      setState((s) => ({ ...s, error: "Enter a code to apply." }));
      return false;
    }
    setState((s) => ({ ...s, checking: true, error: null }));
    try {
      const discount = await store.catalog.validateCode(code);
      if (!discount) {
        setState((s) => ({ ...s, checking: false, error: `No active code matches “${code}”.` }));
        return false;
      }
      writeStored({ discount, source: "typed" });
      setState({ discount, source: "typed", checking: false, error: null });
      return true;
    } catch {
      setState((s) => ({ ...s, checking: false, error: "The code could not be checked. Try again." }));
      return false;
    }
  }

  function remove() {
    // Remember that the buyer chose no code, so a partner link does not re-apply it.
    writeStored({ discount: null, source: "typed" });
    setState({ discount: null, source: null, checking: false, error: null });
  }

  return { ...state, apply, remove, clearError: () => setState((s) => ({ ...s, error: null })) };
}

const codeKind = (discount: Discount) => (discount.kind === "partner" ? "Partner code" : "Promo code");

/**
 * "Partner or promo code". Shows the field while no code is applied, and the applied
 * code's note and Remove once one is. Focus moves between the two so it is never lost.
 */
export function CodeControl({ code }: { code: BagCode }) {
  const [value, setValue] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  const handoff = useRef(false);
  useEffect(() => {
    if (!handoff.current) return;
    handoff.current = false;
    (code.discount ? removeButton.current : input.current)?.focus();
  }, [code.discount]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    handoff.current = true;
    const applied = await code.apply(value);
    if (applied) {
      setValue("");
      setAnnouncement(`Code ${value.trim().toUpperCase()} applied.`);
    } else {
      handoff.current = false;
      input.current?.focus();
    }
  }
  const errorId = `${id}-error`;
  const { discount } = code;
  return (
    <div className="tm-code">
      {discount ? (
        <p className="tm-code-applied">
          {code.source === "link" && (
            <span>
              Partner code <span className="tm-mono">{discount.code}</span> applied from your link
            </span>
          )}
          <button
            ref={removeButton}
            type="button"
            className="tm-text-button"
            onClick={() => {
              handoff.current = true;
              code.remove();
              setAnnouncement(`Code ${discount.code} removed.`);
            }}
          >
            Remove<span className="sr-only"> code {discount.code}</span>
          </button>
        </p>
      ) : (
        <form onSubmit={submit} noValidate>
          <label className="tm-code-label" htmlFor={id}>
            Partner or promo code
          </label>
          <div className={`tm-code-field${code.error ? " is-invalid" : ""}`}>
            <input
              ref={input}
              id={id}
              className="tm-mono"
              value={value}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={32}
              aria-invalid={code.error ? true : undefined}
              aria-describedby={code.error ? errorId : undefined}
              onChange={(e) => {
                setValue(e.target.value);
                if (code.error) code.clearError();
              }}
            />
            <button type="submit" disabled={!value.trim() || code.checking}>
              {code.checking ? "Checking" : "Apply"}
            </button>
          </div>
          {code.error && (
            <p id={errorId} className="tm-field-error" role="alert">
              <CircleAlert size={14} strokeWidth={1.8} aria-hidden="true" />
              {code.error}
            </p>
          )}
        </form>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

/** The applied code as a totals row: the kind, the code in mono, and the amount it takes off. */
export function DiscountRow({ discount, amount }: { discount: Discount | null; amount: number }) {
  if (!discount) return null;
  return (
    <div className="tm-totals-row">
      <dt>
        {codeKind(discount)} <span className="tm-mono">{discount.code}</span>
        <span className="tm-totals-sub"> · {discount.percent}% off</span>
      </dt>
      <dd>{minus(amount)}</dd>
    </div>
  );
}

/* ---------- Bag drawer ---------- */

/** Moves focus to the next line's Remove after a removal, or to the empty state's link. */
function useRemovalFocus(length: number) {
  const list = useRef<HTMLUListElement>(null);
  const fallback = useRef<HTMLAnchorElement>(null);
  const pending = useRef<number | null>(null);
  useEffect(() => {
    const index = pending.current;
    if (index === null) return;
    pending.current = null;
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>(".tm-remove");
    const next = buttons?.length ? buttons[Math.min(index, buttons.length - 1)] : fallback.current;
    next?.focus();
  }, [length]);
  return { list, fallback, mark: (index: number) => (pending.current = index) };
}

export function BagContents() {
  const { change, closeCart } = useShop();
  const { lines, count, subtotal, issues, catalogChecking, catalogError, reloadCatalog } = useBagLines();
  const [insured] = useInsuranceChoice();
  const blocked = issues.length > 0 || catalogChecking || Boolean(catalogError);
  const focus = useRemovalFocus(lines.length);
  const code = useBagCode();
  const shipping = useShipping();
  const discount = code.discount ? discountOn(subtotal, code.discount) : 0;
  const method = shipping.data?.methods.find((m) => m.id === "cold-2day") ?? null;
  const priced = shipping.data ? priceQuote(subtotal, code.discount?.percent ?? 0, method, shipping.data.settings, insured) : null;

  if (!lines.length && !issues.length) {
    return (
      <div className="tm tm-bag is-empty">
        <div className="tm-bag-empty">
          <p className="tm-bag-empty-title">Your bag is empty.</p>
          <Link ref={focus.fallback} className="tm-button tm-button-primary" to="/products" onClick={closeCart}>
            Shop the collection
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="tm tm-bag">
      <p className="tm-bag-tally" aria-live="polite">
        {itemCount(count)}
      </p>
      <ul className="tm-bag-lines" ref={focus.list} aria-label="Items in your bag">
        {lines.map(({ product, quantity, total }, i) => (
          <li className="tm-bag-line" key={product.id}>
            <Thumb product={product} />
            <div className="tm-bag-info">
              <Link className="tm-line-name" to={`/product/${product.id}`} onClick={closeCart}>
                {product.name}
              </Link>
              <p className="tm-line-meta">
                {product.size} · <span className="tm-mono">{product.lot}</span>
              </p>
            </div>
            <p className="tm-bag-price">{money(total)}</p>
            <div className="tm-bag-controls">
              <Quantity
                value={quantity}
                onChange={(q) => change(product.id, q)}
                label={`Quantity for ${product.name} ${product.size}`}
              />
              <button
                type="button"
                className="tm-remove"
                onClick={() => {
                  focus.mark(i);
                  change(product.id, 0);
                }}
              >
                Remove<span className="sr-only"> {product.name} {product.size}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="tm-bag-foot">
        <p className="tm-bag-subtotal">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </p>
        <StockNotice issues={issues} checking={catalogChecking} error={catalogError} onRetry={reloadCatalog} />
        <dl className="tm-totals">
          <DiscountRow discount={code.discount} amount={priced?.discountAmount ?? discount} />
          <InsuranceRow amount={priced?.insurance} applied={priced?.insuranceApplied} />
          <div className="tm-totals-row"><dt>{method?.label ?? "Shipping"}</dt><dd>{priced && method ? priced.shipping === 0 ? "Free" : money(priced.shipping) : "…"}</dd></div>
          <div className="tm-totals-row tm-totals-total"><dt>Total</dt><dd>{priced && method ? money(priced.total) : "…"}</dd></div>
        </dl>
        <ShippingProgress base={priced?.base ?? subtotal} count={count} settings={shipping.data?.settings} />
        {shipping.error && <p role="alert" className="tm-bag-note">Shipping could not be loaded. <button className="tm-text-button" onClick={shipping.reload}>Try again</button></p>}
        <Link className="tm-button tm-button-primary" to="/checkout" aria-disabled={blocked || undefined} tabIndex={blocked ? -1 : undefined} onClick={(event) => { if (blocked) event.preventDefault(); else closeCart(); }}>
          Check out
        </Link>
        <Link className="tm-textlink" to="/cart" onClick={closeCart}>
          View bag <ArrowRight size={16} strokeWidth={1.6} />
        </Link>
      </div>
    </div>
  );
}

/* ---------- /cart ---------- */

export function CartPage() {
  const { change } = useShop();
  const { lines, count, subtotal, issues, catalogChecking, catalogError, reloadCatalog } = useBagLines();
  const [insured] = useInsuranceChoice();
  const blocked = issues.length > 0 || catalogChecking || Boolean(catalogError);
  const code = useBagCode();
  const focus = useRemovalFocus(lines.length);
  const shipping = useShipping();
  const method = shipping.data?.methods.find((m) => m.id === "cold-2day") ?? null;
  const discount = code.discount ? discountOn(subtotal, code.discount) : 0;
  const priced = shipping.data ? priceQuote(subtotal, code.discount?.percent ?? 0, method, shipping.data.settings, insured) : null;

  if (!lines.length && !issues.length) {
    return (
      <div className="tm-page tm-purchase">
        <section className="tm tm-purchase-empty" aria-labelledby="tm-cart-title">
          <div className="tm-empty-page">
            <p className="tm-eyebrow">Your bag</p>
            <h1 id="tm-cart-title" className="tm-display">
              Your bag is empty.
            </h1>
            <Link ref={focus.fallback} className="tm-button tm-button-primary" to="/products">
              Shop the collection
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="tm-page tm-purchase">
      <section className="tm tm-cart" aria-labelledby="tm-cart-title">
        <header className="tm-purchase-head">
          <p className="tm-eyebrow">Your bag</p>
          <h1 id="tm-cart-title" className="tm-heading">
            {itemCount(count)}.
            <br />
            <span>Each traceable to its&nbsp;lot.</span>
          </h1>
        </header>

        <ul className="tm-cart-lines" ref={focus.list} aria-label="Items in your bag">
          {lines.map(({ product, quantity, total: lineTotal }, i) => (
            <li className="tm-cart-line" key={product.id}>
              <Thumb product={product} size="lg" />
              <div className="tm-cart-line-body">
                <h2 className="tm-cart-name">
                  <Link className="tm-line-name" to={`/product/${product.id}`}>
                    {product.name}
                  </Link>
                </h2>
                <p className="tm-cart-price">{money(lineTotal)}</p>
                <p className="tm-line-meta tm-cart-meta">
                  {product.size} · {product.form}
                  <br />
                  Lot <span className="tm-mono">{product.lot}</span>
                </p>
                <div className="tm-cart-controls">
                  <Quantity
                    value={quantity}
                    onChange={(q) => change(product.id, q)}
                    label={`Quantity for ${product.name} ${product.size}`}
                  />
                  <button
                    type="button"
                    className="tm-remove"
                    onClick={() => {
                      focus.mark(i);
                      change(product.id, 0);
                    }}
                  >
                    Remove<span className="sr-only"> {product.name} {product.size}</span>
                  </button>
                  {quantity > 1 && product.price !== undefined && (
                    <span className="tm-cart-unit">{money(product.price)} per vial</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="tm-summary tm-cart-summary" aria-labelledby="tm-cart-summary-title">
          <h2 id="tm-cart-summary-title" className="tm-summary-title">
            Summary
          </h2>
          <StockNotice issues={issues} checking={catalogChecking} error={catalogError} onRetry={reloadCatalog} />
          <dl className="tm-totals">
            <div className="tm-totals-row">
              <dt>Subtotal</dt>
              <dd>{money(subtotal)}</dd>
            </div>
            <DiscountRow discount={code.discount} amount={discount} />
            <InsuranceRow amount={priced?.insurance} applied={priced?.insuranceApplied} />
            <div className="tm-totals-row"><dt>{method?.label ?? "Shipping"}</dt><dd>{priced && method ? priced.shipping === 0 ? "Free" : money(priced.shipping) : "…"}</dd></div>
          </dl>
          <CodeControl code={code} />
          <div className="tm-totals-row tm-totals-total">
            <span>Total</span>
            <span>{priced && method ? money(priced.total) : "…"}</span>
          </div>
          <ShippingProgress base={priced?.base ?? roundMoney(subtotal - discount)} count={count} settings={shipping.data?.settings} />
          {shipping.error && <p role="alert" className="tm-summary-note">Shipping could not be loaded. <button className="tm-text-button" onClick={shipping.reload}>Try again</button></p>}
          <Link aria-disabled={blocked || undefined} tabIndex={blocked ? -1 : undefined} onClick={(event) => { if (blocked) event.preventDefault(); }} className="tm-button tm-button-primary tm-button-block" to="/checkout">
            Check out
          </Link>
        </aside>
      </section>
    </div>
  );
}
