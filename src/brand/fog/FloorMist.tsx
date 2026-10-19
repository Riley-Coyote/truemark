import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { moveInto, registerClaimant } from "../share";
import { createFogWhenReady, fogTop } from "./fog";
import type { Fog, FogFallback, FogParams, FogScene } from "./fog";

/** The event a camera move sends as it starts and as it settles (src/brand/flight.ts FLIGHT_EVENT). */
const FLIGHT = "tm-flight";
/** The event the opening's scroll sequence sends as its camera leaves the room's rest and comes back to it
 *  (src/brand/Sequence.tsx SEQUENCE_EVENT). */
const SEQUENCE = "tm-sequence";
/** A page in a camera move, or waiting to come in with one, or an opening whose scroll camera has left the room's floor
 *  out of its picture: its mist holds still and builds nothing meanwhile. */
const held = (node: Element) => Boolean(node.closest(".tm-views[data-moving], .tm-view[data-pending], .tm-mist[data-seq-away], .tm-home[data-procession-gone]"));

/**
 * A room's mist, alive: its canvas, its context, programs, air and last frame. There is one per room (and per kind:
 * a phone's ambient mist is its own), lent to whichever page shows the room (share.ts): the opening, or a product page
 * standing on one of its pedestals. It is never built twice for one visit: when no page shows it, it is set aside,
 * paused and out of the page, for the next page that does.
 */
type Mist = { canvas: HTMLCanvasElement; fog: Fog; key: string; dead: boolean; onFallback: ((reason: FogFallback) => void) | null };
const kept: Mist[] = [];
/** The mists set aside at once: the room's, and its other shape's (a phone turned on its side). */
const KEEP = 2;
/** The mist as it was tuned: what a page that asks for nothing of its own shows. */
const PLAIN: FogParams = { density: 1, depth: 1, climb: 1, drift: 1, turbulence: 1, light: 1, pointer: 1 };
const keyOf = (scene: FogScene, ambient: boolean) => `${scene.room.w}x${scene.room.h}:${ambient ? "ambient" : "interactive"}`;

/** A page's place for the mist: what it shows, and how it takes the mist in and gives it up. */
type Host = {
  key: string;
  node: HTMLElement;
  mist: Mist | null;
  attach(mist: Mist): void;
  /** Hand the mist on: it stays where it is drawn until its next host moves it. */
  release(): Mist | null;
  /** Nothing to show and nothing coming: make the mist (at once, or once the camera has settled). */
  build(): void;
};
/** The pages showing the room now, by mist, in the order they came; and the one each mist is lent to. */
const hosts = new Map<string, Host[]>();
const owners = new Map<string, Host>();
/** Mists being made, by key: when one is ready it goes to whichever page then owns its key. */
const making = new Set<string>();

function take(key: string): Mist | null {
  // A kept mist whose context was lost meanwhile is no use to anyone.
  for (let i = kept.length - 1; i >= 0; i--) if (kept[i].dead) kept.splice(i, 1);
  const index = kept.findIndex((entry) => entry.key === key);
  return index < 0 ? null : kept.splice(index, 1)[0];
}
function keep(entry: Mist) {
  entry.onFallback = null;
  entry.fog.pause();
  entry.canvas.remove();
  kept.push(entry);
  while (kept.length > KEEP) kept.shift()?.fog.destroy();
  releaseLater();
}

/** How long the room may go unshown before its mists are let go: long enough for a page that shows it to follow. */
const RELEASE_AFTER = 3000;
let releasing = 0;
/**
 * Once no page has shown the room for a moment (the reader has gone on to another kind of page), the mists set aside
 * are destroyed and their GPU contexts given back. A page that shows the room again makes its mist afresh. A turned
 * phone keeps its other shape's mist (a page still shows the room), and a camera move never lets go (one page or the
 * other shows the room throughout).
 */
function releaseLater() {
  window.clearTimeout(releasing);
  releasing = window.setTimeout(() => {
    if ([...hosts.values()].some((list) => list.length) || making.size) return;
    for (const entry of kept.splice(0)) entry.fog.destroy();
  }, RELEASE_AFTER);
}

/** Lend the key's mist to `host`: from the page showing it, from those set aside, or, failing both, made for it. */
function lend(host: Host) {
  const owner = owners.get(host.key);
  if (owner === host) return;
  owners.set(host.key, host);
  const mist = owner?.release() ?? take(host.key);
  if (mist) host.attach(mist);
  else if (!making.has(host.key)) host.build();
}

/** A mist made: shown by the page that owns its key now, or set aside if none does. */
function deliver(mist: Mist) {
  making.delete(mist.key);
  const owner = owners.get(mist.key);
  if (owner && !owner.mist) owner.attach(mist);
  else keep(mist);
}

/** After a move has settled, when the browser is next idle (Safari has no idle callback: a moment later). */
function afterIdle(run: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    const idle = window.requestIdleCallback(run, { timeout: 600 });
    return () => window.cancelIdleCallback(idle);
  }
  const later = window.setTimeout(run, 120);
  return () => window.clearTimeout(later);
}

/** Give the photographed room a paint before compiling the optional atmosphere. */
function afterPaintIdle(run: () => void) {
  let second = 0;
  let cancelIdle: (() => void) | undefined;
  const first = requestAnimationFrame(() => {
    second = requestAnimationFrame(() => { cancelIdle = afterIdle(run); });
  });
  return () => {
    cancelAnimationFrame(first);
    cancelAnimationFrame(second);
    cancelIdle?.();
  };
}

/**
 * The room's floor mist, simulated: a canvas laid on the room's plate from the highest row the mist can reach down to
 * the room's foot, across its full width, so it moves with the plate (its pointer parallax, a camera move) and stays
 * in register with the pedestals at every size. Over the room, under the vials.
 *
 * Only the pointer's movement stirs it, heard on the window, so nothing over the room (the vials, the words) ever
 * waits on it; the canvas itself takes no pointer events. Touch never stirs it, and phones and tablets keep it
 * ambient, at a lower resolution. With reduced motion it is one still moment of the mist, as the rooms are their
 * first frames. It pauses off screen, in a hidden tab, and while a camera move runs (as the room's loop holds its
 * frame). A product page lays the room out `zoom` times closer than the opening; the mist is rendered as at the
 * opening's framing, so the camera can carry it from one to the other unchanged.
 *
 * Where it can't run (no WebGL2, no float targets) or can't keep up (it steps its quality down first), the host's
 * `fallback` shows instead. A page may ask for its own `tune` (the opening's deeper, brighter bank); the mist takes it
 * whenever that page shows it, and gives it up for the next page's.
 */
export function FloorMist({ scene, still, ambient, zoom = 1, tune, fallback = null }: {
  scene: FogScene;
  still: boolean;
  /** No pointer, lower resolution: phones and touch screens. */
  ambient: boolean;
  /** How much closer than the opening this page frames the room. */
  zoom?: number;
  /** This page's own tuning, over the mist's plain one. */
  tune?: Partial<FogParams>;
  /** What shows when the mist stands down. */
  fallback?: ReactNode;
}) {
  const node = useRef<HTMLDivElement>(null);
  const fog = useRef<Fog | null>(null);
  const [failed, setFailed] = useState<FogFallback | null>(null);
  // Read when the mist arrives; afterwards a change is handed to the mist rather than restarting anything.
  const stillNow = useRef(still);
  const zoomNow = useRef(zoom);
  const tuneNow = useRef({ ...PLAIN, ...tune });
  useEffect(() => {
    stillNow.current = still;
    fog.current?.setStill(still);
  }, [still]);
  useEffect(() => {
    zoomNow.current = zoom;
  }, [zoom]);
  useEffect(() => {
    tuneNow.current = { ...PLAIN, ...tune };
    fog.current?.set(tuneNow.current);
  }, [tune]);

  useLayoutEffect(() => {
    const el = node.current;
    if (!el || failed) return;
    const key = keyOf(scene, ambient);
    let live = true;
    let cancelBuild: (() => void) | null = null;
    const fellBack = (reason: FogFallback) => {
      if (live) setFailed(reason);
    };
    // Moving or waiting to move: hold still. Otherwise run (on screen and in a seen tab; the mist sees to that).
    let scrolling = false, scrollRest = 0;
    const sync = () => {
      if (!host.mist) return;
      if (held(el) || scrolling) host.mist.fog.pause();
      else host.mist.fog.resume();
    };
    /** Compile after the room has painted or a camera move has settled. Where supported,
     *  the browser compiles shaders off the page's thread; the mist then comes up gently. */
    const make = () => {
      cancelBuild = null;
      if (!live || owners.get(key) !== host || host.mist || making.has(key) || held(el)) return;
      making.add(key);
      // A fresh canvas: a context can't be handed back once lost or given up.
      const canvas = document.createElement("canvas");
      canvas.className = "tm-floor-mist-canvas";
      canvas.setAttribute("aria-hidden", "true");
      const fade = !stillNow.current;
      if (fade) canvas.style.opacity = "0";
      el.append(canvas);
      const made: Mist = { canvas, fog: null as unknown as Fog, key, dead: false, onFallback: null };
      const options = {
        scene,
        quality: ambient ? ("low" as const) : ("high" as const),
        interactive: !ambient,
        ...tuneNow.current,
        still: stillNow.current,
        zoom: zoomNow.current,
        // Routed to whichever page shows the mist now (to this one while it is being made).
        onFallback: (reason: FogFallback) => {
          made.dead = true;
          (made.onFallback ?? fellBack)(reason);
        },
      };
      const ready = (instance: Fog | null) => {
        if (!instance) {
          making.delete(key);
          canvas.remove();
          return;
        }
        made.fog = instance;
        deliver(made);
        if (fade) {
          canvas.style.transition = "opacity var(--tm-dur-scene) var(--tm-ease-breathe)";
          requestAnimationFrame(() => requestAnimationFrame(() => { canvas.style.opacity = ""; }));
        }
      };
      void createFogWhenReady(canvas, options, () => !live && owners.get(key) === undefined).then(ready);
    };
    const host: Host = {
      key,
      node: el,
      mist: null,
      attach(mist) {
        host.mist = mist;
        mist.onFallback = fellBack;
        fog.current = mist.fog;
        if (import.meta.env.DEV) (window as Window & { tmFloorMist?: Fog | null }).tmFloorMist = mist.fog;
        const moved = mist.canvas.parentNode !== el;
        moveInto(el, mist.canvas);
        mist.fog.setStill(stillNow.current);
        mist.fog.set(tuneNow.current);
        // From another page's framing: rendered exactly as it was, whatever size this page lays it out at.
        if (moved) mist.fog.adopt();
        mist.fog.redraw();
        sync();
      },
      release() {
        const mist = host.mist;
        host.mist = null;
        fog.current = null;
        if (mist) mist.onFallback = null;
        return mist;
      },
      build() {
        // Let the room and its controls paint first. Shader compilation then uses
        // the same asynchronous path as an arriving page, fading into the room.
        // In a move, it waits for the move to settle (onFlight).
        if (!held(el)) {
          cancelBuild?.();
          cancelBuild = afterPaintIdle(make);
        }
      },
    };
    const onFlight = () => {
      if (host.mist) return sync();
      // A page that came in with a camera move and found no mist makes one once the move has settled, when idle.
      if (owners.get(key) === host && !making.has(key) && !held(el)) {
        cancelBuild?.();
        cancelBuild = afterIdle(make);
      }
    };
    // A real change of the window's size: the mist is rendered for this page's own framing again.
    const onResize = () => {
      if (host.mist) host.mist.fog.setZoom(zoomNow.current);
    };
    const list = hosts.get(key) ?? [];
    list.push(host);
    hosts.set(key, list);
    if (!owners.has(key)) lend(host);
    const unclaim = registerClaimant(el, () => lend(host));
    window.addEventListener(FLIGHT, onFlight);
    window.addEventListener(SEQUENCE, onFlight);
    window.addEventListener("resize", onResize);
    // Keep the last beautiful mist frame while a phone is panning. Rendering
    // volumetric fog must not compete with native scroll for the GPU.
    const onScroll = () => {
      if (!scrolling) { scrolling = true; sync(); }
      window.clearTimeout(scrollRest);
      scrollRest = window.setTimeout(() => { scrolling = false; sync(); }, 180);
    };
    if (ambient) window.addEventListener('scroll', onScroll, {passive:true});
    return () => {
      live = false;
      unclaim();
      window.removeEventListener(FLIGHT, onFlight);
      window.removeEventListener(SEQUENCE, onFlight);
      window.removeEventListener("resize", onResize);
      window.removeEventListener('scroll', onScroll); window.clearTimeout(scrollRest);
      cancelBuild?.();
      hosts.set(key, (hosts.get(key) ?? []).filter((h) => h !== host));
      if (owners.get(key) !== host) return;
      owners.delete(key);
      const mist = host.release();
      const remaining = hosts.get(key) ?? [];
      const next = remaining[remaining.length - 1];
      if (next) {
        owners.set(key, next);
        if (mist && !mist.dead) next.attach(mist);
        else if (!making.has(key)) next.build();
      } else if (mist && !mist.dead) keep(mist);
      else if (mist) mist.canvas.remove();
    };
  }, [scene, ambient, failed]);

  // The pointer, as a body moving through the air: heard on the window, never claimed.
  useEffect(() => {
    if (ambient || still || failed) return;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "touch") fog.current?.setPointer(event.clientX, event.clientY);
    };
    const release = () => fog.current?.releasePointer();
    const root = document.documentElement;
    window.addEventListener("pointermove", move, { passive: true });
    root.addEventListener("pointerleave", release, { passive: true });
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointermove", move);
      root.removeEventListener("pointerleave", release);
      window.removeEventListener("blur", release);
    };
  }, [ambient, still, failed]);

  if (failed) return <>{fallback}</>;
  return (
    <div
      ref={node}
      className="tm-floor-mist"
      style={{ "--tm-floor-mist-top": fogTop(scene) } as CSSProperties}
      data-fog-scene={`${scene.room.w}x${scene.room.h}`}
      aria-hidden="true"
    />
  );
}
