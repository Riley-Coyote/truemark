/** Same-origin presentation bridge. Only explicit landing interactions are shared; forms and credentials stay independent. */
export function mapScroll(y, source, target) {
  const destinations = new Map(target.map((point) => [point.key, point.y]));
  const pairs = source.filter((point) => destinations.has(point.key))
    .map((point) => ({ a: point.y, b: destinations.get(point.key) }))
    .sort((a, b) => a.a - b.a);
  // Responsive layouts may reorder content. Keep only monotonic landmarks.
  const ordered = [];
  for (const point of pairs) {
    if (!ordered.length || (point.a > ordered.at(-1).a && point.b >= ordered.at(-1).b)) ordered.push(point);
  }
  if (ordered.length < 2) return 0;
  for (let i = 1; i < ordered.length; i++) {
    const left = ordered[i - 1], right = ordered[i];
    if (y <= right.a) {
      const progress = Math.max(0, Math.min(1, (y - left.a) / Math.max(1, right.a - left.a)));
      return left.b + progress * (right.b - left.b);
    }
  }
  return ordered.at(-1).b;
}

function landmarks(win) {
  const doc = win.document;
  const max = Math.max(0, doc.documentElement.scrollHeight - win.innerHeight);
  const points = [{ key: 'start', y: 0 }];
  const seen = new Set();
  const openingEnd = Number(doc.querySelector('.tm-procession')?.dataset.scrollEnd || 0);
  if (openingEnd) points.push({ key: 'opening-end', y: openingEnd });
  for (const el of doc.querySelectorAll('main section, main h1, main h2, footer')) {
    if (el.parentElement.closest('section') || el.closest('.tm-seq-overlay, .tm-seq') || !el.getClientRects().length || el.closest('[aria-hidden="true"], [role="dialog"]')) continue;
    const name = el.id || el.getAttribute('aria-labelledby') || el.getAttribute('aria-label') ||
      (el.matches('h1,h2') ? el.textContent.trim().replace(/\s+/g, ' ') : el.querySelector('h1,h2')?.textContent.trim().replace(/\s+/g, ' '));
    if (!name) continue;
    const key = el.tagName + ':' + name;
    const y = Math.max(0, el.getBoundingClientRect().top + win.scrollY - 80);
    if (!seen.has(key) && y > openingEnd && y < max) {
      points.push({ key, y });
      seen.add(key);
    }
  }
  points.push({ key: 'end', y: max });
  return points.sort((a, b) => a.y - b.y);
}

export function createCompareSync() {
  const frames = new Map();
  let enabled = false, leader = null, raf = 0, forwarding = false;
  const cancel = () => { cancelAnimationFrame(raf); raf = 0; };
  function align() {
    raf = 0;
    if (!enabled || !leader || !frames.has(leader)) return;
    const source = frames.get(leader);
    if (!source.win.document.body) return;
    const from = landmarks(source.win);
    for (const [id, target] of frames) {
      if (id === leader || target.win.location.href !== source.win.location.href) continue;
      const y = mapScroll(source.win.scrollY, from, landmarks(target.win));
      if (Math.abs(target.win.scrollY - y) > 1) {
        target.expected = y;
        target.win.scrollTo({ top: y, behavior: 'instant' });
      }
    }
  }
  function queue() { if (!raf) raf = requestAnimationFrame(align); }
  return {
    setEnabled(value) {
      enabled = value;
      if (value) queue();
      else {
        cancel();
        for (const { win } of frames.values()) win.dispatchEvent?.(new win.Event('tm-story-release'));
      }
    },
    attach(id, win) {
      frames.get(id)?.detach();
      const claim = () => { leader = id; };
      const scroll = () => {
        const current = frames.get(id);
        if (!current) return;
        // A responsive follower can emit several scroll events while its layout
        // settles. Only real input may take leadership; those follow-up events
        // must never pull the reader back toward an older position.
        if (current.expected !== null && Math.abs(win.scrollY - current.expected) <= 2) {
          current.expected = null;
          return;
        }
        current.expected = null;
        if (leader !== id) return;
        queue();
      };
      const story = event => {
        if (!enabled || forwarding || leader !== id) return;
        forwarding = true;
        try {
          for (const [other, target] of frames) {
            if (other === id || target.win.location.href !== win.location.href) continue;
            target.win.dispatchEvent(new target.win.CustomEvent('tm-story-follow', { detail: event.detail }));
          }
        } finally { forwarding = false; }
      };
      const click = event => {
        if (!enabled || forwarding || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const node = event.target.closest?.('.tm-mist a.tm-room-vial, .tm-proom-back');
        if (!node) return;
        leader = id;
        forwarding = true;
        try {
          for (const [other, target] of frames) {
            if (other === id) continue;
            const selector = node.matches('.tm-proom-back') ? '.tm-proom-back' :
              `.tm-mist a.tm-room-vial[data-product-id="${CSS.escape(node.dataset.productId)}"]`;
            target.win.document.querySelector(selector)?.click();
          }
        } finally { forwarding = false; }
      };
      win.addEventListener('click', click);
      win.addEventListener('tm-story-state', story);
      const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
      for (const event of events) win.addEventListener(event, claim, { passive: true, capture: true });
      win.addEventListener('scroll', scroll, { passive: true });
      win.addEventListener('resize', queue);
      const resize = new ResizeObserver(queue);
      resize.observe(win.document.body);
      const detach = () => {
        for (const event of events) win.removeEventListener(event, claim, true);
        win.removeEventListener('click', click);
        win.removeEventListener('tm-story-state', story);
        win.removeEventListener('scroll', scroll);
        win.removeEventListener('resize', queue);
        resize.disconnect();
        frames.delete(id);
        if (leader === id) leader = frames.keys().next().value || null;
      };
      frames.set(id, { win, detach, expected: null });
      if (!leader) leader = id;
      queue();
      return detach;
    },
    destroy() { cancel(); for (const frame of [...frames.values()]) frame.detach(); },
  };
}
