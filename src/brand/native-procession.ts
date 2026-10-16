import { FOG_SCENES, pedestalCrop } from './fog/scenes';
import type { ProcessionStatus } from './procession-controller';

/** Mobile uses the browser's scroller, not a JS camera or a pointer-driven spring.
 * No vertical scroll subscription, fixed travelers, or per-frame style writes. */
export function createNativeProcession(section: HTMLElement, order: number[], initial: number, report: (s: ProcessionStatus) => void) {
  const home = section.closest<HTMLElement>('.tm-home')!;
  const opening = home.querySelector<HTMLElement>('.tm-mist')!;
  const stage = section.querySelector<HTMLElement>('.tm-procession-stage')!;
  const actors = [...stage.querySelectorAll<HTMLElement>('.tm-procession-actor')];
  const plate = opening.querySelector<HTMLElement>('.tm-room-plate');
  const posterImage = plate?.querySelector<HTMLImageElement>('.tm-room-still');
  const saved = actors.map(actor => actor.getAttribute('style'));
  let active = initial, moving = true, paused = false, visible = false, touching = false, dead = false;
  let timer = 0, frame = 0, direction = 1, measuredWidth = 0, centers: number[] = [];
  home.setAttribute('data-procession', '');
  home.setAttribute('data-procession-native', '');
  home.setAttribute('data-procession-still', '');
  actors.forEach((actor, i) => {
    actor.style.cssText = `order:${order.indexOf(i)}`;
  });
  const emit = () => {
    actors.forEach((actor, i) => actor.toggleAttribute('data-current', i === active));
    section.dataset.active = String(active);
    section.dataset.passage = '1';
    report({active, paused, reduced: !moving, arrived: true, progress: 100});
  };
  const stop = () => { window.clearTimeout(timer); timer = 0; };
  const canPlay = () => moving && !paused && visible && !touching && !document.hidden && !opening.hasAttribute('data-story');
  function schedule() {
    stop();
    if (!dead && canPlay()) timer = window.setTimeout(() => {
      timer = 0;
      if (!canPlay()) return;
      let index = order.indexOf(active) + direction;
      if (index < 0 || index >= order.length) { direction *= -1; index = order.indexOf(active) + direction; }
      go(order[index]);
    }, 6500);
  }
  function go(i: number) {
    if (!centers.length || dead) return;
    stage.scrollTo({left: centers[i], behavior: moving ? 'smooth' : 'instant'});
    schedule();
  }
  function measure() {
    const width = stage.clientWidth;
    // Browser toolbar height changes never reposition a finger's collection.
    const widthChanged = width !== measuredWidth;
    measuredWidth = width;
    const ordered = order.map(i => actors[i]);
    centers = actors.map(actor => actor.offsetLeft + actor.offsetWidth / 2 - width / 2);
    // Preserve the real room's photographed support, at its original glass/rim ratio.
    const poster = posterImage?.currentSrc || posterImage?.src;
    const source = plate?.querySelector<HTMLElement>(`.tm-room-vial[data-product-id="${actors[initial].dataset.productId}"]`);
    const scene = opening.dataset.shape === 'tall' ? FOG_SCENES.collectionTall : FOG_SCENES.collection;
    const crop = pedestalCrop(scene, opening.dataset.shape === 'tall' ? 1 : 2);
    const sourceHeight = (Number(source?.style.getPropertyValue('--vial-h')) || .18) * scene.room.h;
    const seat = (Number(source?.style.getPropertyValue('--seat-y')) || crop.frontTop / scene.room.h) * scene.room.h;
    const cropWidth = crop.half * 2, cropHeight = crop.frontTop + .45 * (crop.base - crop.frontTop) - crop.backTop;
    for (const actor of ordered) {
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
    if (widthChanged) stage.scrollTo({left: centers[active], behavior: 'instant'});
  }
  function scrolled() {
    // One read and, only at a class boundary, one semantic update. The browser
    // owns every intermediate momentum frame and the final snap position.
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      const left = stage.scrollLeft;
      const next = centers.reduce((best, x, i) => Math.abs(x - left) < Math.abs(centers[best] - left) ? i : best, active);
      if (next !== active) { active = next; emit(); }
    });
    schedule(); // Never advance automatically during native momentum.
  }
  const contact = () => { touching = true; stop(); };
  const release = () => { touching = false; schedule(); };
  const wheel = () => schedule();
  const focus = (e: FocusEvent) => { if ((e.target as HTMLElement).matches(':focus-visible')) pauseAutoplay(); };
  function pauseAutoplay() { paused = true; stop(); emit(); }
  function select(i: number) { pauseAutoplay(); go(i); }
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
    select, step(by: number) { select(order[Math.max(0, Math.min(order.length - 1, order.indexOf(active) + by))]); }, pauseAutoplay,
    toggle() { paused = !paused; emit(); schedule(); },
    setMotion(value: boolean) { moving = value; emit(); schedule(); },
    destroy() {
      dead = true; stop(); cancelAnimationFrame(frame); resized.disconnect(); seen.disconnect(); story.disconnect();
      stage.removeEventListener('scroll', scrolled); stage.removeEventListener('touchstart', contact);
      stage.removeEventListener('touchend', release); stage.removeEventListener('touchcancel', release);
      stage.removeEventListener('wheel', wheel); section.removeEventListener('focusin', focus);
      document.removeEventListener('visibilitychange', schedule); posterImage?.removeEventListener('load', measure);
      actors.forEach((actor, i) => { actor.removeAttribute('data-current'); saved[i] === null ? actor.removeAttribute('style') : actor.setAttribute('style', saved[i]!); });
      for (const key of ['procession', 'processionNative', 'processionStill']) delete home.dataset[key];
    },
  };
}
