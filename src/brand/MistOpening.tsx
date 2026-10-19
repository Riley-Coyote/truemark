import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Product } from "../data";
import { store, useResource } from "../platform/store";
import { productById } from "../shop/catalog";
import { useMediaQuery } from "../shop/motion";
import { placeOnOpening } from "../Navigation";
import { BrandDot } from "./BrandDot";
import { collectionIds } from "./carousel";
import { flyToProduct, preloadProduct, registerHome } from "./flight";
import { TALL_SCREEN } from "./opening-media";
import { useArrivedByFlight, useFlightAllowed, useFlightSlot } from "./FlightViews";
import { collectionVerified } from "./plinth";
import {
  COLLECTION,
  COLLECTION_SEATS,
  COLLECTION_TALL,
  COLLECTION_TALL_SEATS,
  frameOpening,
  OPENING_BAND,
  FrontMist,
  Plate,
  RoomFocus,
  RoomLoop,
  roomMedia,
  RoomVial,
  useDepth,
  useStageSize,
} from "./Rooms";
import type { Words } from "./Rooms";
import { FEATURED, MotionSwitch, openStory, SequenceCamera, SequenceRoom, SequenceStills, SequenceTrack, softCutout, useMotion, useSequenceReady, vialShadow } from "./Sequence";
import "./hero.css";
import "./mist.css";
import "./mist-word.css";
import "./stories.css";

/** Every window but an upright phone's sees the room as first photographed; its widened edges wait for very wide screens. */
const BAND = OPENING_BAND;
/** A phone held upright sees the middle three pedestals, with wall above for the headline (opening-media.ts). */
const TALL_FOCUS = { x: 0.5, y: 0.62 };
/** The least room between the words on the wall and the nearest cap below them. */
const CLEARANCE = 36;
/** The room kept under a vial's foot, beyond the clearance the floor already keeps: its pedestal's face, where the
 *  featured vial's way in stands (stories.css .tm-story-cue), and on a wide screen the floor's fade below it; on a
 *  phone, the face above the way in on the floor. */
const FOOT_ROOM = 76;
const FOOT_ROOM_PHONE = 56;
/** Every vial stands at least this far inside the first screen, at every size of window. */
const SCREEN_MARGIN = 16;
/** The smallest a vial stands on a landscape first screen before the stage grows past it instead (a phone on its side). */
const MIN_VIAL = 64;
/** The plate is drawn a little larger than its box, about its centre, and moved by the pointer's depth up to this far
 *  either way (rooms.css .tm-room-plate). */
const PLATE_SCALE = 1.015;
const DEPTH = { x: 7, y: 5 };
/** How far the camera pushes in as the reader scrolls on past the room (stories.css): toward the featured vial. */
const FLY_ZOOM = 2.1;
/** The headline's last word, set into the room: how far down the featured vial its foot sits (in the vial's height),
 *  its gap under the words on the wall (px), its cap height and its width in ems (Poppins Light, tracked in), and the
 *  share of the screen it may span. */
const WORD = { sink: 0.6, gap: 30, cap: 0.8, em: 4.05, span: 0.94 } as const;
/** The space kept under the words on the wall for it to rise into: a share of the screen's height above a floor of
 *  it, so a short laptop window keeps its room whole and a tall one gives the word more. */
/** The room's light on each vial by how many pedestals it stands from the one under the light (mist-word.css): half
 *  the falloff the relit photograph shows across its pedestal tops (wide 0.92, 0.72; tall 0.87), so the labels still
 *  read true. */
const VIAL_LIGHT = { wide: [1, 0.96, 0.86], tall: [1, 0.935] } as const;
const WORD_ROOM = { wide: 0.4, tall: 0.07, from: 680 } as const;
/** The opening's floor mist: a denser, deeper bank than a product page's, climbing the pedestals' feet and catching
 *  the room's light (fog/fog.ts FogParams). */
const ROOM_FOG = { density: 2.9, depth: 2, climb: 2.1, light: 3.2 } as const;
/** How long the room takes to come into focus as the page first opens on it, the word last (mist-word.css), with a
 *  little to spare: after this the arrival's rules are put away. */
const DAWN_MS = 2800;
/** The opening is on screen at the page's top while the page stands within this share of a screen of it: the room's
 *  arrival, and its haze behind the page (mist-word.css), are for then only. */
const AT_TOP = 0.25;
const atTop = (y: number) => y <= 0 || y < window.innerHeight * AT_TOP;

/**
 * The opening: the collection in its misty room, quietly alive (daylight breathing on the walls, mist
 * along the floor), with the client's three-line headline on the wall above it. Each vial stands bare on its
 * pedestal and opens its product as one camera move (flight.ts): the camera pushes in on the vial's own
 * pedestal, the room softens around it, and its details rise beside it.
 * The room is seated from the words: wherever they end on the wall, the caps stand clear below them, at any
 * size of window.
 */
export function MistOpening() {
  const stage = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const lead = useRef<HTMLParagraphElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const foot = useRef<HTMLDivElement>(null);
  const tall = useMediaQuery(TALL_SCREEN);
  const phone = useMediaQuery("(max-width: 560px)");
  // A phone on its side: too short to keep the lead and the caption on the wall and still show the room on the
  // first screen, so, as on a phone held upright, they follow beneath the room.
  const low = useMediaQuery("(orientation: landscape) and (max-height: 500px) and (max-width: 960px)");
  // With the words centred over the room, a landscape screen keeps only the headline and the way in on the wall; the
  // lead and the caption follow beneath the room there too, so the room stands as large as before.
  const beneath = phone || low || !tall;
  // The room lives, and the closer look plays as the reader scrolls, unless the reader asks for stillness: their own
  // setting, or the switch on the stage (Sequence.tsx).
  const still = !useMotion();
  const size = useStageSize(stage);
  // The first screen under the header, as the stage's own height would be (mist.css): the stage itself is sized to what
  // the room covers of it.
  const screenSizer = useRef<HTMLSpanElement>(null);
  const screen = useStageSize(screenSizer).h;
  const slot = useFlightSlot();
  const allowed = useFlightAllowed();
  // Brought back by the camera: it stands as it was left, without its entrance.
  const arrived = useArrivedByFlight();
  const room = tall ? COLLECTION_TALL : COLLECTION;
  const seats = tall ? COLLECTION_TALL_SEATS : COLLECTION_SEATS;
  const vials = (tall ? collectionIds.slice(1, 4) : collectionIds)
    .map((id) => productById(id))
    .filter((product): product is Product => Boolean(product));
  const ids = vials.map((product) => product.id).join(" ");
  // The closer look's vial, on the collection's centre pedestal (Sequence.tsx). Without motion the look is told in
  // still frames below the opening; with the vial taken off sale, not at all, since the story is its lot's.
  const featuredAt = vials.findIndex((product) => product.id === FEATURED);
  const told = featuredAt >= 0;
  const seq = !still && told;
  // The room comes into focus once, as the page first opens on it (mist-word.css): not when the camera brings it back,
  // nor when motion is turned on again later, nor when the page is put back lower down (a reload there).
  const { key } = useLocation();
  const [dawn, setDawn] = useState(() => seq && !arrived && atTop(placeOnOpening(key)));
  // Whether it did, for as long as the opening stands: its vials were set down inside the haze, and keep that entrance
  // (mist-word.css) however the switch is turned afterwards, so it never plays again.
  const [dawned] = useState(dawn);
  // The haze behind the page while the room arrives (mist-word.css): only while the opening is on screen at the top.
  // It gives way to the wall as the arrival ends, or as soon as the reader goes on down the page.
  const [haze, setHaze] = useState(dawn);
  useEffect(() => {
    // The page's first paint is the room's own haze (vite.config.ts startHead); with the room drawn, it is put away.
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.removeAttribute("data-tm-dawn")));
    const timer = window.setTimeout(() => setDawn(false), DAWN_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (!haze) return;
    const away = () => {
      if (!atTop(window.scrollY)) setHaze(false);
    };
    const timer = window.setTimeout(() => setHaze(false), DAWN_MS);
    window.addEventListener("scroll", away, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", away);
    };
  }, [haze]);
  const softs = vials.map(softCutout);
  const ready = useSequenceReady(seq, softs.filter((src): src is string => Boolean(src)));
  // Each shown lot's record in the current world, which the caption reads. Found by its lot, so a set still loading
  // for the other shape of screen is never read as this one's.
  const records = useResource(() => Promise.all(vials.map((product) => store.lots.get(product.lot))), [ids]);
  const recordOf = (product: Product) => records.data?.find((record) => record?.lot === product.lot);
  const shown = vials.map(recordOf);
  // The caption is true of exactly these lots only while every one is released at 99% or better (plinth.ts):
  // while their records load it holds its place unseen; if one isn't, it isn't said.
  const caption = shown.some((record) => record === undefined) && records.loading ? "pending" : collectionVerified(shown) ? "shown" : "absent";

  // The words on the wall: the headline always, and on a landscape screen the lead and the way in opposite
  // it. The words on the floor: on a portrait screen, the way in (and on a portrait tablet the lead beside
  // it). A phone keeps only the headline on the wall and the way in on the floor, so its first screen holds
  // the whole headline, the room and both ways in; the lead and the caption follow beneath the room.
  const [words, setWords] = useState<{ wall: Words[]; floor: Words[] }>({ wall: [], floor: [] });
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    const measure = () => {
      // Where the words are laid out, not where they are drawn: the camera move drifts them as it runs.
      const rect = (part: HTMLElement | null): Words[] => {
        if (!part) return [];
        let left = 0, top = 0;
        for (let el: HTMLElement | null = part; el && el !== node; el = el.offsetParent as HTMLElement | null) {
          left += el.offsetLeft;
          top += el.offsetTop;
        }
        return [{ left, right: left + part.offsetWidth, top, bottom: top + part.offsetHeight }];
      };
      // The words on the floor are given as distances above the stage's foot, to which they are anchored.
      const fromFoot = (blocks: Words[]) => blocks.map((block) => ({ ...block, top: node.offsetHeight - block.top, bottom: node.offsetHeight - block.bottom }));
      const next = {
        wall: [...rect(head.current), ...(!tall && !phone ? [...(beneath ? [] : rect(lead.current)), ...rect(actions.current)] : [])],
        floor: tall ? fromFoot([...rect(actions.current), ...(phone ? [] : rect(lead.current))]) : [],
      };
      setWords((was) => (JSON.stringify(was) === JSON.stringify(next) ? was : next));
    };
    measure();
    void document.fonts?.ready.then(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    for (const part of [head.current, lead.current, actions.current]) if (part) observer.observe(part);
    return () => observer.disconnect();
  }, [tall, phone, beneath, seq]);

  // The wall's words, with room kept under the lowest for the word to rise into.
  const high = screen || size.h;
  const reserve = Math.round(tall ? high * WORD_ROOM.tall : Math.min(high * 0.1, Math.max(0, high - WORD_ROOM.from) * WORD_ROOM.wide));
  const lowest = Math.max(0, ...words.wall.map((block) => block.bottom));
  const reserved = words.wall.map((block) => (block.bottom === lowest ? { ...block, bottom: block.bottom + reserve } : block));
  // The room as large as it can stand with every vial, the face under its foot and a margin inside the first screen,
  // clear of the words (Rooms.tsx frameOpening).
  const frame = frameOpening({
    room,
    seats,
    tall,
    sw: size.w,
    screen: screen || size.h,
    wall: reserved,
    floor: tall ? words.floor.map((block) => ({ ...block, top: block.top + (phone ? FOOT_ROOM_PHONE : FOOT_ROOM) })) : [],
    clearance: CLEARANCE,
    footRoom: tall ? SCREEN_MARGIN : FOOT_ROOM,
    // A pixel's grace for the device's rounding of the plate's edges.
    margin: SCREEN_MARGIN + 1,
    band: BAND,
    focusY: tall ? TALL_FOCUS.y : BAND.focusY,
    minVial: MIN_VIAL,
    plateScale: PLATE_SCALE,
    // The pointer's depth moves a landscape room up to this far (rooms.css .tm-room-plate).
    drift: tall ? { x: 0, y: 0 } : DEPTH,
  });
  const box = frame.box;
  // The stage is as tall as the room covers of the first screen (or, beside words that need it, taller); the room is
  // filled softly around where it falls short of it.
  const featuredSeat = seats[featuredAt];
  const style = {
    ...(size.w && (screen || size.h) ? { "--tm-mist-height": `${Math.round(frame.stage)}px` } : {}),
    // The point the camera pushes in toward as the page scrolls on (stories.css): the featured vial's middle.
    ...(featuredSeat && box.width
      ? {
          "--tm-fly-x": `${(box.left + featuredSeat.x * box.width).toFixed(1)}px`,
          "--tm-fly-y": `${(box.top + (featuredSeat.y - featuredSeat.h * 0.5) * box.height).toFixed(1)}px`,
          "--tm-fly-zoom": String(FLY_ZOOM),
        }
      : {}),
    // Where the room's picture ends, below the stage's foot on a phone (mist-word.css: the floor starts there).
    ...(box.height ? { "--tm-room-foot": `${(box.top + box.height).toFixed(1)}px` } : {}),
  } as CSSProperties;

  // "Verified." stands on the room's back wall, behind the glass: its foot sinks behind the featured vial's shoulders,
  // and it grows up to the words above it, as large as that space and the screen allow.
  const word = (() => {
    if (!featuredSeat || !box.width || !size.w) return null;
    const wall = Math.max(0, ...words.wall.map((block) => block.bottom));
    const vial = featuredSeat.h * box.height * PLATE_SCALE;
    const foot = box.top + box.height / 2 + (featuredSeat.y - 0.5) * box.height * PLATE_SCALE;
    const base = foot - vial * (1 - WORD.sink);
    const font = Math.min((base - wall - WORD.gap) / WORD.cap, (size.w * WORD.span) / WORD.em);
    if (font < 40) return null;
    return {
      "--tm-word-x": `${(size.w / 2 - box.left).toFixed(1)}px`,
      "--tm-word-y": `${(base - box.top).toFixed(1)}px`,
      "--tm-word-size": `${font.toFixed(1)}px`,
    } as CSSProperties;
  })();

  useDepth(stage, !still && !tall);

  // The camera's view of this room (flight.ts): where the plate is, the vials on it and the words (and way in) that leave.
  useLayoutEffect(() => {
    const node = stage.current;
    const plate = node?.querySelector<HTMLElement>(".tm-room-plate");
    if (slot < 0 || !node || !plate || !size.w || !box.width) return;
    const seated = new Map<string, { el: HTMLElement; glass: HTMLElement; seat: (typeof seats)[number]; pedestal: number }>();
    vials.forEach((product, i) => {
      const el = plate.querySelector<HTMLElement>(`[data-product-id="${CSS.escape(product.id)}"]`);
      const glass = el?.querySelector<HTMLElement>(".tm-room-vial-glass");
      if (el && glass && seats[i]) seated.set(product.id, { el, glass, seat: seats[i], pedestal: i });
    });
    // The stage's Motion switch is the opening's own too: it leaves with the words.
    const parts: (HTMLElement | null)[] = [head.current, lead.current, actions.current, foot.current, node.querySelector<HTMLElement>(".tm-seq-switch-rest")];
    const copy = parts.filter((el): el is HTMLElement => Boolean(el));
    return registerHome({
      slot,
      stage: node,
      plate,
      box,
      vials: seated,
      copy,
      cue: plate.querySelector<HTMLElement>(".tm-story-cue"),
      still: plate.querySelector<HTMLImageElement>(".tm-room-still"),
      room,
      focus: plate.querySelector<HTMLElement>(".tm-room-focus"),
    });
    // The scene is the same while its layout is: re-registered only when the plate moves or the vials change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, size.w, size.h, box.left, box.top, box.width, box.height, tall, phone, ids, seq]);

  // The product's room and its vial at product size are made ready once the opening has loaded, so the move
  // never waits for them; pointing at a vial (or reaching it by keyboard) readies its own at once.
  useEffect(() => {
    if (!allowed) return;
    // A possible next page should not consume a data-saving visitor's connection.
    // Intent still readies the same product through RoomVial's onNear callback.
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || (connection?.effectiveType && connection.effectiveType !== "4g") || matchMedia("(prefers-reduced-data: reduce)").matches) return;
    let idle = 0;
    // Safari has no idle callback: a moment after load does.
    const later = typeof window.requestIdleCallback === "function";
    const ready = () => {
      const run = () => { for (const id of ids.split(" ")) if (id) preloadProduct(id); };
      idle = later ? window.requestIdleCallback(run, { timeout: 4000 }) : window.setTimeout(run, 1200);
    };
    if (document.readyState === "complete") ready();
    else window.addEventListener("load", ready, { once: true });
    return () => {
      window.removeEventListener("load", ready);
      if (later) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [allowed, ids]);

  // The page's end is marked while the footer can be seen, and the colour under a phone's toolbar set from it
  // (mist-word.css): Safari takes that colour up only as the page's state changes, never along a scroll's animation.
  useEffect(() => {
    if (!tall) return;
    const footer = document.querySelector("footer.tm-footer");
    if (!footer) return;
    const root = document.documentElement;
    const seen = new IntersectionObserver(([entry]) => root.toggleAttribute("data-tm-at-foot", entry.isIntersecting));
    seen.observe(footer);
    return () => {
      seen.disconnect();
      root.removeAttribute("data-tm-at-foot");
    };
  }, [tall]);

  // A vial opens its product as one camera move; with a modifier key, or while product pages ask a live
  // visitor to sign in first, it is simply the link it is.
  const open = (product: Product) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // The featured vial tells its own story: the camera comes in to it, and the story plays (Sequence.tsx).
    if (seq && ready && product.id === FEATURED) {
      event.preventDefault();
      openStory();
      return;
    }
    if (!allowed) return;
    if (flyToProduct(product.id, event.currentTarget)) event.preventDefault();
  };

  const lede = (
    <p className="tm-mist-lead" ref={lead}>
      Research compounds supplied as lyophilized powder, independently tested on receipt, quarantined
      until release, and traceable from the vial in your hand back to the source batch.
    </p>
  );
  // True of exactly these lots, read from their records (above); scripts/collection-caption.test.ts holds the rule
  // to it, and scripts/hero-shelf.test.ts the collection. Unsaid, its line keeps its place unseen (mist.css), so nothing
  // on the page moves when it goes, and its words are nowhere in the page's text.
  const proof = caption === "absent" ? (
    <p className="tm-mist-proof" data-absent="" aria-hidden="true" />
  ) : (
    <p className="tm-mist-proof" data-pending={caption === "pending" ? "" : undefined} aria-hidden={caption === "pending" ? true : undefined}>
      Every lot shown tested ≥99% by HPLC
    </p>
  );
  const way = (
    <div className="tm-mist-way" ref={actions}>
      {/* Both ways in keep the chat's corner mark off them (assistant/Assistant.tsx KEEP_CLEAR): on a phone they span
          the foot of the screen, the second one under the mark's corner. */}
      <div className="tm-actions tm-mist-actions" data-keep-clear="">
        <Link className="tm-button tm-button-primary" to="/products">
          View catalog
        </Link>
        <Link className="tm-button tm-button-outline" to="/verify">
          Verify a lot
        </Link>
      </div>
      {!beneath && proof}
    </div>
  );
  // The stage: the room and the words on it. With motion, the film's track holds it in view as the camera moves.
  const scene = (
    <div className="tm-mist-stage" ref={stage} style={style} data-fill={frame.fill ? "" : undefined}>
      <span className="tm-mist-screen" ref={screenSizer} aria-hidden="true" />
      {/* Where the room falls short of the stage (a short, wide window): the same room, far softer, all around it. */}
      {frame.fill && <img className="tm-mist-fill" src={roomMedia(room).poster} alt="" aria-hidden="true" draggable={false} />}
      <div className="tm-mist-copy">
        <div className="tm-mist-head" ref={head}>
          <p className="tm-pill-eyebrow">
            <span className="tm-brand-dot" aria-hidden="true" />
            Lot-level traceability
          </p>
          <h1 id="tm-mist-title" className="tm-bhero-title" data-word={word ? "" : undefined}>
            <span className="tm-bhero-line" style={{ "--tm-i": 0 } as CSSProperties}>
              <span>True research.</span>
            </span>
            <span className="tm-bhero-line" style={{ "--tm-i": 1 } as CSSProperties}>
              <span>True precision.</span>
            </span>
            <span className="tm-bhero-line" style={{ "--tm-i": 2 } as CSSProperties}>
              <span>
                Verified
                <BrandDot />
              </span>
            </span>
          </h1>
        </div>
        {phone ? way : (
          <div className="tm-mist-aside">
            {!beneath && lede}
            {way}
          </div>
        )}
      </div>
      <SequenceCamera>
        <Plate box={box}>
          {/* The loop's first frame under the loop, while it loads. The loop and the mist are the room's, lent to
              whichever page shows it (share.ts); the lens's focus comes on only as the camera moves to a pedestal. */}
          <img className="tm-room tm-room-still" src={roomMedia(room).poster} alt="" aria-hidden="true" draggable={false} />
          <RoomLoop room={room} still={still} />
          {/* "Verified." on the back wall, in the photograph's own light (mist-word.css), and the floor mist. */}
          <div className="tm-mist-light" style={word ?? undefined} data-word={word ? "" : undefined}>
            {word && (
              <span className="tm-mist-word" aria-hidden="true">
                <span className="tm-mist-word-ink" data-text="Verified">
                  Verified
                  <BrandDot />
                </span>
              </span>
            )}
            <FrontMist still={still} room={room} tune={ROOM_FOG} />
          </div>
          <RoomFocus room={room} pedestal={null} blur={0} />
          {seq && <SequenceRoom room={room} tall={tall} pedestal={featuredAt} ready={ready} />}
          {vials.map((product, i) => (
            <RoomVial
              key={product.id}
              product={product}
              seat={seats[i]}
              lit={told ? (tall ? VIAL_LIGHT.tall : VIAL_LIGHT.wide)[Math.abs(i - featuredAt)] : 1}
              to={`/product/${product.id}`}
              delay={i}
              soft={seq && ready ? softs[i] : undefined}
              shade={seq && ready ? vialShadow(tall) : undefined}
              onOpen={open(product)}
              onNear={() => { if (allowed) preloadProduct(product.id); }}
            />
          ))}
          {seq && featuredSeat && (
            <button
              type="button"
              className="tm-story-cue"
              style={{ "--seat-x": featuredSeat.x, "--seat-y": featuredSeat.y, "--vial-h": featuredSeat.h } as CSSProperties}
              disabled={!ready}
              onClick={openStory}
            >
              <span className="tm-story-cue-dot" aria-hidden="true" />
              Look closer
            </button>
          )}
        </Plate>
        {seq && <span className="tm-seq-floor" aria-hidden="true" />}
      </SequenceCamera>
      {/* The fog the camera flies into as the page scrolls on past the room, which clears onto the page below. */}
      {seq && <span className="tm-fly-fog" aria-hidden="true" />}
      <MotionSwitch className="tm-seq-switch-rest" keepClear />
    </div>
  );
  return (
    <>
      <section className="tm tm-mist" aria-labelledby="tm-mist-title" data-shape={tall ? "tall" : "wide"} data-arrived={arrived ? "" : undefined} data-seq={seq ? "" : undefined} data-dawn={dawn && seq ? "" : undefined} data-dawn-haze={haze && seq ? "" : undefined} data-dawned={dawned ? "" : undefined}>
        <SequenceTrack on={seq} scene={{ box, plateScale: PLATE_SCALE, seat: seats[featuredAt], tall }} lead={null} ready={ready}>
          {scene}
        </SequenceTrack>
        {beneath && (
          <div className="tm-mist-foot" ref={foot}>
            {lede}
            {proof}
          </div>
        )}
      </section>
      {told && !seq && <SequenceStills />}
    </>
  );
}
