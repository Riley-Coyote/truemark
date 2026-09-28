import type { ComponentProps, ReactNode } from "react";
import { CircleAlert } from "lucide-react";

/** Form fields for the public partner pages: label, optional hint, control, written reason. */
type Framed = { id: string; label: string; hint?: ReactNode; error?: string; optional?: boolean };

const describedBy = ({ id, hint, error }: Framed) =>
  [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="pp-field-error">
      <CircleAlert size={14} strokeWidth={1.8} aria-hidden="true" />
      {children}
    </p>
  );
}

function Frame({ id, label, hint, error, optional, children }: Framed & { children: ReactNode }) {
  return (
    <div className={`pp-field${error ? " is-invalid" : ""}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span> (optional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="pp-field-hint">
          {hint}
        </p>
      )}
      {children}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

export function Field({ id, label, hint, error, optional, ...input }: Framed & ComponentProps<"input">) {
  const frame = { id, label, hint, error, optional };
  return (
    <Frame {...frame}>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(frame)} {...input} />
    </Frame>
  );
}

export function AreaField({ id, label, hint, error, optional, ...area }: Framed & ComponentProps<"textarea">) {
  const frame = { id, label, hint, error, optional };
  return (
    <Frame {...frame}>
      <textarea id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(frame)} {...area} />
    </Frame>
  );
}
