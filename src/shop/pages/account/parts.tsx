import { createContext, useContext, useEffect } from "react";
import type { ComponentProps, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { CircleAlert } from "lucide-react";
import type { Product } from "../../../data";
import { LIVE } from "../../../platform/mode";
import type { Resource } from "../../../platform/store";
import type { Buyer, Lot, Order } from "../../../platform/types";
import { productCutout } from "../../catalog";
import { useShop } from "../../context";
import { pictureLoading, tone } from "../../ui";
import { productFor } from "./lib";
import type { Tone } from "./lib";
import "./account.css";

/** Store calls can throw before they return a promise; keep every failure in the error state. */
export const attempt =
  <T,>(load: () => Promise<T>) =>
  (): Promise<T> =>
    Promise.resolve().then(load);

/** App sets a generic title for unknown paths; account pages name themselves. */
export function useTitle(title: string) {
  const { key } = useLocation();
  useEffect(() => {
    document.title = `${title} — TrueMark BioLabs`;
  }, [title, key]);
}

export type AccountData = {
  buyer: Buyer;
  orders: Resource<Order[]>;
  lots: Resource<Lot[]>;
  signOut: () => Promise<void>;
};

export const AccountContext = createContext<AccountData | null>(null);

export function useAccount(): AccountData {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount must be used inside the account layout");
  return value;
}

/** Put an order's lines back in the bag; the bag opens itself. */
export function useReorder() {
  const { add } = useShop();
  return (order: Order) => {
    const available = order.lines.filter((line) => productFor(line.productId)?.price !== undefined);
    available.forEach((line) => add(line.productId, line.quantity));
    return { added: available.length, missing: order.lines.length - available.length };
  };
}

export function Thumb({ product, size = "md" }: { product: Product; size?: "sm" | "md" }) {
  return (
    <span className={`tm-acct-thumb is-${size}`} style={tone(product)} aria-hidden="true">
      <img src={productCutout(product, "sm")} alt="" {...pictureLoading(productCutout(product, "sm"))} draggable={false} />
    </span>
  );
}

export function StatusChip({ tone: t, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="tm-acct-chip" data-tone={t}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

export function SampleTag({ children = "Sample data" }: { children?: ReactNode }) {
  return <span className="tm-acct-sample">{children}</span>;
}

export function PageHead({
  eyebrow,
  title,
  sub,
  children,
  aside,
  display = false,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
  display?: boolean;
}) {
  return (
    <header className="tm-acct-head">
      <div className="tm-acct-head-top">
        <p className="tm-eyebrow">{eyebrow}</p>
        {/* A real account holds real records: only the preview says its data is a sample. */}
        {aside ?? (LIVE ? null : <SampleTag />)}
      </div>
      <h1 className={display ? "tm-display" : "tm-heading"}>
        {title}
        {sub && (
          <>
            <br />
            <span>{sub}</span>
          </>
        )}
      </h1>
      {children}
    </header>
  );
}

export function SectionHead({ id, label, count, action }: { id: string; label: string; count?: ReactNode; action?: ReactNode }) {
  return (
    <div className="tm-acct-section-head">
      <h2 id={id} className="tm-acct-label">
        {label}
        {count !== undefined && <span>{count}</span>}
      </h2>
      {action}
    </div>
  );
}

export function Loading({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div className="tm-acct-loading" role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="tm-acct-skeleton" aria-hidden="true" />
      ))}
    </div>
  );
}

export function Problem({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="tm-acct-state" role="alert">
      <p className="tm-acct-state-title">{title}</p>
      <p className="tm-acct-state-text">The preview could not read this from the store. Nothing was changed.</p>
      <button type="button" className="tm-acct-quiet" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function Empty({ title, text, children }: { title: string; text: ReactNode; children?: ReactNode }) {
  return (
    <div className="tm-acct-state">
      <p className="tm-acct-state-title">{title}</p>
      <p className="tm-acct-state-text">{text}</p>
      {children}
    </div>
  );
}

/* ---------- Form fields: label, optional hint, control, message ---------- */

type Framed = { id: string; label: string; hint?: ReactNode; error?: string; optional?: boolean; wide?: boolean };

function Frame({ id, label, hint, error, optional, wide, children }: Framed & { children: ReactNode }) {
  return (
    <div className={`tm-acct-input${error ? " is-invalid" : ""}${wide ? " is-wide" : ""}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span> (optional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="tm-acct-hint">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="tm-acct-error">
          <CircleAlert size={14} strokeWidth={1.8} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = ({ id, hint, error }: Framed) =>
  [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;

export function Field({ id, label, hint, error, optional, wide, ...input }: Framed & ComponentProps<"input">) {
  const frame = { id, label, hint, error, optional, wide };
  return (
    <Frame {...frame}>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(frame)} {...input} />
    </Frame>
  );
}

export function AreaField({ id, label, hint, error, optional, wide, ...area }: Framed & ComponentProps<"textarea">) {
  const frame = { id, label, hint, error, optional, wide };
  return (
    <Frame {...frame}>
      <textarea id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(frame)} {...area} />
    </Frame>
  );
}

export function SelectField({
  id,
  label,
  hint,
  error,
  optional,
  wide,
  children,
  ...select
}: Framed & ComponentProps<"select">) {
  const frame = { id, label, hint, error, optional, wide };
  return (
    <Frame {...frame}>
      <span className="tm-acct-select">
        <select id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(frame)} {...select}>
          {children}
        </select>
      </span>
    </Frame>
  );
}
