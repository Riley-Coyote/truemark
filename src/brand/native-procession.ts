import { FOG_SCENES, pedestalCrop, pedestalSeat } from './fog/scenes';
import type { ProcessionStatus } from './procession-controller';

/** How long the strip must lie still, with no finger on it, before it is moved from a copy to the middle. Native
 *  momentum and snapping report a scroll every frame, so a pause this long means they have finished. */
const SETTLE_MS = 160;

/** Mobile uses the browser's scroller, not a JS camera or a pointer-driven spring.
 * No vertical scroll subscription, fixed travelers, or per-frame style writes.
 *
 * It goes round. The classes stand three times over in one strip: a copy of the collection either side of the real
 * one, hidden from screen readers and out of reach of focus. A swipe either way, or the autoplay, carries on past the
 * last class into the first across the seam between two of them. Once the strip is at rest on a copy, it is moved at
 * once by one collection's length, onto the same class in the middle, drawn exactly as the copy was: nothing is seen
 * to move, and there is always a whole collection to go on into, either way. */
export function createNativeProcession(section: HTMLElement, order: number[], initial: number, report: (s: ProcessionStatus) => void) {
  const home = section.closest<HTMLElement>('.tm-home')!;
  const opening = home.querySelector<HTMLElement>('.tm-mist')!;
  const stage = section.querySelector<HTMLElement>('.tm-procession-stage')!;
  const actors = [...stage.querySelectorAll<HTMLElement>('.tm-procession-actor')];
  const plate = opening.querySelector<HTMLElement>('.tm-room-plate');
  const posterImage = plate?.querySelector<HTMLImageElement>('.tm-room-still');
  const saved = actors.map(actor => actor.getAttribute('style'));
  const count = order.length;
  // The strip, left to right: position p shows class order[p % count]; the first and last `count` are the copies.
  const strip = [-1, 0, 1].flatMap(copy => order.map((cls, k) => {
    const el = copy ? actors[cls].cloneNode(true) as HTMLElement : actors[cls];
    if (copy) {
      el.setAttribute('data-copy', '');
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('inert', '');
      stage.append(el);
    }
    el.style.cssText = `order:${k + copy * count}`;
    return {el, cls};
  }));
  const copies = strip.filter(({el, cls}) => el !== actors[cls]).map(({el}) => el);
  const middle = (cls: number) => count + order.indexOf(cls);
  let active = initial, slot = middle(initial), aim = -1;
  let moving = true, paused = false, visible = false, touching = false, dead = false;
  let timer = 0, settling = 0, waited = 0, frame = 0, measuredWidth = 0, centers: number[] = [];
  home.setAttribute('data-procession', '');
  home.setAttribute('data-procession-native', '');
  home.setAttribute('data-procession-still', '');
  const emit = () => {
    // Every copy of the centred class is drawn centred, so the move from a copy to the middle changes nothing.
    strip.forEach(({el, cls}) => el.toggleAttribute('data-current', cls === active));
    section.dataset.active = String(active);
    section.dataset.passage = '1';
    report({active, paused, reduced: !moving, arrived: true, progress: 100});
  };
  const stop = () => { window.clearTimeout(timer); timer = 0; };
  const canPlay = () => moving && !paused && visible && !touching && !document.hidden && !opening.hasAttribute('data-story');
  /** Where the strip is, or is on its way to. */
  const from = () => aim >= 0 ? aim : slot;
  const nearest = (left: number) => centers.reduce((best, x, p) => Math.abs(x - left) < Math.abs(centers[best] - left) ? p : best, slot);
  function schedule() {
    stop();
    if (!dead && canPlay()) timer = window.setTimeout(() => {
      timer = 0;
      if (canPlay()) go(from() + 1);
    }, 6500);
  }
  function rest() {
    window.clearTimeout(settling);
    settling = dead ? 0 : window.setTimeout(settle, SETTLE_MS);
  }
  function settle() {
    settling = 0;
    if (dead || touching || !centers.length) return;
    const left = stage.scrollLeft, at = nearest(left), copy = Math.floor(at / count) - 1;
    // Not yet snapped (WebKit snaps a while after a scroll that stops between vials): moving now would make that snap
    // a jump. Its own scrolling comes first, and brings the strip back here.
    if (Math.abs(left - centers[at]) > 1.5 && waited++ < 12) { rest(); return; }
    aim = -1; waited = 0; slot = at;
    if (!copy) return;
    slot = at - copy * count;
    stage.scrollTo({left: left + centers[slot] - centers[at], behavior: 'instant'});
  }
  function go(p: number) {
    if (!centers.length || dead) return;
    aim = Math.max(0, Math.min(strip.length - 1, p));
    stage.scrollTo({left: centers[aim], behavior: moving ? 'smooth' : 'instant'});
    rest(); // Never settle before this scroll has begun.
    schedule();
  }
  function measure() {
    const width = stage.clientWidth;
    // Browser toolbar height changes never reposition a finger's collection.
    const widthChanged = width !== measuredWidth;
    measuredWidth = width;
    // Unrounded, so a copy and its twin in the middle are exactly one collection's length apart.
    const origin = stage.getBoundingClientRect().left + stage.clientLeft - stage.scrollLeft;
    centers = strip.map(({el}) => { const box = el.getBoundingClientRect(); return box.left + box.width / 2 - origin - width / 2; });
    // Preserve the real room's photographed support, at its original glass/rim ratio. Every vial stands as the room's
    // own vial stands on the centre pedestal the crop shows, whichever class the strip begins on.
    const poster = posterImage?.currentSrc || posterImage?.src;
    const tall = opening.dataset.shape === 'tall';
    const scene = tall ? FOG_SCENES.collectionTall : FOG_SCENES.collection;
    const crop = pedestalCrop(scene, tall ? 1 : 2);
    const seated = pedestalSeat(scene, tall ? 1 : 2, [...plate?.querySelectorAll<HTMLElement>('.tm-room-vial') ?? []].map(vial => ({
      x: Number(vial.style.getPropertyValue('--seat-x')), y: Number(vial.style.getPropertyValue('--seat-y')), h: Number(vial.style.getPropertyValue('--vial-h')),
    })));
    const sourceHeight = seated?.height ?? .18 * scene.room.h;
    const seat = seated?.foot ?? crop.frontTop;
    const cropWidth = crop.half * 2, cropHeight = crop.frontTop + .45 * (crop.base - crop.frontTop) - crop.backTop;
    for (const {el: actor} of strip) {
      const plinth = actor.querySelector<HTMLElement>('.tm-procession-plinth')!;
      const percentWidth = cropWidth / (sourceHeight * 578 / 1112) * 100;
      const fadeDepth = sourceHeight * 66 / actor.offsetHeight * .9;
      const fadeStart = (seat + fadeDepth * .15 - crop.backTop) / cropHeight * 100;
      const fadeEnd = (seat + fadeDepth - crop.backTop) / cropHeight * 100;
      Object.assign(plinth.style, {
        width: `${percentWidth}%`, height: `${cropHeight / sourceHeight * 100}%`, left: `${(100 - percentWidth) / 2}%`,
        top: `${(1 - (seat - crop.backTop) / sourceHeight) * 100}%`, backgroundImage: poster ? `url("${poster}")` : 'none',
        backgroundSize: `${scene.room.w / cropWidth * 100}% ${scene.room.h / cropHeight * 100}%`,
        backgroundPosition: `${(crop.x - crop.half) / (scene.room.w - cropWidth) * 100}% ${crop.backTop / (scene.room.h - cropHeight) * 100}%`,
        maskImage: `linear-gradient(black ${fadeStart}%,transparent ${fadeEnd}%)`,
        clipPath: `inset(0 round 50% 50% 0 0 / ${crop.rimRadius / cropHeight * 100}% ${crop.rimRadius / cropHeight * 100}% 0 0)`,
      });
    }
    if (widthChanged) { aim = -1; slot = middle(active); stage.scrollTo({left: centers[slot], behavior: 'instant'}); }
  }
  function scrolled() {
    // One read and, only at a class boundary, one semantic update. The browser
    // owns every intermediate momentum frame and the final snap position.
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      slot = nearest(stage.scrollLeft);
      if (strip[slot].cls !== active) { active = strip[slot].cls; emit(); }
    });
    waited = 0; rest();
    schedule(); // Never advance automatically during native momentum.
  }
  const contact = () => { touching = true; aim = -1; stop(); window.clearTimeout(settling); settling = 0; };
  const release = () => { touching = false; rest(); schedule(); };
  const wheel = () => { aim = -1; schedule(); };
  const focus = (e: FocusEvent) => { if ((e.target as HTMLElement).matches(':focus-visible')) pauseAutoplay(); };
  function pauseAutoplay() { paused = true; stop(); emit(); }
  /** To a class: its nearest copy, so the strip never runs the long way round. */
  function select(cls: number) {
    pauseAutoplay();
    const start = from();
    go(strip.reduce((best, s, p) => s.cls === cls && Math.abs(p - start) < Math.abs(best - start) ? p : best, middle(cls)));
  }
  const resized = new ResizeObserver(measure); resized.observe(stage); if (plate) resized.observe(plate);
  posterImage?.addEventListener('load', measure);
  const seen = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }, {threshold: 0}); seen.observe(stage);
  const story = new MutationObserver(schedule); story.observe(opening, {attributes: true, attributeFilter: ['data-story']});
  stage.addEventListener('scroll', scrolled, {passive: true});
  stage.addEventListener('touchstart', contact, {passive: true});
  stage.addEventListener('touchend', release, {passive: true});
  stage.addEventListener('touchcancel', release, {passive: true});
  stage.addEventListener('wheel', wheel, {passive: true});
  section.addEventListener('focusin', focus);
  document.addEventListener('visibilitychange', schedule);
  measure(); emit();
  return {
    select, step(by: number) { pauseAutoplay(); go(from() + by); }, pauseAutoplay,
    toggle() { paused = !paused; emit(); schedule(); },
    setMotion(value: boolean) { moving = value; emit(); schedule(); },
    /** `keepOpening`: as the desktop controller's (procession-controller.ts). */
    destroy(keepOpening = false) {
      dead = true; stop(); window.clearTimeout(settling); cancelAnimationFrame(frame); resized.disconnect(); seen.disconnect(); story.disconnect();
      stage.removeEventListener('scroll', scrolled); stage.removeEventListener('touchstart', contact);
      stage.removeEventListener('touchend', release); stage.removeEventListener('touchcancel', release);
      stage.removeEventListener('wheel', wheel); section.removeEventListener('focusin', focus);
      document.removeEventListener('visibilitychange', schedule); posterImage?.removeEventListener('load', measure);
      copies.forEach(copy => copy.remove());
      actors.forEach((actor, i) => { actor.removeAttribute('data-current'); saved[i] === null ? actor.removeAttribute('style') : actor.setAttribute('style', saved[i]!); });
      if (!keepOpening) for (const key of ['procession', 'processionNative', 'processionStill']) delete home.dataset[key];
    },
  };
}
