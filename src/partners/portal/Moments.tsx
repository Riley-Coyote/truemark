/**
 * The sale moment. When an order arrives through the signed-in partner's code
 * or link (from checkout in another tab, or anywhere in the preview), a toast
 * rises with the commission counting up from zero over a soft glow of the
 * brand gradient: the one place the portal lets light in. Figures elsewhere
 * (the overview's "This month") travel to their new values at the same time.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { Dot, MoneyFigure, formatMoney } from "../../app-kit";
import { onPlatformEvent } from "../../platform/events";
import { readPrefs } from "../prefs";
import { ALERTS_OPEN } from "./Alerts";
import { HOME } from "./nav";

/** How long a figure takes to travel to its value, and how long a toast stays. */
const COUNT_MS = 900;
const STAY_MS = 8000;
const MAX_TOASTS = 3;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A number that travels to its value. It starts at `from` when given (the toast counts
 * up from zero), otherwise at the value itself; after that, each rise counts up from the
 * figure last shown. Falls land at once, and with reduced motion every change does.
 */
export function useCountUp(value: number, from?: number): number {
  const [shown, setShown] = useState(() => (from !== undefined && !prefersReducedMotion() ? from : value));
  const current = useRef(shown);
  useEffect(() => {
    const start = current.current;
    if (start === value) return;
    if (value < start || prefersReducedMotion()) {
      current.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    let began: number | null = null;
    const step = (now: number) => {
      began ??= now;
      const t = Math.min(1, (now - began) / COUNT_MS);
      const eased = 1 - (1 - t) ** 3;
      const next = t === 1 ? value : start + (value - start) * eased;
      current.current = next;
      setShown(next);
      if (t < 1) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

/** A money figure with quiet cents that counts up to each new value. */
export function CountingMoney({ value, from }: { value: number; from?: number }) {
  const shown = useCountUp(value, from);
  return <MoneyFigure value={Math.round(shown * 100) / 100} />;
}

type Sale = { referralId: string; orderNumber: string; commission: number; via: "link" | "code" };

function SaleToast({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const [held, setHeld] = useState(false);
  const left = useRef(STAY_MS);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Eight seconds on screen, paused while the pointer or focus is on the toast.
  useEffect(() => {
    if (held) return;
    const started = Date.now();
    const timer = window.setTimeout(() => closeRef.current(), left.current);
    return () => {
      window.clearTimeout(timer);
      left.current = Math.max(0, left.current - (Date.now() - started));
    };
  }, [held]);

  return (
    <div
      className="pp-toast"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="pp-toast-head">
        <p className="pp-toast-title">
          <Dot tone="signal" />
          New order through your {sale.via}
        </p>
        <button type="button" className="kit-iconbutton pp-toast-close" aria-label="Dismiss" onClick={onClose}>
          <X aria-hidden="true" strokeWidth={1.6} />
        </button>
      </div>
      {/* The final figure holds the space, so counting never moves the layout. Readers get the figure once, whole. */}
      <p className="pp-toast-figure kit-num">
        <span className="pp-toast-count" aria-hidden="true">
          <span className="pp-toast-glow" />
          <span className="pp-toast-final">
            <MoneyFigure value={sale.commission} />
          </span>
          <span className="pp-toast-live">
            <CountingMoney value={sale.commission} from={0} />
          </span>
        </span>
        <span className="pp-toast-earned" aria-hidden="true">
          earned
        </span>
        <span className="kit-sr">You earned {formatMoney(sale.commission)}.</span>
      </p>
      <p className="pp-toast-line">
        Order <span className="kit-mono">{sale.orderNumber}</span> · pending until delivered
      </p>
      <Link
        className="kit-link pp-toast-link"
        to={`${HOME}/referrals?referral=${encodeURIComponent(sale.referralId)}`}
        onClick={onClose}
      >
        See it
        <ArrowRight aria-hidden="true" strokeWidth={1.6} />
      </Link>
    </div>
  );
}

/**
 * Listens for orders that credit this partner and raises a toast for each, newest on
 * top. A partner who turns off dashboard alerts for new orders sees none; the bell
 * still keeps every alert.
 */
export function SaleMoments({ partnerId }: { partnerId: string }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [announcement, setAnnouncement] = useState("");

  useEffect(
    () =>
      onPlatformEvent((event) => {
        if (event.type !== "referral.created" || event.partnerId !== partnerId) return;
        if (!readPrefs(partnerId).alerts.newOrder.dashboard) return;
        const sale = { referralId: event.referralId, orderNumber: event.orderNumber, commission: event.commission, via: event.via };
        setSales((list) =>
          list.some((s) => s.referralId === sale.referralId) ? list : [sale, ...list].slice(0, MAX_TOASTS),
        );
        setAnnouncement(
          `New order through your ${sale.via}. You earned ${formatMoney(sale.commission)} on order ${sale.orderNumber}, pending until delivered.`,
        );
      }),
    [partnerId],
  );

  // Opening the alerts panel shows the same sale in the list, so the toasts step aside.
  useEffect(() => {
    const clear = () => setSales([]);
    window.addEventListener(ALERTS_OPEN, clear);
    return () => window.removeEventListener(ALERTS_OPEN, clear);
  }, []);

  const dismiss = useCallback((referralId: string) => setSales((list) => list.filter((s) => s.referralId !== referralId)), []);

  return (
    <>
      <p className="kit-sr" role="status" aria-live="polite">
        {announcement}
      </p>
      {sales.length > 0 && (
        <section className="pp-toasts" aria-label="New orders">
          {sales.map((sale) => (
            <SaleToast key={sale.referralId} sale={sale} onClose={() => dismiss(sale.referralId)} />
          ))}
        </section>
      )}
    </>
  );
}
