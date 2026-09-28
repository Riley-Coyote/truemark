/**
 * Form parts the app kit does not have yet: a one-line text field, a labelled
 * select and a switch, which compose the kit's field classes (label, hint,
 * error) so they read like its text area, each with five states. Also the
 * small marks and helpers the command center's forms share.
 */
import { useId } from "react";
import type { HTMLAttributes, ReactNode, Ref } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { SampleTag } from "../app-kit";
import { PREVIEW_NOTE } from "./preview";

/** Dollars as a person types them: "55", "55.00", "$1,250.00". Commas only as thousands separators. */
export function parseDollars(text: string, { allowZero = false } = {}): { value?: number; error?: string } {
  const trimmed = text.replace(/[$\s]/g, "");
  const clean = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmed) ? trimmed.replace(/,/g, "") : trimmed;
  if (!clean) return { error: "Enter an amount in dollars." };
  if (!/^\d+(\.\d+)?$/.test(clean)) return { error: "Enter dollars and cents, such as 55 or 55.00." };
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return { error: "Use at most two decimal places." };
  const value = Number(clean);
  if (!allowZero && !(value > 0)) return { error: "Enter an amount above $0.00." };
  return { value };
}

export function PreviewTag() {
  return <SampleTag>{PREVIEW_NOTE}</SampleTag>;
}

/** Keeps a phrase such as "5 Oct 2026" or "80 units" on one line. */
export const keepTogether = (text: string) => text.replace(/ /g, "\u00a0");

/** A quiet capital mark beside a value: Sample, Current, Edited, New. */
export function Mark({ children }: { children: ReactNode }) {
  return <span className="cc-sample-mark">{children}</span>;
}

function Note({ id, hint, error }: { id: string; hint?: ReactNode; error?: string }) {
  if (error) {
    return (
      <p id={id} className="kit-field-error">
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={id} className="kit-field-hint">
      {hint}
    </p>
  ) : null;
}

export function TextField({
  label,
  srLabel,
  hideLabel = false,
  value,
  onChange,
  onBlur,
  hint,
  error,
  prefix,
  suffix,
  mono = false,
  size,
  type = "text",
  inputMode,
  min,
  placeholder,
  inputRef,
  disabled = false,
}: {
  label: string;
  /** Words only a screen reader needs, such as the currency. */
  srLabel?: string;
  /** When the row around the field already names it. */
  hideLabel?: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  hint?: ReactNode;
  error?: string;
  prefix?: string;
  suffix?: string;
  mono?: boolean;
  /** A narrower field for short values: a percent, a price, a code, a date. */
  size?: "short" | "medium";
  type?: "text" | "date";
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  min?: string;
  placeholder?: string;
  inputRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className={size ? `kit-field cc-field-${size}` : "kit-field"}>
      <label className={hideLabel ? "kit-sr" : "kit-field-label"} htmlFor={id}>
        {label}
        {srLabel && <span className="kit-sr"> {srLabel}</span>}
      </label>
      <div className="cc-control" data-invalid={error ? "true" : undefined} data-disabled={disabled ? "true" : undefined}>
        {prefix && (
          <span className="cc-affix" aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          ref={inputRef}
          id={id}
          className={mono ? "cc-input kit-mono" : "cc-input"}
          type={type}
          value={value}
          inputMode={inputMode}
          min={min}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? noteId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
        {suffix && (
          <span className="cc-affix" aria-hidden="true">
            {suffix}
          </span>
        )}
      </div>
      <Note id={noteId} hint={hint} error={error} />
    </div>
  );
}

export function SelectField<V extends string>({
  label,
  value,
  onChange,
  onBlur,
  options,
  placeholder,
  hint,
  error,
  selectRef,
}: {
  label: string;
  value: V | "";
  onChange: (value: V) => void;
  onBlur?: () => void;
  options: { value: V; label: string }[];
  placeholder?: string;
  hint?: ReactNode;
  error?: string;
  selectRef?: Ref<HTMLSelectElement>;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className="kit-field">
      <label className="kit-field-label" htmlFor={id}>
        {label}
      </label>
      <div className="kit-select cc-select">
        <select
          ref={selectRef}
          id={id}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? noteId : undefined}
          onChange={(event) => onChange(event.target.value as V)}
          onBlur={onBlur}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" strokeWidth={1.6} />
      </div>
      <Note id={noteId} hint={hint} error={error} />
    </div>
  );
}

/** An on/off switch. Its own border brightens on focus, like every kit control. */
export function Switch({
  checked,
  onChange,
  labelledBy,
  describedBy,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  labelledBy: string;
  describedBy?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="cc-switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="cc-switch-thumb" aria-hidden="true" />
    </button>
  );
}

/** A setting as a sentence and a switch. */
export function SwitchRow({
  title,
  description,
  checked,
  onChange,
  locked,
  note,
}: {
  title: string;
  description: ReactNode;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  /** A word or two beside a lock ("Always on"); the switch cannot be changed here. */
  locked?: string;
  /** A line under the description, such as why the switch is locked. */
  note?: ReactNode;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const textId = `${id}-text`;
  const noteId = `${id}-note`;
  return (
    <div className="cc-switch-row">
      <div className="cc-switch-copy">
        <p id={titleId} className="cc-switch-title">
          {title}
        </p>
        <p id={textId} className="cc-switch-text">
          {description}
        </p>
        {note && (
          <p id={noteId} className="cc-footnote">
            {note}
          </p>
        )}
      </div>
      <div className="cc-switch-side">
        {locked && (
          <span className="cc-lock">
            <Lock aria-hidden="true" strokeWidth={1.6} />
            {locked}
          </span>
        )}
        <Switch
          checked={checked}
          onChange={(value) => onChange?.(value)}
          labelledBy={titleId}
          describedBy={note ? `${textId} ${noteId}` : textId}
          disabled={Boolean(locked) || !onChange}
        />
      </div>
    </div>
  );
}
