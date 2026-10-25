import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, X, ZoomIn } from "lucide-react";
import { claimText, contentValue, labLink, LAB, PURITY_MINIMUM, resultGroups, splitLabel, PURITY_SPEC } from "../../platform/certificate-records";
import { hplcPurity } from "../../platform/certificates";
import { stockProblem } from "../../platform/commerce";
import { useReleasedLots } from "../../platform/released";
import type { Lot, LotResult } from "../../platform/types";
import { LIVE } from "../../platform/mode";
import { categoryName, money, products } from "../../data";
import type { Product } from "../../data";
import { compoundsForBrowsing, describe, productCutout, researchUseNote, specFor, traceability } from "../catalog";
import { useShop } from "../context";
import { labelPrintsLot } from "../label-art";
import { recordFromLot } from "../records";
import { SheetSkirt, useScrollLock, useSheetDrag, useSheetFocus, useSheetPresence, useVisibleViewport, viewportBox } from "../sheet";
import { announceMobileAdd } from "../MobileAdd";
import { useMediaQuery, usePrefersReducedMotion, useReveal } from "../motion";
import { ProductName, ProofFigures, Quantity, tone } from "../ui";
import { certificateDate } from "../../brand/Certificate";
import { CertificateDialog } from "../../brand/CertificateDialog";
import { ContinueExploring } from "../../brand/ContinueExploring";
import { arrivedByFade, arrivedByFlight, flyBack, registerProduct, STACKED } from "../../brand/flight";
import { useAfterFlight, useArrivedByFlight, useFlightSlot } from "../../brand/FlightViews";
import { collectionIds } from "../../brand/carousel";
import { FOCUS, FOG_SCENES } from "../../brand/fog";
import { TALL_SCREEN } from "../../brand/opening-media";
import { ProductStage } from "../../brand/ProductStage";
import { COLLECTION, COLLECTION_SEATS, COLLECTION_TALL, COLLECTION_TALL_SEATS, openingScale, useStageSize, VIAL_RATIO } from "../../brand/Rooms";
import type { Box, Room, Seat } from "../../brand/Rooms";
import { SequenceChain } from "../../brand/SequenceChain";
import { openedFrom, stepBack } from "../../Navigation";
import "../product-room.css";

/*
 * Every product stands in the collection's room, the room the opening shows: the camera close on one of its pedestals.
 * On a wide screen the opening's own products stand on their own pedestals; every other product stands on the centre
 * one (the tallest), where the opening's vial would be. A phone held upright sees the room's tall cut, as the opening
 * does there, with its middle three pedestals: there every product stands on the centre one, since the tall cut has too
 * little room beside its outer two for a vial on them to stand in the middle of the screen. The one exception is the
 * opening's camera move: a vial it carries the reader to stays on the pedestal it was taken from, so the move is one
 * unbroken shot (flight.ts geometry needs the same pedestal at both ends).
 */
/** The room the opening shows on this screen (MistOpening.tsx): the tall cut on a phone held upright. */
const TALL_ROOM = TALL_SCREEN;
/** The pedestal off-opening products stand on: the centre one. */
const CENTRE = { wide: 2, tall: 1 };

/** On a wide screen the vial stands at most this share of its stage tall, and its foot at least this far down it; its
 *  cap at least CAP_CLEAR below the way back ("The collection"), in px. */
const WIDE_VIAL = 0.5;
const WIDE_FOOT = 0.64;
const CAP_CLEAR = 24;
/** The least room between the pedestal's side and the details' column, in px. */
const PEDESTAL_CLEAR = 48;
/** On a phone, the vial's cap stands this share of the room's height below its top, and the vial at most this share of
 *  it tall: the room is cut short enough for the name, the price and Add to cart to share the first screen. */
const STACK_CAP = 0.1;
const STACK_VIAL = 0.62;
/** On a phone, a cap that stands under the way back keeps this far below it, in px. */
const STACK_CLEAR = 8;
/** If the room can't cover the stage with the vial where it should stand, the camera comes this much closer, again. */
const CLOSER = 1.02;
/**
 * The details stand on the side of the room with the most of the room beside the pedestal. The room runs out about
 * 620 of its pixels right of the rightmost pedestal: with the details on the right, the camera would have to come far
 * closer (or stand the vial against them) for the room to reach the stage's right edge on a wide window. So that
 * pedestal has its details on the left; every other one keeps them on the right.
 */
const DETAILS_LEFT = new Set([4]);
/** With its details on the left, that pedestal stands this share of the window nearer the middle than the middle of its
 *  side of the room, so the frame holds together (the room still covers it, and the details keep their clearance). */
const PULL_LEFT = 0.065;

type Framing = { box: Box; seat: Seat; zoom: number };

/**
 * The camera's framing of one pedestal of the room, beside the details: the vial at most WIDE_VIAL of the stage tall,
 * its foot at least WIDE_FOOT down and its cap at least CAP_CLEAR below the way back (`capLine`), centred in the room's
 * side of the stage. The room must cover the stage: the vial moves toward the details if it must (its pedestal keeping
 * PEDESTAL_CLEAR from them), and only then does the camera come closer.
 */
function sideRoom(sw: number, sh: number, room: Room, seat: Seat, half: number, side: "left" | "right", edge: number, capLine: number): Box {
  const vialOf = (p: number) => seat.h * room.h * p;
  let p = (WIDE_VIAL * sh) / (seat.h * room.h);
  const aim = side === "right" ? edge / 2 : edge + (sw - edge) / 2 - PULL_LEFT * sw;
  let x = aim;
  let y = 0;
  for (let i = 0; i < 80; i++, p *= CLOSER) {
    const W = room.w * p, H = room.h * p;
    y = Math.max(WIDE_FOOT * sh, capLine + vialOf(p));
    if (y - seat.y * H > 0 || y + (1 - seat.y) * H < sh) continue;
    const min = Math.max(sw - (1 - seat.x) * W, side === "left" ? edge + PEDESTAL_CLEAR + half * p : -Infinity);
    const max = Math.min(seat.x * W, side === "right" ? edge - PEDESTAL_CLEAR - half * p : Infinity);
    if (min > max) continue;
    x = Math.min(max, Math.max(min, aim));
    break;
  }
  return { left: x - seat.x * room.w * p, top: y - seat.y * room.h * p, width: room.w * p, height: room.h * p };
}

/**
 * The camera's framing on a phone: the vial above the details, its foot where it always stands and its cap a little
 * below the room's top, centred as nearly as the room allows. The room's outer pedestals have too little room beside
 * them to be centred, so their vials stand toward the screen's side; one that would then stand under the way back
 * (`back`: its sides and the line its cap keeps below it) stands a little shorter, its foot where it was.
 */
function stackRoom(sw: number, sh: number, room: Room, seat: Seat, back: { left: number; right: number; line: number }): Box {
  const foot = (STACK_CAP + STACK_VIAL) * sh;
  let p = (STACK_VIAL * sh) / (seat.h * room.h);
  let x = sw / 2;
  for (let i = 0; i < 80; i++) {
    const W = room.w * p, H = room.h * p;
    const vial = seat.h * H;
    if (foot - seat.y * H > 0 || foot + (1 - seat.y) * H < sh) { p *= CLOSER; continue; }
    const min = sw - (1 - seat.x) * W, max = seat.x * W;
    if (min > max) { p *= CLOSER; continue; }
    x = Math.min(max, Math.max(min, sw / 2));
    const half = (vial * VIAL_RATIO) / 2;
    const under = back.line > 0 && x - half < back.right && x + half > back.left;
    if (!under || foot - vial >= back.line - 0.5) break;
    p = (foot - back.line) / (seat.h * room.h);
  }
  return { left: x - seat.x * room.w * p, top: foot - seat.y * room.h * p, width: room.w * p, height: room.h * p };
}

/**
 * A product, standing in its own room. The first screen is the room: the vial on its pedestal and, beside
 * it on a wide screen (below it on a phone), the details a buyer needs: the class, the name and size, the
 * current lot and its HPLC purity, its certificate, the price, the quantity and Add to cart, the client's
 * research-use notice and a short specification. Below: the full specification, the lot's certificate,
 * the standard behind every vial, and the rest of the collection.
 *
 * From the opening's vials the page arrives as one camera move (src/brand/flight.ts); it registers its room
 * so the camera can carry it in, and holds back what lies below the first screen until the move settles.
 *
 * `signInToOrder` is a live visitor who isn't signed in. The page is open to them (the landing's vials carry everyone
 * in), but pricing and ordering belong to research accounts: an account prompt stands where the price, the quantity
 * and Add to cart would. Their catalog (catalog_showcase) carries no prices.
 */
export default function ProductPage({ signInToOrder = false }: { signInToOrder?: boolean }) {
  const { id } = useParams();
  const product = products.find((p) => p.id === id && p.active !== false);
  if (!product) {
    return (
      <div className="tm-page">
        <section className="tm">
          <div className="tm-empty-page">
            <p className="tm-eyebrow">Not found</p>
            <h1 className="tm-display">
              That compound
              <br />
              <span>isn’t in the collection.</span>
            </h1>
            <Link className="tm-textlink" to="/products">
              Browse the collection <ArrowRight size={16} strokeWidth={1.6} />
            </Link>
          </div>
        </section>
      </div>
    );
  }
  return <ProductRoom product={product} signInToOrder={signInToOrder} />;
}

function ProductRoom({ product, signInToOrder }: { product: Product; signInToOrder: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { add, cart } = useShop();
  const [quantity, setQuantity] = useState(1);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useReveal(root, product.name);
  const released = useReleasedLots();
  const stacked = useMediaQuery(STACKED);
  const still = usePrefersReducedMotion();
  const size = useStageSize(scene);
  const slot = useFlightSlot();
  const arrived = useArrivedByFlight();
  const settled = useAfterFlight();
  // The page the opening's move pushed: "The collection" takes the camera back out to it.
  const enteredByMove = arrivedByFlight(location);
  const enteredByCamera = enteredByMove && !arrivedByFade(location);

  const siblings = products.filter((p) => p.name === product.name && p.active !== false);
  const index = Math.max(0, siblings.indexOf(product));
  const [slide, setSlide] = useState({ index, prev: -1, name: product.name });
  if (slide.index !== index || slide.name !== product.name) {
    // Same compound: crossfade between sizes. New compound: cut cleanly.
    setSlide({ index, prev: slide.name === product.name ? slide.index : -1, name: product.name });
  }
  useEffect(() => {
    setQuantity(1);
  }, [product.id]);

  // The room the opening shows on this screen, and the pedestal this product stands on: on a wide screen the opening's
  // own, found by name so every size of a compound stands where it does, or the centre one; on a phone held upright,
  // the centre one, so every vial stands in the middle of the screen, unless the opening's camera brought the reader
  // here, when the vial stays where the camera came to it (a fade from the collection has no camera to keep up with).
  const tall = useMediaQuery(TALL_ROOM);
  const room = tall ? COLLECTION_TALL : COLLECTION;
  const seats = tall ? COLLECTION_TALL_SEATS : COLLECTION_SEATS;
  const shownIds = tall ? collectionIds.slice(1, 4) : collectionIds;
  const own = tall && !enteredByCamera ? -1 : shownIds.findIndex((shownId) => products.find((p) => p.id === shownId)?.name === product.name);
  const pedestal = own >= 0 ? own : tall ? CENTRE.tall : CENTRE.wide;
  const seat = seats[pedestal];
  const half = (tall ? FOG_SCENES.collectionTall : FOG_SCENES.collection).pedestals[pedestal].half;
  const side = stacked ? null : !tall && DETAILS_LEFT.has(pedestal) ? "left" : "right";
  // Where the details' column meets the room's side of the stage, the line the vial's cap keeps below the way back, and
  // the first screen's height (the opening's stage, for the mist's zoom): their layout, never their rise.
  const panel = useRef<HTMLDivElement>(null);
  const backLink = useRef<HTMLAnchorElement>(null);
  const [edges, setEdges] = useState({ column: 0, capLine: 0, backLeft: 0, backRight: 0, screen: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      const back = backLink.current, column = panel.current, stage = scene.current;
      const next = {
        column: stacked || !column ? 0 : side === "left" ? column.offsetLeft + column.offsetWidth : column.offsetLeft,
        capLine: back ? back.offsetTop + back.offsetHeight + (stacked ? STACK_CLEAR : CAP_CLEAR) : 0,
        backLeft: back ? back.offsetLeft : 0,
        backRight: back ? back.offsetLeft + back.offsetWidth : 0,
        screen: stage ? Math.round(Math.min(1280, Math.max(544, window.innerHeight - (stage.getBoundingClientRect().top + window.scrollY)))) : 0,
      };
      setEdges((was) => (Object.keys(next) as (keyof typeof next)[]).every((key) => was[key] === next[key]) ? was : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const el of [scene.current, backLink.current, panel.current]) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [stacked, side]);
  const framing: Framing | null = !size.w || !size.h ? null : (() => {
    const box = stacked ? stackRoom(size.w, size.h, room, seat, { left: edges.backLeft, right: edges.backRight, line: edges.capLine })
      : sideRoom(size.w, size.h, room, seat, half, side ?? "right", edges.column || size.w * (side === "left" ? 0.42 : 0.58), edges.capLine);
    // How much closer than the opening this frames the room (the opening's stage is the first screen).
    const zoom = box.width / room.w / openingScale(room, size.w, stacked ? edges.screen || size.h : size.h);
    return { box, seat, zoom };
  })();
  const box = framing?.box ?? null;
  const foot = box ? { x: box.left + seat.x * box.width, y: box.top + seat.y * box.height } : null;
  const [labelOpen, setLabelOpen] = useState(false);

  // The room, for the opening's camera (flight.ts): the plate it carries in, the layers that arrive, the vial
  // that travels and the details that rise, in order.
  useLayoutEffect(() => {
    const page = root.current, stage = scene.current;
    const plate = stage?.querySelector<HTMLElement>(".tm-proom-plate");
    const parts = {
      room: stage?.querySelector<HTMLElement>(".tm-proom-room"),
      fade: stage?.querySelector<HTMLElement>(".tm-proom-fade"),
      ground: page?.querySelector<HTMLElement>(".tm-room-page-ground"),
      glass: stage?.querySelector<HTMLElement>(".tm-proom-glass"),
      contact: stage?.querySelector<HTMLElement>(".tm-proom-contact"),
    };
    if (slot < 0 || !page || !stage || !plate || !box || !parts.room || !parts.fade || !parts.ground || !parts.glass || !heading.current) return;
    return registerProduct({
      slot,
      id: product.id,
      scene: stage,
      plate,
      box,
      seat,
      framed: room,
      pedestal,
      room: parts.room,
      fade: parts.fade,
      ground: parts.ground,
      glass: parts.glass,
      contact: parts.contact ?? null,
      image: stage.querySelector<HTMLImageElement>(".tm-proom-glass img.is-active"),
      still: stage.querySelector<HTMLImageElement>(".tm-proom-still"),
      rise: [...page.querySelectorAll<HTMLElement>(".tm-proom [data-rise]")],
      heading: heading.current,
    });
    // Re-registered when the room is laid out again, its vial resized, or the product changes; its parts are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, product.id, stacked, room, pedestal, box?.left, box?.top, box?.width, box?.height, seat.h]);

  const unavailable = stockProblem(product, quantity + (cart.find((item) => item.id === product.id)?.quantity ?? 0));
  const spec = specFor(product);
  // The same list while the page stands (the rail measures itself whenever its list changes).
  const others = useMemo(() => compoundsForBrowsing.filter((c) => c.name !== product.name), [product.name, compoundsForBrowsing]);
  // The current lot's record, once it arrives. A lot still in testing has none, and then no lot line shows.
  const lot = released.data?.find((entry) => entry.lot === product.lot);
  const certificate = lot ? recordFromLot(lot) : null;
  // Until the records first arrive, the lot line keeps its place unseen, so the room never shifts when it lands.
  const waiting = released.loading && !released.data;
  const purity = lot ? hplcPurity(lot) : undefined;
  const groups = lot ? resultGroups(lot.results) : [];
  const single = groups.length === 1 ? groups[0] : undefined;
  // A blend's every component, each figure named: never only its lowest (the client's request, October 2026).
  const parts = groups.filter((g) => g.purity);

  const compact: [string, string][] = spec.cas
    ? [["CAS", spec.cas], ["Formula", spec.formula ?? ""], ["Mol. weight", spec.weight ?? ""], ["Storage", spec.storage]]
    : [
        ["Form", spec.form],
        ["Storage", spec.storage],
        ...(single?.content ? [["Content, this lot", `${contentValue(single.content)}${single.content.unit === "mg per vial" ? " per vial" : ""}`] as [string, string]] : []),
        ...(groups.length && groups.every((g) => g.identity) ? [["Identity, this lot", groups[0].identity!.value] as [string, string]] : []),
      ];

  const rows: [string, ReactNode][] = [
    ["Compound", product.name],
    ["Class", categoryName(product.category)],
    ["Presentation", `${product.size} per vial`],
    ["Form", spec.form],
    ["CAS number", spec.cas],
    ["Molecular formula", spec.formula],
    ["Molecular weight", spec.weight],
    ["Sequence", spec.sequence],
    ["Blend", spec.blend],
    ["Purity specification", product.category === "lab-supplies" ? undefined : `≥${PURITY_SPEC}% (HPLC)`],
    ...lotRows(lot?.results, "purity"),
    ["Identity method", product.category === "lab-supplies" ? undefined : "Mass spectrometry"],
    ...lotRows(lot?.results, "identity"),
    ...lotRows(lot?.results, "content"),
    ["Storage", spec.storage],
    ["Documentation", "Lot-specific certificate of analysis"],
    ["Intended use", "Laboratory research only"],
  ];

  // The current lot and its result, read from its certificate record. Without a released record, nothing: no
  // lot line, no figure. With sizes to choose from, it follows the price, since its lot is the chosen size's.
  const proof = (
    <div className="tm-proom-proof" data-rise="" data-waiting={waiting ? "" : undefined} aria-hidden={waiting || undefined}>
      {(waiting || (lot && certificate)) && (
        <>
          <dl className="tm-proom-record">
            <div>
              <dt>Lot</dt>
              <dd className="tm-mono">{product.lot}</dd>
            </div>
            {(waiting || purity) && (
              <div>
                <dt>HPLC purity</dt>
                {parts.length > 1 ? (
                  <dd className="tm-mono tm-proom-parts">
                    {parts.map((g) => (
                      <span key={g.component}>
                        {g.purity!.value}%<small>{g.component}</small>
                      </span>
                    ))}
                  </dd>
                ) : (
                  <dd className="tm-mono">
                    {purity ? `${purity.value}%` : "\u00a0"}<small>this lot</small>
                  </dd>
                )}
              </div>
            )}
          </dl>
          <button type="button" className="tm-textlink" onClick={() => setCertificateOpen(true)} aria-haspopup="dialog" disabled={waiting}>
            Read this lot’s certificate <ArrowRight size={15} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );

  const back = enteredByMove ? "/" : "/products";
  return (
    <div className="tm-page tm-room-page" style={tone(product)} ref={root}>
      {/* The page the room ends on. It arrives with the room, so the first screen is never two pages at once. */}
      <div className="tm-room-page-ground" style={{ top: size.h || undefined }} />
      <section className="tm tm-proom" aria-labelledby="tm-product-title" data-side={side ?? undefined}>
        <div className="tm-proom-scene" ref={scene}>
          <ProductStage
            items={siblings}
            index={slide.index}
            prev={slide.prev}
            box={box}
            seat={seat}
            room={room}
            pedestal={pedestal}
            focus={box ? (FOCUS.blur * box.width) / room.w : 0}
            zoom={framing?.zoom ?? 1}
            still={still}
            arrived={arrived}
          />
          <div className="tm-proom-fade" aria-hidden="true" />
        </div>
        <Link
          className="tm-proom-back"
          to={back}
          ref={backLink}
          data-rise=""
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            // Brought here by the opening's camera: the camera takes you back out.
            if (enteredByMove && flyBack()) event.preventDefault();
            // Opened from the collection: back to it, where it was left, rather than to a fresh copy at its top.
            else if (!enteredByMove && openedFrom(location.key, "/products")) {
              event.preventDefault();
              stepBack();
            }
          }}
        >
          <ArrowLeft size={16} strokeWidth={1.6} aria-hidden="true" />
          The collection
        </Link>

        <div className="tm-proom-panel" ref={panel}>
          {/* The pane of frosted glass the details stand on (product-room.css). It rises with them. */}
          <span className="tm-proom-pane" data-rise="" aria-hidden="true" />
          <p className="tm-eyebrow tm-proom-class" data-rise="">
            <Link to={`/products?class=${product.category}`}>{categoryName(product.category)}</Link>
          </p>
          <h1 id="tm-product-title" className="tm-proom-name" tabIndex={-1} ref={heading} data-rise="">
            <span><ProductName name={product.name} /></span>{" "}
            <span className="tm-proom-size">{product.size}</span>
          </h1>
          {/* The client's own subtitle for the compound, where it has one ("Pentadecapeptide"). */}
          {spec.descriptor && (
            <p className="tm-proom-descriptor" data-rise="">
              {spec.descriptor} <span aria-hidden="true">·</span> {product.size} <span aria-hidden="true">·</span> {product.form}
            </p>
          )}

          {/* On a phone the price and Add to cart come first, so they share the first screen with the name. */}
          {siblings.length === 1 && !stacked && proof}

          {siblings.length > 1 && (
            <fieldset className="tm-sizes tm-proom-sizes" data-rise="">
              <legend>Size</legend>
              <div>
                {siblings.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={s.id === product.id}
                    onClick={() =>
                      navigate(`/product/${s.id}`, { replace: true, state: { keepScroll: true, flight: enteredByMove || undefined, fade: arrivedByFade(location) || undefined } })
                    }
                  >
                    {s.size}
                    {s.price !== undefined && <span>{money(s.price)}</span>}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="tm-proom-buy" data-rise="">
            {signInToOrder ? (
              <>
                <p className="tm-proom-account">Pricing and ordering open with a research account.</p>
                <Link className="tm-button tm-button-primary tm-button-wide tm-proom-signin" to="/access/apply">
                  Create an account to order
                </Link>
                <p className="tm-proom-account">
                  Already have one?{" "}
                  <Link className="tm-inline-link" to="/access" state={{ from: location.pathname }}>
                    Sign in
                  </Link>
                </p>
              </>
            ) : product.price !== undefined && (
              <>
                <p className="tm-proom-price">
                  <strong>{money(product.price)}</strong>
                  <span>per vial</span>
                </p>
                {product.stock === 0 && <p className="tm-proom-stock" role="status">Out of stock</p>}
                {unavailable && product.stock !== 0 && <p className="tm-field-error" role="status">{unavailable}</p>}
                <div className="tm-buy-row">
                  <Quantity value={quantity} onChange={setQuantity} label="Quantity" />
                  <button
                    type="button"
                    className="tm-button tm-button-primary tm-button-wide"
                    disabled={Boolean(unavailable)}
                    onClick={() => {
                      add(product.id, quantity);
                      announceMobileAdd(product.id, scene.current?.querySelector<HTMLImageElement>(".tm-proom-glass img.is-active"));
                    }}
                  >
                    Add to cart
                  </button>
                </div>
              </>
            )}
            {!LIVE && <p className="tm-fineprint">Design preview. No order is placed and no payment is collected.</p>}
          </div>

          {(siblings.length > 1 || stacked) && proof}

          <p className="tm-proom-notice" data-rise="">{researchUseNote}</p>

          <dl className="tm-proom-spec" data-rise="">
            {compact.filter(([, value]) => value).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className={/CAS|Formula/.test(label) ? "tm-mono" : undefined}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* The label, up close: on the pedestal's face under the vial. After the details in reading order, so the
            keyboard meets it once the buying is done. */}
        <div className="tm-proom-zoom" style={foot ? { left: foot.x, top: foot.y } : undefined}>
          <button type="button" className="tm-proom-zoom-button" data-rise="" onClick={() => setLabelOpen(true)} aria-haspopup="dialog">
            <ZoomIn size={16} strokeWidth={1.6} aria-hidden="true" />
            Label detail
          </button>
        </div>
      </section>

      {/* Below the first screen. While the camera brings the page in, it waits: nothing of it is on screen. */}
      {settled && (
        <>
          <section className="tm tm-product-spec" aria-labelledby="tm-spec-title">
            <header className="tm-spec-head" data-reveal>
              <p className="tm-eyebrow">Specification</p>
              <h2 id="tm-spec-title" className="tm-heading">
                The essentials.
              </h2>
              <p className="tm-section-note">
                Identifiers and handling for {product.name}. Results for your lot are on its certificate.
              </p>
            </header>
            <div className="tm-proom-spec-body" data-reveal>
              <p className="tm-product-desc">{describe(product)}</p>
              <ul className="tm-buy-notes">
                <li>10 mL vial · Type I glass</li>
                <li>Shipped with temperature control when applicable</li>
                <li>Certificate of analysis for every lot</li>
              </ul>
              <dl className="tm-spec-table">
                {rows
                  .filter((row): row is [string, NonNullable<ReactNode>] => Boolean(row[1]))
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd className={/CAS|formula|Sequence/.test(label) ? "tm-mono" : undefined}>
                        {label === "Sequence" && typeof value === "string" ? <SequenceChain sequence={value} name={product.name} /> : value}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          </section>

          <LotSection product={product} lot={lot} loading={released.loading && !released.data} onOpen={() => setCertificateOpen(true)} />

          <section className="tm tm-product-proof" aria-labelledby="tm-product-proof-title">
            <header className="tm-section-head" data-reveal>
              <p className="tm-eyebrow">The standard</p>
              <h2 id="tm-product-proof-title" className="tm-heading">
                Behind every vial.
                <br />
                <span>On every certificate.</span>
              </h2>
              <Link className="tm-textlink" to="/quality">
                Read our standard <ArrowRight size={16} strokeWidth={1.6} />
              </Link>
            </header>
            <ProofFigures storage={product.category !== "lab-supplies"} />
            <div className="tm-traceability" data-reveal>
              <h3 className="tm-traceability-title">Testing and traceability</h3>
              <ul className="tm-traceability-list">
                {traceability(product).map(([title, text]) => (
                  <li key={title}>
                    <p className="tm-traceability-name">{title}</p>
                    <p className="tm-traceability-text">{text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="tm tm-product-more" aria-labelledby="tm-more-title">
            <ContinueExploring compounds={others} />
          </section>
        </>
      )}

      {certificateOpen && certificate && <CertificateDialog record={certificate} onClose={() => setCertificateOpen(false)} />}
      {labelOpen && <LabelDetail product={product} onClose={() => setLabelOpen(false)} />}
    </div>
  );
}

/** The modal layer the shop's dialogs share (styles.css, .modal-backdrop). */
const DIALOG_LAYER = 100;

/**
 * The supplied label, up close: the vial's own cut-out, untouched, cropped to its label and shown no larger than the
 * art itself, so it stays crisp. A dialog over the dimmed page on a wide screen, a sheet on a phone; Escape, the close
 * button or the page around it put it away, and focus goes back to the control that opened it.
 */
function LabelDetail({ product, onClose }: { product: Product; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  const titleId = useId();
  const seen = useVisibleViewport();
  const { state, requestClose } = useSheetPresence(onClose);
  // Leaving, it takes no taps or keys, and focus goes back as it begins to go.
  const leaving = state === "leaving";
  useScrollLock();
  useSheetFocus(panel, requestClose, "never", leaving);
  const drag = useSheetDrag(panel, requestClose, (target) => Boolean(target.closest(".tm-labeldlg-grab, .tm-labeldlg-head")));
  // "As printed on the vial" only where the art prints the lot this page sells (label-art.ts). CJC (No DAC) /
  // Ipamorelin's art is still the supplied 10 mg / 10 mg label, so it is named by its product and size alone.
  const printed = labelPrintsLot(product);
  return (
    <>
      <div
        className="tm-labeldlg"
        data-state={state}
        inert={leaving}
        style={viewportBox(seen, "tm-sheet")}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) requestClose();
        }}
      >
        <section ref={panel} className="tm tm-labeldlg-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} {...drag}>
          <span className="tm-labeldlg-grab" aria-hidden="true" />
          <header className="tm-labeldlg-head">
            <p className="tm-eyebrow">Label detail</p>
            <h2 id={titleId} className="tm-labeldlg-title">
              <ProductName name={product.name} /> <span>{product.size}</span>
            </h2>
          </header>
          <div className="tm-labeldlg-label">
            <img
              src={productCutout(product, "lg")}
              alt={printed ? `The label of ${product.name} ${product.size}, lot ${product.lot}, as printed on the vial` : `The label of ${product.name}, ${product.size}`}
              draggable={false}
            />
          </div>
          <p className="tm-labeldlg-lot">
            {printed ? <>Lot <span className="tm-mono">{product.lot}</span>, as printed on the vial</> : `${product.name}, ${product.size}`}
          </p>
          <button type="button" className="tm-labeldlg-close" aria-label="Close label detail" onClick={requestClose}>
            <X size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </section>
      </div>
      <SheetSkirt seen={seen} state={state} layer={DIALOG_LAYER} />
    </>
  );
}

/**
 * The current lot, below the first screen: its certificate's figures as the record gives them, and the ways to
 * read the certificate itself. A lot without a released record shows its number and where to look it up.
 */
function LotSection({ product, lot, loading, onOpen }: { product: Product; lot: Lot | undefined; loading: boolean; onOpen: () => void }) {
  const record = lot ? recordFromLot(lot) : null;
  const groups = lot ? resultGroups(lot.results) : [];
  const purity = lot ? hplcPurity(lot) : undefined;
  const parts = groups.filter((g) => g.purity);
  const identity = groups.find((g) => g.identity)?.identity;
  const lab = labLink(lot?.reference);
  const contents = groups.filter((g) => g.content);
  return (
    <section className="tm tm-proom-lot" id="certificate" aria-labelledby="tm-lot-title" tabIndex={-1}>
      <header className="tm-spec-head" data-reveal>
        <p className="tm-eyebrow">Current lot</p>
        <h2 id="tm-lot-title" className="tm-heading tm-proom-lot-number">{product.lot}</h2>
        {lot && record ? (
          <p className="tm-section-note">
            Certificate <span className="tm-mono">{lot.reference}</span>, from {LAB.name}, {LAB.description}.
          </p>
        ) : !loading ? (
          <p className="tm-section-note">This lot’s certificate is published here once its laboratory results are released.</p>
        ) : null}
      </header>
      <div className="tm-proom-lot-body" data-reveal>
        {lot && record ? (
          <>
            <dl className="tm-proom-figures">
              {purity && (
                <div>
                  <dt>HPLC purity</dt>
                  {parts.length > 1 ? (
                    <dd>
                      {parts.map((g) => (
                        <span key={g.component} className="tm-figure tm-figure-part">
                          {g.purity!.value}<small>%</small>
                          <span className="tm-figure-name">{g.component}</span>
                        </span>
                      ))}
                      <span className="tm-figure-text">Specification ≥{PURITY_MINIMUM}% for each component</span>
                    </dd>
                  ) : (
                    <dd>
                      <span className="tm-figure">{purity.value}<small>%</small></span>
                      <span className="tm-figure-text">Specification ≥{PURITY_MINIMUM}%</span>
                    </dd>
                  )}
                </div>
              )}
              {identity && (
                <div>
                  <dt>Identity</dt>
                  <dd>
                    <span className="tm-figure tm-proom-word">{identity.value}</span>
                    <span className="tm-figure-text">{identity.method}</span>
                  </dd>
                </div>
              )}
              {contents.length === 1 && contents[0].content && (
                <div>
                  <dt>{splitLabel(contents[0].content.label).base}</dt>
                  <dd>
                    <span className="tm-figure">{contents[0].content.value}<small>{contents[0].content.unit.replace(/ per vial$/, "")}</small></span>
                    {claimText(contents[0]) && <span className="tm-figure-text">{claimText(contents[0])!.replace(/^./, (ch) => ch.toUpperCase())}</span>}
                  </dd>
                </div>
              )}
              {lot.testedAt && (
                <div>
                  <dt>Analyzed</dt>
                  <dd>
                    <span className="tm-figure tm-proom-word">{certificateDate(lot.testedAt)}</span>
                    {lot.releasedAt && <span className="tm-figure-text">Certificate issued {certificateDate(lot.releasedAt)}</span>}
                  </dd>
                </div>
              )}
            </dl>
            <div className="tm-proom-lot-actions">
              <button type="button" className="tm-textlink" onClick={onOpen} aria-haspopup="dialog">
                Read the certificate <ArrowRight size={15} strokeWidth={1.6} aria-hidden="true" />
              </button>
              {record.coaUrl && (
                <a className="tm-textlink" href={record.coaUrl} target="_blank" rel="noopener">
                  Open the PDF <ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" />
                </a>
              )}
              {lab && (
                <a className="tm-textlink" href={lab.href} target="_blank" rel="noopener">
                  Confirm with {LAB.name}{lab.enter ? ` (enter ${lab.enter})` : ""} <ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" />
                </a>
              )}
            </div>
          </>
        ) : !loading ? (
          <Link className="tm-textlink" to={`/verify?lot=${encodeURIComponent(product.lot)}`}>
            Look up this lot <ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The current lot's own results for the specification table, read from its certificate record:
 * one line, or one per component of a blend.
 */
function lotRows(results: LotResult[] | undefined, kind: "purity" | "identity" | "content"): [string, ReactNode][] {
  if (!results?.length) return [];
  const groups = resultGroups(results);
  const named = (component: string | undefined, text: string) => (component ? `${component} ${text}` : text);
  const lines = (texts: string[]) => (texts.length > 1 ? texts.map((text) => <span key={text} className="tm-spec-line">{text}</span>) : texts[0]);
  if (kind === "purity") {
    const texts = groups.flatMap((g) => (g.purity ? [named(g.component, `${g.purity.value}%`)] : []));
    return texts.length ? [["HPLC purity, current lot", lines(texts)]] : [];
  }
  if (kind === "identity") {
    const texts = groups.flatMap((g) => (g.identity ? [named(g.component, g.identity.value.toLowerCase())] : []));
    if (!texts.length) return [];
    // The certificate's own method, beside the identity method the site states.
    const method = `by ${groups.find((g) => g.identity)!.identity!.method}`;
    return [["Identity, current lot", groups.length > 1 ? lines([...texts, method]) : `${texts[0].charAt(0).toUpperCase()}${texts[0].slice(1)}, ${method}`]];
  }
  const content = groups.filter((g) => g.content);
  const rows: [string, ReactNode][] = [];
  if (content.length) {
    const perVial = content[0].content!.unit === "mg per vial";
    const label = perVial ? "Content per vial, current lot" : `${splitLabel(content[0].content!.label).base}, current lot`;
    rows.push([label, lines(content.map((g) => named(g.component, [contentValue(g.content!), claimText(g)].filter(Boolean).join(" · "))))]);
  }
  for (const g of groups) {
    for (const extra of g.other) rows.push([`${splitLabel(extra.label).base}, current lot`, `${extra.value} ${extra.unit} · ${extra.method}`]);
  }
  return rows;
}
