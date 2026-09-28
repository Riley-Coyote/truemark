import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A right-side panel for one record. Focus moves into it, stays inside it
 * while it is open, and returns to whatever opened it. Escape closes it.
 */
export function Drawer({
  title,
  mono = false,
  eyebrow,
  subtitle,
  tags,
  footer,
  children,
  onClose,
}: {
  title: ReactNode;
  /** Set the title in mono when it is an identifier (an order or lot number). */
  mono?: boolean;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  tags?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = panel.current;
    if (!root) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.focus({ preventScroll: true });

    function onKey(event: KeyboardEvent) {
      if (!root) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
      );
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      const inside = current instanceof Node && root.contains(current) && current !== root;
      if (event.shiftKey && (!inside || current === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || current === last)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <>
      <div className="kit-drawer-scrim" onMouseDown={onClose} aria-hidden="true" />
      <div ref={panel} className="kit-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="kit-drawer-head">
          <div className="kit-drawer-heading">
            {eyebrow && <p className="kit-label">{eyebrow}</p>}
            <h2 id={titleId} className={`kit-drawer-title${mono ? " kit-mono" : ""}`}>
              {title}
            </h2>
            {subtitle && <p className="kit-drawer-sub">{subtitle}</p>}
            {tags && <div className="kit-drawer-tags">{tags}</div>}
          </div>
          <button type="button" className="kit-iconbutton" aria-label="Close" onClick={onClose}>
            <X aria-hidden="true" strokeWidth={1.6} />
          </button>
        </header>
        <div className="kit-drawer-body">{children}</div>
        {footer && <footer className="kit-drawer-foot">{footer}</footer>}
      </div>
    </>
  );
}
