import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useFocusReturn, usePhone } from "./bits";

/** A right-hand drawer on larger screens, a bottom sheet on phones. */
export function Panel({
  id,
  title,
  sub,
  onClose,
  children,
  foot,
}: {
  id: string;
  title: string;
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  foot?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const headingId = useId();
  const phone = usePhone();
  useFocusReturn(ref);

  useEffect(() => {
    // Land on the panel itself, so a screen reader reads its title first.
    ref.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section
      ref={ref}
      id={id}
      className={`rl-panel ${phone ? "rl-sheet rl-sheet-tall" : "rl-drawer"}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      tabIndex={-1}
    >
      <header className="rl-panel-head">
        <div className="rl-panel-titles">
          <h2 id={headingId} className="rl-panel-title">
            {title}
          </h2>
          {sub && <div className="rl-panel-sub">{sub}</div>}
        </div>
        <button type="button" className="rl-icon-btn" aria-label={`Close ${title}`} onClick={onClose}>
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </header>
      <div className="rl-panel-scroll">{children}</div>
      {foot && <footer className="rl-panel-foot">{foot}</footer>}
    </section>
  );
}
