/**
 * The partner's alerts: a bell in the portal's top bar with the unread count,
 * and a panel that lists every alert (a live sale, an approval, a payout) with
 * its amount and how long ago it happened in the sample world. Each alert
 * opens the page it is about. Buyers never appear: alerts name orders only.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Bell } from "lucide-react";
import { Button, Dot, formatDay, formatMoney } from "../../app-kit";
import { useNotices } from "../../platform/notifications";
import { worldNow } from "../../platform/storage";
import { HOME } from "./nav";

const MINUTE = 60_000;
const DAY = 86_400_000;

/** Tells open views that the alerts panel opened, so a sale toast can step aside. */
export const ALERTS_OPEN = "pp-alerts-open";

/**
 * "Just now", "4 min ago", "3 hours ago", then by calendar day (UTC, as every date in
 * the app): "Yesterday", "5 days ago", and after a week the date, "5 Sep".
 */
export function relativeTime(iso: string, now = Date.parse(worldNow())): string {
  const then = Date.parse(iso);
  const minutes = Math.floor(Math.max(0, now - then) / MINUTE);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(now / DAY) - Math.floor(then / DAY);
  if (days <= 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDay(iso);
}

/** Re-render on a steady beat while shown, so "Just now" becomes "1 min ago". */
function useBeat(active: boolean, every = 30_000) {
  const [, setBeat] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setBeat((b) => b + 1), every);
    return () => window.clearInterval(timer);
  }, [active, every]);
}

export function AlertsBell({ partnerId }: { partnerId: string }) {
  const { items, unread, markAllRead, markRead } = useNotices(`partner:${partnerId}`);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const headingId = useId();
  const location = useLocation();
  const previousUnread = useRef(unread);
  const [rang, setRang] = useState(0);
  useBeat(open);

  // A new alert makes the count tick once.
  useEffect(() => {
    if (unread > previousUnread.current) setRang((n) => n + 1);
    previousUnread.current = unread;
  }, [unread]);

  useEffect(() => setOpen(false), [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent(ALERTS_OPEN));
    panel.current?.focus({ preventScroll: true });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        button.current?.focus();
      }
    }
    function onPointer(event: PointerEvent) {
      if (wrap.current && event.target instanceof Node && !wrap.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const now = Date.parse(worldNow());
  const label = unread ? `Alerts, ${unread} unread` : "Alerts";

  return (
    <div
      ref={wrap}
      className="pp-bell"
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        className="kit-iconbutton pp-bell-button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell aria-hidden="true" strokeWidth={1.6} />
        {unread > 0 && (
          <span key={rang} className="pp-bell-count kit-num" data-rang={rang > 0 ? "true" : undefined} aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div ref={panel} id={panelId} className="pp-bell-panel" role="dialog" aria-labelledby={headingId} tabIndex={-1}>
          <header className="pp-bell-head">
            <h2 id={headingId} className="kit-card-title">
              Alerts
            </h2>
            <span className="pp-bell-unread kit-num">{unread ? `${unread} unread` : "All read"}</span>
            <Button variant="text" className="pp-bell-markall" disabled={!unread} onClick={() => markAllRead()}>
              Mark all as read
            </Button>
          </header>
          {items.length ? (
            <ul className="pp-bell-list" aria-label="Alerts, newest first">
              {items.map((notice) => (
                <li key={notice.id}>
                  <Link
                    className="pp-notice"
                    data-unread={notice.read ? undefined : "true"}
                    to={notice.href ?? HOME}
                    onClick={() => {
                      if (!notice.read) markRead(notice.id);
                      setOpen(false);
                    }}
                  >
                    <span className="pp-notice-mark">{!notice.read && <Dot tone="signal" />}</span>
                    <span className="pp-notice-text">
                      <span className="pp-notice-title">
                        {!notice.read && <span className="kit-sr">Unread: </span>}
                        {notice.title}
                      </span>
                      <span className="pp-notice-body">{notice.body}</span>
                    </span>
                    <span className="pp-notice-side">
                      {notice.amount !== undefined && <span className="pp-notice-amount kit-num">{formatMoney(notice.amount)}</span>}
                      <time className="pp-notice-time" dateTime={notice.at}>
                        {relativeTime(notice.at, now)}
                      </time>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pp-bell-empty">No alerts yet. New orders through your code appear here.</p>
          )}
          <footer className="pp-bell-foot">
            <Link className="kit-link" to={`${HOME}/settings`} state={{ focus: "alerts", keepScroll: true }} onClick={() => setOpen(false)}>
              Alert preferences
              <ArrowRight aria-hidden="true" strokeWidth={1.6} />
            </Link>
          </footer>
        </div>
      )}
    </div>
  );
}
