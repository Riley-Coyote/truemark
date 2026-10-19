import { clamp01, HANDOFF, scene, smooth } from "./procession-math";

/** The opening's camera move on a phone: the room pushes in and the scene drops, then the collection's vials rise.
 *
 * iPhone Safari scrolls the page on its own, ahead of any script, so anything a script moves to keep pace with the
 * scroll lands a frame or more late (as much as four at the start of a swipe), and two things moved by the two clocks
 * come apart. So nothing here keeps pace with the scroll. The room and everything seated in it are held by the screen
 * itself (position: fixed, procession.css), and the camera only pushes and drops within that still frame; the words
 * and the page below scroll over it natively. The collection's vials rise on their own clock as it comes into view,
 * so they never have to meet a moving target. */
export function createPinnedPassage(home: HTMLElement, section: HTMLElement) {
  const opening = home.querySelector<HTMLElement>(".tm-mist");
  const hero = opening?.querySelector<HTMLElement>(".tm-mist-stage");
  const plate = hero?.querySelector<HTMLElement>(".tm-room-plate");
  const camera = hero?.querySelector<HTMLElement>(".tm-seq-camera");
  const stage = section.querySelector<HTMLElement>(".tm-procession-stage");
  const heading = section.querySelector<HTMLElement>(".tm-procession-heading");
  // No room to move (another opening, or none): nothing to hold.
  if (!opening || !hero || !plate || !camera || !stage || !heading) return { setMotion() {}, destroy() {} };
  return pin(home, section, { opening, hero, plate, camera, stage, heading });
}

type Room = Record<"opening" | "hero" | "plate" | "camera" | "stage" | "heading", HTMLElement>;

function pin(home: HTMLElement, section: HTMLElement, { opening, hero, plate, camera, stage, heading }: Room) {
  const actors = [...stage.querySelectorAll<HTMLElement>(".tm-procession-actor")];
  // The room's field behind the whole page, as on a wide screen: the camera's room softens into it.
  const world = document.createElement("div"), fill = document.createElement("img");
  world.className = "tm-procession-world"; world.setAttribute("aria-hidden", "true");
  fill.className = "tm-procession-world-fill"; fill.alt = "";
  // Already soft (soften(), below): no live blur.
  fill.style.filter = "none";
  world.append(fill); home.prepend(world);
  // The large viewport, steady while Safari's toolbar comes and goes.
  const viewport = document.createElement("div");
  viewport.style.cssText = "position:fixed;width:0;height:100lvh;visibility:hidden;pointer-events:none";
  home.append(viewport);

  const DEPTH = 2.1;
  // The dive spans more of the way down than on a wide screen, where a flight of vials fills the rest: here the camera
  // is still moving as the words below pass over it, and the room softens only as the collection comes.
  const SPAN = .62, FADE = .16;
  // How long the camera takes to catch up with the page, in seconds. Held by the screen, it can trail a flick a little
  // and glide, which reads as weight, and nothing it carries can come apart.
  const GLIDE = .14;
  let shown = -1, last = 0;

  /** The room's field, softened once: the photograph halved and halved again down to a few dozen pixels, which the
   *  screen draws back up as a deep, even blur. A live CSS blur on a layer held under the whole page is worked out
   *  again at every frame of a scroll on an iPhone (two frames in three came late with it, one in eight without). */
  let softenedFrom = "";
  function soften(image: HTMLImageElement) {
    const src = image.currentSrc;
    softenedFrom = src;
    const draw = () => {
      if (dead || softenedFrom !== src || !image.naturalWidth) return;
      let from: CanvasImageSource = image, w = image.naturalWidth, h = image.naturalHeight;
      while (w > 48) {
        const next = document.createElement("canvas");
        next.width = Math.max(1, Math.round(w / 2)); next.height = Math.max(1, Math.round(h / 2));
        const ctx = next.getContext("2d");
        if (!ctx) return;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(from, 0, 0, next.width, next.height);
        from = next; w = next.width; h = next.height;
      }
      const small = from as HTMLCanvasElement;
      // An upright phone's tall room is lifted to the wide room's tone, as procession.css lifts the live field.
      if (matchMedia("(max-width:560px) and (max-aspect-ratio:11/10)").matches) {
        const ctx = small.getContext("2d")!, data = ctx.getImageData(0, 0, small.width, small.height);
        for (let i = 0; i < data.data.length; i += 4) for (let c = 0; c < 3; c++) data.data[i + c] = Math.min(255, data.data[i + c] * 1.2);
        ctx.putImageData(data, 0, 0);
      }
      fill.src = small.toDataURL("image/png");
    };
    if (image.complete) draw(); else image.addEventListener("load", draw, { once: true });
  }
  let moving = true, story = false, dead = false, dirty = true, risen = false;
  let frame = 0, end = 1, pivotX = 0, pivotY = 0, fall = 0, restLeft = 0, restTop = 0, depthBelow = 0;
  let word: HTMLElement | null = null, copy: HTMLElement | null = null, cue: HTMLElement | null = null, lead: HTMLElement | null = null;
  let written = new WeakMap<HTMLElement, Map<string, { wanted: string; seen: string }>>();
  /** A style written only when it changes: a held frame costs nothing. It is written again if anything else has
   *  changed it since (the page's flights home write the opening's words and camera too, flight.ts). */
  const write = (el: HTMLElement | null, key: string, value: string) => {
    if (!el) return;
    let styles = written.get(el);
    if (!styles) written.set(el, styles = new Map());
    const last = styles.get(key);
    if (last && last.wanted === value && last.seen === el.style.getPropertyValue(key)) return;
    el.style.setProperty(key, value);
    styles.set(key, { wanted: value, seen: el.style.getPropertyValue(key) });
  };
  const pinned = () => moving && !story;

  /** The opening's words, as they are now: it sets its word after the first render and redraws its copy as the phone
   *  layout settles (and again when a reader comes back to the page), so a node held from before may have left it. */
  function find() {
    word = hero.querySelector(".tm-mist-word"); copy = hero.querySelector(".tm-mist-copy");
    cue = hero.querySelector(".tm-story-cue"); lead = opening.querySelector(".tm-mist-foot");
  }
  const stale = () => [word, copy, cue, lead].some(el => !el?.isConnected);
  function measure() {
    dirty = false;
    find();
    const y = window.scrollY;
    // Where the stage lies with the page at its top: the camera is held there.
    const rect = hero.getBoundingClientRect();
    restLeft = rect.left; restTop = rect.top + y;
    home.style.setProperty("--tm-pin-left", `${restLeft}px`);
    home.style.setProperty("--tm-pin-top", `${restTop}px`);
    home.style.setProperty("--tm-pin-w", `${rect.width}px`);
    home.style.setProperty("--tm-pin-h", `${rect.height}px`);
    const header = document.querySelector<HTMLElement>(".tm-header");
    const stuck = header ? header.offsetHeight + (parseFloat(getComputedStyle(header).top) || 0) : 80;
    end = Math.max(1, Math.ceil(section.getBoundingClientRect().top + y - stuck - 24));
    const height = viewport.offsetHeight || window.innerHeight;
    // The plate as the room is drawn (procession.css scales it by 1.015 about its centre), in the resting screen.
    const ps = getComputedStyle(plate), pw = parseFloat(ps.width), ph = parseFloat(ps.height);
    const plateW = pw * 1.015, plateH = ph * 1.015;
    const plateX = restLeft + parseFloat(ps.left) - pw * .0075, plateY = restTop + parseFloat(ps.top) - ph * .0075;
    const seats = [...plate.querySelectorAll<HTMLElement>(".tm-room-vial")].map(vial => ({
      id: vial.dataset.productId,
      x: plateX + plateW * Number(vial.style.getPropertyValue("--seat-x")),
      foot: plateY + plateH * Number(vial.style.getPropertyValue("--seat-y")),
      height: plateH * Number(vial.style.getPropertyValue("--vial-h")),
    }));
    // The camera pushes in on the middle vial, and the scene falls until every cap has left the frame.
    const featured = seats[Math.floor(seats.length / 2)];
    pivotX = featured?.x ?? rect.width / 2;
    pivotY = featured ? featured.foot - featured.height / 2 : height / 2;
    const capTop = seats.length ? Math.min(...seats.map(s => s.foot - s.height)) : pivotY;
    fall = height + 32 - (pivotY + (capTop - pivotY) * DEPTH);
    const still = plate.querySelector<HTMLImageElement>(".tm-room-still");
    if (still?.currentSrc && still.currentSrc !== softenedFrom) soften(still);
    // The wall above the picture's top edge as the camera drops (procession.css): the same picture, turned over.
    if (still?.currentSrc) plate.style.setProperty("--tm-room-poster", `url("${still.currentSrc}")`);
    depthBelow = Math.round(stage.offsetHeight * .62);
    stage.style.setProperty("--tm-rise", `${depthBelow}px`);
  }

  function draw(now: number) {
    frame = 0;
    if (dead) return;
    // While the page flies to or from another (flight.ts), the flight moves the opening; it is measured again and
    // drawn once the page has landed (its tm-flight).
    if (home.closest(".tm-views[data-moving]")) return;
    if (dirty) measure();
    else if (stale()) find();
    home.toggleAttribute("data-procession-pinned", pinned());
    document.documentElement.toggleAttribute("data-tm-pinned", pinned());
    if (!pinned()) { release(); return; }
    const wanted = clamp01(Math.max(0, window.scrollY) / end);
    const dt = last ? Math.min(.064, (now - last) / 1000) : 1 / 60;
    last = now;
    // A jump (a deep link, the way back, a tab come back to) is taken at once; a scroll is followed.
    if (shown < 0 || Math.abs(wanted - shown) > .5) shown = wanted;
    else shown += (wanted - shown) * (1 - Math.exp(-dt / GLIDE));
    if (Math.abs(wanted - shown) < .0002) shown = wanted;
    const passage = shown, dive = passage / SPAN;
    const filmed = scene(dive * HANDOFF, pivotX, pivotY, DEPTH, fall);
    // In the held frame: a point at (x, y) on the resting screen is filmed at pivot + (point - pivot) * zoom + drop.
    // Past the dive the camera keeps its last pose (scene() holds there) while the room fades.
    write(camera, "transform", `translate3d(${(filmed.x + restLeft * (filmed.zoom - 1)).toFixed(2)}px,${(filmed.y + restTop * (filmed.zoom - 1)).toFixed(2)}px,0) scale(${filmed.zoom.toFixed(4)})`);
    // Once the scene has fallen from sight, the room softens into its own field behind the page.
    const room = passage >= SPAN ? 1 - smooth((passage - SPAN) / FADE) : 1;
    write(camera, "opacity", room.toFixed(3));
    write(camera, "visibility", room > .001 ? "visible" : "hidden");
    // Out of sight, its mist holds still (FloorMist's held()): the camera is fixed, so the mist always seems in view.
    home.toggleAttribute("data-procession-gone", room <= .001);
    write(camera, "pointer-events", passage > .02 ? "none" : "");
    write(word, "opacity", (1 - smooth(dive / .6)).toFixed(3));
    write(copy, "opacity", (1 - smooth(passage / .14)).toFixed(3));
    write(cue, "opacity", (1 - smooth(passage / .1)).toFixed(3));
    write(lead, "opacity", smooth((passage - .18) / .2).toFixed(3));
    write(heading, "opacity", smooth((passage - .45) / .22).toFixed(3));
    write(fill, "translate", `0 ${Math.min(window.innerHeight * .1, .22 * fall * filmed.drop).toFixed(1)}px`);
    if (shown !== wanted) schedule(); else last = 0;
  }
  function schedule() { if (!frame && !dead) frame = requestAnimationFrame(draw); }
  function release() {
    for (const [el, keys] of [[camera, ["transform", "opacity", "visibility", "pointer-events"]], [word, ["opacity"]], [copy, ["opacity"]], [cue, ["opacity"]], [lead, ["opacity"]], [heading, ["opacity"]]] as const) {
      for (const key of keys) el?.style.removeProperty(key);
    }
    written = new WeakMap();
    shown = -1; last = 0;
    home.removeAttribute("data-procession-gone");
    stage.removeAttribute("data-sunk");
    risen = true;
  }

  /** The collection's vials rise onto their pedestals as it comes into view, each on its own clock. */
  function rise() {
    if (risen || !pinned()) return;
    risen = true;
    stage.removeAttribute("data-sunk");
    const current = actors.findIndex(actor => actor.hasAttribute("data-current"));
    actors.forEach((actor, i) => {
      const away = Math.abs(i - Math.max(0, current));
      actor.animate(
        [{ translate: `0 ${depthBelow}px`, opacity: 0 }, { opacity: 1, offset: .4 }, { translate: "0 0", opacity: 1 }],
        { duration: 1500, delay: Math.min(away, 3) * 90, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" },
      );
    });
  }
  function sink() {
    if (!pinned()) return;
    risen = false;
    for (const actor of actors) actor.getAnimations().forEach(a => a.cancel());
    stage.setAttribute("data-sunk", "");
  }
  const arrival = new IntersectionObserver(([entry]) => {
    if (entry.intersectionRatio >= .5) rise();
    // Only once it has gone below the screen again does it sink, to rise again as the reader comes back down.
    else if (!entry.isIntersecting && entry.boundingClientRect.top > 0) sink();
  }, { threshold: [0, .5] });

  function storyChange() {
    story = opening.hasAttribute("data-story");
    if (story) release();
    dirty = true; schedule();
  }
  // Safari's toolbar changes the window's height as a swipe begins. Measured mid-move, the held room would jump, so
  // the room is measured again only at rest or when the width changes (a turn of the phone).
  let width = window.innerWidth;
  function resize() {
    const turned = window.innerWidth !== width;
    width = window.innerWidth;
    if (turned || window.scrollY < 1) { dirty = true; schedule(); }
  }
  const resized = new ResizeObserver(resize);
  resized.observe(hero); resized.observe(section);
  const watch = new MutationObserver(storyChange);
  watch.observe(opening, { attributes: true, attributeFilter: ["data-story"] });
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", resize);
  const flown = () => { dirty = true; schedule(); };
  window.addEventListener("tm-flight", flown);
  void document.fonts.ready.then(() => { if (!dead) { dirty = true; schedule(); } });
  // Below the opening on arrival (a deep link, the way back): the vials are simply there.
  if (window.scrollY < 8) stage.setAttribute("data-sunk", ""); else risen = true;
  arrival.observe(stage);
  storyChange();

  return {
    setMotion(value: boolean) {
      moving = value;
      if (!moving) release();
      dirty = true; schedule();
    },
    destroy() {
      dead = true; cancelAnimationFrame(frame);
      resized.disconnect(); watch.disconnect(); arrival.disconnect();
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", resize);
      window.removeEventListener("tm-flight", flown);
      release();
      home.removeAttribute("data-procession-pinned"); home.removeAttribute("data-procession-gone");
      document.documentElement.removeAttribute("data-tm-pinned");
      for (const key of ["--tm-pin-left", "--tm-pin-top", "--tm-pin-w", "--tm-pin-h"]) home.style.removeProperty(key);
      world.remove(); viewport.remove();
    },
  };
}
