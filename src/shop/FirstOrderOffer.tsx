import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, X } from "lucide-react";
import { assetUrl } from "../assetUrl";
import { BrandDot } from "../brand/HeroShelf";
import { LIVE } from "../platform/mode";
import { store, useResource } from "../platform/store";
import type { Discount } from "../platform/types";
import { firstOrderOffer } from "./catalog";
import { useReviewDockRoom } from "./dock";
import { ADD_EVENT } from "./MobileAdd";
import { useBagCode } from "./pages/checkout/Bag";
import { SheetSkirt, useScrollLock, useSheetDrag, useSheetFocus, useSheetPresence, useVisibleViewport, viewportBox } from "./sheet";
import type { SheetState } from "./sheet";
import "./offer.css";

/*
 * The first-order offer, welcoming a first-time visitor once: as a popup (an iPhone sheet on a
 * phone) or as a small card in the corner that blocks nothing. The client is choosing between the
 * two on the review site; `?offer=popup`, `?offer=card` or `?offer=off` shows each, even after a
 * "Not now". The code is the shop's own (FIRSTLOT); applying it puts it in the bag, exactly as
 * typing it there would.
 */

type Variant = "popup" | "card" | "off";
const CODE = "FIRSTLOT";
const VARIANT_KEY = "tm-offer-variant";
const STATE_KEY = "tm-offer";
/** On the site this long, or this far down a page, and the offer appears. */
const DELAY_MS = 7000;
const SCROLL_SHARE = 0.4;
/** Pages where a buyer is busy with something else: buying, their account, a lot or an order. */
const QUIET = /^\/(cart|checkout|account|access|track|verify)(\/|$)/;
const SHOPPING = /^\/(products|product)(\/|$)/;
/** The modal layer the shop's dialogs share (styles.css, .modal-backdrop). */
const OFFER_LAYER = 100;
const visitStart = typeof performance !== "undefined" ? performance.now() : 0;

const photo = {
  src: assetUrl("images/scenes/trio.webp"),
  srcSet: `${assetUrl("images/scenes/trio-sm.webp")} 1200w, ${assetUrl("images/scenes/trio.webp")} 2400w`,
};

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Without storage the offer simply asks again on a later visit. */
  }
}

/** Another dialog, the bag, search, the chat or the menu has the reader's attention. */
const busy = () =>
  document.documentElement.hasAttribute("data-scroll-locked") || Boolean(document.querySelector('.tm-mmenu, [aria-modal="true"]'));

function useVariant(search: string): { variant: Variant; forced: boolean } {
  const asked = new URLSearchParams(search).get("offer");
  const valid = asked === "popup" || asked === "card" || asked === "off" ? asked : null;
  useEffect(() => {
    if (valid) write(VARIANT_KEY, valid);
  }, [valid]);
  if (valid) return { variant: valid, forced: valid !== "off" };
  const stored = read(VARIANT_KEY);
  return { variant: stored === "card" || stored === "off" ? stored : "popup", forced: false };
}

export function FirstOrderOffer({ locked }: { locked: boolean }) {
  const location = useLocation();
  const { variant, forced } = useVariant(location.search);
  const offer = useResource<Discount | null>(() => (LIVE ? store.catalog.validateCode(CODE) : Promise.resolve(firstOrderOffer)), []);
  const code = useBagCode();
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  // Shown once per visit, even where `?offer=` asks for it again after a "Not now".
  const [done, setDone] = useState(false);
  const quiet = QUIET.test(location.pathname);
  const settled = read(STATE_KEY);
  const eligible = !done && Boolean(offer.data?.active) && variant !== "off" && !quiet && (forced || !settled) && (applied || code.discount?.code !== CODE);

  // Appear once: after a while on the site, or partway down a page, never over another dialog.
  useEffect(() => {
    if (!eligible || open) return;
    let timer = 0;
    const show = () => {
      if (busy()) {
        timer = window.setTimeout(show, 1500);
        return;
      }
      setOpen(true);
    };
    const elapsed = performance.now() - visitStart;
    timer = window.setTimeout(show, forced ? 900 : Math.max(1500, DELAY_MS - elapsed));
    const onScroll = () => {
      const room = document.documentElement.scrollHeight - window.innerHeight;
      if (room > 0 && window.scrollY / room >= SCROLL_SHARE && performance.now() - visitStart > 2000) {
        window.clearTimeout(timer);
        show();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [eligible, open, forced]);

  // Arriving at checkout, an account page or a lookup puts the offer away; it isn't dismissed.
  useEffect(() => {
    if (quiet) setOpen(false);
  }, [quiet]);

  const dismiss = useCallback(() => {
    if (!applied) write(STATE_KEY, "dismissed");
    setOpen(false);
    setDone(true);
  }, [applied]);

  const apply = useCallback(async () => {
    const ok = await code.apply(CODE);
    if (ok) {
      write(STATE_KEY, "applied");
      setApplied(true);
    }
    return ok;
  }, [code]);

  if (!open || !offer.data) return null;
  const props: OfferProps = {
    percent: offer.data.percent,
    locked,
    applied,
    checking: code.checking,
    error: code.error,
    onApply: apply,
    onClose: dismiss,
    from: location.pathname,
  };
  return variant === "card" ? <OfferCard {...props} /> : <OfferDialog {...props} />;
}

type OfferProps = {
  percent: number;
  locked: boolean;
  applied: boolean;
  checking: boolean;
  error: string | null;
  onApply: () => Promise<boolean>;
  onClose: () => void;
  from: string;
};

/** The code, set like the lot line of a label: a small caps label, then the identifier. */
function CodeLine({ size = "md" }: { size?: "md" | "sm" }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CODE);
      setCopied(true);
    } catch {
      /* The code is on screen to type. */
    }
  };
  return (
    <p className={`tm-offer-codeline is-${size}`}>
      <span className="tm-offer-codeline-label">Code</span>
      <span className="tm-offer-codeline-value">{CODE}</span>
      {size === "md" && (
        <button type="button" className="tm-offer-copy" onClick={copy} aria-live="polite">
          {/* Both words hold the space, so the code's box never shifts when one replaces the other. */}
          <span hidden={copied}>Copy</span>
          <span hidden={!copied}>Copied</span>
        </button>
      )}
    </p>
  );
}

function Primary({ locked, applied, checking, onApply, onClose, from }: OfferProps) {
  if (locked) {
    return (
      <Link className="tm-button tm-button-primary" to="/access" state={{ from }} onClick={onClose}>
        Open a research account
      </Link>
    );
  }
  if (applied) {
    // Already among the products, the offer simply steps aside; elsewhere it leads to them.
    return SHOPPING.test(from) ? (
      <button type="button" className="tm-button tm-button-primary" onClick={onClose}>
        Continue shopping
      </button>
    ) : (
      <Link className="tm-button tm-button-primary" to="/products" onClick={onClose}>
        Shop the catalog
      </Link>
    );
  }
  return (
    <button type="button" className="tm-button tm-button-primary" onClick={() => void onApply()} disabled={checking} aria-busy={checking || undefined}>
      Apply to my bag
    </button>
  );
}

/** The popup: a dialog beside the page on a wide screen, a sheet risen from the bottom on a phone. */
function OfferDialog(props: OfferProps) {
  const { percent, locked, applied, error, onClose } = props;
  const panel = useRef<HTMLElement>(null);
  const titleId = useId();
  const seen = useVisibleViewport();
  const { state, requestClose } = useSheetPresence(onClose);
  useScrollLock();
  useSheetFocus(panel, requestClose, "fine");
  const drag = useSheetDrag(panel, requestClose, (target) => Boolean(target.closest(".tm-offer-photo, .tm-offer-grab")));
  return (
    <>
      <div
        className="tm-offer"
        data-state={state}
        style={viewportBox(seen, "tm-sheet")}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) requestClose();
        }}
      >
        <section ref={panel} className="tm tm-offer-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} data-review="offer-popup" {...drag}>
          <figure className="tm-offer-photo">
            <img src={photo.src} srcSet={photo.srcSet} sizes="(max-width: 760px) 100vw, 50rem" alt="" draggable={false} />
          </figure>
          <span className="tm-offer-grab" aria-hidden="true" />
          <div className="tm-offer-body">
            <p className="tm-offer-eyebrow">First order</p>
            <h2 id={titleId} className="tm-offer-title">
              {percent}% off your first order
              <BrandDot />
            </h2>
            <p className="tm-offer-text">
              {locked
                ? "Research accounts are opened to verified laboratories. Use the code on your first order."
                : "Use the code at checkout, or apply it to your bag now."}
            </p>
            <CodeLine />
            {applied && <Applied percent={percent} />}
            {error && !applied && (
              <p className="tm-offer-error" role="alert">
                {error}
              </p>
            )}
            <div className="tm-offer-actions">
              <Primary {...props} />
              <button type="button" className="tm-offer-later" onClick={requestClose}>
                {applied ? "Close" : "Not now"}
              </button>
            </div>
            <p className="tm-offer-fine">For laboratory research use only.</p>
          </div>
          <button type="button" className="tm-offer-close" aria-label="Close" onClick={requestClose}>
            <X size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </section>
      </div>
      <SheetSkirt seen={seen} state={state} layer={OFFER_LAYER} />
    </>
  );
}

function Applied({ percent }: { percent: number }) {
  return (
    <p className="tm-offer-applied" role="status">
      <Check size={16} strokeWidth={2} aria-hidden="true" />
      Applied. {percent}% comes off at checkout.
    </p>
  );
}

/** The corner card: the same offer, in view without blocking anything. */
function OfferCard(props: OfferProps) {
  const { percent, locked, applied, checking, onApply, onClose, from } = props;
  const [state, setState] = useState<SheetState>("entering");
  const [hidden, setHidden] = useState(false);
  const card = useRef<HTMLElement>(null);
  const dockRoom = useReviewDockRoom(true);

  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setState("open"));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  // While the added-to-bag bar is up on a phone, the card steps aside for it.
  useEffect(() => {
    let timer = 0;
    const added = () => {
      setHidden(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHidden(false), 5600);
    };
    window.addEventListener(ADD_EVENT, added);
    return () => {
      window.removeEventListener(ADD_EVENT, added);
      window.clearTimeout(timer);
    };
  }, []);

  // Once applied, the card has done its work: it says so, then goes.
  useEffect(() => {
    if (!applied) return;
    const timer = window.setTimeout(() => leave(), 2600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  const leave = () => {
    setState("leaving");
    window.setTimeout(onClose, 420);
  };

  return (
    <aside
      ref={card}
      className="tm tm-offer-card"
      data-state={hidden ? "leaving" : state}
      aria-label="First-order offer"
      data-review="offer-card"
      style={{ "--tm-offer-dock": `${dockRoom}px` } as CSSProperties}
      onKeyDown={(event) => {
        if (event.key === "Escape") leave();
      }}
    >
      <img className="tm-offer-card-photo" src={photo.src} srcSet={photo.srcSet} sizes="6rem" alt="" draggable={false} />
      <div className="tm-offer-card-text">
        <p className="tm-offer-card-title">{applied ? "Applied to your bag" : `${percent}% off your first order`}</p>
        <CodeLine size="sm" />
      </div>
      {locked ? (
        <Link className="tm-offer-card-action" to="/access" state={{ from }} onClick={onClose}>
          Open an account
        </Link>
      ) : (
        <button type="button" className="tm-offer-card-action" onClick={() => void onApply()} disabled={checking || applied} data-done={applied || undefined}>
          {applied ? <Check size={16} strokeWidth={2} aria-label="Applied" /> : "Apply"}
        </button>
      )}
      <button type="button" className="tm-offer-card-close" aria-label="Dismiss the offer" onClick={leave}>
        <X size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </aside>
  );
}
