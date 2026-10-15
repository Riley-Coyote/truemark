import { createContext, memo, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Location } from "react-router-dom";
import { bindRouter, bindSlot, bindViews, flightViews, keepsParked, pageOf } from "./flight";
import "./flight.css";

const SlotContext = createContext(-1);
const AllowedContext = createContext(false);

/** The view slot a page is drawn in (-1 outside the shop's views, as in a test render). */
export const useFlightSlot = () => useContext(SlotContext);

/** Whether a vial may carry the reader into its product (not while product pages ask a live visitor to sign in). */
export const useFlightAllowed = () => useContext(AllowedContext);

/** True for a page that a camera move brought in: it arrives already standing, without its own entrance. */
export function useArrivedByFlight() {
  const slot = useFlightSlot();
  const [arrived] = useState(() => flightViews.snapshot().slots.some((s) => s.id === slot && s.pending));
  return arrived;
}

function settledNow(slot: number) {
  const views = flightViews.snapshot();
  if (slot < 0) return true;
  const own = views.slots.find((s) => s.id === slot);
  return !own || (!views.moving && !own.parked);
}
/** The page is the opening, parked under a product page for Back (flight.ts): mounted, unseen and inert. */
function parkedNow(slot: number) {
  return slot >= 0 && flightViews.snapshot().slots.some((s) => s.id === slot && s.parked);
}

/** False while the page's slot is part of a camera move. Read as one boolean, so a page redraws only when it flips. */
export function useFlightSettled() {
  const slot = useFlightSlot();
  return useSyncExternalStore(flightViews.subscribe, () => settledNow(slot), () => true);
}

/**
 * What a page shows below its first screen can wait for a camera move: it is drawn once the move has settled
 * and the browser is next idle, so neither the move nor its last frame waits on it. A page that arrives any
 * other way draws it at once, and a page that has drawn it no longer listens, so a move leaving it never
 * redraws it. An opening parked under a product page (flight.ts) lets it go, and draws it again once Back has
 * brought it home and settled: nothing below it runs while it is unseen.
 */
export function useAfterFlight() {
  const slot = useFlightSlot();
  const drawn = useRef(false);
  const parked = useSyncExternalStore(flightViews.subscribe, () => parkedNow(slot), () => false);
  const settled = useSyncExternalStore(flightViews.subscribe, () => (drawn.current && !parkedNow(slot)) || settledNow(slot), () => true);
  const [ready, setReady] = useState(settled);
  useEffect(() => {
    if (ready && !parked) drawn.current = true;
  }, [ready, parked]);
  useEffect(() => {
    if (!parked) return;
    drawn.current = false;
    setReady(false);
  }, [parked]);
  useEffect(() => {
    if (parked || !settled || ready) return;
    // Safari has no idle callback: the next frames do.
    if (typeof window.requestIdleCallback === "function") {
      const idle = window.requestIdleCallback(() => setReady(true), { timeout: 600 });
      return () => window.cancelIdleCallback(idle);
    }
    const later = window.setTimeout(() => setReady(true), 120);
    return () => window.clearTimeout(later);
  }, [parked, settled, ready]);
  return ready && !parked;
}

/**
 * A slot's page, drawn again only when its address changes. What else a page needs from the shop (the cart)
 * reaches it through context, so a page held for a camera move isn't redrawn by every change around it while
 * the camera runs.
 */
const SlotPage = memo(
  function SlotPage({ at, render }: { at: Location; render: (location: Location) => ReactNode }) {
    return <>{render(at)}</>;
  },
  (before, after) => before.at === after.at,
);

/**
 * The shop's page, drawn into view slots. At rest there is one, showing the router's address. During the
 * opening's camera move there are two, each pinned to its own address, so the departing page is still drawn
 * (and still mounted) while the arriving one comes in over it (src/brand/flight.ts).
 *
 * Every slot always passes its address to `<Routes location>`: the router wraps a page in a location context
 * only when it is given one, so pinning and unpinning a slot never changes its tree (and never remounts it).
 */
export function FlightViews({ allowed, children }: { allowed: boolean; children: (location: Location) => ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const views = useSyncExternalStore(flightViews.subscribe, flightViews.snapshot, flightViews.snapshot);
  useLayoutEffect(() => {
    bindRouter(location, navigate);
  });
  // The opening is drawn under the product, so a product page always comes after it. A parked opening is drawn only
  // while the reader stays on the product page the camera brought them to: leaving it any other way, the opening
  // goes in the same commit as the new page comes (flight.ts bindRouter then forgets it).
  const order = (at: Location) => (pageOf(at.pathname) === "product" ? 1 : 0);
  const slots = views.slots
    .filter((slot) => !slot.parked || keepsParked(location))
    .map((slot) => ({ slot, at: slot.location ?? location }))
    .sort((a, b) => order(a.at) - order(b.at));
  return (
    <AllowedContext.Provider value={allowed}>
    <div className="tm-views" ref={bindViews}>
      {slots.map(({ slot, at }) => (
        <div
          key={slot.id}
          className="tm-view"
          data-view={pageOf(at.pathname)}
          data-pending={slot.pending ? "" : undefined}
          data-parked={slot.parked ? "" : undefined}
          inert={slot.leaving || slot.parked || undefined}
          ref={(element) => {
            bindSlot(slot.id, element);
            return () => bindSlot(slot.id, null);
          }}
        >
          <SlotContext.Provider value={slot.id}>
            <SlotPage at={at} render={children} />
          </SlotContext.Provider>
        </div>
      ))}
    </div>
    </AllowedContext.Provider>
  );
}
