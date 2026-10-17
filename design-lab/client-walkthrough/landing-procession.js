/** Lab controls the selected production component; it does not paint a second copy. */
export function createProcessionStudy(frame, onState, onMotion) {
  const win = frame.contentWindow, doc = frame.contentDocument;
  let settings, raf = 0, start, resolve, disposed = false, pending;
  const section = () => doc.querySelector('.tm-procession');
  const control = (action, value) => section()?.dispatchEvent(new win.CustomEvent('tm-procession-control', { detail: { action, value } }));
  const end = () => {
    const node = section(), headerEl = doc.querySelector('.tm-header');
    const header = headerEl ? headerEl.offsetHeight + (parseFloat(win.getComputedStyle(headerEl).top) || 0) : 80;
    return node ? Math.max(1, Math.ceil(node.getBoundingClientRect().top + win.scrollY - header - 24)) : 1;
  };
  function stopPreview() { win.cancelAnimationFrame(raf); raf = 0; start = undefined; resolve?.(); resolve = undefined; }
  function status(event) {
    const s = event.detail;
    onState(s.reduced ? 'Still collection · motion is off' : s.arrived ? 'Procession · selected for the local page' : 'Follow the same collection into the catalog', s.progress);
    onMotion({ ...s, playing: !s.paused && !s.reduced && s.arrived, reason: s.reduced ? 'Still' : s.paused ? 'Paused' : s.arrived ? 'Playing' : 'Waiting for arrival', progress: s.motionProgress ?? 0 });
  }
  function apply() { if (settings) control('options', settings); if (pending && section()) { const part = pending; pending = undefined; jump(part); } }
  const observer = new win.MutationObserver(apply); observer.observe(doc.body, { childList: true, subtree: true });
  doc.addEventListener('tm-procession-status', status);
  function interrupt(e) { if (e.type !== 'keydown' || ['Escape','ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key)) stopPreview(); }
  win.addEventListener('wheel', interrupt, { passive: true }); win.addEventListener('touchstart', interrupt, { passive: true }); win.addEventListener('keydown', interrupt);
  function jump(part) {
    stopPreview();
    if (!section()) { pending = part; if (win.location.pathname !== '/') win.location.assign('/?offer=off'); return; }
    const close = doc.querySelector('.tm-mist[data-story] .tm-story-close');
    if (close) { close.click(); pending = part; return; }
    win.scrollTo({ top: part === 'hero' ? 0 : end() * (part === 'passage' ? .5 : 1), behavior: settings?.still ? 'instant' : 'smooth' });
  }
  return {
    update(value) { settings = value; apply(); }, jump, stopPreview,
    scrub(progress) { stopPreview(); win.scrollTo({ top: progress * end(), behavior: 'instant' }); },
    motionControl(action, value) { if (action === 'replay') { control('next'); } else control(action, value); },
    playPassage() {
      stopPreview(); if (settings?.still) { jump('classes'); return Promise.resolve(); }
      control('reset', { play: true }); win.scrollTo({ top: 0, behavior: 'instant' });
      return new Promise(done => {
        resolve = done;
        const play = now => {
          if (disposed) return;
          start ??= now; const t = Math.min(1, (now - start) / 6000), q = t * t * (3 - 2 * t);
          win.scrollTo({ top: q * end(), behavior: 'instant' });
          if (t < 1) raf = win.requestAnimationFrame(play); else stopPreview();
        };
        raf = win.requestAnimationFrame(play);
      });
    },
    preserveScroll(change) {
      const old = end(), progress = Math.min(1, win.scrollY / old), extra = Math.max(0, win.scrollY - old);
      change(); win.requestAnimationFrame(() => win.requestAnimationFrame(() => { if (!disposed) win.scrollTo({ top: end() * progress + extra, behavior: 'instant' }); }));
    },
    destroy() { disposed = true; stopPreview(); observer.disconnect(); doc.removeEventListener('tm-procession-status', status); win.removeEventListener('wheel', interrupt); win.removeEventListener('touchstart', interrupt); win.removeEventListener('keydown', interrupt); },
  };
}
