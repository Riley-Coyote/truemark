/** The same glass travels from the hero into Procession. Local lab only. */
export function createVialPassage(doc, plate, motion) {
  const win = doc.defaultView, root = doc.documentElement;
  const layer = doc.createElement('div');
  layer.className = 'lc-vial-passage'; layer.setAttribute('aria-hidden', 'true');
  doc.body.append(layer);
  const glass = new Map();
  const clamp = n => Math.max(0, Math.min(1, n));
  // Use the existing motion study's smooth, reversible camera interpolation.
  const ease = n => { n = clamp(n); return n * n * n * (n * (n * 6 - 15) + 10); };
  const mix = (a, b, t) => a + (b - a) * t;

  function suspend() {
    delete root.dataset.lcCarry; delete root.dataset.lcFlight;
    layer.replaceChildren(); glass.clear();
  }

  return {
    draw({ enabled, progress, settings, geometry }) {
      if (!enabled) { if (root.hasAttribute('data-lc-carry')) suspend(); return; }
      root.dataset.lcCarry = '';
      const t = clamp(progress), returningAt = settings.returnAt / 100;
      const exitAt = .42;
      // At this point the entire vial, including its cap, is below the frame.
      // Rewinding after a class cycle can restore the opening lineup invisibly.
      if (t <= exitAt + .02) motion.resetArrival();
      root.toggleAttribute('data-lc-flight', t > 0 && t < 1);
      root.style.setProperty('--lc-arrival-image', t >= 1 ? '1' : '0');
      root.style.setProperty('--lc-arrival-detail', ease((t - .86) / .14));
      root.style.setProperty('--lc-arrival-copy', ease((t - .94) / .06));
      root.style.setProperty('--lc-arrival-copy-visibility', t >= .94 ? 'visible' : 'hidden');
      root.style.setProperty('--lc-arrival-controls-visibility', t >= 1 ? 'visible' : 'hidden');
      layer.dataset.progress = t.toFixed(4);
      if (t === 0 || t === 1) return;

      const originals = new Map([...plate.querySelectorAll('.tm-room-vial')].map(el => [el.dataset.productId, el]));
      const center = [...originals.values()][Math.floor(originals.size / 2)];
      if (!center) return;
      const { left, top, width, height } = geometry;
      const targets = motion.arrivalTargets();
      for (const target of targets) {
        const original = originals.get(target.id), source = original || center;
        let image = glass.get(target.id);
        if (!image) {
          image = doc.createElement('img'); image.className = 'lc-passage-glass';
          image.dataset.productId = target.id; image.alt = ''; image.draggable = false;
          // Both ends use this exact, original transparent product artwork.
          image.src = target.image.src; image.width = 578; image.height = 1112;
          glass.set(target.id, image); layer.append(image);
        }
        const isVisible = t < returningAt ? !!original : target.visible;
        image.style.visibility = isVisible ? 'visible' : 'hidden';
        const box = target.image.getBoundingClientRect();
        const sx = left + width * Number(source.style.getPropertyValue('--seat-x'));
        const sy = top + height * Number(source.style.getPropertyValue('--seat-y'));
        const sh = height * Number(source.style.getPropertyValue('--vial-h'));
        const q = ease(t), dh = mix(sh, box.height, q), dw = dh * 578 / 1112;
        const x = mix(sx, box.left + box.width / 2, q);
        // The trough is measured from the cap, not the vial's foot: every
        // silhouette clears the viewport, at every responsive size.
        const below = win.innerHeight + dh + win.innerHeight * settings.dip / 100;
        const foot = t < exitAt
          ? mix(sy, below, ease(t / exitAt))
          : t < returningAt ? below
          : mix(below, box.bottom, ease((t - returningAt) / (1 - returningAt)));
        image.style.transform = `translate3d(${(x - dw / 2).toFixed(3)}px,${(foot - dh).toFixed(3)}px,0) scale(${(dh / 1112).toFixed(7)})`;
        // No opacity dissolve or label substitution while the vial travels.
        const light = Number(source.style.getPropertyValue('--tm-lit')) || 1;
        image.style.filter = `brightness(${mix(light, 1, q).toFixed(4)})`;
      }
    },
    suspend,
    destroy() { suspend(); layer.remove(); },
  };
}
