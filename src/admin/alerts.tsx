import { storageKey } from "../platform/mode";
/**
 * The owner feels every order land: a bell in the top bar holding the owner's
 * alerts, and a toast whenever an order is placed anywhere in the preview (this
 * tab, another tab, the demo's frames). An optional chime, off by default.
 */
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { FocusEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { Dot, MoneyFigure, formatDateTime, formatDay } from "../app-kit";
import { onPlatformEvent } from "../platform/events";
import { notices, useNotices } from "../platform/notifications";
import { worldNow } from "../platform/storage";
import { store } from "../platform/store";
import { SwitchRow } from "./fields";
import { HOME } from "./nav";

/* ---------- Time, as the sample world tells it ---------- */

const DAY_MS = 86_400_000;
const dayOf = (iso: string) => Math.floor(Date.parse(iso) / DAY_MS);

/** "Just now", "12 min ago", "3 hours ago", then calendar days: "Yesterday", "4 days ago", then the date. */
export function ago(iso: string, now: string): string {
  const seconds = Math.max(0, (Date.parse(now) - Date.parse(iso)) / 1000);
  if (seconds < 45) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = dayOf(now) - dayOf(iso);
  if (days <= 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDay(iso);
}

/** worldNow(), refreshed every half minute so "2 min ago" stays true. */
export function useWorldNow(): string {
  const [now, setNow] = useState(worldNow);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(worldNow()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** The kit's narrow layout (below 900px), where the top bar's tools move into the menu bar. */
const NARROW = "(max-width: 56.25rem)";
export function useNarrow(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(NARROW);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(NARROW).matches,
  );
}

/* ---------- The chime ---------- */

const CHIME_KEY = storageKey("tm-command-chime");
const chimeListeners = new Set<() => void>();

function readChime(): boolean {
  try {
    return localStorage.getItem(CHIME_KEY) === "on";
  } catch {
    return false;
  }
}

/** Two soft sine notes, A5 then E6: frequency in hertz, start in seconds. */
const NOTES: [number, number][] = [
  [880, 0],
  [1318.51, 0.14],
];
const PEAK_GAIN = 0.08;
const ATTACK_S = 0.015;
const RING_S = 1.1;
let audio: AudioContext | null = null;

/**
 * Play the chime. Browsers allow sound only after someone has used the page; until
 * then it stays silent (the toast and the bell still say it).
 */
export function playChime() {
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const context = audio;
    const start = context.currentTime + 0.02;
    for (const [frequency, offset] of NOTES) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, start + offset + ATTACK_S);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + RING_S);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + RING_S + 0.05);
    }
  } catch {
    /* No audio here; the alert is still shown. */
  }
}

/** Whether new orders chime in this browser (off by default), and a setter that plays it once when turned on. */
export function useChime(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore((onChange) => {
    chimeListeners.add(onChange);
    return () => {
      chimeListeners.delete(onChange);
    };
  }, readChime);
  const set = useCallback((value: boolean) => {
    try {
      localStorage.setItem(CHIME_KEY, value ? "on" : "off");
    } catch {
      /* The choice lasts for this visit only. */
    }
    chimeListeners.forEach((listener) => listener());
    if (value) playChime();
  }, []);
  return [on, set];
}

/* ---------- The bell ---------- */

/**
 * The bell and the toasts share one fact: whether the owner is looking at the
 * alerts. While the panel is open it already shows each new order, so toasts
 * step aside rather than cover it.
 */
const alertsView = new EventTarget();
let viewingAlerts = false;
/** How long the bell stays marked as ringing: its swing (--tm-dur-scene) with room to finish. */
const RING_MS = 1200;
function setViewingAlerts(open: boolean) {
  viewingAlerts = open;
  if (open) alertsView.dispatchEvent(new Event("open"));
}

export function OwnerBell() {
  const { items, unread, markAllRead, markRead } = useNotices("owner");
  const [open, setOpen] = useState(false);
  const [chime, setChime] = useChime();
  const now = useWorldNow();
  const panelId = useId();
  const titleId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [ringing, setRinging] = useState(false);
  const seen = useRef(unread);

  // A new unread alert swings the bell once.
  useEffect(() => {
    const more = unread > seen.current;
    seen.current = unread;
    if (!more) return;
    setRinging(true);
    const timer = window.setTimeout(() => setRinging(false), RING_MS);
    return () => window.clearTimeout(timer);
  }, [unread]);

  useEffect(() => {
    setViewingAlerts(open);
    if (!open) return;
    panel.current?.focus({ preventScroll: true });
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      button.current?.focus();
    }
    function onPointer(event: PointerEvent) {
      if (wrap.current && event.target instanceof Node && !wrap.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      setViewingAlerts(false);
    };
  }, [open]);

  // Tabbing out of the panel closes it, as a pointer outside does.
  function onBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (open && next instanceof Node && wrap.current && !wrap.current.contains(next)) setOpen(false);
  }

  const label = unread ? `Alerts, ${unread} unread` : "Alerts";
  const shown = items.slice(0, 20);

  return (
    <div ref={wrap} className="cc-bell" data-review="owner-alerts" onBlur={onBlur}>
      <button
        ref={button}
        type="button"
        className="kit-iconbutton cc-bell-button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        data-ringing={ringing ? "" : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell aria-hidden="true" strokeWidth={1.6} />
        {unread > 0 && (
          <span className="cc-bell-count" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div ref={panel} id={panelId} className="cc-bell-panel" role="dialog" aria-labelledby={titleId} tabIndex={-1}>
          <header className="cc-bell-head">
            <h2 id={titleId} className="kit-label">
              Alerts
            </h2>
            <button
              type="button"
              className="kit-button kit-button-text cc-bell-read"
              onClick={() => {
                markAllRead();
                // The button turns inactive once nothing is unread; keep focus in the panel.
                panel.current?.focus({ preventScroll: true });
              }}
              disabled={!unread}
            >
              Mark all as read
            </button>
          </header>
          {shown.length ? (
            <ul className="cc-bell-list">
              {shown.map((notice) => (
                <li key={notice.id}>
                  <Link
                    className="cc-alert"
                    data-unread={notice.read ? undefined : ""}
                    to={notice.href ?? HOME}
                    onClick={() => {
                      markRead(notice.id);
                      setOpen(false);
                    }}
                  >
                    <span className="cc-alert-dot" aria-hidden="true" />
                    <span className="cc-alert-title">
                      {notice.title}
                      {!notice.read && <span className="kit-sr">, unread</span>}
                    </span>
                    <time className="cc-alert-time" dateTime={notice.at} title={formatDateTime(notice.at)}>
                      {ago(notice.at, now)}
                    </time>
                    <span className="cc-alert-body">{notice.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cc-bell-empty">No alerts yet. New orders appear here as they land.</p>
          )}
          <footer className="cc-bell-foot">
            <SwitchRow
              title="Chime for new orders"
              description="A soft sound in this browser when an order lands."
              checked={chime}
              onChange={setChime}
            />
          </footer>
        </div>
      )}
    </div>
  );
}

/* ---------- Toasts ---------- */

type Landed = {
  key: string;
  orderId: string;
  number: string;
  total: number;
  institution: string;
  code?: string;
};

/** How long a toast stays when nobody is looking at it. */
const TOAST_MS = 12_000;

function OrderToast({ order, onOpen, onClose }: { order: Landed; onOpen: () => void; onClose: () => void }) {
  const [held, setHeld] = useState(false);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;

  // It waits while a pointer rests on it or focus is inside it.
  useEffect(() => {
    if (held) return;
    const timer = window.setTimeout(() => close.current(), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [held]);

  return (
    <section
      className="cc-toast"
      aria-labelledby={titleId}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setHeld(false);
      }}
    >
      <header className="cc-toast-head">
        <Dot tone="signal" className="cc-toast-dot" />
        <h2 id={titleId} className="cc-toast-title">
          New order <span className="kit-mono">{order.number}</span>
        </h2>
        <button type="button" className="kit-iconbutton cc-toast-close" aria-label={`Dismiss the alert for ${order.number}`} onClick={onClose}>
          <X aria-hidden="true" strokeWidth={1.6} />
        </button>
      </header>
      <p className="kit-figure cc-toast-figure">
        <MoneyFigure value={order.total} />
      </p>
      <p className="cc-toast-meta">
        {order.institution}
        {order.code && (
          <>
            {" · via "}
            <span className="kit-mono">{order.code}</span>
          </>
        )}
      </p>
      <div className="cc-toast-actions">
        <button type="button" className="kit-button kit-button-primary" onClick={onOpen}>
          Open
        </button>
        <span className="cc-toast-when">Just now</span>
      </div>
    </section>
  );
}

/** A toast for every order placed while the command center is open, from any tab. */
export function OrderToasts() {
  const [landed, setLanded] = useState<Landed[]>([]);
  const [chime] = useChime();
  const chimeOn = useRef(chime);
  chimeOn.current = chime;
  const navigate = useNavigate();

  useEffect(
    () =>
      onPlatformEvent((event) => {
        if (event.type !== "order.placed") return;
        void Promise.all([
          store.buyers.get(event.buyerId).catch(() => null),
          event.partnerId ? store.partners.get(event.partnerId).catch(() => null) : Promise.resolve(null),
        ]).then(([buyer, partner]) => {
          const order: Landed = {
            key: `${event.orderId}-${event.at}`,
            orderId: event.orderId,
            number: event.number,
            total: event.total,
            institution: buyer?.institution ?? "Research account",
            code: partner?.code,
          };
          if (!viewingAlerts) setLanded((list) => [order, ...list.filter((item) => item.orderId !== order.orderId)].slice(0, 3));
          if (chimeOn.current) playChime();
        });
      }),
    [],
  );

  // Opening the bell shows these same orders, so the toasts make way.
  useEffect(() => {
    const clear = () => setLanded([]);
    alertsView.addEventListener("open", clear);
    return () => alertsView.removeEventListener("open", clear);
  }, []);

  const dismiss = useCallback((key: string) => setLanded((list) => list.filter((item) => item.key !== key)), []);

  return (
    <div className="cc-toasts" aria-live="polite" aria-relevant="additions">
      {landed.map((order) => (
        <OrderToast
          key={order.key}
          order={order}
          onClose={() => dismiss(order.key)}
          onOpen={() => {
            dismiss(order.key);
            const href = `${HOME}/orders?order=${order.orderId}`;
            const ids = notices
              .list("owner")
              .filter((notice) => notice.href === href && !notice.read)
              .map((notice) => notice.id);
            if (ids.length) notices.markRead("owner", ids);
            navigate(href);
          }}
        />
      ))}
    </div>
  );
}
