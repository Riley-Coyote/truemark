import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cycleDialogFocus } from "../focus";

// Nested record actions share one scroll lock; only the foremost panel handles keys.
const layers: HTMLDivElement[] = [];
let savedOverflow = "";


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
    if (!layers.length) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    layers.push(root);
    root.focus({ preventScroll: true });

    function onKey(event: KeyboardEvent) {
      if (!root || layers.at(-1) !== root || event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      cycleDialogFocus(root, event);
    }

    function onFocus(event: FocusEvent) {
      if (layers.at(-1) === root && event.target instanceof Node && !root?.contains(event.target)) {
        root?.focus({ preventScroll: true });
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      const wasTop = layers.at(-1) === root;
      const index = layers.indexOf(root);
      if (index !== -1) layers.splice(index, 1);
      if (!layers.length) document.body.style.overflow = savedOverflow;
      if (wasTop && previous && document.contains(previous)) previous.focus({ preventScroll: true });
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
