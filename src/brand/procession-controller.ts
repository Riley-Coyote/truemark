import { advance, advanceDrift, clamp01, distance, mix, modulo, passageFoot, pose, smooth } from "./procession-math";

export type ProcessionStatus = { active: number; paused: boolean; reduced: boolean; arrived: boolean; progress: number };
type Options = { size: number; tempo: number; hold: number; dip: number; depth: number; drift: string; still: boolean };
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
  const captions = [...section.querySelectorAll<HTMLElement>(".tm-procession-caption")];
  const details = section.querySelector<HTMLElement>(".tm-procession-details")!;
  const heading = section.querySelector<HTMLElement>(".tm-procession-heading")!;
  const navigation = section.querySelector<HTMLElement>(".tm-procession-navigation")!;
  const index = section.querySelector<HTMLElement>(".tm-procession-index")!;
  const count = actors.length;
  const layer = document.createElement("div");
  layer.className = "tm-procession-passage"; layer.setAttribute("aria-hidden", "true");
  const travelers = actors.map(actor => {
    const image = actor.querySelector("img")!.cloneNode() as HTMLImageElement;
    image.className = "tm-procession-glass"; image.dataset.productId = actor.dataset.productId; layer.append(image); return image;
  });
  const world = document.createElement("div"); world.className = "tm-procession-world"; world.setAttribute("aria-hidden", "true");
  const fill = document.createElement("img"), room = document.createElement("img");
  fill.className = "tm-procession-world-fill"; room.className = "tm-procession-world-room";
  fill.alt = room.alt = ""; world.append(fill, room); home.append(world); document.body.append(layer);

  let options: Options = { size: 100, tempo: 1, hold: 5.5, dip: 6, depth: 2.1, drift: "continuous", still: false };
  let moving = true, paused = false, frozen = false, visible = false, disposed = false, dirty = true, story = false;
  let frame = 0, last = 0, elapsed = 0, phase = order.indexOf(initial), target = phase, velocity = 0, passage = 0;
  let active = initial, lastStatus = "", lastDevStatus = "", priorArrival = false, dragging = false;
  let scrubStart: number | undefined;
  let driftVelocity = 0;
  let width = 1, height = 1, stageTop = 0, end = 1, spacing = 1, vialHeight = 1, vialWidth = 1, baseFoot = 1;
  let plateX = 0, plateY = 0, plateW = 1, plateH = 1, sectionEnd = 1;
  let sources = new Map<string, Point>();
  const still = () => !moving || options.still;
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
    stageTop = r.top + y;
    const headerEl = document.querySelector<HTMLElement>(".tm-header");
    const header = headerEl ? headerEl.offsetHeight + (parseFloat(getComputedStyle(headerEl).top) || 0) : 80;
    // scrollTo rounds to device pixels. Use a reachable endpoint so a section
    // jump cannot stop at 99.94% and leave the collection inert.
    end = Math.max(1, Math.ceil(section.getBoundingClientRect().top + y - header - 24));
    sectionEnd = section.getBoundingClientRect().bottom + y;
    const actorStyle = getComputedStyle(actors[0]), plateStyle = getComputedStyle(plate);
    // offsetHeight/offsetLeft round fractional CSS pixels. The carried image
    // must meet the actual rendered box, including phone heights like 219.32px.
    vialHeight = parseFloat(actorStyle.height) * options.size / 100; vialWidth = vialHeight * 578 / 1112;
    spacing = width <= 700 ? width * .37 : Math.min(350, width * .235);
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
    const poster = plate.querySelector<HTMLImageElement>(".tm-room-still")?.currentSrc;
    if (poster && room.src !== poster) room.src = fill.src = poster;
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
    if (still() || story || Math.abs(requested - passage) > .6) passage = requested;
    else passage += (requested - passage) * (1 - Math.exp(-dt / .055));
    if (Math.abs(requested - passage) < .00015) passage = requested;
    const arrived = still() || passage === 1;
    if (arrived && !priorArrival) elapsed = 0;
    priorArrival = arrived;
    if ((passage === 0 || passage > .28 && passage < .48) && !still() && !story) {
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
    const inFlight = !still() && !story && passage > 0 && passage < 1;
    home.toggleAttribute("data-procession-flight", inFlight);
    home.toggleAttribute("data-procession-still", still());
    layer.hidden = !inFlight;
    const arrivalDetail = still() ? 1 : smooth((passage - .80) / .20);
    const arrivalCopy = still() ? 1 : smooth((passage - .88) / .12);
    opacity(details, arrivalCopy); opacity(navigation, arrivalCopy); opacity(index, arrivalCopy);
    navigation.inert = index.inert = details.inert = !arrived;
    opacity(heading, still() ? 1 : smooth((passage - .45) / .22));
    const extraScroll = Math.max(0, y - end);
    const middleSource = sources.get(actors[initial].dataset.productId!) ?? [...sources.values()][0];
    actors.forEach((actor, i) => {
      const d = distance(order.indexOf(i), phase, count), p = pose(d, spacing, vialHeight);
      const scale = p.scale * options.size / 100;
      actor.style.transform = `translate3d(${p.x}px,${p.y}px,0) scale(${scale})`;
      const onscreen = Math.abs(p.x) - vialWidth * p.scale / 2 < width / 2 + 8;
      actor.style.visibility = onscreen ? "visible" : "hidden";
      actor.style.opacity = "1";
      images[i].style.opacity = arrived || story ? "1" : "0";
      shadows[i].style.opacity = String(arrivalDetail);
      if (!inFlight || !middleSource) return;
      const source = sources.get(actor.dataset.productId!), origin = source ?? middleSource;
      const glass = travelers[i], q = smooth(passage);
      // Keep the hero's own lighting on departure. The new room light takes
      // over only below the frame, so the side vials never flash brighter.
      glass.style.filter = passage < .5 ? `brightness(${origin.light})` : "none";
      const toHeight = vialHeight * p.scale, toFoot = baseFoot + p.y;
      const glassHeight = mix(origin.height, toHeight, q);
      const x = mix(origin.x, width / 2 + p.x, q);
      const trough = Math.max(origin.foot, toFoot, height + end * .5 + glassHeight) + height * (.8 + options.dip / 100);
      const foot = passageFoot(passage, origin.foot, toFoot, end, trough) - passage * end - extraScroll;
      glass.style.transform = `translate3d(${x - glassHeight * 578 / 1112 / 2}px,${foot - glassHeight}px,0) scale(${glassHeight / 1112})`;
      glass.style.visibility = (passage < .5 ? !!source : onscreen) ? "visible" : "hidden";
    });
    // The caption has a fixed shared footprint, including the longest name. Its
    // destination cannot change underneath a focused link.
    // Keep the name readable for most of the slow pass. Change it only in the
    // quiet gap between center positions, never with a visible text pop.
    const captionStrength = still() || frozen ? 1 : 1 - smooth((Math.abs(phase - Math.round(phase)) - .38) / .12);
    captions.forEach((caption, i) => { caption.style.opacity = i === active ? String(captionStrength) : "0"; });
    const cameraProgress = still() ? 1 : smooth(passage / .60), zoom = 1 + (options.depth - 1) * cameraProgress;
    const cx = width * .5 * (1 - zoom), cy = height * .24 * (1 - zoom) + height * .94 * cameraProgress;
    const worldOpacity = story ? 0 : 1 - smooth((y - sectionEnd + height * .4) / (height * .9));
    opacity(world, worldOpacity);
    room.style.transform = `translate3d(${plateX * zoom + cx}px,${plateY * zoom + cy}px,0) scale(${zoom})`;
    if (!story) {
      // CSS scroll animations relinquish this camera while Procession owns it.
      camera.style.transform = still() ? "none" : `translate3d(${cx}px,${y + cy}px,0) scale(${zoom})`;
      opacity(camera, still() ? 1 : 1 - smooth(passage / .5));
      const words = still() ? 1 : 1 - smooth(passage / .24);
      opacity(word, words); opacity(copy, words); opacity(cue, words);
      opacity(lead, still() ? 1 : smooth((passage - .18) / .2));
      camera.style.pointerEvents = passage > .06 && !still() ? "none" : "";
    }
    emit(arrived);
    const progressing = Math.abs(requested - passage) > .00015;
    const cycling = running && !dragging && !frozen && (!paused && visible || Math.abs(phase - target) > .0001 || Math.abs(velocity) > .001);
    if (progressing || cycling) schedule(); else last = 0;
  }
  function schedule() { if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(draw); }
  function resize() { dirty = true; schedule(); }
  function setTarget(value: number) {
    if (driftVelocity) velocity = driftVelocity;
    driftVelocity = 0;
    paused = true; frozen = false; elapsed = 0; target = value;
    if (still() || !visible) { phase = target; velocity = 0; }
    schedule();
  }
  function step(direction: number) { setTarget(Math.round(target) + direction); }
  function select(i: number) { setTarget(phase + distance(order.indexOf(i), phase, count)); }
  function toggle() { paused = !paused; frozen = paused; driftVelocity = 0; last = 0; schedule(); }
  function pauseAutoplay() {
    // Focus can arrive after the click that starts a manual glide. It stops
    // autoplay, but must not cancel that explicitly requested destination.
    if (!paused) frozen = true;
    paused = true; schedule();
  }
  function focus(event: FocusEvent) {
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
    }
    last = 0; dirty = true; schedule();
  }
  let pointer: { id: number; x: number; y: number; phase: number; time: number; lastX: number } | undefined;
  function down(e: PointerEvent) {
    if (e.button !== 0 || !priorArrival) return;
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, phase, time: e.timeStamp, lastX: e.clientX };
  }
  function move(e: PointerEvent) {
    if (!pointer || pointer.id !== e.pointerId) return;
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    if (!dragging) {
      if (Math.abs(dy) > Math.abs(dx) + 6) { pointer = undefined; return; }
      if (Math.abs(dx) < 8) return;
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
    }
    dragging = false; pointer = undefined; delete stage.dataset.dragging; schedule();
  }
  const resized = new ResizeObserver(resize);
  for (const el of [hero, plate, section, stage]) resized.observe(el);
  const observer = new MutationObserver(stateChange);
  observer.observe(opening, { attributes: true, attributeFilter: ["data-story", "data-seq"], childList: true, subtree: true });
  const seen = new IntersectionObserver(([entry]) => { visible = entry.intersectionRatio >= .55; last = 0; schedule(); }, { threshold: [0, .55, 1] }); seen.observe(stage);
  window.addEventListener("scroll", schedule, { passive: true }); window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", stateChange);
  stage.addEventListener("pointerdown", down); stage.addEventListener("pointermove", move);
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
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
    setMotion(value: boolean) { moving = value; if (still()) { phase = target = Math.round(target); velocity = driftVelocity = 0; } schedule(); },
    destroy() {
      disposed = true; cancelAnimationFrame(frame); resized.disconnect(); observer.disconnect(); seen.disconnect();
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", stateChange);
      stage.removeEventListener("pointerdown", down); stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up); stage.removeEventListener("pointercancel", up);
      section.removeEventListener("focusin", focus); section.removeEventListener("tm-procession-control", labControl);
      layer.remove(); world.remove();
      for (const el of [camera, word, copy, cue, lead]) { el?.style.removeProperty("opacity"); el?.style.removeProperty("transform"); }
      camera.style.removeProperty("pointer-events");
      for (const key of ["procession", "processionFlight", "processionStill", "processionStory"]) delete home.dataset[key];
    },
  };
}
export type ProcessionController = ReturnType<typeof createProcession>;
