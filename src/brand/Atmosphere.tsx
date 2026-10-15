import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../shop/motion";
import { DUSK_MIST, HEADER_FOLLOWS_LIGHT, LEAD, headerSkyAt, inkFollow, overheadDark, passageAt, phaseProgress, skyAt, smooth, step, windowLight } from "./dusk";
import { startDuskMist } from "./dusk-mist";
import type { Passage } from "./dusk";
import "./atmosphere.css";

/** The screen's band below the sticky header, where words can be read. */
function viewBand(header: Element | null): { viewTop: number; viewFoot: number } {
  return { viewTop: header ? Math.max(0, header.getBoundingClientRect().bottom) : 0, viewFoot: window.innerHeight };
}

/** An element's top on the page, by layout alone: a reveal still on its way (a transform) doesn't move it. */
function pageTop(node: HTMLElement): number {
  let top = 0;
  for (let at: HTMLElement | null = node; at; at = at.offsetParent as HTMLElement | null) top += at.offsetTop;
  return top;
}
const pageBottom = (node: HTMLElement) => pageTop(node) + node.offsetHeight;

/** Where a passage stands within the element it is drawn in, from its two edges on the page. */
function place(gap: HTMLElement, host: HTMLElement, above: number, below: number) {
  gap.style.setProperty("--tm-gap-top", `${(above - pageTop(host)).toFixed(1)}px`);
  gap.style.setProperty("--tm-gap-height", `${Math.max(1, below - above).toFixed(1)}px`);
}

/** The lowest edge among some words on the page, or the highest. */
const lowest = (nodes: Iterable<HTMLElement>) => Math.max(...[...nodes].map(pageBottom));
const highest = (nodes: Iterable<HTMLElement>) => Math.min(...[...nodes].map(pageTop));

/** Writes a style only when its value changes: most frames of a scroll change nothing but a layer's opacity. */
function writer() {
  const was = new Map<HTMLElement, Map<string, string>>();
  return (node: HTMLElement | null, name: string, value: string | null) => {
    if (!node) return;
    let mine = was.get(node);
    if (!mine) was.set(node, (mine = new Map()));
    if (mine.get(name) === (value ?? "")) return;
    mine.set(name, value ?? "");
    if (value === null) node.style.removeProperty(name);
    else node.style.setProperty(name, value);
  };
}

/**
 * The home page's light: one fixed layer behind the page, the room's ambient light, falling from paper through dusk
 * into the night chapter and rising again into the closing (atmosphere.css, dusk.ts). It is drawn as still plates of
 * sky, the later fading in over the earlier, and the window light, moved and faded as a whole, so a scroll changes
 * only layers' opacity and transform. It measures the two passages, keeps the words' ink and the header's glass with
 * the light (HEADER_FOLLOWS_LIGHT), brings the night room's own light up as the room arrives, and lets the eyes adapt
 * once the night has settled. With reduced motion the page keeps its still form.
 */
export function Atmosphere() {
  const layer = useRef<HTMLDivElement>(null);
  const under = useRef<HTMLSpanElement>(null);
  const over = useRef<HTMLSpanElement>(null);
  const window_ = useRef<HTMLSpanElement>(null);
  const rose = useRef<HTMLSpanElement>(null);
  const grain = useRef<HTMLSpanElement>(null);
  const mistLayer = useRef<HTMLCanvasElement>(null);
  const still = usePrefersReducedMotion();
  useEffect(() => {
    const home = layer.current?.closest<HTMLElement>(".tm-home");
    const index = home?.querySelector<HTMLElement>(".tm-index");
    const proof = home?.querySelector<HTMLElement>(".tm-proof");
    const closing = home?.querySelector<HTMLElement>(".tm-closing");
    const duskGap = proof?.querySelector<HTMLElement>(".tm-dusk-gap");
    const dawnGap = closing?.querySelector<HTMLElement>(".tm-dawn-gap");
    const room = proof?.querySelector<HTMLElement>(".tm-proof-room") ?? null;
    const atmo = layer.current;
    if (!home || !index || !proof || !closing || !duskGap || !dawnGap || !atmo) return;
    const root = document.documentElement;
    const header = document.querySelector<HTMLElement>(".tm-header");

    // The passages' edges: the catalog's last cards to the night's first words, the night's last to the closing's first.
    const measure = () => {
      // The catalog ends on its cards: their paper carries their own words, so the passage begins at their foot.
      const catalogLast = index.querySelectorAll<HTMLElement>(".tm-class");
      // The night begins with its room where the room stands first (beside the words, or opening the chapter on a phone).
      const nightFirst = [...proof.querySelectorAll<HTMLElement>(".tm-proof-copy > *"), ...(room ? [room] : [])];
      const nightLast = proof.querySelectorAll<HTMLElement>(".tm-trail-record li, .tm-trail-lot");
      const closingFirst = closing.querySelectorAll<HTMLElement>(".tm-closing-buyers > *, .tm-closing-questions > *");
      if (!catalogLast.length || !nightFirst.length || !nightLast.length || !closingFirst.length) return;
      place(duskGap, proof, lowest(catalogLast), highest(nightFirst));
      place(dawnGap, closing, lowest(nightLast), highest(closingFirst));
    };
    // Once the light is drawn, a passage that moves is read again at once.
    let measured = () => {};
    const remeasure = () => {
      measure();
      measured();
    };
    remeasure();
    const resized = new ResizeObserver(remeasure);
    for (const node of [index, proof, closing]) resized.observe(node);
    void document.fonts?.ready.then(remeasure);

    if (still) {
      delete home.dataset.light;
      return () => resized.disconnect();
    }
    home.dataset.light = "script";
    const follows = HEADER_FOLLOWS_LIGHT && header !== null;
    if (follows) root.dataset.tmHeaderLight = "script";

    // Evening mist, drawn only while the dusk passage is on screen (left off: dusk.ts, DUSK_MIST).
    const mist = DUSK_MIST && mistLayer.current ? startDuskMist(mistLayer.current, [0.89, 0.86, 0.94]) : null;

    const write = writer();
    let sky: "day" | "night" = "day";
    let eyes = "closed";
    let frame = 0;
    const update = () => {
      frame = 0;
      const band = viewBand(header);
      const at = (node: HTMLElement, view = band): Passage => {
        const box = node.getBoundingClientRect();
        return { top: box.top, height: box.height, ...view };
      };
      // The passages are read over the whole screen, the plates' own frame (dusk.ts), each with its lead-in.
      const screen = { viewTop: 0, viewFoot: window.innerHeight };
      const lead = LEAD * window.innerHeight;
      const duskT = passageAt(at(duskGap, screen), lead), dawnT = passageAt(at(dawnGap, screen), lead);
      // The night room's own light reads only its entry: 0 to 1 as it comes on screen, up by the time four fifths of
      // it is, so wherever its first spread is read the room stands lit. Once it is up the vial is drawn by its resting
      // rule again (rooms.css).
      const stage = room ? Math.min(1, phaseProgress(at(room)) * 1.25) : 1;
      if (room) {
        const lit = step(stage, 0.02);
        write(room, "--tm-stage", lit.toFixed(2));
        const rising = lit >= 1 ? "up" : "rising";
        if (proof.dataset.stage !== rising) proof.dataset.stage = rising;
      }

      // The sky: the plate below, and the next one fading in over it.
      const now = skyAt(duskT, dawnT);
      if (under.current && under.current.dataset.plate !== now.under) under.current.dataset.plate = now.under;
      if (over.current && over.current.dataset.plate !== now.over) over.current.dataset.plate = now.over;
      write(over.current, "opacity", step(now.mix, 0.002).toFixed(3));
      // Grain, as a film's or an eye's: none on paper, the full whisper from twilight down.
      write(grain.current, "opacity", step(smooth(0.98, 0.62, (now.top + now.foot) / 2), 0.01).toFixed(2));

      // The window light: the panes lengthen and sink as the sun goes down, and blush.
      const light = windowLight(duskT, dawnT, stage);
      write(window_.current, "opacity", step(light.on, 0.005).toFixed(3));
      if (light.on > 0) {
        const down = step(light.down, 0.002);
        write(window_.current, "transform", `translate3d(${(down * 4).toFixed(2)}vw, ${(down * 34 - 6).toFixed(2)}vh, 0) skewX(${(-18 - down * 16).toFixed(2)}deg) scale(${(1 + down * 0.1).toFixed(3)}, ${(1 + down * 0.75).toFixed(3)})`);
        write(rose.current, "opacity", step(light.rose, 0.005).toFixed(3));
      }
      if (mist && mistLayer.current) {
        mist.setActive(duskT > -0.75 && duskT < 2.7);
        write(mistLayer.current, "opacity", step(smooth(-0.75, 0, duskT) * (1 - smooth(1.6, 2.6, duskT)), 0.01).toFixed(2));
      }

      // The words' ink, held to AA wherever the light stands (home.css): written in steps too small to see. At the
      // dusk's turn the catalog's words turn to light, over a short crossfade (home.css, data-ink).
      const ink = inkFollow(duskT, dawnT, now);
      write(index, "--tm-ink-follow", `${step(ink.catalog * 100, 2).toFixed(0)}%`);
      const lit = ink.lit ? "lit" : undefined;
      if (index.dataset.ink !== lit) {
        if (lit) index.dataset.ink = lit;
        else delete index.dataset.ink;
      }
      write(proof, "--tm-glow-follow", `${step(ink.night * 100, 2).toFixed(0)}%`);
      write(closing, "--tm-ink-follow", `${step(ink.closing * 100, 2).toFixed(0)}%`);

      if (follows && header) {
        write(header, "--tm-light-top", step(overheadDark(now.top), 0.01).toFixed(2));
        sky = headerSkyAt(duskT, dawnT, sky);
        if (root.dataset.tmHeaderSky !== sky) root.dataset.tmHeaderSky = sky;
      }
      // The eyes: once the night has fully fallen they adapt to it, lifting the room's exposure a little; as the
      // light comes back up, either way, they are reset, out of sight.
      const next = duskT >= 2.98 && dawnT < 0.5 ? "open" : duskT < 2.6 || dawnT >= 1 ? "closed" : eyes;
      if (next !== eyes) {
        eyes = next;
        proof.dataset.eyes = eyes;
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    measured = schedule;
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      mist?.stop();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      resized.disconnect();
      delete home.dataset.light;
      delete index.dataset.ink;
      delete proof.dataset.eyes;
      delete proof.dataset.stage;
      delete root.dataset.tmHeaderLight;
      delete root.dataset.tmHeaderSky;
      room?.style.removeProperty("--tm-stage");
      index.style.removeProperty("--tm-ink-follow");
      proof.style.removeProperty("--tm-glow-follow");
      closing.style.removeProperty("--tm-ink-follow");
      header?.style.removeProperty("--tm-light-top");
    };
  }, [still]);
  return (
    <div className="tm-atmo" ref={layer} aria-hidden="true">
      <span className="tm-atmo-plate" ref={under} data-plate="dusk-0" />
      <span className="tm-atmo-plate" ref={over} data-plate="dusk-1" />
      <span className="tm-atmo-window" ref={window_}>
        <span className="tm-atmo-panes" />
        <span className="tm-atmo-panes tm-atmo-panes-dusk" ref={rose} />
      </span>
      {DUSK_MIST && <canvas className="tm-atmo-mist" ref={mistLayer} />}
      <span className="tm-atmo-grain" ref={grain} />
    </div>
  );
}
