import { art, makeArt } from './landing-art.js';
import { createCollection } from './landing-collection.js';
import { createMotionStudy, isMotionStudy } from './landing-motion.js';
import { createVialPassage } from './landing-passage.js';
import { createProcessionStudy } from './landing-procession.js';

/** A disposable DOM study over the real preview, never imported by the app. */
export function createLandingScene(frame, onState, onMotion) {
  if (!new URL(frame.contentWindow.location.href).searchParams.has('collection')) return createProcessionStudy(frame, onState, onMotion);
  const win = frame.contentWindow, doc = frame.contentDocument, root = doc.documentElement;
  const css = doc.createElement('link'); css.rel = 'stylesheet'; css.href = '/design-lab/client-walkthrough/landing-study.css'; doc.head.append(css);
  const collectionCss = doc.createElement('link'); collectionCss.rel = 'stylesheet'; collectionCss.href = '/design-lab/client-walkthrough/landing-collection.css'; doc.head.append(collectionCss);
  const motionCss = doc.createElement('link'); motionCss.rel = 'stylesheet'; motionCss.href = '/design-lab/client-walkthrough/landing-motion.css'; doc.head.append(motionCss);
  let settings, before = false, home, stage, plate, index, world, room, fog, collection, motion, passage, ready = false, raf = 0, disposed = false, pendingJump;
  let previewRaf = 0, finishPreview;
  const reduce = win.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = n => Math.min(1, Math.max(0, n));
  const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
  const resized = new win.ResizeObserver(schedule);
  const observer = new win.MutationObserver(() => {
    mount(); schedule();
    if (pendingJump && ready && !home?.querySelector('.tm-mist[data-story]')) {
      const part = pendingJump; pendingJump = undefined; jump(part);
    }
  });
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-seq', 'data-story'] });

  function mount() {
    const next = doc.querySelector('.tm-home');
    if (next === home && home?.isConnected) return;
    stopPreview(); resized.disconnect(); world?.remove(); passage?.destroy(); collection?.destroy(); motion?.destroy(); home = next; ready = false;
    delete root.dataset.lcActive;
    if (!home) { onState(win.location.pathname === '/' ? 'Loading the local storefront…' : 'Exploring the preview · Hero returns to the study'); return; }
    stage = home.querySelector('.tm-mist-stage'); plate = stage?.querySelector('.tm-room-plate'); index = home.querySelector('.tm-index');
    if (!stage || !plate || !index) { home = null; return; }
    world = doc.createElement('div'); world.className = 'lc-world'; world.setAttribute('aria-hidden', 'true');
    const fill = doc.createElement('img'); fill.className = 'lc-world-fill'; fill.alt = '';
    room = doc.createElement('img'); room.className = 'lc-world-room'; room.alt = ''; room.decoding = 'async';
    fog = doc.createElement('img'); fog.className = 'lc-world-mist'; fog.alt = ''; fog.src = '/design-photography/04-studio-backgrounds/fog-overlays/fgw--da413182.png';
    fog.onerror = () => { fog.hidden = true; onState('Mist reference unavailable · room remains usable'); };
    room.onload = () => { if (!disposed) { ready = true; apply(); if (pendingJump) { const part = pendingJump; pendingJump = undefined; jump(part); } } };
    room.onerror = () => { ready = false; delete root.dataset.lcActive; onState('Room image unavailable · showing the original landing'); };
    world.append(fill, room, fog); home.append(world);
    collection = createCollection(doc, index);
    motion = createMotionStudy(doc, index, onMotion);
    passage = createVialPassage(doc, plate, motion);
    if (settings) motion.update(settings);
    resized.observe(stage); resized.observe(plate); resized.observe(index);
    const tall = win.matchMedia('(max-width:560px) and (max-aspect-ratio:11/10)').matches;
    room.src = fill.src = tall ? '/media/open-phone-crisp-4k.jpg' : '/media/open-crisp-4k.jpg';
  }

  function legacyArt() {
    for (const [i, card] of [...index.querySelectorAll('.tm-class')].entries()) {
      if (!art[i] || card.querySelector('.lc-art')) continue;
      card.append(makeArt(doc, art[i]));
      const cta = doc.createElement('span'); cta.className = 'lc-card-cta'; cta.setAttribute('aria-hidden', 'true');
      cta.append(doc.createTextNode('Explore class')); const arrow = doc.createElement('span'); arrow.textContent = '↗'; cta.append(arrow); card.append(cta);
    }
  }

  function apply() {
    if (!settings || !home) return;
    root.toggleAttribute('data-lc-active', ready && !before);
    root.dataset.lcCards = settings.cards;
    root.dataset.lcPassage = settings.passage;
    root.toggleAttribute('data-lc-motion', isMotionStudy(settings.cards));
    if (settings.cards !== 'collection' && !isMotionStudy(settings.cards)) legacyArt();
    motion?.update(settings);
    root.toggleAttribute('data-lc-still', settings.still || reduce.matches);
    root.style.setProperty('--lc-portrait-scale', settings.size / 100);
    root.style.setProperty('--lc-mist', settings.mist / 100);
    schedule();
  }

  function draw() {
    raf = 0;
    if (disposed || !stage?.isConnected || !ready || !settings) return;
    const y = win.scrollY, h = win.innerHeight;
    const r = stage.getBoundingClientRect(), w = r.width, sh = r.height;
    const still = settings.still || reduce.matches || !home.querySelector('.tm-mist')?.hasAttribute('data-seq');
    root.toggleAttribute('data-lc-still', still);
    const p = smooth(y / Math.max(sh * .92, 1));
    const activeStory = !!home.querySelector('.tm-mist[data-story]');
    if (still || activeStory) stopPreview();
    const carrying = settings.passage === 'carry' && settings.cards === 'procession' && !before && !still && !activeStory;
    const end = passageEnd();
    const arrival = y >= end - .5 ? 1 : clamp(y / end);
    // One camera transform for the original foreground and a persistent copy of
    // its exact photographic plate. No painted floor or white wipe at the join.
    const depth = settings.passage === 'soft' ? 1 + (settings.depth - 1) * .38 : settings.depth;
    const zoom = still ? 1 : 1 + (depth - 1) * p;
    const px = w * .5, py = sh * .31;
    const pw = plate.offsetWidth * 1.015, ph = plate.offsetHeight * 1.015;
    const pl = plate.offsetLeft - plate.offsetWidth * .0075, pt = plate.offsetTop - plate.offsetHeight * .0075;
    const top = r.top + y;
    const vials = [...plate.querySelectorAll('.tm-room-vial')];
    const featured = vials[Math.floor(vials.length / 2)];
    const seat = parseFloat(featured?.style.getPropertyValue('--seat-y')) || .5986;
    const vialHeight = parseFloat(featured?.style.getPropertyValue('--vial-h')) || .1792;
    // Rise past the collection: keep the glass solid while it travels out of
    // the frame, instead of washing the whole scene out to a pale surface.
    const startingCap = top + pt + ph * (seat - vialHeight);
    const finalCap = top + py * (1 - depth) + (pt + ph * (seat - vialHeight)) * depth;
    // Clear the foreground before the catalog enters. Previously the title
    // could rise through the still-visible vials at the midpoint of the move.
    const exitAt = .68;
    const targetCap = startingCap + (h + 64 - startingCap) / exitAt;
    const lift = Math.max(0, targetCap - finalCap);
    const elevation = lift * p;
    const cx = px * (1 - zoom), cy = y + py * (1 - zoom) + elevation;
    root.style.setProperty('--lc-camera-x', `${cx.toFixed(2)}px`);
    root.style.setProperty('--lc-camera-y', `${(still ? 0 : cy).toFixed(2)}px`);
    root.style.setProperty('--lc-camera-scale', zoom.toFixed(4));
    root.style.setProperty('--lc-object-opacity', still ? '1' : (1 - smooth((p - exitAt) / .17)).toFixed(4));
    root.style.setProperty('--lc-word-opacity', still ? '1' : (1 - smooth((p - .12) / .35)).toFixed(4));
    root.style.setProperty('--lc-lead-opacity', still ? '1' : smooth((p - .32) / .22).toFixed(4));
    root.style.setProperty('--lc-collection-opacity', still ? '1' : smooth((p - .64) / .18).toFixed(4));
    root.style.setProperty('--lc-collection-visibility', still || p >= .64 ? 'visible' : 'hidden');
    if (carrying) {
      root.style.setProperty('--lc-word-opacity', (1 - smooth((arrival - .06) / .29)).toFixed(4));
      root.style.setProperty('--lc-lead-opacity', smooth((arrival - .22) / .2).toFixed(4));
      root.style.setProperty('--lc-collection-opacity', smooth((arrival - .43) / .18).toFixed(4));
      root.style.setProperty('--lc-collection-visibility', arrival >= .43 ? 'visible' : 'hidden');
    }
    root.style.setProperty('--lc-room-softness', `${(p * 1.5).toFixed(2)}px`);
    root.style.setProperty('--lc-pointer', p > .4 && !still ? 'none' : 'auto');
    room.style.width = `${pw}px`; room.style.height = `${ph}px`;
    // Even in still mode the environment remains fixed; foreground scrolls in
    // the ordinary document flow. Background and text never depend on motion.
    const worldZoom = still ? depth : zoom;
    const x = r.left + px * (1 - worldZoom) + pl * worldZoom, sy = top + py * (1 - worldZoom) + pt * worldZoom + (still ? lift : elevation);
    // On a tall screen the upward camera travel can expose the photograph's
    // top edge. Feather that edge into an enlarged crop of the same wall.
    const edge = Math.max(0, sy) > 0 ? Math.min(240, (sy + h * .25) / worldZoom) * (still ? 1 : smooth(p / .3)) : 0;
    room.style.setProperty('--lc-room-edge', `${edge.toFixed(2)}px`);
    room.style.transform = `translate3d(${x.toFixed(2)}px,${sy.toFixed(2)}px,0) scale(${worldZoom.toFixed(4)})`;
    fog.style.setProperty('--lc-mist-drift', `${still ? 0 : Math.sin(y / Math.max(h, 1) * .65) * 34}px`);
    // The current landing keeps its paper trail and closing in daylight. Carry
    // the room through both, then let it settle into the existing opaque footer.
    const roomVisibility = smooth(home.getBoundingClientRect().bottom / Math.max(h * .6, 1));
    world.style.setProperty('--lc-world-opacity', activeStory ? '0' : roomVisibility.toFixed(3));
    passage?.draw({ enabled: carrying, progress: arrival, settings, geometry: { left: r.left + pl, top: top + pt, width: pw, height: ph } });
    motion?.context({ enabled: !before && isMotionStudy(settings.cards) && (carrying ? arrival >= 1 : still || p >= .82), story: activeStory, still });
    onState(before ? 'Original landing · comparison' : activeStory ? 'The existing “Look closer” story' : still ? 'Still preview · shared room' : carrying ? arrival < .02 ? 'Scroll to follow the same vials' : arrival < .42 ? 'The vials dip below the frame' : arrival < settings.returnAt / 100 ? 'Moving forward beneath the frame' : arrival < 1 ? 'The same collection rises into place' : 'Arrived · the collection can now cycle' : y < sh * .1 ? 'Scroll to move through the room' : y < sh * .85 ? 'The transition · one photographic space' : isMotionStudy(settings.cards) ? 'Local motion study · original vial artwork' : settings.cards === 'collection' ? 'Backup · not selected for the page' : 'Earlier study · not selected', Math.round(clamp(y / passageEnd()) * 100));
  }
  function schedule() { if (!raf && !disposed) raf = win.requestAnimationFrame(draw); }
  const onResize = () => {
    const src = win.matchMedia('(max-width:560px) and (max-aspect-ratio:11/10)').matches ? '/media/open-phone-crisp-4k.jpg' : '/media/open-crisp-4k.jpg';
    if (room && !room.src.endsWith(src)) { room.src = src; world.querySelector('.lc-world-fill').src = src; }
    schedule();
  };
  win.addEventListener('scroll', schedule, { passive: true }); win.addEventListener('resize', onResize); reduce.addEventListener('change', apply);
  mount();
  function passageEnd() {
    const top = (index?.getBoundingClientRect().top || 0) + win.scrollY;
    const header = doc.querySelector('.tm-header')?.getBoundingClientRect().height || 80;
    return Math.max(1, top - (settings?.passage === 'carry' ? header + 16 : 0));
  }
  function stopPreview() {
    win.cancelAnimationFrame(previewRaf); previewRaf = 0;
    finishPreview?.(); finishPreview = undefined;
  }
  const interruptPreview = event => {
    if (event.type !== 'keydown' || ['Escape', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) stopPreview();
  };
  win.addEventListener('wheel', interruptPreview, { passive: true });
  win.addEventListener('touchstart', interruptPreview, { passive: true });
  win.addEventListener('keydown', interruptPreview);
  function jump(part) {
    stopPreview();
    if (!home || !ready) {
      if (win.location.pathname === '/') pendingJump = part;
      else win.location.assign('/?offer=off');
      return;
    }
    const close = home.querySelector('.tm-mist[data-story] .tm-story-close');
    if (close) { pendingJump = part; close.click(); return; }
    const header = doc.querySelector('.tm-header')?.getBoundingClientRect().height || 80;
    const target = part === 'hero' ? 0 : part === 'passage' ? stage.offsetHeight * .43 : index.getBoundingClientRect().top + win.scrollY - header - 16;
    const still = settings.still || reduce.matches || !home.querySelector('.tm-mist')?.hasAttribute('data-seq');
    win.scrollTo({ top: target, behavior: still ? 'instant' : 'smooth' });
  }
  return {
    update(value, original) { stopPreview(); settings = value; before = original; mount(); apply(); },
    scrub(progress) { stopPreview(); if (index?.isConnected) win.scrollTo({ top: progress * passageEnd(), behavior: 'instant' }); },
    playPassage() {
      stopPreview();
      if (!ready || settings.still || reduce.matches || !home.querySelector('.tm-mist')?.hasAttribute('data-seq')) { jump('classes'); return Promise.resolve(); }
      if (home.querySelector('.tm-mist[data-story]')) { jump('hero'); return Promise.resolve(); }
      win.scrollTo({ top: 0, behavior: 'instant' }); passage?.suspend(); motion?.resetArrival();
      return new Promise(resolve => {
        finishPreview = resolve; let start;
        const play = now => {
          start ??= now;
          const t = clamp((now - start) / 6800);
          win.scrollTo({ top: smooth(t) * passageEnd(), behavior: 'instant' });
          if (t < 1) previewRaf = win.requestAnimationFrame(play); else stopPreview();
        };
        previewRaf = win.requestAnimationFrame(play);
      });
    },
    stopPreview,
    motionControl(action, value) { motion?.control(action, value); },
    jump,
    preserveScroll(change) {
      const y = win.scrollY, oldTop = index?.getBoundingClientRect().top;
      const inOpening = stage && y < stage.offsetHeight * .7;
      const ratio = stage ? y / stage.offsetHeight : 0;
      change();
      win.requestAnimationFrame(() => win.requestAnimationFrame(() => {
        if (disposed || !index?.isConnected) return;
        const target = inOpening ? ratio * stage.offsetHeight : win.scrollY + index.getBoundingClientRect().top - oldTop;
        win.scrollTo({ top: Math.max(0, target), behavior: 'instant' });
      }));
    },
    destroy() {
      stopPreview(); disposed = true; win.cancelAnimationFrame(raf); observer.disconnect(); resized.disconnect();
      win.removeEventListener('scroll', schedule); win.removeEventListener('resize', onResize); reduce.removeEventListener('change', apply);
      win.removeEventListener('wheel', interruptPreview); win.removeEventListener('touchstart', interruptPreview); win.removeEventListener('keydown', interruptPreview);
      passage?.destroy(); collection?.destroy(); motion?.destroy(); world?.remove(); css.remove(); collectionCss.remove(); motionCss.remove(); delete root.dataset.lcActive; delete root.dataset.lcCards; delete root.dataset.lcPassage; delete root.dataset.lcStill; delete root.dataset.lcMotion;
    },
  };
}
