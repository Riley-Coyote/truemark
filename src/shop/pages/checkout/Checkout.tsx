import { live } from "../../../platform/live/runtime";
import { PaymentOutcomes } from "./Pay";
import type { Outcome } from "../../../platform/live/payments";
import type { Order } from "../../../platform/types";
import { InsuranceRow, useInsuranceChoice, clearInsuranceChoice } from "../../Insurance";
import { priceQuote, shippingPrice, insurancePrice } from "../../../platform/pricing";
import { LIVE } from "../../../platform/mode";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, CircleAlert, LockKeyhole, Plus } from "lucide-react";
import { money } from "../../../data";
import { productById } from "../../catalog";
import { store, useResource } from "../../../platform/store";
import type { Address, Buyer, BuyerStatus, ShippingMethod, ShippingMethodId } from "../../../platform/types";
import { useShop } from "../../context";
import { usePrefersReducedMotion } from "../../motion";
import {
  StockNotice,
  CodeControl,
  DiscountRow,
  Thumb,
  clearBagCode,
  discountOn,
  itemCount,
  roundMoney,
  useBagCode,
  useBagLines,
} from "./Bag";
import type { BagCode, BagLine } from "./Bag";
import "./checkout.css";

type StepId = "account" | "address" | "delivery" | "payment";

const STEPS: Record<StepId, { index: string; title: string }> = {
  account: { index: "01", title: "Research account" },
  address: { index: "02", title: "Shipping address" },
  delivery: { index: "03", title: "Delivery" },
  payment: { index: "04", title: "Payment" },
};
const ORDER: StepId[] = ["account", "address", "delivery", "payment"];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STATES: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];

/** Why an account that is not verified cannot order. */
const STATUS_NOTE: Record<Exclude<BuyerStatus, "verified">, string> = {
  pending: "This research account is awaiting review. Orders can be placed once it is verified.",
  declined: "This research account was not approved, so orders can’t be placed from it.",
  suspended: "This research account is suspended, so orders can’t be placed from it.",
};

const addressLine = (a: Address) =>
  `${a.institution}, ${a.line1}${a.line2 ? `, ${a.line2}` : ""}, ${a.city}, ${a.region} ${a.postal}`;

/* ---------- Small parts ---------- */

function PaymentLock({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  return LIVE ? <fieldset className="tm-payment-lock" disabled={disabled}>{children}</fieldset> : <>{children}</>;
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="tm-field-error">
      <CircleAlert size={14} strokeWidth={1.8} aria-hidden="true" />
      {children}
    </p>
  );
}

function Step({
  id,
  done,
  summary,
  onChange,
  locked,
  tag,
  headingRef,
  children,
}: {
  id: StepId;
  done: boolean;
  summary?: ReactNode;
  onChange?: () => void;
  locked?: boolean;
  tag?: string;
  headingRef: (el: HTMLHeadingElement | null) => void;
  children?: ReactNode;
}) {
  const { index, title } = STEPS[id];
  return (
    <section className={`tm-step${done ? " is-done" : ""}`} aria-labelledby={`tm-step-${id}`}>
      <span className="tm-step-index" aria-hidden="true">
        {index}
      </span>
      <h2 id={`tm-step-${id}`} className="tm-step-title" tabIndex={-1} ref={headingRef}>
        <span className="sr-only">Part {Number(index)} of 4, </span>
        {title}
        {done && <span className="sr-only">, complete</span>}
      </h2>
      {done ? (
        <div className="tm-step-summary">
          <div className="tm-step-summary-text">{summary}</div>
          <button type="button" className="tm-text-button" disabled={locked} onClick={onChange}>
            Change<span className="sr-only"> {title.toLowerCase()}</span>
          </button>
        </div>
      ) : (
        <>
          {tag && <span className="tm-step-tag">{tag}</span>}
          <div className="tm-step-body">{children}</div>
        </>
      )}
    </section>
  );
}

function VerifiedMark({ status }: { status: BuyerStatus }) {
  const verified = status === "verified";
  return (
    <span className={`tm-verified${verified ? "" : " is-muted"}`}>
      <i aria-hidden="true" />
      {verified ? "Verified" : status === "pending" ? "Awaiting review" : status === "declined" ? "Not approved" : "Suspended"}
    </span>
  );
}

/* ---------- 01 Research account ---------- */

function SignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  return LIVE ? <div className="tm-signin"><p className="tm-step-lead">Sign in to your research account to place an order.</p><Link className="tm-button tm-button-primary" to="/access" state={{ from: "/checkout" }}>Sign in</Link></div> : <PreviewSignInForm onSignedIn={onSignedIn} />;
}
function PreviewSignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const message = "Enter an email address, such as name@institution.org.";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setError(message);
      input.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await store.session.signIn(email.trim());
      onSignedIn();
    } catch {
      setError("The account could not be opened. Try again.");
      setBusy(false);
    }
  }

  return (
    <form className="tm-signin" onSubmit={submit} noValidate>
      <p className="tm-step-lead">Sign in to your research account to place an order.</p>
      <div className={`tm-field${error ? " is-invalid" : ""}`}>
        <label htmlFor="tm-checkout-email">Email</label>
        <input
          ref={input}
          id="tm-checkout-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          value={email}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "tm-checkout-email-error" : "tm-checkout-email-note"}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error && EMAIL.test(e.target.value.trim())) setError(null);
          }}
          onBlur={() => {
            if (email.trim() && !EMAIL.test(email.trim())) setError(message);
          }}
        />
        {error && <FieldError id="tm-checkout-email-error">{error}</FieldError>}
      </div>
      <div className="tm-step-actions">
        <button type="submit" className="tm-button tm-button-primary" disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Opening the account" : "Continue"}
        </button>
        <Link className="tm-textlink" to="/access/apply">
          Apply for a research account <ArrowRight size={16} strokeWidth={1.6} />
        </Link>
      </div>
      <p id="tm-checkout-email-note" className="tm-step-fine">
        Design preview: any email opens the sample research account.
      </p>
    </form>
  );
}

function AccountCard({ buyer }: { buyer: Buyer }) {
  return (
    <div className="tm-account-card">
      <p className="tm-account-name">{buyer.name}</p>
      <p className="tm-account-meta">
        {buyer.institution} · {buyer.role}
        <br />
        {buyer.email}
      </p>
      <VerifiedMark status={buyer.status} />
    </div>
  );
}

/* ---------- 02 Shipping address ---------- */

type Draft = {
  institution: string;
  attention: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  phone: string;
};
type DraftKey = keyof Draft;

const EMPTY_DRAFT: Draft = { institution: "", attention: "", line1: "", line2: "", city: "", region: "", postal: "", phone: "" };

const RULES: Record<DraftKey, (value: string) => string | null> = {
  institution: (v) => (v.trim() ? null : "Enter the institution’s name."),
  attention: (v) => (v.trim() ? null : "Enter the name of the person who receives the shipment."),
  line1: (v) => (v.trim() ? null : "Enter the street address."),
  line2: () => null,
  city: (v) => (v.trim() ? null : "Enter the city."),
  region: (v) => (v ? null : "Choose the state."),
  postal: (v) => (/^\d{5}(-\d{4})?$/.test(v.trim()) ? null : "Enter a five-digit ZIP code."),
  phone: (v) => (v.replace(/\D/g, "").length >= 10 ? null : "Enter a phone number with its area code."),
};

const FIELDS: { key: DraftKey; label: string; autoComplete: string; hint?: string; optional?: boolean; wide?: boolean; type?: string }[] = [
  { key: "institution", label: "Institution", autoComplete: "organization", wide: true },
  { key: "attention", label: "Attention", autoComplete: "name", hint: "The person who receives the shipment.", wide: true },
  { key: "line1", label: "Address line 1", autoComplete: "address-line1", wide: true },
  { key: "line2", label: "Address line 2", autoComplete: "address-line2", hint: "Suite, floor or building.", optional: true, wide: true },
  { key: "city", label: "City", autoComplete: "address-level2" },
  { key: "region", label: "State", autoComplete: "address-level1" },
  { key: "postal", label: "ZIP", autoComplete: "postal-code" },
  { key: "phone", label: "Phone", autoComplete: "tel", type: "tel" },
];

function AddressForm({ onUse, onCancel }: { onUse: (address: Address) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Partial<Record<DraftKey, string>>>({});
  const refs = useRef<Partial<Record<DraftKey, HTMLInputElement | HTMLSelectElement | null>>>({});
  const baseId = useId();
  useEffect(() => {
    refs.current.institution?.focus();
  }, []);

  const check = (key: DraftKey, value: string) =>
    setErrors((current) => ({ ...current, [key]: RULES[key](value) ?? undefined }));

  function update(key: DraftKey, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    // Once a field has shown an error, clear it as soon as the value is right.
    if (errors[key]) check(key, value);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: Partial<Record<DraftKey, string>> = {};
    for (const { key } of FIELDS) {
      const message = RULES[key](draft[key]);
      if (message) next[key] = message;
    }
    setErrors(next);
    const first = FIELDS.find(({ key }) => next[key]);
    if (first) {
      refs.current[first.key]?.focus();
      return;
    }
    onUse({
      id: `new-${Date.now()}`,
      label: "New address",
      institution: draft.institution.trim(),
      attention: draft.attention.trim(),
      line1: draft.line1.trim(),
      line2: draft.line2.trim() || undefined,
      city: draft.city.trim(),
      region: draft.region,
      postal: draft.postal.trim(),
      country: "United States",
      phone: draft.phone.trim(),
    });
  }

  return (
    <form className="tm-address-form" onSubmit={submit} noValidate aria-label="New address">
      <p className="tm-address-form-title">New address</p>
      <div className="tm-fields">
        {FIELDS.map(({ key, label, autoComplete, hint, optional, wide, type }) => {
          const id = `${baseId}-${key}`;
          const error = errors[key];
          const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
          const common = {
            id,
            autoComplete,
            value: draft[key],
            "aria-invalid": error ? true : undefined,
            "aria-describedby": describedBy,
            "aria-required": optional ? undefined : true,
            onBlur: () => check(key, draft[key]),
          };
          return (
            <div key={key} className={`tm-field tm-field-${key}${wide ? " is-wide" : ""}${error ? " is-invalid" : ""}`}>
              <label htmlFor={id}>
                {label}
                {optional && <span className="tm-field-optional"> (optional)</span>}
              </label>
              {key === "region" ? (
                <div className="tm-select-field">
                  <select
                    {...common}
                    ref={(el) => {
                      refs.current[key] = el;
                    }}
                    onChange={(e) => {
                      update(key, e.target.value);
                      check(key, e.target.value);
                    }}
                  >
                    <option value="">Choose</option>
                    {STATES.map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <input
                  {...common}
                  ref={(el) => {
                    refs.current[key] = el;
                  }}
                  type={type ?? "text"}
                  inputMode={key === "postal" ? "numeric" : key === "phone" ? "tel" : undefined}
                  maxLength={key === "postal" ? 10 : 120}
                  onChange={(e) => update(key, e.target.value)}
                />
              )}
              {error ? (
                <FieldError id={`${id}-error`}>{error}</FieldError>
              ) : (
                hint && (
                  <p id={`${id}-hint`} className="tm-field-hint">
                    {hint}
                  </p>
                )
              )}
            </div>
          );
        })}
      </div>
      <p className="tm-address-country">Country · United States</p>
      {LIVE && <p className="tm-step-fine">Saved to your research account for your next order.</p>}
      <div className="tm-step-actions">
        <button type="submit" className="tm-button tm-button-primary">
          Use this address
        </button>
        <button type="button" className="tm-text-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddressChoice({ address, checked, onSelect }: { address: Address; checked: boolean; onSelect: () => void }) {
  return (
    <label className="tm-choice">
      <input type="radio" className="tm-choice-input" name="tm-address" value={address.id} checked={checked} onChange={onSelect} />
      <span className="tm-choice-top">
        <span className="tm-choice-label">{address.label}</span>
        <span className="tm-choice-mark" aria-hidden="true" />
      </span>
      <span className="tm-choice-title">{address.institution}</span>
      <span className="tm-choice-text">
        {address.attention}
        <br />
        {address.line1}
        {address.line2 && `, ${address.line2}`}
        <br />
        {address.city}, {address.region} {address.postal}
        {address.phone && (
          <>
            <br />
            {address.phone}
          </>
        )}
      </span>
    </label>
  );
}

/* ---------- Order summary ---------- */

function OrderSummary({
  lines,
  subtotal,
  code,
  discountAmount,
  insurance,
  insuranceApplied,
  method,
  total,
  titleId,
  tax,
  taxMode,
  addressChosen,
  sampleRates,
  locked,
}: {
  lines: BagLine[];
  subtotal: number;
  code: BagCode;
  discountAmount: number;
  insurance: number;
  insuranceApplied: boolean;
  method: ShippingMethod | null;
  total: number;
  titleId: string;
  tax: number;
  taxMode: "off" | "rates";
  addressChosen: boolean;
  sampleRates: boolean;
  locked: boolean;
}) {
  return (
    <>
      <div className="tm-summary-head">
        <h2 id={titleId} className="tm-summary-title">
          Order summary
        </h2>
        <Link className="tm-quiet-link" aria-disabled={locked || undefined} onClick={(event) => { if (locked) event.preventDefault(); }} to="/cart">
          Edit bag
        </Link>
      </div>
      <ul className="tm-summary-lines" aria-label="Items">
        {lines.map(({ product, quantity, total: lineTotal }) => (
          <li className="tm-summary-line" key={product.id}>
            <Thumb product={product} size="xs" />
            <div className="tm-summary-line-text">
              <p className="tm-summary-name">
                {product.name} <span>{product.size}</span>
              </p>
              <p className="tm-summary-lot tm-mono">{product.lot}</p>
            </div>
            <p className="tm-summary-price">
              {money(lineTotal)}
              <span>Qty {quantity}</span>
            </p>
          </li>
        ))}
      </ul>
      <PaymentLock disabled={locked}><CodeControl code={code} /></PaymentLock>
      <dl className="tm-totals">
        <div className="tm-totals-row">
          <dt>Subtotal</dt>
          <dd>{money(subtotal)}</dd>
        </div>
        <DiscountRow discount={code.discount} amount={discountAmount} />
        <InsuranceRow amount={insurance} applied={insuranceApplied} />
        <div className="tm-totals-row">
          <dt>
            Shipping{sampleRates && <span className="tm-totals-sub"> · sample rate</span>}
          </dt>
          <dd>{method ? method.price === 0 ? "Free" : money(method.price) : "Choose delivery"}</dd>
        </div>
        {(!LIVE || taxMode === "rates") && <div className="tm-totals-row">
          <dt>Tax</dt><dd className={!LIVE || !addressChosen ? "tm-totals-quiet" : undefined}>{!LIVE ? "Calculated at launch" : addressChosen ? money(tax) : "Calculated after your address"}</dd>
        </div>}
      </dl>
      <p className="tm-totals-row tm-totals-total">
        <span>Total</span>
        <span>{money(total)}</span>
      </p>
    </>
  );
}

/* ---------- Page ---------- */

export default function Checkout() {
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();
  const { clear } = useShop();
  const { lines, count, subtotal, issues, catalogChecking, catalogError, reloadCatalog } = useBagLines();
  const [insured, setInsured] = useInsuranceChoice();
  const code = useBagCode();
  const session = useResource(() => store.session.get(), []);
  const methods = useResource(() => store.catalog.shippingMethods(), []);
  const settings = useResource(() => store.settings.get(), []);

  const buyer = session.data ?? null;
  const verified = buyer?.status === "verified";

  const [accountOpen, setAccountOpen] = useState(false);
  const [awaitingSignIn, setAwaitingSignIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [addressDone, setAddressDone] = useState(false);
  const [deliveryDone, setDeliveryDone] = useState(false);
  const [added, setAdded] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [methodId, setMethodId] = useState<ShippingMethodId>("cold-2day");
  const [attested, setAttested] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const paymentMode = useResource(() => LIVE ? live().payments.mode() : Promise.resolve("off" as const));
  const taxRates = useResource(() => LIVE ? live().payments.rates() : Promise.resolve([]));
  const [heldOrder, setHeldOrder] = useState<Order | null>(null);
  const [outcome, setOutcome] = useState<Outcome>("approve");
  const [sheetOpen, setSheetOpen] = useState(false);

  const headings = useRef<Partial<Record<StepId, HTMLHeadingElement | null>>>({});
  const addButton = useRef<HTMLButtonElement>(null);
  const [focusTarget, setFocusTarget] = useState<StepId | "add" | null>(null);
  const sheetId = useId();
  const sheetTitle = useId();
  const asideTitle = useId();

  // An address added here joins the account's own once it is saved there; list it once.
  const addresses = [...(buyer?.addresses ?? []), ...added.filter((a) => !buyer?.addresses.some((saved) => saved.id === a.id))];
  const address = addresses.find((a) => a.id === addressId) ?? null;
  const discountAmount = code.discount ? discountOn(subtotal, code.discount) : 0;
  const selectedMethod = methods.data?.find((m) => m.id === methodId) ?? null;
  const priced = settings.data ? priceQuote(subtotal, code.discount?.percent ?? 0, selectedMethod, settings.data, insured, LIVE ? address : null, taxRates.data ?? []) : null;
  const method = selectedMethod ? { ...selectedMethod, price: priced?.shipping ?? selectedMethod.price } : null;

  // Preselect the account's first saved address once it is known; drop a selection that left.
  const addressIds = addresses.map((a) => a.id).join(" ");
  useEffect(() => {
    if (addressId && addressIds.split(" ").includes(addressId)) return;
    setAddressId(addresses[0]?.id ?? null);
  }, [addressIds]);

  // After signing in, wait for the session to reflect it, then move on to the next open part.
  useEffect(() => {
    if (!awaitingSignIn || !buyer) return;
    setAwaitingSignIn(false);
    setAccountOpen(false);
    setFocusTarget(buyer.status === "verified" ? nextOpen("account", { account: true }) : "account");
  }, [awaitingSignIn, buyer]);

  useEffect(() => {
    if (!focusTarget) return;
    setFocusTarget(null);
    const el = focusTarget === "add" ? addButton.current : headings.current[focusTarget];
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [focusTarget, reduced]);

  const accountDone = Boolean(buyer && verified && !accountOpen);
  const addressComplete = addressDone && address !== null && !adding;
  const deliveryComplete = deliveryDone && method !== null;

  function nextOpen(from: StepId, now: Partial<Record<StepId, boolean>> = {}): StepId {
    const done: Record<StepId, boolean> = {
      account: accountDone,
      address: addressComplete,
      delivery: deliveryComplete,
      payment: false,
      ...now,
    };
    return ORDER.slice(ORDER.indexOf(from) + 1).find((id) => !done[id]) ?? "payment";
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await store.session.signOut();
    } finally {
      setSigningOut(false);
      setAccountOpen(false);
      setAddressDone(false);
      setFocusTarget("account");
    }
  }

  const total = heldOrder?.total ?? priced?.total ?? roundMoney(subtotal - discountAmount + (method?.price ?? 0));

  const needs: string[] = [];
  if (!buyer) needs.push("a research account");
  else if (!verified) needs.push("a verified research account");
  if (!address || adding) needs.push("a shipping address");
  if (!method) needs.push("a delivery method");
  if (!settings.data || settings.loading || settings.error) needs.push("shipping settings");
  if (!heldOrder && (issues.length || catalogChecking || catalogError)) needs.push("available stock");
  if (LIVE && (paymentMode.loading || paymentMode.error || !paymentMode.data || paymentMode.data === "live")) needs.push("payments");
  if (LIVE && settings.data?.taxMode === "rates" && (taxRates.loading || taxRates.error)) needs.push("tax rates");
  if (code.checking) needs.push("code verification");
  if (!attested) needs.push("the research-use confirmation");
  const canPlace = needs.length === 0 && (heldOrder !== null || lines.length > 0) && !placing;

  async function place() {
    if (!canPlace || !buyer || !address || !method) return;
    setPlacing(true);
    setPlaceError(null);
    try {
      const order = heldOrder ?? await store.orders.place(buyer.id, {
        lines: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        address,
        shipping: method.id,
        insurance: insured,
        discountCode: code.discount?.code,
        via: code.source === "link" ? "link" : "code",
      });
      if (LIVE && paymentMode.data === "simulated") {
        setHeldOrder(order);
        const result = await live().payments.pay(order.id, outcome);
        if (result.status === "failed") {
          setPlaceError("The payment was declined. Choose an outcome and try again.");
          setPlacing(false); return;
        }
      }
      clearBagCode();
      clearInsuranceChoice();
      navigate(`/checkout/confirmation/${order.id}`, { replace: true });
      clear();
    } catch (error) {
      setPlacing(false);
      reloadCatalog?.();
      setPlaceError(error instanceof Error ? error.message : "The order could not be placed. Try again.");
    }
  }

  if (!heldOrder && !lines.length && !issues.length) {
    return (
      <div className="tm-page tm-purchase">
        <section className="tm tm-purchase-empty" aria-labelledby="tm-checkout-title">
          <div className="tm-empty-page">
            <p className="tm-eyebrow">Checkout</p>
            <h1 id="tm-checkout-title" className="tm-page-title">
              Your bag is empty.
            </h1>
            <Link className="tm-button tm-button-primary" to="/products">
              Shop the collection
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const sampleRates = !LIVE || settings.data?.shippingRatesConfirmed !== true;
  const heldLines: BagLine[] | null = heldOrder ? heldOrder.lines.flatMap((line) => {
    const product = productById(line.productId);
    return product ? [{ product, quantity: line.quantity, total: roundMoney(line.quantity * line.unitPrice) }] : [];
  }) : null;
  const summaryProps = { lines: heldLines ?? lines, subtotal: heldOrder?.subtotal ?? subtotal, code, discountAmount: heldOrder?.discount?.amount ?? discountAmount, method: heldOrder && method ? { ...method, price: heldOrder.shipping.price } : method, total,
    tax: heldOrder?.tax ?? priced?.tax ?? 0, taxMode: settings.data?.taxMode ?? "off", addressChosen: address !== null, sampleRates, locked: heldOrder !== null,
    insurance: heldOrder?.insurance ?? priced?.insurance ?? 0, insuranceApplied: heldOrder?.insuranceApplied ?? priced?.insuranceApplied ?? false };
  const listFormat = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

  return (
    <div className="tm-page tm-purchase">
      <section className="tm tm-checkout" aria-labelledby="tm-checkout-title">
        <header className="tm-purchase-head">
          <p className="tm-eyebrow">Checkout</p>
          <h1 id="tm-checkout-title" className="tm-heading">
            Place your order.
          </h1>
        </header>
        {!LIVE && <p className="tm-purchase-preview">Design preview · sample data</p>}

        {/* Narrow screens: the summary folds into a bar above the four parts. */}
        <div className="tm-summary-sheet">
          <button
            type="button"
            className="tm-summary-toggle"
            aria-expanded={sheetOpen}
            aria-controls={sheetId}
            onClick={() => setSheetOpen((open) => !open)}
          >
            <span className="tm-summary-toggle-label">
              {sheetOpen ? "Hide order summary" : "Show order summary"}
              <span>{itemCount(count)}</span>
            </span>
            <span className="tm-summary-toggle-total">{money(total)}</span>
            <ChevronDown size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <div id={sheetId} className="tm-summary tm-summary-sheet-body" hidden={!sheetOpen} role="region" aria-labelledby={sheetTitle}>
            <OrderSummary {...summaryProps} titleId={sheetTitle} />
          </div>
        </div>

        <div className="tm-steps">
          <PaymentLock disabled={heldOrder !== null}>
          {/* 01 */}
          <Step
            id="account"
            locked={heldOrder !== null}
            done={accountDone}
            headingRef={(el) => {
              headings.current.account = el;
            }}
            onChange={() => {
              setAccountOpen(true);
              setFocusTarget("account");
            }}
            summary={
              buyer && (
                <>
                  <span>
                    {buyer.name}, {buyer.institution}
                  </span>
                  <VerifiedMark status={buyer.status} />
                </>
              )
            }
          >
            {session.data === undefined && session.error ? (
              <div className="tm-step-state" role="alert">
                <p className="tm-step-lead">The account could not be loaded.</p>
                <button type="button" className="tm-text-button" onClick={session.reload}>
                  Try again
                </button>
              </div>
            ) : session.data === undefined || awaitingSignIn ? (
              <p className="tm-step-state tm-step-lead" aria-live="polite">
                {awaitingSignIn ? "Opening the sample research account…" : "Checking your account…"}
              </p>
            ) : buyer ? (
              <div className="tm-account">
                <AccountCard buyer={buyer} />
                {buyer.status !== "verified" && (
                  <p className="tm-account-block" role="status">
                    <CircleAlert size={16} strokeWidth={1.7} aria-hidden="true" />
                    <span>
                      {STATUS_NOTE[buyer.status]}{" "}
                      <Link className="tm-quiet-link" to="/contact">
                        Contact the team
                      </Link>
                    </span>
                  </p>
                )}
                <div className="tm-step-actions">
                  {verified && (
                    <button
                      type="button"
                      className="tm-button tm-button-primary"
                      onClick={() => {
                        setAccountOpen(false);
                        setFocusTarget(nextOpen("account", { account: true }));
                      }}
                    >
                      Continue
                    </button>
                  )}
                  <button type="button" className="tm-text-button" onClick={signOut} disabled={signingOut}>
                    {signingOut ? "Signing out" : "Sign out"}
                  </button>
                </div>
              </div>
            ) : (
              <SignInForm onSignedIn={() => setAwaitingSignIn(true)} />
            )}
          </Step>

          {/* 02 */}
          <Step
            id="address"
            locked={heldOrder !== null}
            done={addressComplete}
            headingRef={(el) => {
              headings.current.address = el;
            }}
            onChange={() => {
              setAddressDone(false);
              setFocusTarget("address");
            }}
            summary={address && <span>{addressLine(address)}</span>}
          >
            {!buyer && !added.length && (
              <p className="tm-step-note">Your saved addresses appear here once you sign in.</p>
            )}
            <fieldset className="tm-choices">
              <legend className="sr-only">Ship to</legend>
              {addresses.map((a) => (
                <AddressChoice key={a.id} address={a} checked={a.id === addressId} onSelect={() => setAddressId(a.id)} />
              ))}
              {!adding && (
                <button ref={addButton} type="button" className="tm-choice tm-choice-add" onClick={() => setAdding(true)}>
                  <Plus size={18} strokeWidth={1.6} aria-hidden="true" />
                  Add an address
                </button>
              )}
            </fieldset>
            {adding ? (
              <AddressForm
                onUse={(next) => {
                  setAdded((list) => [...list, next]);
                  setAddressId(next.id);
                  setAdding(false);
                  setAddressDone(true);
                  setFocusTarget(nextOpen("address", { address: true }));
                  // Live keeps it on the research account for next time. The order ships to it either way,
                  // so a failed save changes nothing here.
                  if (LIVE && buyer) {
                    void live().saveAddress(buyer.id, { ...next, label: buyer.addresses.length ? "Delivery address" : "Laboratory" }).then((saved) => {
                      setAdded((list) => list.map((a) => (a.id === next.id ? saved : a)));
                      setAddressId((current) => (current === next.id ? saved.id : current));
                    }, () => undefined);
                  }
                }}
                onCancel={() => {
                  setAdding(false);
                  setFocusTarget("add");
                }}
              />
            ) : (
              address && (
                <div className="tm-step-actions">
                  <button
                    type="button"
                    className="tm-button tm-button-primary"
                    onClick={() => {
                      setAddressDone(true);
                      setFocusTarget(nextOpen("address", { address: true }));
                    }}
                  >
                    Continue
                  </button>
                </div>
              )
            )}
          </Step>

          {/* 03 */}
          <Step
            id="delivery"
            locked={heldOrder !== null}
            done={deliveryComplete}
            tag={!LIVE || settings.data?.shippingRatesConfirmed !== true ? "Sample rates" : undefined}
            headingRef={(el) => {
              headings.current.delivery = el;
            }}
            onChange={() => {
              setDeliveryDone(false);
              setFocusTarget("delivery");
            }}
            summary={
              method && (
                <span>
                  {method.label} · {method.price === 0 ? "Free" : money(method.price)} {sampleRates && <span className="tm-step-summary-quiet">sample rate</span>}
                </span>
              )
            }
          >
            {settings.error && <p className="tm-step-lead" role="alert">Shipping settings could not be loaded. <button type="button" className="tm-text-button" onClick={settings.reload}>Try again</button></p>}
            {methods.data === undefined && methods.error ? (
              <div className="tm-step-state" role="alert">
                <p className="tm-step-lead">Delivery methods could not be loaded.</p>
                <button type="button" className="tm-text-button" onClick={methods.reload}>
                  Try again
                </button>
              </div>
            ) : methods.data === undefined ? (
              <div className="tm-choices" aria-busy="true" aria-label="Loading delivery methods">
                <span className="tm-choice tm-skeleton" />
                <span className="tm-choice tm-skeleton" />
              </div>
            ) : (
              <>
                <fieldset className="tm-choices" data-review="shipping-rates">
                  <legend className="sr-only">Delivery method</legend>
                  {methods.data.map((m) => (
                    <label className="tm-choice" key={m.id}>
                      <input
                        type="radio"
                        className="tm-choice-input"
                        name="tm-delivery"
                        value={m.id}
                        checked={m.id === methodId}
                        onChange={() => setMethodId(m.id)}
                      />
                      <span className="tm-choice-top">
                        <span className="tm-choice-title">{m.label}</span>
                        <span className="tm-choice-mark" aria-hidden="true" />
                      </span>
                      <span className="tm-choice-text">{m.detail}</span>
                      <span className="tm-choice-price">{settings.data && shippingPrice(roundMoney(subtotal - discountAmount), m, settings.data) === 0 ? "Free" : money(m.price)}</span>
                    </label>
                  ))}
                </fieldset>
                {settings.data?.insuranceMode === "optional" && <label className="tm-check">
                  <input type="checkbox" className="tm-check-input" checked={insured} onChange={(event) => setInsured(event.target.checked)} />
                  <span className="tm-check-box" aria-hidden="true"><Check size={14} strokeWidth={2.2} /></span>
                  <span className="tm-check-text">Insure this shipment · {money(insurancePrice(roundMoney(subtotal - discountAmount), settings.data, true))}</span>
                </label>}
                <div className="tm-step-actions">
                  <button
                    type="button"
                    className="tm-button tm-button-primary"
                    disabled={!method}
                    onClick={() => {
                      setDeliveryDone(true);
                      setFocusTarget(nextOpen("delivery", { delivery: true }));
                    }}
                  >
                    Continue
                  </button>
                </div>
              </>
            )}
          </Step>

          </PaymentLock>
          {/* 04 */}
          <Step
            id="payment"
            tag={LIVE && paymentMode.data === "simulated" ? "Simulated" : undefined}
            done={false}
            headingRef={(el) => {
              headings.current.payment = el;
            }}
          >
            <div className="tm-secure" role="group" aria-labelledby="tm-secure-title" aria-describedby="tm-secure-note">
              <p id="tm-secure-title" className="tm-secure-title">
                <LockKeyhole size={16} strokeWidth={1.6} aria-hidden="true" />
                {LIVE ? "Payment" : "Secure payment form"}
              </p>
              {!LIVE && <>
              <div className="tm-fields">
                <div className="tm-field is-wide is-inert">
                  <label htmlFor="tm-card-number">Card number</label>
                  <input id="tm-card-number" disabled placeholder="1234 1234 1234 1234" />
                </div>
                <div className="tm-field is-inert">
                  <label htmlFor="tm-card-expiry">Expiry</label>
                  <input id="tm-card-expiry" disabled placeholder="MM / YY" />
                </div>
                <div className="tm-field is-inert">
                  <label htmlFor="tm-card-code">Security code</label>
                  <input id="tm-card-code" disabled placeholder="CVC" />
                </div>
              </div>
              </>}
              {/* In live, the panel holds what the payment step actually does: its note and, while
                  payments are simulated, the test outcomes. */}
              {LIVE && <p id="tm-secure-note" className="tm-step-note">
                {paymentMode.data === "simulated" ? "Payments are simulated on this site. No card is charged." : paymentMode.data === "live" ? "Card payments are being connected. Please try again soon." : "Payments connect at launch; this order is placed and held as authorized."}
              </p>}
              {LIVE && paymentMode.data === "simulated" && <PaymentOutcomes value={outcome} onChange={setOutcome} disabled={placing} />}
            </div>
            {!LIVE && <p id="tm-secure-note" className="tm-step-note">
              Card details are entered in your payment partner’s secure form and never touch
              TrueMark’s servers. Connected at launch.
            </p>}

            {heldOrder && <><p className="tm-step-note">Order {heldOrder.number} is held for 30 minutes while you complete payment.</p><button type="button" className="tm-text-button" disabled={placing} onClick={async () => {
              setPlacing(true); setPlaceError(null);
              try { await live().payments.cancelUnpaid(heldOrder.id); setHeldOrder(null); reloadCatalog?.(); }
              catch (error) { setPlaceError(error instanceof Error ? error.message : "The order could not be cancelled. Try again."); }
              finally { setPlacing(false); }
            }}>Cancel order and edit bag</button></>}
            <label className="tm-check">
              <input
                type="checkbox"
                className="tm-check-input"
                checked={attested}
                aria-required="true"
                onChange={(e) => setAttested(e.target.checked)}
              />
              <span className="tm-check-box" aria-hidden="true">
                <Check size={14} strokeWidth={2.2} />
              </span>
              <span className="tm-check-text">
                I confirm these materials are for laboratory research use only and will not be used
                in humans or animals.
              </span>
            </label>

            {!heldOrder && <StockNotice issues={issues} checking={catalogChecking} error={catalogError} onRetry={reloadCatalog} />}
            <div className="tm-place">
              <p className="tm-totals-row tm-totals-total tm-place-total">
                <span>Total</span>
                <span>{money(total)}</span>
              </p>
              <button
                type="button"
                className="tm-button tm-button-primary tm-button-block"
                disabled={!canPlace}
                aria-describedby="tm-place-needs"
                onClick={place}
              >
                {placing ? "Placing the order" : heldOrder ? "Try payment again" : "Place order"}
              </button>
              <p id="tm-place-needs" className="tm-place-needs" aria-live="polite">
                {needs.length > 0 ? `Still needed: ${listFormat.format(needs)}.` : "Ready to place."}
              </p>
              {placeError && <FieldError id="tm-place-error">{placeError}</FieldError>}
              <p className="tm-step-fine">
                {LIVE ? paymentMode.data === "simulated" ? "Simulated payment. No card is charged." : "No payment is collected at this step." : "Design preview. No payment is collected; the order is kept in this browser."}
              </p>
            </div>
          </Step>
        </div>

        <aside className="tm-summary tm-checkout-summary" aria-labelledby={asideTitle}>
          <OrderSummary {...summaryProps} titleId={asideTitle} />
        </aside>
      </section>
    </div>
  );
}
