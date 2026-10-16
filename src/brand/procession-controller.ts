import { advance, advanceDrift, clamp01, distance, HANDOFF, mix, modulo, pose, RISE, scene, smooth } from "./procession-math";
import { FOG_SCENES, pedestalCrop } from "./fog/scenes";

export type ProcessionStatus = { active: number; paused: boolean; reduced: boolean; arrived: boolean; progress: number };
type Options = { size: number; tempo: number; hold: number; depth: number; drift: string; still: boolean };
type Point = { x: number; foot: number; height: number; light: number };

/** One frame loop owns the glass, camera and class cycle. Geometry is measured on
 * resize, never between transform writes. Scrolling remains entirely native. */
export function createProcession(section: HTMLElement, order: number[], initial: number, report: (status: ProcessionStatus) => void) {
  const home = section.closest<HTMLElement>(".tm-home")!;
  const opening = home.querySelector<HTMLElement>(".tm-mist")!;
  const hero = opening.querySelector<HTMLElement>(".tm-mist-stage")!;
  const plate = hero.querySelector<HTMLElement>(".tm-room-plate")!;
  const camera = hero.querySelector<HTMLElement>(".tm-seq-camera")!;
  let word: HTMLElement | null, copy: HTMLElement | null, cue: HTMLElement | null, lead: HTMLElement | null;
  const stage = section.querySelector<HTMLElement>(".tm-procession-stage")!;
  const actors = [...stage.querySelectorAll<HTMLElement>(".tm-procession-actor")];
  const images = actors.map(actor => actor.querySelector<HTMLImageElement>("img")!);
  const shadows = actors.map(actor => actor.querySelector<HTMLElement>(".tm-procession-shadow")!);
  const details = section.querySelector<HTMLElement>(".tm-procession-details")!;
  const heading = section.querySelector<HTMLElement>(".tm-procession-heading")!;
  const navigation = section.querySelector<HTMLElement>(".tm-procession-navigation")!;
  const count = actors.length;
  const layer = document.createElement("div");
  layer.className = "tm-procession-passage"; layer.setAttribute("aria-hidden", "true");
  const travelers = actors.map(actor => {
    const group = actor.cloneNode(true) as HTMLElement;
    group.className = "tm-procession-glass"; layer.append(group); return group;
  });
  const world = document.createElement("div"); world.className = "tm-procession-world"; world.setAttribute("aria-hidden", "true");
  const fill = document.createElement("img"), room = document.createElement("img");
  fill.className = "tm-procession-world-fill"; room.className = "tm-procession-world-room";
  // The room's field lies first, under the window's light on its wall (WallLight), and stays behind the whole page.
  fill.alt = room.alt = ""; world.append(fill, room); home.prepend(world); document.body.append(layer);

  let options: Options = { size: 100, tempo: 1, hold: 5.5, depth: 2.1, drift: "continuous", still: false };
  let moving = true, paused = false, frozen = false, visible = false, disposed = false, dirty = true, story = false;
  let frame = 0, last = 0, elapsed = 0, phase = order.indexOf(initial), target = phase, velocity = 0, passage = 0;
  let active = initial, lastStatus = "", lastDevStatus = "", priorArrival = false, dragging = false;
  let scrubStart: number | undefined;
  let driftVelocity = 0;
  let resumeTimer = 0;
  function cancelResume() { window.clearTimeout(resumeTimer); resumeTimer = 0; }
  function resumeAfterSwipe() {
    cancelResume();
    resumeTimer = window.setTimeout(() => {
      resumeTimer = 0; if (disposed || still()) return;
      paused = frozen = false; elapsed = 0; last = 0; schedule();
    }, 3500);
  }
  let directScroll = false;
  let width = 1, height = 1, stageTop = 0, end = 1, spacing = 1, vialHeight = 1, baseFoot = 1;
  let plateX = 0, plateY = 0, plateW = 1, plateH = 1;
  let heroX = 0, heroY = 0, pivotX = 0, pivotY = 0, fall = 0, lift = 0;
  let sources = new Map<string, Point>();
  const still = () => !moving || options.still;
  // On a touch screen the page scrolls natively and the script that would carry the flight runs a frame behind it, so
  // the carried vials and the zoomed room lag the page and pile onto its words. There the flight is grounded: the
  // opening and the collection stand in the page and scroll with it, as with motion off, and the collection still
  // drifts and answers a swipe.
  const grounded = () => still() || directScroll;
  function measure() {
    dirty = false;
    // The hero inserts its word after measuring, and replaces floor copy across
    // breakpoints. Follow the current nodes rather than a detached first render.
    word = hero.querySelector<HTMLElement>(".tm-mist-word");
    copy = hero.querySelector<HTMLElement>(".tm-mist-copy");
    cue = hero.querySelector<HTMLElement>(".tm-story-cue");
    lead = opening.querySelector<HTMLElement>(".tm-mist-foot");
    const y = window.scrollY, heroRect = hero.getBoundingClientRect(), r = stage.getBoundingClientRect();
    width = window.innerWidth; height = window.innerHeight;
    directScroll = matchMedia("(pointer: coarse)").matches;
    stageTop = r.top + y;
    const headerEl = document.querySelector<HTMLElement>(".tm-header");
    const header = headerEl ? headerEl.offsetHeight + (parseFloat(getComputedStyle(headerEl).top) || 0) : 80;
    // scrollTo rounds to device pixels. Use a reachable endpoint so a section
    // jump cannot stop at 99.94% and leave the collection inert.
    end = Math.max(1, Math.ceil(section.getBoundingClientRect().top + y - header - 24));
    section.dataset.scrollEnd = String(end);
    const actorStyle = getComputedStyle(actors[0]), plateStyle = getComputedStyle(plate);
    // offsetHeight/offsetLeft round fractional CSS pixels. The carried image
    // must meet the actual rendered box, including phone heights like 219.32px.
    vialHeight = parseFloat(actorStyle.height) * options.size / 100;
    // The photographed rim is wider than the glass. Keep neighbouring supports
    // clear on phones/tablets as well as at the largest lab vial scale.
    spacing = Math.max(width <= 700 ? width * .56 : Math.min(350, width * .235), vialHeight * 1.12);
    baseFoot = stageTop + r.height - parseFloat(actorStyle.bottom);
    const pw = parseFloat(plateStyle.width), ph = parseFloat(plateStyle.height);
    plateW = pw * 1.015; plateH = ph * 1.015;
    plateX = heroRect.left + parseFloat(plateStyle.left) - pw * .0075;
    plateY = heroRect.top + y + parseFloat(plateStyle.top) - ph * .0075;
    sources = new Map([...plate.querySelectorAll<HTMLElement>(".tm-room-vial")].map(vial => [vial.dataset.productId!, {
      x: plateX + plateW * Number(vial.style.getPropertyValue("--seat-x")),
      foot: plateY + plateH * Number(vial.style.getPropertyValue("--seat-y")),
      height: plateH * Number(vial.style.getPropertyValue("--vial-h")),
      light: Number(vial.style.getPropertyValue("--tm-lit")) || 1,
    }]));
    const featured = sources.get(actors[initial].dataset.productId!) ?? [...sources.values()][0];
    heroX = heroRect.left; heroY = heroRect.top + y;
    pivotX = featured?.x ?? width / 2;
    pivotY = featured ? featured.foot - featured.height / 2 : height / 2;
    const capTop = Math.min(...[...sources.values()].map(source => source.foot - source.height));
    fall = height + 32 - (pivotY + (capTop - pivotY) * options.depth);
    lift = Math.max(0, height + 24 + vialHeight - (baseFoot - RISE * end));
    const poster = plate.querySelector<HTMLImageElement>(".tm-room-still")?.currentSrc;
    if (poster && room.src !== poster) room.src = fill.src = poster;
    // A photographic pedestal travels with each vial, never underneath it on a
    // separate track. Use the centre plinth's measured rim in the same room.
    const tall = opening.dataset.shape === "tall";
    const fogScene = tall ? FOG_SCENES.collectionTall : FOG_SCENES.collection;
    const crop = pedestalCrop(fogScene, tall ? 1 : 2);
    const seat = featured ? (featured.foot - plateY) / plateH * fogScene.room.h : crop.frontTop;
    const sourceHeight = featured ? featured.height / plateH * fogScene.room.h : 256;
    const cut = crop.frontTop + .45 * (crop.base - crop.frontTop);
    const cropWidth = crop.half * 2, cropHeight = cut - crop.backTop;
    for (const actor of [...actors, ...travelers]) {
      const plinth = actor.querySelector<HTMLElement>(".tm-procession-plinth")!;
      const percentWidth = cropWidth / (sourceHeight * 578 / 1112) * 100;
      plinth.style.width = `${percentWidth}%`;
      plinth.style.height = `${cropHeight / sourceHeight * 100}%`;
      plinth.style.left = `${(100 - percentWidth) / 2}%`;
      plinth.style.top = `${(1 - (seat - crop.backTop) / sourceHeight) * 100}%`;
      plinth.style.backgroundImage = poster ? `url("${poster}")` : "none";
      plinth.style.backgroundSize = `${fogScene.room.w / cropWidth * 100}% ${fogScene.room.h / cropHeight * 100}%`;
      plinth.style.backgroundPosition = `${(crop.x - crop.half) / (fogScene.room.w - cropWidth) * 100}% ${crop.backTop / (fogScene.room.h - cropHeight) * 100}%`;
      const radius = crop.rimRadius / cropHeight * 100;
      plinth.style.clipPath = `inset(0 round 50% 50% 0 0 / ${radius}% ${radius}% 0 0)`;
      // Fade each physical support before the stage boundary. The same mask is
      // carried by the return copy, so it cannot spill over the caption or cut
      // abruptly when the fixed passage hands back to the document.
      const fadeDepth = sourceHeight * parseFloat(actorStyle.bottom) / vialHeight * .9;
      const fadeStart = (seat + fadeDepth * .15 - crop.backTop) / cropHeight * 100;
      const fadeEnd = (seat + fadeDepth - crop.backTop) / cropHeight * 100;
      plinth.style.maskImage = `linear-gradient(black ${fadeStart}%,transparent ${fadeEnd}%)`;
    }
    room.style.width = `${plateW}px`; room.style.height = `${plateH}px`;
    actors.forEach(actor => { actor.style.transformOrigin = "50% 100%"; });
    home.dataset.procession = "";
  }
  const opacity = (el: HTMLElement | null, value: number) => { if (el) el.style.opacity = String(value); };
  function emit(arrived: boolean) {
    const state = { active, paused, reduced: still(), arrived, progress: Math.round(passage * 100) };
    // React updates only at semantic changes, not at the display's frame rate.
    const key = `${active}/${paused}/${still()}/${arrived}`;
    if (key !== lastStatus) { lastStatus = key; report(state); }
    if (import.meta.env.DEV) {
      const motionProgress = Math.round(modulo(phase, 1) * 100);
      const devKey = `${key}/${state.progress}/${motionProgress}`;
      if (devKey !== lastDevStatus) { lastDevStatus = devKey; section.dispatchEvent(new CustomEvent("tm-procession-status", { detail: { ...state, motionProgress }, bubbles: true })); }
    }
    section.dataset.active = String(active); section.dataset.passage = passage.toFixed(4);
  }
  function draw(now: number) {
    frame = 0; if (disposed) return;
    const dt = Math.min(last ? (now - last) / 1000 : 1 / 60, .064); last = now;
    if (dirty) measure();
    const y = Math.max(0, window.scrollY), requested = clamp01(y / end);
    // Short input damping smooths wheel steps. Never trap the document scroll or
    // replay a missed scene after a fast flick, tab switch or deep link.
    if (grounded() || story || Math.abs(requested - passage) > .6) passage = requested;
    else passage += (requested - passage) * (1 - Math.exp(-dt / .055));
    if (Math.abs(requested - passage) < .00015) passage = requested;
    const arrived = grounded() || passage >= .94;
    if (arrived && !priorArrival) elapsed = 0;
    priorArrival = arrived;
    if ((passage === 0 || passage >= HANDOFF && passage < RISE) && !grounded() && !story) {
      // Restore spatial order only when the cap of every carried vial is offscreen.
      phase = target = order.indexOf(initial); velocity = 0; elapsed = 0;
    }
    const running = arrived && !story && !document.hidden && !still();
    const drifting = running && !dragging && !frozen && !paused && visible && options.drift === "continuous";
    if (!drifting) driftVelocity = 0;
    if (running && !dragging && !frozen) {
      if (drifting) {
        const next = advanceDrift(phase, driftVelocity, dt, options.tempo);
        phase = target = next.position; driftVelocity = next.velocity; velocity = 0;
      } else if (Math.abs(target - phase) > .0001 || Math.abs(velocity) > .001) {
        const next = advance(phase, velocity, target, dt, options.tempo);
        phase = next.position; velocity = next.velocity;
        if (Math.abs(target - phase) < .0001 && Math.abs(velocity) < .001) { phase = target; velocity = 0; elapsed = 0; }
      } else if (!paused && visible) {
        elapsed += dt;
        if (elapsed >= options.hold) { target += 1; elapsed = 0; }
      }
    }
    active = order[modulo(Math.round(phase), count)];
    const inFlight = !grounded() && !story && passage >= HANDOFF && passage < 1;
    home.toggleAttribute("data-procession-flight", inFlight);
    home.toggleAttribute("data-procession-still", grounded());
    layer.hidden = !inFlight;
    const arrivalDetail = grounded() ? 1 : smooth((passage - .80) / .20);
    const arrivalCopy = grounded() ? 1 : smooth((passage - .76) / .18);
    opacity(details, arrivalCopy); opacity(navigation, arrivalCopy);
    navigation.inert = details.inert = !arrived;
    opacity(heading, grounded() ? 1 : smooth((passage - .45) / .22));
    const extraScroll = Math.max(0, y - end);
    const filmed = scene(grounded() ? 0 : passage, pivotX, pivotY, options.depth, fall);
    const departure = scene(HANDOFF, pivotX, pivotY, options.depth, fall);
    const rearrange = smooth((passage - HANDOFF) / (RISE - HANDOFF));
    const rise = smooth((passage - RISE) / (1 - RISE));
    const middleSource = sources.get(actors[initial].dataset.productId!) ?? [...sources.values()][0];
    actors.forEach((actor, i) => {
      const d = distance(order.indexOf(i), phase, count), p = pose(d, spacing, vialHeight);
      const scale = p.scale * options.size / 100;
      actor.style.transform = `translate3d(${p.x}px,${p.y}px,0) scale(${scale})`;
      const onscreen = Math.abs(p.x) - vialHeight * 1.15 * p.scale / 2 < width / 2 + 8;
      actor.style.visibility = onscreen ? "visible" : "hidden";
      actor.style.opacity = grounded() || passage === 1 || story ? "1" : "0";
      images[i].style.opacity = "1";
      shadows[i].style.opacity = String(arrivalDetail);
      if (!inFlight || !middleSource) return;
      const source = sources.get(actor.dataset.productId!), origin = source ?? middleSource;
      const glass = travelers[i];
      glass.style.filter = passage < RISE ? `brightness(${origin.light})` : "none";
      const toHeight = vialHeight * p.scale, toX = width / 2 + p.x;
      const laidFoot = baseFoot + p.y - passage * end - extraScroll + lift;
      const from = source ? {
        x: departure.x + source.x * departure.zoom,
        foot: departure.y + source.foot * departure.zoom,
        height: source.height * departure.zoom,
      } : { x: toX, foot: laidFoot, height: toHeight };
      const glassHeight = mix(from.height, toHeight, rearrange);
      const x = mix(from.x, toX, rearrange);
      const foot = mix(from.foot, laidFoot, rearrange) - lift * rise;
      glass.style.transform = `translate3d(${x - glassHeight * 578 / 1112 / 2}px,${foot - glassHeight}px,0) scale(${glassHeight / 1112})`;
      glass.style.visibility = (passage < RISE ? !!source : onscreen) ? "visible" : "hidden";
    });
    // The opening's room goes on down the page: its defocused field stays behind every section to the footer.
    opacity(world, story ? 0 : 1);
    room.style.transform = `translate3d(${plateX * filmed.zoom + filmed.x}px,${plateY * filmed.zoom + filmed.y}px,0) scale(${filmed.zoom})`;
    // Once the entire collection is below the frame, soften the now-empty wall
    // into the same photograph's defocused continuation. No visible object fades.
    opacity(room, grounded() ? 0 : 1 - smooth((passage - HANDOFF) / .10));
    fill.style.translate = grounded() ? "0 0" : `0 ${Math.min(height * .1, .22 * (passage < HANDOFF ? fall * filmed.drop : mix(fall, lift, rearrange) * (1 - rise)))}px`;
    if (!story) {
      // CSS scroll animations relinquish this camera while Procession owns it.
      // Correct for the hero's resting offset, so its plate and the fixed world
      // use the exact same viewport matrix even under a header or review dock.
      // Once the camera has handed the room over it is out of sight, and it rests: carried on down the page with the
      // scroll, its zoomed room would stretch the page's own length past the footer.
      const handed = !grounded() && passage >= HANDOFF;
      camera.style.transform = grounded() || handed ? "none" : `translate3d(${filmed.x + heroX * (filmed.zoom - 1)}px,${filmed.y + heroY * (filmed.zoom - 1) + y}px,0) scale(${filmed.zoom})`;
      opacity(camera, handed ? 0 : 1);
      const words = grounded() ? 1 : 1 - smooth(passage / .24);
      opacity(word, words);
      const copyOpacity = grounded() ? 1 : 1 - smooth(passage / .14);
      opacity(copy, copyOpacity); opacity(cue, grounded() ? 1 : 1 - smooth(passage / .10));
      if (copy) copy.style.visibility = copyOpacity > .001 ? "" : "hidden";
      opacity(lead, grounded() ? 1 : smooth((passage - .18) / .2));
      // Keep the visible hero vials interactive until the room actually leaves the frame.
      camera.style.pointerEvents = handed ? "none" : "";
    }
    emit(arrived);
    const progressing = Math.abs(requested - passage) > .00015;
    const cycling = running && !dragging && !frozen && (!paused && visible || Math.abs(phase - target) > .0001 || Math.abs(velocity) > .001);
    if (progressing || cycling) schedule(); else last = 0;
  }
  function schedule() { if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(draw); }
  function resize() { dirty = true; schedule(); }
  function setTarget(value: number) {
    cancelResume();
    if (driftVelocity) velocity = driftVelocity;
    driftVelocity = 0;
    paused = true; frozen = false; elapsed = 0; target = value;
    if (still() || !visible) { phase = target; velocity = 0; }
    schedule();
  }
  function step(direction: number) { setTarget(Math.round(target) + direction); }
  function select(i: number) { setTarget(phase + distance(order.indexOf(i), phase, count)); }
  function toggle() { cancelResume(); paused = !paused; frozen = paused; driftVelocity = 0; last = 0; schedule(); }
  function pauseAutoplay() {
    cancelResume();
    // Focus can arrive after the click that starts a manual glide. It stops
    // autoplay, but must not cancel that explicitly requested destination.
    if (!paused) frozen = true;
    paused = true; schedule();
  }
  function focus(event: FocusEvent) {
    // A touch focuses the stage too. That is direct manipulation, not a
    // keyboard request to stop autoplay; pointer release owns its resumption.
    if (pointer) return;
    if (!(event.target as HTMLElement).closest('.tm-procession-play')) pauseAutoplay();
  }
  function stateChange() {
    const wasStory = story;
    story = opening.hasAttribute("data-story");
    home.toggleAttribute("data-procession-story", story);
    if (story && !wasStory) {
      // Hand the camera and opening copy to the film once. Its changing captions
      // also trigger this observer; clearing styles again would erase the film's
      // fade after its writer has cached it, leaving the headline over the story.
      for (const el of [camera, word, copy, cue, lead]) { el?.style.removeProperty("opacity"); el?.style.removeProperty("transform"); }
      copy?.style.removeProperty("visibility");
    }
    last = 0; dirty = true; schedule();
  }
  let pointer: { id: number; x: number; y: number; phase: number; time: number; lastX: number; frozen: boolean; resume: boolean } | undefined;
  function down(e: PointerEvent) {
    if (!e.isPrimary || pointer || e.button !== 0 || !priorArrival) return;
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, phase, time: e.timeStamp, lastX: e.clientX, frozen, resume: !paused || !!resumeTimer };
    cancelResume();
    // Hold the presentation on contact; intent is resolved without fighting the
    // page's vertical pan. Horizontal motion then tracks the finger directly.
    frozen = true; driftVelocity = 0;
  }
  function move(e: PointerEvent) {
    if (!pointer || pointer.id !== e.pointerId) return;
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    if (!dragging) {
      if (Math.abs(dy) > Math.abs(dx) + 6) { frozen = pointer.frozen; if (pointer.resume && paused) resumeAfterSwipe(); pointer = undefined; schedule(); return; }
      if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy) + 6) return;
      stage.setPointerCapture(e.pointerId); dragging = true; paused = true; frozen = false;
      stage.dataset.dragging = "";
    }
    e.preventDefault();
    phase = pointer.phase - dx / spacing;
    velocity = -(e.clientX - pointer.lastX) / spacing / Math.max(.008, (e.timeStamp - pointer.time) / 1000);
    pointer.lastX = e.clientX; pointer.time = e.timeStamp; schedule();
  }
  function up(e: PointerEvent) {
    if (!pointer || pointer.id !== e.pointerId) return;
    if (dragging) {
      if (e.type === "pointercancel" || e.timeStamp - pointer.time > 100) velocity = 0;
      velocity = Math.max(-4, Math.min(4, velocity));
      target = Math.round(phase + velocity * .16);
      if (still()) { phase = target = Math.round(target); velocity = driftVelocity = 0; }
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    } else frozen = pointer.frozen;
    if (pointer.resume && paused && !still()) resumeAfterSwipe();
    dragging = false; pointer = undefined; delete stage.dataset.dragging; schedule();
  }
  // A trackpad swipes sideways as a finger does on glass: two fingers drawn across the stage carry the collection with
  // them, momentum included, and it settles on the nearest class once they stop. Over the stage the browser's own
  // sideways swipe (back a page) stays off; a swipe more up than across stays the page's scroll.
  let wheeling = 0, wheelResume = false;
  function wheel(e: WheelEvent) {
    if (!priorArrival || story || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (!wheeling) { wheelResume = !paused || !!resumeTimer; cancelResume(); }
    window.clearTimeout(wheeling);
    dragging = true; paused = true; frozen = false; driftVelocity = velocity = 0;
    phase += (e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX) / spacing;
    target = phase;
    wheeling = window.setTimeout(() => {
      wheeling = 0; dragging = false;
      phase = still() ? Math.round(phase) : phase; target = Math.round(phase);
      if (wheelResume && !still()) resumeAfterSwipe();
      schedule();
    }, 140);
    schedule();
  }
  stage.addEventListener("wheel", wheel, { passive: false });
  const resized = new ResizeObserver(resize);
  for (const el of [hero, plate, section, stage]) resized.observe(el);
  const observer = new MutationObserver(stateChange);
  observer.observe(opening, { attributes: true, attributeFilter: ["data-story", "data-seq"], childList: true, subtree: true });
  // Hysteresis avoids repeatedly braking at one boundary while Safari's
  // toolbar or the presentation frame changes the visible portion of the stage.
  const seen = new IntersectionObserver(([entry]) => {
    const next = entry.isIntersecting && entry.intersectionRatio >= (visible ? .1 : .25);
    if (next === visible) return;
    visible = next; last = 0; schedule();
  }, { threshold: [0, .1, .25, 1] }); seen.observe(stage);
  window.addEventListener("scroll", schedule, { passive: true }); window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", stateChange);
  stage.addEventListener("pointerdown", down); stage.addEventListener("pointermove", move);
  // A press can leave the stage before horizontal intent captures the pointer.
  window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  section.addEventListener("focusin", focus);
  void document.fonts.ready.then(() => { if (!disposed) resize(); });
  stateChange();

  // Only the development build exposes tuning to the existing local design lab.
  function labControl(event: Event) {
    const { action, value } = (event as CustomEvent).detail ?? {};
    if (action !== "scrub" && action !== "options") scrubStart = undefined;
    if (action === "options") {
      options = { ...options, ...value }; dirty = true;
      if (still()) { phase = target = Math.round(target); velocity = driftVelocity = 0; }
    } else if (action === "next") step(1);
    else if (action === "prev") step(-1);
    else if (action === "toggle") toggle();
    else if (action === "reset") {
      phase = target = order.indexOf(initial); velocity = driftVelocity = 0; elapsed = 0; frozen = false;
      if (value?.play) paused = false;
    }
    else if (action === "scrub") {
      scrubStart ??= Math.floor(phase);
      paused = frozen = true; phase = scrubStart + clamp01(value); target = scrubStart + 1; velocity = 0;
    }
    schedule();
  }
  if (import.meta.env.DEV) section.addEventListener("tm-procession-control", labControl);
  return {
    step, select, toggle, pauseAutoplay,
    setMotion(value: boolean) { moving = value; if (!value) cancelResume(); if (still()) { phase = target = Math.round(target); velocity = driftVelocity = 0; } schedule(); },
    destroy() {
      disposed = true; cancelResume(); window.clearTimeout(wheeling); cancelAnimationFrame(frame); resized.disconnect(); observer.disconnect(); seen.disconnect();
      stage.removeEventListener("wheel", wheel);
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", stateChange);
      stage.removeEventListener("pointerdown", down); stage.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      section.removeEventListener("focusin", focus); section.removeEventListener("tm-procession-control", labControl);
      layer.remove(); world.remove();
      for (const el of [camera, word, copy, cue, lead]) { el?.style.removeProperty("opacity"); el?.style.removeProperty("transform"); }
      copy?.style.removeProperty("visibility");
      camera.style.removeProperty("pointer-events");
      for (const key of ["procession", "processionFlight", "processionStill", "processionStory"]) delete home.dataset[key];
    },
  };
}
export type ProcessionController = ReturnType<typeof createProcession>;
