/**
 * Pieces the app kit does not have yet, built for the partner portal on the
 * kit's own theme tokens: a copy button with a confirmed state, a checkbox,
 * a one-line text field, a totals row for a DataTable, and a partner link set
 * in type.
 */
import { useEffect, useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "../../app-kit";
import type { Column } from "../../app-kit";
import { SITE } from "../program";

/** Copy text to the clipboard; falls back to a selection copy where the Clipboard API is unavailable. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* Fall through to the selection copy. */
  }
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.className = "pp-copy-source";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  } finally {
    previous?.focus({ preventScroll: true });
  }
}

/**
 * A copy button that confirms in place ("Copied") for a moment and says so to
 * screen readers. Both labels share one box, so confirming never moves the layout.
 */
export function CopyButton({
  text,
  label,
  what,
  variant = "quiet",
  className,
}: {
  text: string;
  label: string;
  /** What is copied, for the announcement: "Code", "Link", "Disclosure". */
  what: string;
  variant?: "primary" | "quiet";
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2400);
    return () => window.clearTimeout(timer);
  }, [state]);
  const copied = state === "copied";
  return (
    <span className={["pp-copy", className].filter(Boolean).join(" ")}>
      <Button
        variant={variant}
        data-state={state}
        onClick={async () => setState((await copyText(text)) ? "copied" : "failed")}
      >
        {copied ? <Check aria-hidden="true" strokeWidth={1.8} /> : <Copy aria-hidden="true" strokeWidth={1.6} />}
        <span className="pp-copy-labels">
          <span data-show={!copied}>{label}</span>
          <span data-show={copied} aria-hidden={!copied}>
            Copied
          </span>
        </span>
      </Button>
      <span className="kit-sr" role="status">
        {copied ? `${what} copied.` : state === "failed" ? `${what} could not be copied. Select the text and copy it instead.` : ""}
      </span>
    </span>
  );
}

/** A partner link set in type: the address quiet, the path clear, the code carried at the end. */
export function PartnerUrl({ path, code }: { path: string; code: string }) {
  return (
    <span className="pp-url">
      <span className="pp-url-base">{SITE}</span>
      <wbr />
      <span className="pp-url-path">{path}</span>
      <wbr />
      <span className="pp-url-ref">?ref={code}</span>
    </span>
  );
}

/** A checkbox in the kit's register: a square that fills with ink. */
export function CheckItem({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="pp-kcheck" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/**
 * A one-line field in the kit's register: its label above, an optional prefix
 * ("$") inside the box, its actions beside the box (below it when the row is
 * narrow), and a hint or an error below. The box's own border brightens on focus.
 */
export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  prefix,
  inputRef,
  actions,
  ...input
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string;
  prefix?: string;
  inputRef?: Ref<HTMLInputElement>;
  actions?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "prefix">) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className="kit-field pp-field">
      <label className="kit-field-label" htmlFor={id}>
        {label}
      </label>
      <div className="pp-field-row">
        <span className="pp-input" data-invalid={error ? "true" : undefined} data-disabled={input.disabled ? "true" : undefined}>
          {prefix && (
            <span className="pp-input-prefix" aria-hidden="true">
              {prefix}
            </span>
          )}
          <input
            {...input}
            id={id}
            ref={inputRef}
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={hint || error ? noteId : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
        </span>
        {actions && <div className="pp-field-actions">{actions}</div>}
      </div>
      {error ? (
        <p id={noteId} className="kit-field-error" role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={noteId} className="kit-field-hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/**
 * A totals row for a DataTable, which has no footer: a one-row table that
 * shares the table's column widths, so every figure sits under its column.
 */
export function TotalsRow<T>({
  columns,
  cells,
  label,
}: {
  columns: Column<T>[];
  cells: Record<string, ReactNode>;
  label: string;
}) {
  return (
    <table className="kit-table is-static pp-totals" aria-label={label}>
      <colgroup>
        {columns.map((column) => (
          <col key={column.key} style={column.width ? { width: column.width } : undefined} />
        ))}
      </colgroup>
      <tbody>
        <tr>
          {columns.map((column, i) =>
            i === 0 ? (
              <th key={column.key} scope="row" data-mobile={column.mobile ?? "meta"}>
                {cells[column.key]}
              </th>
            ) : (
              <td key={column.key} className={column.align === "end" ? "is-end" : undefined} data-mobile={column.mobile ?? "meta"}>
                {cells[column.key]}
              </td>
            ),
          )}
        </tr>
      </tbody>
    </table>
  );
}
