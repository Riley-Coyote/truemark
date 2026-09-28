import { useId } from "react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronDown, Search, X } from "lucide-react";
import { splitMoney } from "./format";
import { statusLabel, toneFor } from "./status";
import type { Tone } from "./status";
import { Sparkline } from "./charts";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/* ---------- Buttons ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "danger" | "text";
};

/** Pill button. Primary is the one decisive action on a surface; quiet is everything else. */
export function Button({ variant = "quiet", className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={cx("kit-button", `kit-button-${variant}`, className)} {...rest} />;
}

export function IconButton({
  label,
  children,
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type={type} className={cx("kit-iconbutton", className)} aria-label={label} {...rest}>
      {children}
    </button>
  );
}

/* ---------- Status ---------- */

/** A status as a dot and a word. The dot carries the tone; the word stays neutral. */
export function StatusChip({ status, label, tone }: { status: string; label?: string; tone?: Tone }) {
  return (
    <span className="kit-chip" data-tone={tone ?? toneFor(status)}>
      {label ?? statusLabel(status)}
    </span>
  );
}

/** A 6px dot: a status tone, or a product's label colour. */
export function Dot({ tone, colour, className }: { tone?: Tone; colour?: string; className?: string }) {
  const style = { "--kit-dot-colour": colour ?? (tone ? `var(--kit-tone-${tone})` : undefined) } as CSSProperties;
  return <span className={cx("kit-dot", className)} style={style} aria-hidden="true" />;
}

export function SampleTag({ children = "Sample data" }: { children?: ReactNode }) {
  return <span className="kit-tag">{children}</span>;
}

export function Avatar({ initials, label }: { initials: string; label: string }) {
  return (
    <span className="kit-avatar" role="img" aria-label={label} title={label}>
      {initials}
    </span>
  );
}

/* ---------- Layout ---------- */

export function PageHeader({
  description,
  meta,
  actions,
}: {
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="kit-pagehead">
      {description && <p className="kit-pagehead-text">{description}</p>}
      {(meta || actions) && (
        <div className="kit-pagehead-meta">
          {meta}
          {actions}
        </div>
      )}
    </div>
  );
}

export function Card({
  title,
  meta,
  children,
  className,
  flush = false,
}: {
  title?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  const id = useId();
  return (
    <section className={cx("kit-card", className)} aria-labelledby={title ? id : undefined}>
      {(title || meta) && (
        <header className="kit-card-head">
          {title && (
            <h2 id={id} className="kit-card-title">
              {title}
            </h2>
          )}
          {meta && <div className="kit-card-meta">{meta}</div>}
        </header>
      )}
      <div className={cx("kit-card-body", flush && "is-flush")}>{children}</div>
    </section>
  );
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  const fallback = useId();
  const headingId = id ?? fallback;
  return (
    <section className="kit-section" aria-labelledby={headingId}>
      <h3 id={headingId} className="kit-label">
        {title}
      </h3>
      {children}
    </section>
  );
}

/* ---------- Figures ---------- */

/** "$7,204" with quiet cents. */
export function MoneyFigure({ value }: { value: number }) {
  const [whole, cents] = splitMoney(value);
  return (
    <>
      {whole}
      {cents && <small>{cents}</small>}
    </>
  );
}

export type Delta = { text: string; direction: "up" | "down" | "flat"; note: string };

export function StatGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="kit-stats" aria-label={label}>
      {children}
    </section>
  );
}

export function StatTile({
  label,
  figure,
  delta,
  spark,
  sparkLabel,
  loading = false,
}: {
  label: string;
  figure: ReactNode;
  delta?: Delta;
  spark?: number[];
  sparkLabel?: string;
  loading?: boolean;
}) {
  const Icon = delta?.direction === "up" ? ArrowUpRight : delta?.direction === "down" ? ArrowDownRight : ArrowRight;
  return (
    <div className="kit-stat">
      <p className="kit-label">{label}</p>
      {loading ? (
        <>
          <p className="kit-figure" aria-hidden="true">
            <Skeleton width="62%" height="0.7em" />
          </p>
          <p className="kit-delta">
            <Skeleton width="48%" />
          </p>
          <span className="kit-spark" aria-hidden="true" />
          <span className="kit-sr">Loading {label.toLowerCase()}</span>
        </>
      ) : (
        <>
          <p className="kit-figure">{figure}</p>
          {delta && (
            <p className="kit-delta">
              <Icon aria-hidden="true" strokeWidth={1.6} />
              <strong>{delta.text}</strong> {delta.note}
            </p>
          )}
          {spark && <Sparkline values={spark} label={sparkLabel ?? label} />}
        </>
      )}
    </div>
  );
}

/* ---------- Inputs ---------- */

export type SegmentOption<V extends string> = { value: V; label: string; count?: number; disabled?: boolean };

/** Tabs and segmented filters. Each segment is a pressed/unpressed button. */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  label: string;
}) {
  return (
    <div className="kit-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="kit-segment"
          aria-pressed={option.value === value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && <span className="kit-segment-count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder: string;
  label: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <form
      role="search"
      className={cx("kit-search", disabled && "is-disabled")}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(value);
      }}
    >
      <Search aria-hidden="true" strokeWidth={1.6} />
      <label className="kit-sr" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            event.stopPropagation();
            onChange("");
          }
        }}
      />
      {value && !disabled && (
        <button type="button" className="kit-search-clear" aria-label="Clear search" onClick={() => onChange("")}>
          <X aria-hidden="true" strokeWidth={1.7} />
        </button>
      )}
    </form>
  );
}

export function Select<V extends string>({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: V;
  onChange: (value: V) => void;
  options: { value: V; label: string }[];
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="kit-select">
      <label className="kit-sr" htmlFor={id}>
        {label}
      </label>
      <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as V)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" strokeWidth={1.6} />
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  hint,
  error,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className="kit-field">
      <label className="kit-field-label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="kit-textarea"
        value={value}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? noteId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
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

/* ---------- States ---------- */

export function Skeleton({ width = "100%", height }: { width?: string; height?: string }) {
  return <span className="kit-skeleton" style={{ width, height }} aria-hidden="true" />;
}

export function EmptyState({
  eyebrow,
  title,
  note,
  action,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  note?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx("kit-empty", compact && "is-compact")}>
      {eyebrow && <p className="kit-label">{eyebrow}</p>}
      <p className="kit-empty-title">{title}</p>
      {note && <p className="kit-empty-note">{note}</p>}
      {action}
    </div>
  );
}

/* ---------- Detail lists ---------- */

export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="kit-facts">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type TimelineItem = { key: string; title: ReactNode; meta?: ReactNode; tone: Tone };

export function Timeline({ items, label }: { items: TimelineItem[]; label: string }) {
  return (
    <ol className="kit-timeline" aria-label={label}>
      {items.map((item) => (
        <li key={item.key}>
          <Dot tone={item.tone} />
          <div className="kit-timeline-text">
            <span className="kit-timeline-title">{item.title}</span>
            {item.meta && <span className="kit-timeline-meta">{item.meta}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
